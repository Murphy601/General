#!/usr/bin/env node
/**
 * Universal Study-Drama lessons for PP1–Grade 12.
 * Pipeline: auto page map → universal writer → house-style normalize → drama → light QA → save.
 * Keeps existing Grade 8 Integrated Science study-drama-engine-v1 packs.
 *
 * Usage:
 *   node scripts/batch-universal-lessons.mjs
 *   node scripts/batch-universal-lessons.mjs --grade grade-4
 *   node scripts/batch-universal-lessons.mjs --grade grade-7 --subject MATHEMATICS
 *   node scripts/batch-universal-lessons.mjs --limit 5
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getTopicSourceText, formatGradeLabel, displayTopicName, listDocuments, extractTopicBlocks } from './curriculum-source.mjs';
import { buildAutoPageMap, paragraphsFromRaw } from './study-drama/auto-page-map.mjs';
import { getPageMap } from './study-drama/page-maps.mjs';
import { writePage, buildQuizFromPages } from './study-drama/writer.mjs';
import { writeUniversalPage, buildQuizFromUniversalPages } from './study-drama/universal-writer.mjs';
import { writeDrama } from './study-drama/drama.mjs';
import { writeUniversalDrama } from './study-drama/universal-drama.mjs';
import { displayNormalize } from './study-drama/house-style.mjs';
import { runQA } from './study-drama/qa.mjs';
import { CONFIG, matchesBannedIntro } from './study-drama/config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'web', 'data', 'content');
const INDEX_FILE = join(CONTENT_DIR, 'index.json');
const CURRICULUM = join(ROOT, 'knowledge-base', 'phase5', 'curriculum-index.json');
const LEDGER_FILE = join(ROOT, 'knowledge-base', 'phase5', 'universal-lesson-ledger.json');
const G8_NOTES = join(ROOT, 'knowledge-base', 'textbooks', 'grade-8-integrated-science-notes.json');

const TARGET_GRADES = [
  'pp1',
  'pp2',
  'grade-1',
  'grade-2',
  'grade-3',
  'grade-4',
  'grade-5',
  'grade-6',
  'grade-7',
  'grade-8',
  'grade-9',
  'grade-10',
  'grade-11',
  'grade-12',
];

function parseArgs(argv) {
  const args = { grade: null, subject: null, limit: 0, keepG8Is: true, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--grade') args.grade = argv[++i];
    else if (argv[i] === '--subject') args.subject = argv[++i];
    else if (argv[i] === '--limit') args.limit = Number(argv[++i]) || 0;
    else if (argv[i] === '--replace-g8-is') args.keepG8Is = false;
    else if (argv[i] === '--dry-run') args.dryRun = true;
  }
  return args;
}

function loadIndex() {
  if (!existsSync(INDEX_FILE)) return [];
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
}

function isG8IntegratedScience(grade, subject) {
  return grade === 'grade-8' && /INTEGRATED\s*SCIENCE/i.test(String(subject || ''));
}

function topicKey(grade, subject, topicNumber, topicName, slug) {
  const id = String(slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  if (id) return `${grade}|${String(subject).toUpperCase()}|slug:${id}`;
  const name = String(topicName || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `${grade}|${String(subject).toUpperCase()}|${topicNumber}|${name}`;
}

function indexEntry(content) {
  return {
    ...content,
    body: (content.body || content.pages?.lesson || '').slice(0, 240),
    pages: {
      lesson: (content.pages?.lesson || '').slice(0, 240) + '…',
      quiz: (content.pages?.quiz || '').slice(0, 200) + '…',
      answers: '',
      studyPages: (content.pages?.studyPages || []).map((p) => ({
        pageNumber: p.pageNumber,
        title: p.title,
        free: p.free,
        body: '',
      })),
    },
  };
}

function videoIndexEntry(content) {
  return {
    ...content,
    body: (content.body || '').slice(0, 240) + '…',
    pages: { lesson: '', quiz: '', answers: '', studyPages: [] },
  };
}

function lightQAPass(studyPages, drama) {
  // Soft gate for mass generation: require sections + no banned scaffolding/intros
  const need = [
    'WHAT YOU WILL LEARN',
    'INTRODUCTION',
    'MAIN NOTES',
    'WORKED EXAMPLE',
    'IN EVERYDAY LIFE',
    'SUMMARY',
    'REVISION QUESTIONS',
    'ANSWERS',
  ];
  const introFPS = [];
  for (const p of studyPages) {
    for (const sec of need) {
      if (!new RegExp(sec, 'i').test(p.body)) return false;
    }
    if (/Learners should ignore|Q1\/A1\b|Around .+?, learners meet/i.test(p.body)) return false;
    if (/^#{1,3}\s|\*\*[^*]+\*\*/m.test(p.body)) return false;
    const m = p.body.match(/INTRODUCTION\n----\n([\s\S]*?)(\n\n[A-Z]|\nMAIN NOTES)/i);
    const intro = (m?.[1] || '').trim();
    if (intro.length < 40 || matchesBannedIntro(intro)) return false;
    const fp = intro.slice(0, 72).toLowerCase();
    if (introFPS.includes(fp)) return false;
    introFPS.push(fp);
  }
  if (!drama || drama.length < 400) return false;
  return true;
}

/** Cache KICD topic blocks per grade+subject to avoid re-parsing huge PDFs text */
const sourceCache = new Map();
function getCachedSource({ grade, subject, topicNumber, topicName }) {
  const key = `${grade}|${String(subject).toUpperCase()}`;
  if (!sourceCache.has(key)) {
    const byNumber = new Map();
    try {
      const docs = listDocuments({ grade, subject });
      for (const doc of docs) {
        const blocks = extractTopicBlocks(doc.extractedText || '');
        for (const b of blocks) {
          const k = b.topicNumber;
          if (!byNumber.has(k) || (b.rawText || '').length > (byNumber.get(k).rawText || '').length) {
            byNumber.set(k, { ...b, fileId: doc.fileId });
          }
        }
      }
    } catch {
      /* curriculum text may be missing for some senior electives */
    }
    sourceCache.set(key, byNumber);
  }
  const byNumber = sourceCache.get(key);
  if (byNumber.has(topicNumber)) return byNumber.get(topicNumber);
  // Fallback name search
  const want = String(topicName || '').toUpperCase().slice(0, 20);
  if (want) {
    for (const b of byNumber.values()) {
      if (String(b.topicName || '').toUpperCase().includes(want)) return b;
    }
  }
  try {
    return getTopicSourceText({ grade, subject, topicNumber, topicName });
  } catch {
    return null;
  }
}

const args = parseArgs(process.argv);
const grades = args.grade ? [args.grade] : TARGET_GRADES;

console.log(`Universal Study-Drama lessons — grades: ${grades.join(', ')}`);
mkdirSync(CONTENT_DIR, { recursive: true });

const curriculum = JSON.parse(readFileSync(CURRICULUM, 'utf8'));
let index = loadIndex();

// Optional G8 IS notes paragraphs keyed by topic number
let g8NotesByNumber = {};
if (existsSync(G8_NOTES)) {
  const catalog = JSON.parse(readFileSync(G8_NOTES, 'utf8'));
  for (const t of catalog.topics || []) g8NotesByNumber[t.topicNumber] = t;
}

const jobs = [];
for (const g of curriculum.grades || []) {
  const grade = g.grade || g.id;
  if (!grades.includes(grade)) continue;
  for (const s of Object.values(g.subjects || {})) {
    const subject = s.subject;
    if (!subject) continue;
    if (args.subject && !subject.toUpperCase().includes(args.subject.toUpperCase())) continue;
    if (args.keepG8Is && isG8IntegratedScience(grade, subject)) continue;
    for (const t of s.topics || []) {
      jobs.push({
        grade,
        gradeLabel: g.label || formatGradeLabel(grade),
        subject,
        topicNumber: t.topicNumber,
        topicName: displayTopicName(t.topicName) || t.topicName,
        strandName: t.strandName,
        strandNumber: t.strandNumber,
        slug: t.slug,
        fileId: t.fileId,
      });
    }
  }
}

if (args.limit > 0) jobs.splice(args.limit);

console.log(`Topics to generate: ${jobs.length}`);
if (args.dryRun) {
  console.log(jobs.slice(0, 10));
  process.exit(0);
}

const ledger = { version: 1, createdAt: new Date().toISOString(), ok: 0, fail: 0, failures: [] };
const t0 = Date.now();
let sinceFlush = 0;

for (let ji = 0; ji < jobs.length; ji++) {
  const job = jobs[ji];
  const src = getCachedSource({
    grade: job.grade,
    subject: job.subject,
    topicNumber: job.topicNumber,
    topicName: job.topicName,
  });
  const rawText = src?.rawText || '';
  const paragraphs =
    isG8IntegratedScience(job.grade, job.subject) && g8NotesByNumber[job.topicNumber]?.paragraphs
      ? g8NotesByNumber[job.topicNumber].paragraphs
      : paragraphsFromRaw(rawText);

  const topic = {
    ...job,
    paragraphs,
    rawText,
  };

  const handMap =
    isG8IntegratedScience(job.grade, job.subject) ? getPageMap(job.topicNumber) : null;
  const map = handMap || buildAutoPageMap(topic);
  if (!map.pages || map.pages.length < (CONFIG.MIN_PAGES || 20)) {
    ledger.fail++;
    ledger.failures.push(`${job.grade}|${job.subject}|${job.topicNumber}: short map`);
    continue;
  }

  let pageLedger = { locals: [], questionStems: [], factStarts: [], introFingerprints: [] };
  const studyPages = [];
  const useHandWriter = Boolean(handMap);

  for (let i = 0; i < map.pages.length; i++) {
    const page = map.pages[i];
    const written = useHandWriter
      ? writePage({
          topic,
          map,
          page,
          pageNumber: i + 1,
          totalPages: map.pages.length,
          ledger: pageLedger,
        })
      : writeUniversalPage({
          topic,
          map,
          page,
          pageNumber: i + 1,
          totalPages: map.pages.length,
          ledger: pageLedger,
        });
    pageLedger = written.ledger;
    const body = displayNormalize(written.body);
    studyPages.push({
      pageNumber: i + 1,
      title: page.title,
      free: i < 3,
      body,
    });
  }

  const dramaRaw = useHandWriter ? writeDrama(topic, studyPages) : writeUniversalDrama(topic, studyPages);
  const drama = displayNormalize(dramaRaw);

  // Prefer full QA when handcrafted; light QA for mass packs
  let qaOk = true;
  if (useHandWriter) {
    const qa = runQA({
      topic,
      pageMap: map,
      studyPages,
      drama,
      ledger: pageLedger,
      minPages: CONFIG.MIN_PAGES,
    });
    qaOk = qa.approved;
  } else {
    qaOk = lightQAPass(studyPages, drama);
  }

  if (!qaOk) {
    ledger.fail++;
    ledger.failures.push(`${job.grade}|${job.subject}|${job.topicNumber}: QA`);
    process.stdout.write('x');
    continue;
  }

  const quizPack = useHandWriter
    ? buildQuizFromPages(topic, studyPages)
    : null;
  const quiz = useHandWriter
    ? quizPack.quiz
    : buildQuizFromUniversalPages(studyPages, topic);
  const answers = useHandWriter ? quizPack.answers : '';

  const lessonId = randomUUID();
  const videoId = randomUUID();
  const lesson = {
    id: lessonId,
    type: 'topic-lesson',
    title: `${job.gradeLabel} ${job.subject} — ${job.topicName}`,
    topic: {
      grade: job.grade,
      gradeLabel: job.gradeLabel,
      subject: job.subject,
      topicNumber: job.topicNumber,
      topicOrder: Number(String(job.topicNumber).replace(/[^\d.]/g, '')) || ji + 1,
      topicName: job.topicName,
      strandName: job.strandName,
      slug: job.slug || `${job.topicNumber}-${String(job.topicName).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    },
    pages: {
      lesson: studyPages.map((p) => p.body).join('\n\n'),
      quiz,
      answers,
      studyPages,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: studyPages.reduce((n, p) => n + p.body.split(/\s+/).length, 0),
      reviewed: true,
      access: 'free',
      priceKes: 0,
      contentSource: 'study-drama-engine-v1',
      engine: useHandWriter ? 'g8-handcrafted' : 'universal-study-drama',
      pageCount: studyPages.length,
      freePages: 3,
    },
    sources: [
      {
        id: src?.fileId || job.fileId || 'curriculum-index',
        grade: job.grade,
        subject: job.subject,
        excerpt: (rawText || job.topicName).slice(0, 220),
      },
    ],
  };

  const video = {
    id: videoId,
    type: 'video-script',
    title: `${job.gradeLabel} ${job.subject} — ${job.topicName} (Screen Drama)`,
    topic: { ...lesson.topic },
    body: drama,
    pages: { lesson: '', quiz: '', answers: '', studyPages: [] },
    metadata: {
      createdAt: new Date().toISOString(),
      wordCount: drama.split(/\s+/).length,
      reviewed: true,
      access: 'free',
      priceKes: 0,
      contentSource: 'study-drama-engine-v1',
      engine: useHandWriter ? 'g8-handcrafted' : 'universal-study-drama',
      linkedLessonId: lessonId,
      videoLength: CONFIG.VIDEO_LENGTH,
    },
    sources: lesson.sources,
  };

  // Replace prior lesson + video for same topic key (number + name), including old stubs
  const lessonKey = topicKey(job.grade, job.subject, job.topicNumber, job.topicName, job.slug);
  const dropLesson = (i) => {
    if (i.type !== 'topic-lesson') return false;
    if (i.topic?.grade !== job.grade) return false;
    if (String(i.topic?.subject || '').toUpperCase() !== job.subject.toUpperCase()) return false;
    const k = topicKey(i.topic.grade, i.topic.subject, i.topic.topicNumber, i.topic.topicName, i.topic.slug);
    return k === lessonKey;
  };
  const dropVideo = (i) => {
    if (i.type !== 'video-script') return false;
    if (i.topic?.grade !== job.grade) return false;
    if (String(i.topic?.subject || '').toUpperCase() !== job.subject.toUpperCase()) return false;
    const k = topicKey(i.topic.grade, i.topic.subject, i.topic.topicNumber, i.topic.topicName, i.topic.slug);
    return k === lessonKey;
  };

  for (const old of index.filter((i) => dropLesson(i) || dropVideo(i))) {
    const p = join(CONTENT_DIR, `${old.id}.json`);
    if (existsSync(p)) {
      try {
        unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
  index = index.filter((i) => !dropLesson(i) && !dropVideo(i) && i.id !== lessonId && i.id !== videoId);

  writeFileSync(join(CONTENT_DIR, `${lessonId}.json`), JSON.stringify(lesson));
  writeFileSync(join(CONTENT_DIR, `${videoId}.json`), JSON.stringify(video));
  index.unshift(videoIndexEntry(video));
  index.unshift(indexEntry(lesson));

  ledger.ok++;
  sinceFlush++;
  process.stdout.write(sinceFlush % 50 === 0 ? `${ledger.ok}` : '.');

  if (sinceFlush >= 25) {
    writeFileSync(INDEX_FILE, JSON.stringify(index));
    sinceFlush = 0;
  }
}

writeFileSync(INDEX_FILE, JSON.stringify(index));
mkdirSync(dirname(LEDGER_FILE), { recursive: true });
writeFileSync(
  LEDGER_FILE,
  JSON.stringify(
    {
      ...ledger,
      failures: ledger.failures.slice(0, 100),
      elapsedSec: Math.round((Date.now() - t0) / 1000),
      indexSize: index.length,
    },
    null,
    2,
  ),
);

console.log(
  `\nDone. ok=${ledger.ok} fail=${ledger.fail} index=${index.length} ${Math.round((Date.now() - t0) / 1000)}s`,
);
