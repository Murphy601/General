#!/usr/bin/env node
/**
 * Build Grade 8 Integrated Science multi-page lessons from uploaded notes.
 *
 * Goals:
 * - Follow the notes section-by-section (not a thin template).
 * - Keep nearly all note facts; clean wording lightly for classroom study.
 * - Many short study pages (scrollable booklet), not one dump.
 * - NO page locks until publish (all pages free). Use --lock later.
 *
 * Usage:
 *   node scripts/build-g8-integrated-science-pages.mjs
 *   node scripts/build-g8-integrated-science-pages.mjs --lock --free-pages 3
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NOTES = join(ROOT, 'knowledge-base', 'textbooks', 'grade-8-integrated-science-notes.json');
const CONTENT_DIR = join(ROOT, 'web', 'data', 'content');
const INDEX_FILE = join(CONTENT_DIR, 'index.json');

const LOCK_MODE = process.argv.includes('--lock');
const FREE_PAGES = (() => {
  const i = process.argv.indexOf('--free-pages');
  return i >= 0 ? Number(process.argv[i + 1]) || 3 : 3;
})();

/** Soft target for note content per study page (more pages = better scroll UX). */
const TARGET_CHARS = 520;
const MAX_CHARS = 780;
const MIN_PAGES = 10;

function cleanLine(s) {
  return String(s || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[]/g, '')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bcompunds\b/gi, 'compounds')
    .replace(/\bflouride\b/gi, 'fluoride')
    .replace(/\bleaner(s)?\b/gi, (_, p) => (p ? 'learners' : 'learner'))
    .replace(/\bsort -hand\b/gi, 'shorthand')
    .replace(/\bration\b/gi, 'ratio')
    .replace(/\bgoogles\b/gi, 'goggles')
    .trim();
}

function dropBoilerplate(line) {
  return /GRADE\s*\d+|LESSON NOTES COMPLETE|RATIONALIZED INTEGRATED|^STRAND\s*\d+/i.test(line);
}

function isSectionHeading(line, topic) {
  const raw = cleanLine(line);
  const t = raw.replace(/:$/, '').trim();
  if (!t || t.length < 4 || t.length > 110) return false;
  if (dropBoilerplate(t)) return false;
  if (/^For example,?$/i.test(t)) return false;
  // Math fragments / incomplete lines
  if (/^=/.test(t) || /^Use it to$/i.test(t) || /^Therefore, we conclude that$/i.test(t)) return false;

  // Keep lab labels inside the current section (not new pages)
  if (
    /^(Requirements|Procedure|Procedures|Caution|Observation|Apparatus|Materials)$/i.test(t)
  ) {
    return false;
  }

  // Table cell noise — never treat as a section break
  if (
    /^(Name of element|Chemical symbol|Latin name\.?|Volume|Density|Shape|Ability to flow|Compressibility|State of matter|Examples of food sources|Mineral element of compound|Solid|Liquid|Gas|Solids|Liquids|Gases)$/i.test(
      t,
    )
  ) {
    return false;
  }

  if (/^\d+\.\d+\b/.test(t)) return true;
  if (t.toLowerCase() === String(topic.topicName || '').toLowerCase()) return true;

  // Explicit curriculum / notes headings (from the uploaded notes)
  if (
    /^(Meaning of|Relating common|Application of|Applications of|Importance of|Properties of|Summary of|Pure and Impure|Diffusion and Osmosis|Pressure in|Meaning of pressure|Classes of|Types of|Safety measures|Forms of energy|Chemical energy|Word equation|Information on Packaging|Examples of food nutrients|The cell membrane|In plants Osmosis|In animals,|Movement of|Reproduction in|Transformation of|Physical changes|Chemical changes|Experiment to demonstrate)/i.test(
      t,
    )
  ) {
    return true;
  }
  // Exact short headings only (avoid matching full sentences that start with these words)
  if (/^(DIFFUSION|OSMOSIS|Diffusion|Osmosis)\.?$/i.test(t)) return true;

  // ALL CAPS multi-word headings from notes (e.g. ELEMENTS AND COMPOUNDS)
  if (
    t === t.toUpperCase() &&
    /[A-Z]/.test(t) &&
    t.split(/\s+/).length >= 2 &&
    t.split(/\s+/).length <= 10
  ) {
    return true;
  }

  // Metal importance blocks in notes
  if (/^(Gold|Silver|Iron)$/i.test(t) && /:$/.test(raw)) return true;

  // Longer labeled sub-topics ending with colon
  if (/:$/.test(raw) && t.length >= 18 && t.length < 70) return true;

  return false;
}

function toBullet(line) {
  const cleaned = cleanLine(line);
  // Keep lab labels as sub-headings inside the page
  if (/^(Requirements|Procedure|Procedures|Caution|Observation)\s*:?\s*$/i.test(cleaned)) {
    return `\n▸ ${cleaned.replace(/:$/, '')}\n`;
  }
  const t = cleaned.replace(/^(?:[-•]|\d+[.)]\s*|a\)|b\)|c\)|)\s*/i, '').trim();
  if (!t) return '';
  let out = t;
  // Keep note voice; light pupil-facing cleanup only
  out = out.replace(/^The learner (?:is guided to|should)\s+/i, '');
  if (!/^[A-Z0-9“"]/.test(out)) out = out.charAt(0).toUpperCase() + out.slice(1);
  return `• ${out}`;
}

/** Collapse broken element/symbol table rows into readable pairs when possible. */
function normalizeTableish(lines) {
  const out = [];
  const skip = new Set([
    'name of element',
    'chemical symbol',
    'latin name',
    'latin name.',
    'examples of food sources',
    'mineral element of compound',
    'state of matter',
    'volume',
    'density',
    'shape',
    'ability to flow',
    'compressibility',
  ]);

  for (let i = 0; i < lines.length; i += 1) {
    const a = cleanLine(lines[i]);
    const b = cleanLine(lines[i + 1] || '');
    const c = cleanLine(lines[i + 2] || '');
    if (skip.has(a.toLowerCase())) continue;

    // Element + Latin + Symbol (3-column table)
    if (
      /^[A-Z][a-z]+$/.test(a) &&
      /^[A-Z][a-z]+$/.test(b) &&
      /^[A-Z][a-z]?$/.test(c) &&
      c.length <= 2
    ) {
      out.push(`${a} (Latin: ${b}) → symbol ${c}`);
      i += 2;
      continue;
    }
    // Element + Symbol
    if (/^[A-Z][a-z]+$/.test(a) && /^[A-Z][a-z]?$/.test(b) && b.length <= 2) {
      out.push(`${a} → ${b}`);
      i += 1;
      continue;
    }
    // Mineral + food sources (short label + longer list)
    if (
      /^(Carbon|Nitrogen|Fluoride|Flouride|Calcium|Copper|Iron|Magnesium|Phosphorus|Potassium|Sodium chloride)$/i.test(
        a,
      ) &&
      b.length > 8 &&
      !/^[A-Z][a-z]?$/.test(b)
    ) {
      out.push(`${a}: ${b}`);
      i += 1;
      continue;
    }
    out.push(lines[i]);
  }
  return out;
}

/**
 * Split topic notes into ordered sections using headings from the notes.
 */
function splitSections(topic) {
  const paras = (topic.paragraphs || []).map(cleanLine).filter(Boolean).filter((p) => !dropBoilerplate(p));
  const sections = [];
  let current = { title: topic.topicName, lines: [] };

  const push = () => {
    const lines = current.lines.filter(Boolean);
    if (!lines.length && !current.title) return;
    // Avoid empty heading-only sections
    if (!lines.length) return;
    sections.push({ title: current.title || topic.topicName, lines });
  };

  for (const p of paras) {
    if (isSectionHeading(p, topic) && current.lines.length >= 2) {
      push();
      current = { title: p.replace(/:$/, ''), lines: [] };
      continue;
    }
    if (isSectionHeading(p, topic) && !current.lines.length) {
      current.title = p.replace(/:$/, '');
      continue;
    }
    current.lines.push(p);
  }
  push();

  // Merge tiny orphan sections into previous
  const merged = [];
  for (const s of sections) {
    const chars = s.lines.join(' ').length;
    if (merged.length && chars < 120) {
      merged[merged.length - 1].lines.push(`【${s.title}】`, ...s.lines);
    } else {
      merged.push({ ...s, lines: [...s.lines] });
    }
  }
  return merged;
}

/**
 * Turn sections into study pages — keep note content, paginate for scroll UX.
 */
function buildStudyPages(topic) {
  const sections = splitSections(topic);
  const rawPages = [];

  for (const section of sections) {
    const normalized = normalizeTableish(section.lines);
    const blocks = paginateLines(normalized, TARGET_CHARS, MAX_CHARS);
    blocks.forEach((lines, i) => {
      const title =
        blocks.length === 1 ? section.title : `${section.title} (${i + 1}/${blocks.length})`;
      rawPages.push({ title: cleanLine(title), lines });
    });
  }

  // Ensure enough pages for denser topics by splitting largest pages
  let pages = rawPages;
  let guard = 0;
  while (pages.length < MIN_PAGES && guard < 40) {
    guard += 1;
    let maxI = 0;
    for (let i = 1; i < pages.length; i += 1) {
      if (pages[i].lines.join(' ').length > pages[maxI].lines.join(' ').length) maxI = i;
    }
    const big = pages[maxI];
    if (big.lines.length < 8) break;
    const mid = Math.ceil(big.lines.length / 2);
    const a = { title: `${stripPart(big.title)} (a)`, lines: big.lines.slice(0, mid) };
    const b = { title: `${stripPart(big.title)} (b)`, lines: big.lines.slice(mid) };
    pages.splice(maxI, 1, a, b);
  }

  return pages.map((p, idx) => formatPage(topic, idx + 1, p.title, p.lines, pages.length));
}

function stripPart(title) {
  return cleanLine(title).replace(/\s*\((?:a|b|\d+\/\d+)\)\s*$/i, '');
}

function paginateLines(lines, target, max) {
  const out = [];
  let buf = [];
  let chars = 0;
  const flush = () => {
    if (!buf.length) return;
    out.push(buf);
    buf = [];
    chars = 0;
  };
  for (const line of lines) {
    const len = line.length + 1;
    if (buf.length && chars + len > max) flush();
    buf.push(line);
    chars += len;
    if (chars >= target) flush();
  }
  flush();
  return out.length ? out : [lines];
}

function formatPage(topic, pageNumber, title, lines, totalPages) {
  const bullets = lines
    .map((l) => {
      if (/^【(.+)】$/.test(l)) {
        return `\n▸ ${RegExp.$1}\n`;
      }
      return toBullet(l);
    })
    .filter(Boolean);

  // Flatten accidental blank markers
  const learnLines = [];
  for (const b of bullets) {
    if (b.startsWith('\n▸')) {
      learnLines.push('');
      learnLines.push(b.trim());
      learnLines.push('');
    } else {
      learnLines.push(b);
    }
  }

  const keyPoints = pickKeyPoints(lines, topic);
  const checks = checkYourself(topic, pageNumber, lines);

  const body = [
    `PAGE ${pageNumber}: ${title}`.toUpperCase(),
    '',
    `Topic ${topic.topicNumber}: ${topic.topicName}`,
    `Source: Grade 8 Rationalized Integrated Science lesson notes`,
    '',
    '▸ Learn (from the notes)',
    '',
    ...learnLines,
    '',
    '▸ Key points',
    '',
    ...keyPoints.map((x) => `• ${x}`),
    '',
    '▸ Check yourself',
    '',
    ...checks.map((x) => `• ${x}`),
    '',
    pageNumber < totalPages
      ? `• Next: continue to page ${pageNumber + 1}.`
      : '• End of study pages — open the Revision Quiz.',
  ].join('\n');

  const free = !LOCK_MODE || pageNumber <= FREE_PAGES;
  return { pageNumber, title, body, free };
}

function pickKeyPoints(lines, topic) {
  const points = [];
  for (const p of lines) {
    const t = cleanLine(p);
    if (t.length < 35 || t.length > 180) continue;
    if (/^(Name of element|Chemical symbol|Latin name|Requirements|Procedure|Volume|Density|Shape)$/i.test(t)) {
      continue;
    }
    if (
      /is defined|means that|therefore|for example|composed of|cannot be|important|pressure =|formula|diffusion|osmosis|element|compound|energy|force/i.test(
        t,
      )
    ) {
      points.push(t.length > 150 ? `${t.slice(0, 147)}...` : t);
    }
    if (points.length >= 4) break;
  }
  if (!points.length) {
    points.push(`Re-read this page and explain the main idea of ${topic.topicName} in your own words.`);
    points.push(`Give one example from the notes that you can see at home or school.`);
  }
  while (points.length < 3) {
    points.push(`Connect one fact on this page to daily life in Kenya.`);
  }
  return points.slice(0, 4);
}

function checkYourself(topic, pageNumber, lines) {
  const sample = lines.find((l) => cleanLine(l).length > 40) || topic.topicName;
  return [
    `In one sentence, what is this page teaching about ${topic.topicName}?`,
    `Write 4 bullet notes from this page without looking back.`,
    `Make one short exam question from: “${cleanLine(sample).slice(0, 90)}”`,
  ];
}

function buildQuiz(topic, pages) {
  const facts = pages
    .flatMap((p) => p.body.split('\n'))
    .map((l) => l.replace(/^•\s*/, '').trim())
    .filter(
      (l) =>
        l.length > 40 &&
        l.length < 160 &&
        !/^PAGE |^▸|^Topic |^Source:|Next:|End of study|Check yourself|Key points|Learn /i.test(l) &&
        !/Write 4 bullet|In one sentence|Make one short/i.test(l),
    );

  // Prefer diverse facts across pages
  const picked = [];
  const step = Math.max(1, Math.floor(facts.length / 12));
  for (let i = 0; i < facts.length && picked.length < 12; i += step) {
    picked.push(facts[i]);
  }
  while (picked.length < 10 && facts[picked.length]) picked.push(facts[picked.length]);

  const questions = [];
  const answers = [];
  for (let i = 0; i < 10; i += 1) {
    const fact = picked[i] || `${topic.topicName} is part of Grade 8 Integrated Science.`;
    questions.push({
      number: i + 1,
      question: `According to the study notes on ${topic.topicName}, which statement is correct?`,
      options: [
        `A. ${fact}`,
        `B. ${topic.topicName} is not taught in Grade 8 Integrated Science.`,
        `C. We should ignore examples and only memorise headings.`,
        `D. Science notes do not need practice questions.`,
      ],
    });
    answers.push({ number: i + 1, answer: 'A', explanation: fact });
  }
  for (let i = 0; i < 5; i += 1) {
    const n = 11 + i;
    const prompts = [
      `Using the notes, explain ${topic.topicName} with one clear example.`,
      `List five key points from the study pages on ${topic.topicName}.`,
      `Write a short paragraph summarising the most important ideas in ${topic.topicName}.`,
      `Create one exam-style question on ${topic.topicName} and answer it.`,
      `How is ${topic.topicName} useful in day-to-day life in Kenya?`,
    ];
    questions.push({ number: n, question: prompts[i] });
    answers.push({
      number: n,
      answer: 'Any correct answer clearly based on the study notes.',
      explanation: 'Mark against the multi-page lesson notes.',
    });
  }

  const qLines = [
    `REVISION QUIZ: ${topic.topicName.toUpperCase()}`,
    '',
    '• Use your study pages. Answer in full where asked.',
    '',
  ];
  const aLines = [`ANSWERS: ${topic.topicName.toUpperCase()}`, ''];
  for (const q of questions) {
    qLines.push(`${q.number}. ${q.question}`);
    (q.options || []).forEach((o) => qLines.push(`   ${o}`));
    qLines.push('');
  }
  for (const a of answers) {
    aLines.push(`${a.number}. ${a.answer}`);
    if (a.explanation) aLines.push(`   • ${a.explanation}`);
    aLines.push('');
  }
  return { questions, quiz: qLines.join('\n'), answers: aLines.join('\n') };
}

function buildVideoScript(topic, pages) {
  return [
    `VIDEO SCRIPT: ${topic.topicName.toUpperCase()}`,
    `Grade 8 · Integrated Science · ${pages.length} study pages`,
    '',
    '[0:00] Hook — Today we study this topic page by page from the lesson notes.',
    `[0:20] Teach page 1: ${pages[0]?.title || topic.topicName}`,
    '[2:00] Work through key points on the board',
    '[3:30] Pause — Check yourself',
    `[4:30] Continue through pages 2–${Math.min(4, pages.length)}`,
    '[5:30] CTA — Finish remaining pages, then Revision Quiz',
    '',
    '— CBC Learn · multi-page notes lesson',
  ].join('\n');
}

function loadIndex() {
  if (!existsSync(INDEX_FILE)) return [];
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
}

function saveLesson(content) {
  mkdirSync(CONTENT_DIR, { recursive: true });
  let index = loadIndex();
  const sameTopic = (i) =>
    i.type === 'topic-lesson' &&
    i.topic?.grade === content.topic.grade &&
    String(i.topic?.subject || '').toUpperCase() === String(content.topic.subject || '').toUpperCase() &&
    i.topic?.topicNumber === content.topic.topicNumber;

  for (const old of index.filter(sameTopic)) {
    const p = join(CONTENT_DIR, `${old.id}.json`);
    if (existsSync(p) && old.id !== content.id) {
      try {
        writeFileSync(p, '');
      } catch {
        /* ignore */
      }
    }
  }
  index = index.filter((i) => i.id !== content.id && !sameTopic(i));
  writeFileSync(join(CONTENT_DIR, `${content.id}.json`), JSON.stringify(content, null, 2));
  index.unshift({
    ...content,
    pages: {
      ...content.pages,
      lesson: (content.pages.lesson || '').slice(0, 220) + '…',
      quiz: '',
      answers: '',
      studyPages: (content.pages.studyPages || []).map((p) => ({
        pageNumber: p.pageNumber,
        title: p.title,
        free: p.free,
        body: '',
      })),
    },
  });
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

function saveVideo(video) {
  let index = loadIndex();
  const same = (i) =>
    i.type === 'video-script' &&
    i.topic?.grade === video.topic.grade &&
    String(i.topic?.subject || '').toUpperCase() === String(video.topic.subject || '').toUpperCase() &&
    i.topic?.topicNumber === video.topic.topicNumber;
  index = index.filter((i) => i.id !== video.id && !same(i));
  writeFileSync(join(CONTENT_DIR, `${video.id}.json`), JSON.stringify(video, null, 2));
  index.unshift({
    ...video,
    pages: { lesson: '', quiz: (video.pages.quiz || '').slice(0, 200) + '…', answers: '' },
  });
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

if (!existsSync(NOTES)) {
  console.error('Missing notes JSON. Expected:', NOTES);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(NOTES, 'utf8'));
console.log(
  `Building multi-page lessons for ${catalog.subject} (${catalog.topics.length} topics)` +
    (LOCK_MODE ? `, LOCK on (freePages=${FREE_PAGES})` : ', all pages UNLOCKED (pre-publish)'),
);

for (const topic of catalog.topics) {
  const studyPages = buildStudyPages(topic);
  const quizData = buildQuiz(topic, studyPages);
  const freeCount = LOCK_MODE ? FREE_PAGES : studyPages.length;

  const lessonPreview = [
    `LESSON: ${topic.topicName.toUpperCase()}`,
    '',
    `Grade: Grade 8`,
    `Subject: INTEGRATED SCIENCE`,
    `Strand: ${topic.strandName}`,
    `Topic ${topic.topicNumber}: ${topic.topicName}`,
    '',
    `• Multi-page study from Grade 8 Integrated Science notes (${studyPages.length} pages)`,
    LOCK_MODE
      ? `• Pages 1–${FREE_PAGES} free preview · later pages unlock with payment`
      : '• All pages unlocked for now (locks will be added at publish)',
    `• Format: Learn (from notes) → Key points → Check yourself`,
    '',
    studyPages.map((p) => `Page ${p.pageNumber}: ${p.title}`).join('\n'),
  ].join('\n');

  const slug = `${String(topic.topicNumber).replace(/\./g, '-')}-${topic.topicName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)}`;

  const id = randomUUID();
  const content = {
    id,
    type: 'topic-lesson',
    title: `Topic ${topic.topicNumber}: ${topic.topicName}`,
    topic: {
      grade: 'grade-8',
      gradeLabel: 'Grade 8',
      subject: 'INTEGRATED SCIENCE',
      strand: topic.strandName,
      subStrand: topic.topicName,
      topicNumber: topic.topicNumber,
      topicOrder:
        Number(String(topic.topicNumber).split('.')[0]) * 10 +
        Number(String(topic.topicNumber).split('.')[1] || 0),
      slug,
    },
    pages: {
      lesson: lessonPreview,
      quiz: quizData.quiz,
      answers: quizData.answers,
      studyPages,
      freePageCount: freeCount,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: studyPages.reduce((n, p) => n + p.body.split(/\s+/).length, 0),
      reviewed: false,
      access: 'free',
      priceKes: 0,
      questionCount: quizData.questions.length,
      contentSource: 'g8-is-notes-multipage-v2',
      sourceChars: topic.chars,
      freePageCount: freeCount,
      totalStudyPages: studyPages.length,
      lockPages: LOCK_MODE,
      textbookTitles: ['Grade 8 Rationalized Integrated Science Lesson Notes'],
    },
    sources: [
      {
        id: 'g8-is-notes',
        grade: 'grade-8',
        subject: 'INTEGRATED SCIENCE',
        excerpt: (topic.paragraphs || []).slice(0, 4).join(' ').slice(0, 240),
      },
    ],
  };

  saveLesson(content);

  const videoScript = buildVideoScript(topic, studyPages);
  saveVideo({
    id: randomUUID(),
    type: 'video-script',
    title: `Video: ${topic.topicName}`,
    topic: content.topic,
    pages: { lesson: '', quiz: videoScript, answers: '' },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: videoScript.split(/\s+/).length,
      reviewed: false,
      access: 'free',
      priceKes: 0,
      contentSource: 'g8-is-notes-multipage-v2',
      linkedLessonId: content.id,
    },
    sources: content.sources,
  });

  const locked = studyPages.filter((p) => !p.free).length;
  console.log(
    `  ✓ ${topic.topicNumber} ${topic.topicName}: ${studyPages.length} pages` +
      (LOCK_MODE ? ` (${freeCount} free / ${locked} locked)` : ' (all unlocked)'),
  );
}

console.log('\nDone. Open /learn/grade-8/integrated-science');
