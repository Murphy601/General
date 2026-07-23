#!/usr/bin/env node
/**
 * Study-Content & Drama Engine runner for Grade 8 Integrated Science
 * Spec: knowledge-base/prompts/study-content-drama-engine.md
 *
 * Pipeline: 1A Page Planner → 1B Per-Page Writer → 2 Display Validator
 *           → 3 Screen-Drama Director → 4 QA & Verification
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getPageMap } from './study-drama/page-maps.mjs';
import { writePage, buildQuizFromPages } from './study-drama/writer.mjs';
import { displayNormalize } from './study-drama/house-style.mjs';
import { writeDrama } from './study-drama/drama.mjs';
import { runQA } from './study-drama/qa.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NOTES = join(ROOT, 'knowledge-base', 'textbooks', 'grade-8-integrated-science-notes.json');
const CONTENT_DIR = join(ROOT, 'web', 'data', 'content');
const INDEX_FILE = join(CONTENT_DIR, 'index.json');

const CONFIG = {
  CURRICULUM: 'CBC / KICD (Kenya)',
  SUBJECT: 'INTEGRATED SCIENCE',
  GRADE: 'Grade 8 JSS',
  MIN_PAGES: 20,
  VIDEO_LENGTH: '5–10 minutes',
  CONTENT_SOURCE: 'study-drama-engine-v1',
};

const LOCK_MODE = process.argv.includes('--lock');
const FREE_PAGES = (() => {
  const i = process.argv.indexOf('--free-pages');
  return i >= 0 ? Number(process.argv[i + 1]) || 3 : 3;
})();

function loadIndex() {
  if (!existsSync(INDEX_FILE)) return [];
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
}

function saveRecord(content) {
  mkdirSync(CONTENT_DIR, { recursive: true });
  let index = loadIndex();
  const same = (i) =>
    i.type === content.type &&
    i.topic?.grade === content.topic.grade &&
    /INTEGRATED\s*SCIENCE/i.test(String(i.topic?.subject || '')) &&
    i.topic?.topicNumber === content.topic.topicNumber;

  for (const old of index.filter(same)) {
    const p = join(CONTENT_DIR, `${old.id}.json`);
    if (existsSync(p) && old.id !== content.id) {
      try {
        unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
  index = index.filter((i) => i.id !== content.id && !same(i));
  writeFileSync(join(CONTENT_DIR, `${content.id}.json`), JSON.stringify(content, null, 2));
  index.unshift({
    ...content,
    body: (content.body || content.pages?.quiz || content.pages?.lesson || '').slice(0, 240),
    pages: {
      ...content.pages,
      lesson: (content.pages.lesson || '').slice(0, 240) + '…',
      quiz: (content.pages.quiz || '').slice(0, 220) + '…',
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

if (!existsSync(NOTES)) {
  console.error('Missing notes:', NOTES);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(NOTES, 'utf8'));
console.log(
  `Study-Drama Engine v1 — ${CONFIG.SUBJECT} ${CONFIG.GRADE} · minPages=${CONFIG.MIN_PAGES} · video=${CONFIG.VIDEO_LENGTH}`,
);
console.log(`Curriculum: ${CONFIG.CURRICULUM}`);
console.log('');

let rejected = 0;

for (const topic of catalog.topics) {
  const map = getPageMap(topic.topicNumber);
  if (!map) {
    console.error(`  ✗ No page map for topic ${topic.topicNumber}`);
    rejected++;
    continue;
  }

  // Agent 1A
  const pagePlan = map.pages;
  if (pagePlan.length < CONFIG.MIN_PAGES) {
    console.error(`  ✗ ${topic.topicNumber}: page map has ${pagePlan.length} < ${CONFIG.MIN_PAGES}`);
    rejected++;
    continue;
  }

  // Agent 1B loop
  let ledger = { locals: [], questionStems: [], factStarts: [] };
  const studyPages = [];
  for (let i = 0; i < pagePlan.length; i++) {
    const { body, ledger: next } = writePage({
      topic,
      map,
      page: pagePlan[i],
      pageNumber: i + 1,
      totalPages: pagePlan.length,
      ledger,
    });
    ledger = next;
    // Agent 2
    const normalized = displayNormalize(body);
    studyPages.push({
      pageNumber: i + 1,
      title: pagePlan[i].title,
      body: normalized,
      free: true,
    });
  }

  // Agent 3
  const drama = displayNormalize(writeDrama(topic, studyPages));

  // Agent 4
  const qa = runQA({
    topic,
    pageMap: map,
    studyPages,
    drama,
    ledger,
    minPages: CONFIG.MIN_PAGES,
  });

  if (!qa.approved) {
    console.error(`  ✗ ${topic.topicNumber} ${topic.topicName}: QA REJECTED`);
    console.error(qa.report.split('\n').map((l) => `     ${l}`).join('\n'));
    rejected++;
    // still save for inspection
  }

  const quizData = buildQuizFromPages(topic, studyPages);
  const freeCount = LOCK_MODE ? Math.min(FREE_PAGES, studyPages.length) : studyPages.length;
  const slug = `${String(topic.topicNumber).replace(/\./g, '-')}-${topic.topicName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)}`;

  const lesson = {
    id: randomUUID(),
    type: 'topic-lesson',
    title: `Topic ${topic.topicNumber}: ${topic.topicName}`,
    topic: {
      grade: 'grade-8',
      gradeLabel: 'Grade 8',
      subject: 'INTEGRATED SCIENCE',
      strand: map.strand,
      subStrand: map.subStrand,
      topicNumber: topic.topicNumber,
      topicOrder:
        Number(String(topic.topicNumber).split('.')[0]) * 10 +
        Number(String(topic.topicNumber).split('.')[1] || 0),
      slug,
    },
    pages: {
      lesson: [
        'STUDY MODULE PAGE MAP',
        '====',
        `${CONFIG.SUBJECT} · ${CONFIG.GRADE} · ${topic.topicName}`,
        `${studyPages.length} pages · engine ${CONFIG.CONTENT_SOURCE}`,
        '',
        ...studyPages.map((p) => `PAGE ${p.pageNumber}: ${p.title}`),
        '',
        qa.report,
      ].join('\n'),
      quiz: quizData.quiz,
      answers: quizData.answers,
      studyPages,
      freePageCount: freeCount,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: studyPages.reduce((n, p) => n + p.body.split(/\s+/).length, 0),
      reviewed: qa.approved,
      access: 'free',
      priceKes: 0,
      questionCount: quizData.questionCount,
      contentSource: CONFIG.CONTENT_SOURCE,
      sourceChars: topic.chars,
      freePageCount: freeCount,
      totalStudyPages: studyPages.length,
      lockPages: LOCK_MODE,
      qaVerdict: qa.approved ? 'APPROVED' : 'REJECTED',
      textbookTitles: ['Grade 8 Rationalized Integrated Science Lesson Notes'],
      engine: 'study-content-drama-engine',
      minPages: CONFIG.MIN_PAGES,
      videoLength: CONFIG.VIDEO_LENGTH,
    },
    sources: [
      {
        id: 'g8-is-notes',
        grade: 'grade-8',
        subject: 'INTEGRATED SCIENCE',
        excerpt: (topic.paragraphs || []).slice(0, 3).join(' ').slice(0, 220),
      },
    ],
  };

  saveRecord(lesson);

  const videoBody = drama;
  saveRecord({
    id: randomUUID(),
    type: 'video-script',
    title: `Drama: ${topic.topicName}`,
    topic: lesson.topic,
    body: videoBody,
    pages: { lesson: '', quiz: videoBody, answers: '', studyPages: [] },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: videoBody.split(/\s+/).length,
      reviewed: qa.approved,
      access: 'free',
      priceKes: 0,
      contentSource: CONFIG.CONTENT_SOURCE,
      linkedLessonId: lesson.id,
      videoFormat: 'screen-drama',
      videoLength: CONFIG.VIDEO_LENGTH,
      qaVerdict: qa.approved ? 'APPROVED' : 'REJECTED',
    },
    sources: lesson.sources,
  });

  console.log(
    `  ${qa.approved ? '✓' : '!'} ${topic.topicNumber} ${topic.topicName}: ${studyPages.length} pages · drama ready · QA ${qa.approved ? 'APPROVED' : 'REJECTED'}`,
  );
}

console.log('');
if (rejected) {
  console.error(`Done with ${rejected} QA rejection(s).`);
  process.exitCode = 1;
} else {
  console.log('Done. All topics APPROVED.');
}
