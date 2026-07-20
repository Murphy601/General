#!/usr/bin/env node
/**
 * Populate Revision Hub with original CBC papers generated from KICD designs.
 *
 * Categories:
 *   general  — subject general assessment quizzes
 *   termly   — Term 1 / 2 / 3 exams
 *   mock     — end-of-year / KPSEA-style mocks
 *   premium  — longer advanced papers
 *
 * Usage:
 *   node scripts/batch-generate-exams.mjs --grade grade-4
 *   node scripts/batch-generate-exams.mjs --all --no-llm
 *   node scripts/batch-generate-exams.mjs --grade grade-1 --category termly
 */
import './load-env.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatGradeLabel, INDEX_PATH } from './curriculum-source.mjs';
import { buildExamFromTopics, paperTypeForCategory } from './exam-from-kicd.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'web', 'data', 'content');
const INDEX_FILE = join(CONTENT_DIR, 'index.json');
const MANIFEST = join(__dirname, '..', 'knowledge-base', 'phase5', 'exam-manifest.json');

const REGULAR_GRADES = [
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
];

function parseArgs(argv) {
  const args = {
    grade: null,
    subject: null,
    category: null,
    all: false,
    dryRun: false,
    reset: false,
    limitSubjects: 0,
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--grade') args.grade = argv[++i];
    else if (argv[i] === '--subject') args.subject = argv[++i];
    else if (argv[i] === '--category') args.category = argv[++i];
    else if (argv[i] === '--all') args.all = true;
    else if (argv[i] === '--dry-run') args.dryRun = true;
    else if (argv[i] === '--reset') args.reset = true;
    else if (argv[i] === '--limit-subjects') args.limitSubjects = Number(argv[++i]);
    else if (argv[i] === '--no-llm') {
      /* accepted for CLI compatibility */
    }
  }
  return args;
}

function loadManifest() {
  if (!existsSync(MANIFEST)) return { version: 1, completed: [] };
  return JSON.parse(readFileSync(MANIFEST, 'utf8'));
}

function saveManifest(m) {
  mkdirSync(dirname(MANIFEST), { recursive: true });
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2));
}

function loadIndex() {
  if (!existsSync(INDEX_FILE)) return [];
  return JSON.parse(readFileSync(INDEX_FILE, 'utf8'));
}

function saveContent(content) {
  mkdirSync(CONTENT_DIR, { recursive: true });
  writeFileSync(join(CONTENT_DIR, `${content.id}.json`), JSON.stringify(content, null, 2));

  let index = loadIndex();
  const samePaper = (i) =>
    ['quiz', 'exam', 'termly-exam', 'mock-exam', 'premium-exam'].includes(i.type) &&
    i.topic?.grade === content.topic.grade &&
    String(i.topic?.subject || '').toUpperCase() === String(content.topic.subject || '').toUpperCase() &&
    i.metadata?.category === content.metadata.category &&
    (i.metadata?.term || null) === (content.metadata.term || null) &&
    i.title === content.title;

  index = index.filter((i) => i.id !== content.id && !samePaper(i));
  index.unshift({
    ...content,
    body: (content.pages?.quiz || '').slice(0, 220) + '…',
    pages: {
      lesson: '',
      quiz: (content.pages?.quiz || '').slice(0, 220) + '…',
      answers: '',
    },
  });
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2));
}

function examKey({ grade, subject, category, term, title }) {
  return `exam-v1|${grade}|${subject}|${category}|${term || '-'}|${title}`;
}

function chunkTopics(topics, parts) {
  if (!topics.length) return Array.from({ length: parts }, () => []);
  const size = Math.ceil(topics.length / parts);
  const out = [];
  for (let i = 0; i < parts; i += 1) {
    out.push(topics.slice(i * size, (i + 1) * size));
  }
  return out;
}

function plansForSubject(gradeEntry, subjectEntry, onlyCategory) {
  const grade = gradeEntry.grade;
  const gradeLabel = gradeEntry.label || formatGradeLabel(grade);
  const subject = subjectEntry.subject;
  const topics = subjectEntry.topics || [];
  const plans = [];

  const want = (cat) => !onlyCategory || onlyCategory === cat;

  if (want('general')) {
    plans.push({
      category: 'general',
      term: null,
      title: `${gradeLabel} ${subject} — General Assessment`,
      topics: topics.slice(0, 8),
    });
  }

  if (want('termly')) {
    const [t1, t2, t3] = chunkTopics(topics, 3);
    plans.push(
      {
        category: 'termly',
        term: 1,
        title: `${gradeLabel} ${subject} — Term 1 Exam`,
        topics: t1.length ? t1 : topics.slice(0, 6),
      },
      {
        category: 'termly',
        term: 2,
        title: `${gradeLabel} ${subject} — Term 2 Exam`,
        topics: t2.length ? t2 : topics.slice(0, 6),
      },
      {
        category: 'termly',
        term: 3,
        title: `${gradeLabel} ${subject} — Term 3 Exam`,
        topics: t3.length ? t3 : topics.slice(0, 6),
      },
    );
  }

  if (want('mock')) {
    plans.push({
      category: 'mock',
      term: null,
      title: `${gradeLabel} ${subject} — Mock Exam`,
      topics: topics.slice(0, 10),
    });
  }

  if (want('premium')) {
    plans.push({
      category: 'premium',
      term: null,
      title: `${gradeLabel} ${subject} — Premium Revision Paper`,
      topics: topics.slice(0, 12),
    });
  }

  return plans.map((p) => ({ ...p, grade, gradeLabel, subject }));
}

const args = parseArgs(process.argv);
if (!existsSync(INDEX_PATH)) {
  console.error('Run npm run content:index first');
  process.exit(1);
}

const curriculum = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
let manifest = loadManifest();
if (args.reset) {
  manifest = { version: 1, completed: [] };
  saveManifest(manifest);
}

let grades = curriculum.grades.filter((g) => REGULAR_GRADES.includes(g.grade));
if (args.grade) grades = grades.filter((g) => g.grade === args.grade);
if (!args.all && !args.grade) {
  console.error('Use --grade grade-4 or --all');
  process.exit(1);
}

let created = 0;
let skipped = 0;

for (const gradeEntry of grades) {
  console.log(`\n=== ${gradeEntry.label || gradeEntry.grade} ===`);
  let subjects = Object.values(gradeEntry.subjects || {}).filter((s) => (s.topics || []).length > 0);
  if (args.subject) {
    subjects = subjects.filter((s) => s.subject.toLowerCase().includes(args.subject.toLowerCase()));
  }
  if (args.limitSubjects > 0) subjects = subjects.slice(0, args.limitSubjects);

  for (const subjectEntry of subjects) {
    const plans = plansForSubject(gradeEntry, subjectEntry, args.category);
    for (const plan of plans) {
      const key = examKey(plan);
      if (manifest.completed.includes(key)) {
        skipped += 1;
        continue;
      }

      if (args.dryRun) {
        console.log(`  DRY: ${plan.title} (${plan.topics.length} topics)`);
        continue;
      }

      const built = buildExamFromTopics({
        grade: plan.grade,
        gradeLabel: plan.gradeLabel,
        subject: plan.subject,
        topics: plan.topics,
        category: plan.category,
        term: plan.term,
        title: plan.title,
      });

      const content = {
        id: randomUUID(),
        type: paperTypeForCategory(plan.category),
        title: built.title,
        topic: {
          grade: plan.grade,
          gradeLabel: plan.gradeLabel,
          subject: plan.subject,
        },
        pages: built.pages,
        metadata: {
          createdAt: new Date().toISOString(),
          wordCount: (built.pages.quiz || '').split(/\s+/).length,
          reviewed: false,
          ...built.metadata,
        },
        sources: [
          {
            id: 'kicd-design',
            grade: plan.grade,
            subject: plan.subject,
            excerpt: 'Original assessment generated from KICD curriculum design topics/outcomes.',
          },
        ],
      };

      saveContent(content);
      manifest.completed.push(key);
      saveManifest(manifest);
      created += 1;
      console.log(`  ✓ ${plan.category}: ${built.title} (${built.questionCount} Qs)`);
    }
  }
}

console.log(`\nDone. Created ${created}, skipped ${skipped}.`);
