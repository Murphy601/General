/**
 * Patch existing universal Study-Drama lessons:
 * - rebuild Revision Quiz + Answers tabs (fixes empty Answers)
 * - refresh per-page REVISION QUESTIONS / ANSWERS with engaging stems
 *
 * Usage:
 *   node scripts/patch-universal-quizzes.mjs
 *   node scripts/patch-universal-quizzes.mjs --grade grade-7
 *   node scripts/patch-universal-quizzes.mjs --limit 20
 */
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { sectionBlock } from './study-drama/house-style.mjs';
import {
  buildQuizFromUniversalPages,
  buildPageRevisionQA,
} from './study-drama/universal-writer.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'web', 'data', 'content');
const INDEX_FILE = join(CONTENT_DIR, 'index.json');

function parseArgs(argv) {
  const args = { grade: null, limit: 0 };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--grade') args.grade = argv[++i];
    else if (argv[i] === '--limit') args.limit = Number(argv[++i]) || 0;
  }
  return args;
}

function extractSection(body, name) {
  const re = new RegExp(`${name}\\n----\\n([\\s\\S]*?)(?=\\n\\n[A-Z][A-Z ]+\\n----|$)`, 'i');
  return (String(body || '').match(re) || [])[1] || '';
}

function extractBullets(section) {
  return String(section || '')
    .split('\n')
    .map((l) => l.replace(/^•\s*/, '').trim())
    .filter((l) => l.length > 12);
}

function replaceQaSections(body, questions, answers) {
  const qBlock = [
    sectionBlock('REVISION QUESTIONS'),
    ...questions.map((q, i) => `${i + 1}. ${q}`),
  ].join('\n');
  const aBlock = [
    sectionBlock('ANSWERS'),
    ...answers.map((a, i) => `${i + 1}. ${a}`),
  ].join('\n');

  let next = String(body || '');
  if (/REVISION QUESTIONS\n----\n/i.test(next) && /\nANSWERS\n----\n/i.test(next)) {
    next = next.replace(
      /REVISION QUESTIONS\n----\n[\s\S]*?(?=\nANSWERS\n----\n)/i,
      `${qBlock}\n\n`,
    );
    next = next.replace(/ANSWERS\n----\n[\s\S]*$/i, aBlock);
    return next.trim();
  }
  return `${next.trim()}\n\n${qBlock}\n\n${aBlock}`.trim();
}

function indexEntry(content) {
  return {
    ...content,
    body: (content.body || content.pages?.lesson || '').slice(0, 240),
    pages: {
      lesson: (content.pages?.lesson || '').slice(0, 240) + '…',
      quiz: (content.pages?.quiz || '').slice(0, 200) + '…',
      answers: (content.pages?.answers || '').slice(0, 200) + (content.pages?.answers ? '…' : ''),
      studyPages: (content.pages?.studyPages || []).map((p) => ({
        pageNumber: p.pageNumber,
        title: p.title,
        free: p.free,
        body: (p.body || '').slice(0, 180) + '…',
      })),
    },
  };
}

const args = parseArgs(process.argv);
const index = JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
let patched = 0;
let skipped = 0;
let sinceFlush = 0;

const targets = index.filter((e) => {
  if (e.type !== 'topic-lesson') return false;
  const eng = e.metadata?.engine || '';
  const src = e.metadata?.contentSource || '';
  // Patch both universal and G8 handcrafted Study-Drama lessons
  if (!/study-drama|study-content-drama/i.test(`${src} ${eng}`)) return false;
  if (args.grade && e.topic?.grade !== args.grade) return false;
  return true;
});

const jobs = args.limit > 0 ? targets.slice(0, args.limit) : targets;
console.log(`Patching quizzes/answers for ${jobs.length} lessons…`);

for (const entry of jobs) {
  const path = join(CONTENT_DIR, `${entry.id}.json`);
  if (!existsSync(path)) {
    skipped++;
    continue;
  }
  let lesson;
  try {
    lesson = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    skipped++;
    continue;
  }

  const topic = {
    subject: lesson.topic?.subject || 'CBC',
    topicName: lesson.topic?.topicName || lesson.title || 'Topic',
    grade: lesson.topic?.grade || '',
  };
  const studyPages = lesson.pages?.studyPages || [];
  if (!studyPages.length) {
    skipped++;
    continue;
  }

  const refreshed = studyPages.map((p, i) => {
    const notes = extractBullets(extractSection(p.body, 'MAIN NOTES'));
    const goals = extractSection(p.body, 'WHAT YOU WILL LEARN');
    const scope = (goals.match(/•\s*(.+)/) || [])[1] || p.title;
    const pack = buildPageRevisionQA({
      ideaLabel: p.title,
      topicName: topic.topicName,
      subject: topic.subject,
      notes: notes.length ? notes : [scope],
      scope,
      variant: i + 1,
      grade: topic.grade || '',
    });
    return {
      ...p,
      body: replaceQaSections(p.body, pack.questions, pack.answers),
    };
  });

  const quizPack = buildQuizFromUniversalPages(refreshed, topic);
  lesson.pages = {
    ...lesson.pages,
    studyPages: refreshed,
    lesson: refreshed.map((p) => p.body).join('\n\n'),
    quiz: quizPack.quiz,
    answers: quizPack.answers,
  };
  lesson.metadata = {
    ...lesson.metadata,
    quizPatchedAt: new Date().toISOString(),
    quizQuestionCount: quizPack.questionCount,
  };

  writeFileSync(path, JSON.stringify(lesson));

  const idx = index.findIndex((x) => x.id === entry.id);
  if (idx >= 0) index[idx] = indexEntry(lesson);

  patched++;
  sinceFlush++;
  process.stdout.write(patched % 50 === 0 ? `${patched}` : '.');
  if (sinceFlush >= 40) {
    writeFileSync(INDEX_FILE, JSON.stringify(index));
    sinceFlush = 0;
  }
}

writeFileSync(INDEX_FILE, JSON.stringify(index));
console.log(`\nDone. patched=${patched} skipped=${skipped}`);
