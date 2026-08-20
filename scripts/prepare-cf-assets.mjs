#!/usr/bin/env node
/**
 * Copy/pack lesson JSON into web/public so Cloudflare Workers can serve it
 * as static assets. No D1 or R2 — just files.
 *
 * Skips SNE and the 82MB index.json (over the 25 MiB per-file limit).
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGULAR_GRADES, slugifySubject } from './cf-slug.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DIR = join(ROOT, 'web', 'data', 'content');
const PUBLIC_CONTENT = join(ROOT, 'web', 'public', 'data', 'content');
const RUNTIME = join(ROOT, 'web', 'public', 'data', 'runtime');
const CURRICULUM = join(ROOT, 'knowledge-base', 'phase5', 'curriculum-index.json');
const INDEX_PATH = join(CONTENT_DIR, 'index.json');

const EXAM_TYPES = new Set(['exam', 'termly-exam', 'mock-exam', 'premium-exam', 'past-paper']);
const GRADE_SET = new Set(REGULAR_GRADES);

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

function slimItem(item) {
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    topic: item.topic,
    metadata: {
      createdAt: item.metadata?.createdAt,
      wordCount: item.metadata?.wordCount,
      reviewed: item.metadata?.reviewed,
      access: item.metadata?.access,
      priceKes: item.metadata?.priceKes,
      category: item.metadata?.category,
      term: item.metadata?.term ?? null,
      contentSource: item.metadata?.contentSource,
      questionCount: item.metadata?.questionCount,
      linkedLessonId: item.metadata?.linkedLessonId,
      year: item.metadata?.year ?? null,
      series: item.metadata?.series,
      externalUrl: item.metadata?.externalUrl,
      downloadUrl: item.metadata?.downloadUrl,
      sourceSite: item.metadata?.sourceSite,
    },
    sources: [],
  };
}

function examCategory(item) {
  if (item.metadata?.category) return item.metadata.category;
  switch (item.type) {
    case 'termly-exam':
      return 'termly';
    case 'mock-exam':
      return 'mock';
    case 'premium-exam':
      return 'premium';
    case 'past-paper':
      return 'vault';
    default:
      return 'general';
  }
}

function resetDir(dir) {
  rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

if (!existsSync(INDEX_PATH)) {
  console.error('Missing', INDEX_PATH);
  process.exit(1);
}

console.log('Loading content index…');
const index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
resetDir(PUBLIC_CONTENT);
resetDir(RUNTIME);

const lessonsByGrade = {};
const videosByGrade = {};
const examCounts = { general: 0, termly: 0, mock: 0, premium: 0, vault: 0, byGrade: {} };
const examIdMap = {};
const examPacks = {};
let copied = 0;
let skipped = 0;

function bumpCount(grade, category) {
  examCounts[category] = (examCounts[category] || 0) + 1;
  examCounts.byGrade[grade] ||= {};
  examCounts.byGrade[grade][category] = (examCounts.byGrade[grade][category] || 0) + 1;
}

for (const item of index) {
  const grade = item.topic?.grade;
  if (!GRADE_SET.has(grade)) {
    skipped += 1;
    continue;
  }

  if (item.type === 'topic-lesson') {
    const src = join(CONTENT_DIR, `${item.id}.json`);
    if (!existsSync(src) || statSync(src).size === 0) {
      skipped += 1;
      continue;
    }
    copyFileSync(src, join(PUBLIC_CONTENT, `${item.id}.json`));
    copied += 1;
    (lessonsByGrade[grade] ||= []).push(slimItem(item));
    continue;
  }

  if (item.type === 'video-script') {
    const src = join(CONTENT_DIR, `${item.id}.json`);
    if (!existsSync(src) || statSync(src).size === 0) {
      skipped += 1;
      continue;
    }
    copyFileSync(src, join(PUBLIC_CONTENT, `${item.id}.json`));
    copied += 1;
    (videosByGrade[grade] ||= []).push(slimItem(item));
    continue;
  }

  if (EXAM_TYPES.has(item.type)) {
    const src = join(CONTENT_DIR, `${item.id}.json`);
    if (!existsSync(src) || statSync(src).size === 0) {
      skipped += 1;
      continue;
    }
    const full = JSON.parse(readFileSync(src, 'utf8'));
    const category = examCategory(item);
    const subjectSlug = slugifySubject(item.topic?.subject || 'general');
    const packKey = `${grade}/${category}/${subjectSlug}.json`;
    (examPacks[packKey] ||= []).push(full);
    examIdMap[item.id] = { grade, category, subjectSlug };
    bumpCount(grade, category);
    continue;
  }

  skipped += 1;
}

ensureDir(join(RUNTIME, 'lessons'));
ensureDir(join(RUNTIME, 'videos'));
ensureDir(join(RUNTIME, 'exam-packs'));

for (const grade of REGULAR_GRADES) {
  writeFileSync(join(RUNTIME, 'lessons', `${grade}.json`), JSON.stringify(lessonsByGrade[grade] || []));
  writeFileSync(join(RUNTIME, 'videos', `${grade}.json`), JSON.stringify(videosByGrade[grade] || []));
}

for (const [packKey, papers] of Object.entries(examPacks)) {
  const dest = join(RUNTIME, 'exam-packs', packKey);
  ensureDir(dirname(dest));
  writeFileSync(dest, JSON.stringify(papers));
}

writeFileSync(join(RUNTIME, 'exam-id-map.json'), JSON.stringify(examIdMap));
writeFileSync(join(RUNTIME, 'exam-counts.json'), JSON.stringify(examCounts));

if (existsSync(CURRICULUM)) {
  const curriculum = JSON.parse(readFileSync(CURRICULUM, 'utf8'));
  curriculum.grades = (curriculum.grades || []).filter((g) => GRADE_SET.has(g.grade));
  writeFileSync(join(RUNTIME, 'curriculum-index.json'), JSON.stringify(curriculum));
}

const manifest = {
  copiedFiles: copied,
  skipped,
  lessonGrades: Object.fromEntries(REGULAR_GRADES.map((g) => [g, (lessonsByGrade[g] || []).length])),
  examPacks: Object.keys(examPacks).length,
  examIds: Object.keys(examIdMap).length,
};
writeFileSync(join(RUNTIME, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(JSON.stringify(manifest, null, 2));
console.log('Cloudflare static assets ready under web/public/data/');
