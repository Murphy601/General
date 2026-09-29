#!/usr/bin/env node
// Builds Grade 4 lesson + exam records from content-authoring/grade-4/<subject>/ into web/data/content.
// Usage: node scripts/g4/build.mjs [--subject slug ...] [--dry]
// Writes: lesson records, exam records (4 tiers x 20), prunes duplicate/orphan old records,
// rewrites grade-4 topics of the subject in knowledge-base/phase5/curriculum-index.json,
// and updates web/data/content/index.json. Run once, after all subjects validate.
import { readFileSync, writeFileSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { SUBJECTS, loadLessons, loadBank } from './parse.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const CONTENT = join(ROOT, 'web', 'data', 'content');
const AUTH = join(ROOT, 'content-authoring', 'grade-4');
const CIDX = join(ROOT, 'knowledge-base', 'phase5', 'curriculum-index.json');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const only = args.flatMap((a, i) => (args[i - 1] === '--subject' ? [a] : []));
const slugs = only.length ? only : Object.keys(SUBJECTS);
const now = new Date().toISOString();

const TIERS = {
  general: { type: 'exam', label: 'General Assessment', marks: 30, mcq: 15, minutes: 45, access: 'free', price: 0, category: 'general' },
  termly: { type: 'termly-exam', label: 'Termly Exam', marks: 50, mcq: 20, minutes: 60, access: 'free', price: 50, category: 'termly' },
  mock: { type: 'mock-exam', label: 'Mock Exam', marks: 80, mcq: 30, minutes: 90, access: 'paid', price: 100, category: 'mock' },
  premium: { type: 'premium-exam', label: 'Premium Revision Paper', marks: 100, mcq: 40, minutes: 120, access: 'paid', price: 150, category: 'premium' },
};
const PAPERS_PER_TIER = 20;

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const ord = (n) => String(n).split('.').reduce((a, x, i) => a + (parseInt(x, 10) || 0) / 100 ** i, 0);
const slugify = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
const words = (s) => (s.match(/\S+/g) || []).length;
const LETTERS = 'ABCD';

function quizText(subject, topicName, quiz) {
  const out = [`${subject} — ${topicName.toUpperCase()} · REVISION QUIZ`, '====', '', 'Answer in your exercise book. Show your working. Then check with the Answers tab.', ''];
  for (const q of quiz) {
    out.push(`${q.n}. ${q.q}`);
    q.options.forEach((o, i) => out.push(`   ${LETTERS[i]}. ${o}`));
    out.push('');
  }
  return out.join('\n').trim() + '\n';
}
function answersText(subject, topicName, quiz) {
  const out = [`${subject} — ${topicName.toUpperCase()} · ANSWERS`, '====', ''];
  for (const q of quiz) {
    out.push(`${q.n}. ${q.answer}`);
    if (q.why) out.push(`   ${q.why.replace(/\n/g, '\n   ')}`);
    out.push('');
  }
  return out.join('\n').trim() + '\n';
}

function buildLesson(subject, slug, L, existingId, sourceExcerpt, order) {
  const title = `Grade 4 ${subject} — ${L.meta.topicName}`;
  const studyPages = L.pages.map((p, i) => ({
    pageNumber: p.pageNumber, title: p.title, free: i < 3,
    body: `${p.title.toUpperCase()}\n====\n\n${p.text}`.trim(),
  }));
  const lesson = studyPages.map((p) => `PAGE ${p.pageNumber}: ${p.title}\n${p.body}`).join('\n\n');
  const quiz = quizText(subject, L.meta.topicName, L.quiz);
  const answers = answersText(subject, L.meta.topicName, L.quiz);
  return {
    id: existingId || randomUUID(), type: 'topic-lesson', title,
    topic: {
      grade: 'grade-4', gradeLabel: 'Grade 4', subject, topicNumber: L.meta.topicNumber, topicOrder: order,
      topicName: L.meta.topicName, strandName: L.meta.strand || `Strand ${L.meta.topicNumber.split('.')[0]}`,
      slug: `${L.meta.topicNumber.replace(/\./g, '-')}-${slugify(L.meta.topicName)}`,
    },
    pages: { lesson, quiz, answers, studyPages, freePageCount: 3 },
    metadata: {
      createdAt: now, wordCount: words(lesson), reviewed: false, access: 'free', priceKes: 0,
      contentSource: 'g4-authored-v1', pageCount: studyPages.length, freePages: 3, freePageCount: 3, totalStudyPages: studyPages.length,
      figureCount: L.pages.reduce((a, p) => a + p.figures.length, 0),
    },
    sources: sourceExcerpt ? [{ id: 'kicd-grade-4-design', subject, grade: 'grade-4', excerpt: sourceExcerpt }] : [],
  };
}

// ---------- exams ----------
function shuffleOptions(q, rand) {
  const opts = q.options.map(String);
  if (opts.some((o) => /all of the above|none of the above|both .* and|a and b|zote hapo juu|hakuna/i.test(o))) return { options: opts, answer: q.answer };
  const idx = [0, 1, 2, 3];
  for (let i = 3; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return { options: idx.map((k) => opts[k]), answer: idx.indexOf(q.answer) };
}
function pick(pool, n, usage, rand, topicCap) {
  const byTopic = new Map();
  const chosen = [];
  const cand = pool.map((q) => ({ q, k: (usage.get(q) || 0) + rand() * 0.9 })).sort((a, b) => a.k - b.k);
  for (const { q } of cand) {
    if (chosen.length >= n) break;
    const t = String(q.topic);
    if ((byTopic.get(t) || 0) >= topicCap) continue;
    byTopic.set(t, (byTopic.get(t) || 0) + 1); chosen.push(q);
  }
  for (const { q } of cand) { if (chosen.length >= n) break; if (!chosen.includes(q)) chosen.push(q); }
  return chosen;
}
function pickShort(pool, target, usage, rand) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const cand = pool.map((q) => ({ q, k: (usage.get(q) || 0) + rand() * (attempt < 20 ? 0.9 : 6) })).sort((a, b) => a.k - b.k);
    const chosen = []; let left = target;
    for (const { q } of cand) {
      if (left === 0) break;
      if (q.marks <= left && (left - q.marks === 0 || left - q.marks >= 2)) { chosen.push(q); left -= q.marks; }
    }
    if (left === 0) return chosen;
  }
  throw new Error(`cannot assemble ${target} marks of short answers; add more varied-mark items`);
}
function examText(subject, tier, i, mcq, shorts, total, term) {
  const T = TIERS[tier];
  const out = [`${subject} — ${T.label.toUpperCase()} #${i}${term ? ` (TERM ${term})` : ''}`, '====', '',
    'GRADE: Grade 4', `SUBJECT: ${subject}`, `TIME ALLOWED: ${T.minutes} minutes`, `TOTAL MARKS: ${total}`, 'ASSESSMENT: CBC school-based practice paper', '',
    'INSTRUCTIONS', '----', '1. Answer all questions.', '2. For calculations, show your working and write the units.', '3. For multiple choice, choose the one best answer.', '4. Check your work before you hand in.', '',
    'SECTION A — MULTIPLE CHOICE', '----'];
  let n = 1;
  for (const q of mcq) { out.push(`${n}. ${q.q} (1 mark)`); q.options.forEach((o, k) => out.push(`   ${LETTERS[k]}. ${o}`)); out.push(''); n++; }
  out.push('SECTION B — STRUCTURED / SHORT ANSWERS', '----');
  for (const q of shorts) { out.push(`${n}. ${q.q} (${q.marks} mark${q.marks > 1 ? 's' : ''})`, ''); n++; }
  return out.join('\n').trim() + '\n';
}
function markingText(subject, tier, i, mcq, shorts, term) {
  const T = TIERS[tier];
  const out = [`${subject} — ${T.label.toUpperCase()} #${i}${term ? ` (TERM ${term})` : ''} · MARKING SCHEME`, '====', '', 'SECTION A', '----'];
  let n = 1;
  for (const q of mcq) { out.push(`${n}. ${LETTERS[q.answer]} — ${q.options[q.answer]}`); if (q.explanation) out.push(`   ${q.explanation}`); out.push(''); n++; }
  out.push('SECTION B', '----');
  for (const q of shorts) {
    out.push(`${n}. (${q.marks} marks)`, `   Answer: ${String(q.answer).replace(/\n/g, '\n   ')}`);
    if (q.working) out.push(`   Working / marking points: ${String(q.working).replace(/\n/g, '\n   ')}`);
    out.push(''); n++;
  }
  return out.join('\n').trim() + '\n';
}

function buildExams(subject, slug, bank, lessons, oldExams) {
  const rand = rng(hash(slug));
  const topics = [...new Set(lessons.map((l) => l.meta.topicNumber))].sort((a, b) => ord(a) - ord(b));
  const third = Math.ceil(topics.length / 3);
  const termOf = (t) => Math.min(3, Math.floor(topics.indexOf(t) / third) + 1);
  const usageM = new Map(); const usageS = new Map();
  const records = [];
  for (const [tier, T] of Object.entries(TIERS)) {
    const olds = oldExams.filter((e) => e.type === T.type).sort((a, b) => (a.topic.topicOrder || 0) - (b.topic.topicOrder || 0));
    for (let i = 1; i <= PAPERS_PER_TIER; i++) {
      const term = tier === 'termly' ? ((i - 1) % 3) + 1 : null;
      let mPool = bank.mcq, sPool = bank.short;
      if (term) {
        const m2 = bank.mcq.filter((q) => termOf(String(q.topic)) === term), s2 = bank.short.filter((q) => termOf(String(q.topic)) === term);
        if (m2.length >= T.mcq * 1.5 && s2.length >= 12) { mPool = m2; sPool = s2; }
      }
      const cap = Math.max(2, Math.ceil((T.mcq / topics.length) * 2));
      const mcqRaw = pick(mPool, T.mcq, usageM, rand, cap);
      const shorts = pickShort(sPool, T.marks - T.mcq, usageS, rand);
      mcqRaw.forEach((q) => usageM.set(q, (usageM.get(q) || 0) + 1));
      shorts.forEach((q) => usageS.set(q, (usageS.get(q) || 0) + 1));
      const ordered = tier === 'general' ? mcqRaw : [...mcqRaw].sort((a, b) => ord(a.topic) - ord(b.topic));
      const mcq = ordered.map((q) => { const s = shuffleOptions(q, rand); return { ...q, options: s.options, answer: s.answer }; });
      const old = olds[i - 1];
      records.push({
        id: old?.id || randomUUID(), type: T.type,
        title: `Grade 4 ${subject} — ${T.label} #${i}${term ? ` (Term ${term})` : ''}`,
        topic: { grade: 'grade-4', gradeLabel: 'Grade 4', subject, topicNumber: tier, topicOrder: i, slug: `grade-4-${slug}-${tier}-${i}` },
        pages: { lesson: '', quiz: examText(subject, tier, i, mcq, shorts, T.marks, term), answers: markingText(subject, tier, i, mcq, shorts, term), studyPages: [] },
        metadata: {
          createdAt: now, wordCount: 0, reviewed: false, access: T.access, priceKes: T.price, questionCount: mcq.length + shorts.length,
          category: T.category, term, contentSource: 'g4-authored-v1', paperTier: tier.toUpperCase(), paperIndex: i, totalMarks: T.marks,
        },
        sources: [{ id: 'g4-authored-lessons', subject, grade: 'grade-4', excerpt: `Questions drawn from the authored Grade 4 ${subject} lessons.` }],
      });
      const r = records[records.length - 1]; r.metadata.wordCount = words(r.pages.quiz);
    }
  }
  const reuse = [...usageM.values()];
  return { records, stats: { mcqUsed: usageM.size, mcqBank: bank.mcq.length, maxReuse: Math.max(...reuse), avgReuse: (reuse.reduce((a, b) => a + b, 0) / reuse.length).toFixed(1) } };
}

// ---------- main ----------
const idx = JSON.parse(readFileSync(join(CONTENT, 'index.json'), 'utf8'));
const cidx = JSON.parse(readFileSync(CIDX, 'utf8'));
const g4 = cidx.grades.find((g) => g.grade === 'grade-4');
const toDelete = new Set(); const toWrite = [];

function readRec(id) { try { return JSON.parse(readFileSync(join(CONTENT, id + '.json'), 'utf8')); } catch { return null; } }
const allG4 = new Map();
for (const r of idx) if (r.topic?.grade === 'grade-4') allG4.set(r.id, r);

for (const slug of slugs) {
  const subject = SUBJECTS[slug]; const dir = join(AUTH, slug);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const lessons = loadLessons(dir).filter((l) => l.meta);
  const bank = loadBank(dir);
  if (!lessons.length) { console.log(`skip ${slug}: no lessons`); continue; }
  const oldLessons = [...allG4.values()].filter((r) => r.topic.subject === subject && r.type === 'topic-lesson');
  const oldVideos = [...allG4.values()].filter((r) => r.topic.subject === subject && r.type === 'video-script');
  const oldExams = [...allG4.values()].filter((r) => r.topic.subject === subject && /exam/.test(r.type));
  const claimed = new Set(); const built = [];
  lessons.sort((a, b) => ord(a.meta.topicNumber) - ord(b.meta.topicNumber));
  lessons.forEach((L, i) => {
    const num = L.meta.topicNumber;
    const match = oldLessons.find((r) => !claimed.has(r.id) && r.topic.topicNumber === num);
    if (match) claimed.add(match.id);
    const src = match?.sources?.[0]?.excerpt || '';
    const rec = buildLesson(subject, slug, L, match?.id, src, ord(num) || i + 1);
    built.push(rec); toWrite.push(rec);
  });
  const keepIds = new Set(built.map((r) => r.id));
  for (const r of oldLessons) if (!keepIds.has(r.id)) toDelete.add(r.id);
  // video scripts: drop only those whose lesson is gone (their content is untouched otherwise)
  for (const v of oldVideos) if (v.metadata?.linkedLessonId && !keepIds.has(v.metadata.linkedLessonId)) toDelete.add(v.id);
  // curriculum index topics for this subject
  const cs = g4.subjects[subject] || (g4.subjects[subject] = { subject, fileIds: [], topics: [] });
  const fileId = cs.topics[0]?.fileId;
  cs.topics = built.map((r) => ({
    topicNumber: r.topic.topicNumber, topicOrder: r.topic.topicOrder, strandNumber: r.topic.topicNumber.split('.')[0], strandName: r.topic.strandName,
    topicName: r.topic.topicName, lessonCount: r.pages.studyPages.length, slug: r.topic.slug, grade: 'grade-4', subject, ...(fileId ? { fileId } : {}),
  }));
  if (bank.mcq.length && bank.short.length) {
    const { records, stats } = buildExams(subject, slug, bank, lessons, oldExams);
    const keep = new Set(records.map((r) => r.id));
    for (const e of oldExams) if (!keep.has(e.id)) toDelete.add(e.id);
    toWrite.push(...records);
    console.log(`${slug}: ${built.length} lessons, ${records.length} exams`, stats);
  } else console.log(`${slug}: ${built.length} lessons (no question bank yet — exams left untouched)`);
}

if (dry) { console.log(`dry run: would write ${toWrite.length}, delete ${toDelete.size}`); process.exit(0); }
const trunc = (s) => (s && s.length > 200 ? s.slice(0, 200) + '…' : s);
const written = new Set(toWrite.map((r) => r.id));
for (const r of toWrite) writeFileSync(join(CONTENT, r.id + '.json'), JSON.stringify(r, null, 2));
for (const id of toDelete) if (!written.has(id) && existsSync(join(CONTENT, id + '.json'))) rmSync(join(CONTENT, id + '.json'));
const next = idx.filter((r) => !toDelete.has(r.id) && !written.has(r.id));
for (const r of toWrite) {
  next.unshift({
    ...r, body: trunc(r.pages.lesson) || trunc(r.pages.quiz),
    pages: { ...r.pages, lesson: trunc(r.pages.lesson), quiz: trunc(r.pages.quiz), answers: trunc(r.pages.answers), studyPages: r.pages.studyPages.map((p) => ({ ...p, body: trunc(p.body) })) },
  });
}
writeFileSync(join(CONTENT, 'index.json'), JSON.stringify(next, null, 2));
writeFileSync(CIDX, JSON.stringify(cidx, null, 2));
console.log(`wrote ${toWrite.length} records, removed ${toDelete.size}`);
