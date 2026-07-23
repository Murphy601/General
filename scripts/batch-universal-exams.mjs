#!/usr/bin/env node
/**
 * Universal Agent 5 batch — ≥20 real papers per subject × tier for PP1–Grade 12.
 * Purges outcome-paste KICD junk (original-from-kicd-design) for those grades.
 *
 * Usage:
 *   node scripts/batch-universal-exams.mjs
 *   node scripts/batch-universal-exams.mjs --grade grade-4
 *   node scripts/batch-universal-exams.mjs --grade pp1
 *   node scripts/batch-universal-exams.mjs --purge-only
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateUniversalPaper, TIER } from './study-drama/universal-exam.mjs';
import { CONFIG } from './study-drama/config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT_DIR = join(ROOT, 'web', 'data', 'content');
const INDEX_FILE = join(CONTENT_DIR, 'index.json');
const CURRICULUM = join(ROOT, 'knowledge-base', 'phase5', 'curriculum-index.json');
const LEDGER_FILE = join(ROOT, 'knowledge-base', 'phase5', 'universal-exam-ledger.json');

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
const CATEGORIES = Object.keys(TIER);
const PAPERS = CONFIG.PAPERS_PER_SUBJECT || 20;

function parseArgs(argv) {
  const args = { grade: null, subject: null, purgeOnly: false, keepG8Is: true };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--grade') args.grade = argv[++i];
    else if (argv[i] === '--subject') args.subject = argv[++i];
    else if (argv[i] === '--purge-only') args.purgeOnly = true;
    else if (argv[i] === '--replace-g8-is') args.keepG8Is = false;
  }
  return args;
}

function loadIndex() {
  if (!existsSync(INDEX_FILE)) return [];
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
}

function gradeLabel(grade) {
  const g = String(grade || '');
  if (/^pp1$/i.test(g)) return 'PP1';
  if (/^pp2$/i.test(g)) return 'PP2';
  return g.replace(/^grade-(\d+)$/i, (_, n) => `Grade ${n}`);
}

function isG8IntegratedScience(item) {
  return (
    item.topic?.grade === 'grade-8' &&
    /INTEGRATED\s*SCIENCE/i.test(String(item.topic?.subject || '')) &&
    item.metadata?.contentSource === 'study-drama-exam-v1'
  );
}

function subjectMatch(itemSubject, filter) {
  if (!filter) return true;
  const a = String(itemSubject || '').toUpperCase();
  const b = String(filter).toUpperCase();
  return a === b || a.includes(b) || b.includes(a);
}

function isJunkExam(item, grades, subjectFilter) {
  if (!['exam', 'termly-exam', 'mock-exam', 'premium-exam', 'quiz'].includes(item.type)) return false;
  if (!grades.includes(item.topic?.grade)) return false;
  if (!subjectMatch(item.topic?.subject, subjectFilter)) return false;
  const src = item.metadata?.contentSource || item.metadata?.sourceStrategy || '';
  return src === 'original-from-kicd-design' || src === '' || /kicd-design/i.test(src);
}

function isStaleUniversal(item, grades, subjectFilter) {
  // Replace previous universal runs for target grades (idempotent regenerate)
  if (!grades.includes(item.topic?.grade)) return false;
  if (!subjectMatch(item.topic?.subject, subjectFilter)) return false;
  if (!['exam', 'termly-exam', 'mock-exam', 'premium-exam'].includes(item.type)) return false;
  return item.metadata?.contentSource === 'universal-exam-v1';
}

function indexEntry(content) {
  return {
    ...content,
    pages: {
      lesson: '',
      quiz: (content.pages?.quiz || '').slice(0, 220) + '…',
      answers: (content.pages?.answers || '').slice(0, 160) + '…',
      studyPages: [],
    },
  };
}

function loadCurriculumSubjects(grades) {
  const idx = JSON.parse(readFileSync(CURRICULUM, 'utf8'));
  const out = [];
  for (const g of idx.grades || []) {
    const grade = g.grade || g.id;
    if (!grades.includes(grade)) continue;
    for (const s of Object.values(g.subjects || {})) {
      const subject = s.subject || s.subjectName;
      if (!subject) continue;
      out.push({
        grade,
        gradeLabel: g.label || gradeLabel(grade),
        subject,
        topics: Array.isArray(s.topics) ? s.topics : [],
      });
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const grades = args.grade ? [args.grade] : TARGET_GRADES;

console.log(`Universal exams — grades: ${grades.join(', ')} · ${PAPERS} papers/tier · tiers: ${CATEGORIES.join(', ')}`);

mkdirSync(CONTENT_DIR, { recursive: true });
let index = loadIndex();
let purged = 0;

// Purge junk + previous universal for target grades/subjects (keep G8 IS study-drama papers)
const keep = [];
for (const item of index) {
  const dropJunk = isJunkExam(item, grades, args.subject);
  const dropOldUniversal = isStaleUniversal(item, grades, args.subject);
  const drop = dropJunk || dropOldUniversal;
  if (drop) {
    if (args.keepG8Is && isG8IntegratedScience(item)) {
      keep.push(item);
      continue;
    }
    const p = join(CONTENT_DIR, `${item.id}.json`);
    if (existsSync(p)) {
      try {
        unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
    purged++;
  } else {
    keep.push(item);
  }
}
index = keep;
console.log(`Purged ${purged} old/junk exam records`);

if (args.purgeOnly) {
  writeFileSync(INDEX_FILE, JSON.stringify(index));
  console.log('Purge-only done.');
  process.exit(0);
}

let subjects = loadCurriculumSubjects(grades);
if (args.subject) {
  const want = args.subject.toUpperCase();
  subjects = subjects.filter((s) => s.subject.toUpperCase() === want || s.subject.toUpperCase().includes(want));
}

// Skip regenerating G8 Integrated Science if we keep the dedicated engine papers
if (args.keepG8Is) {
  subjects = subjects.filter(
    (s) => !(s.grade === 'grade-8' && /INTEGRATED\s*SCIENCE/i.test(s.subject)),
  );
}

console.log(`Subjects to generate: ${subjects.length}`);

const ledger = { version: 1, createdAt: new Date().toISOString(), counts: {} };
let created = 0;
const t0 = Date.now();

function flushIndex() {
  writeFileSync(INDEX_FILE, JSON.stringify(index));
}

for (const sub of subjects) {
  const label = `${sub.grade} / ${sub.subject}`;
  process.stdout.write(`→ ${label} …`);
  const subStart = Date.now();
  for (const category of CATEGORIES) {
    for (let i = 0; i < PAPERS; i++) {
      let paper;
      try {
        paper = generateUniversalPaper({
          grade: sub.grade,
          gradeLabel: sub.gradeLabel,
          subject: sub.subject,
          topics: sub.topics,
          category,
          paperIndex: i,
          term: null,
        });
      } catch (err) {
        console.error(`\nFAIL ${label} ${category} #${i + 1}: ${err.message}`);
        throw err;
      }
      writeFileSync(join(CONTENT_DIR, `${paper.id}.json`), JSON.stringify(paper));
      index.push(indexEntry(paper));
      created++;
    }
  }
  const key = `${sub.grade}|${sub.subject}`;
  ledger.counts[key] = PAPERS * CATEGORIES.length;
  console.log(` ${PAPERS * CATEGORIES.length} papers (${Date.now() - subStart}ms)`);
  // Checkpoint index every subject so a crash does not lose the purge
  if (created % 400 < PAPERS * CATEGORIES.length) flushIndex();
}

flushIndex();
mkdirSync(dirname(LEDGER_FILE), { recursive: true });
writeFileSync(LEDGER_FILE, JSON.stringify({ ...ledger, created, purged }, null, 2));

console.log(
  `Done. Created ${created} papers, purged ${purged}. Index size ${index.length}. ${Math.round((Date.now() - t0) / 1000)}s`,
);
