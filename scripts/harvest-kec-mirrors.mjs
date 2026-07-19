#!/usr/bin/env node
/**
 * Harvest downloadable KEC mirror links from lms.kec.ac.ke.
 *
 * Targets:
 *  - /ebooks/ Apache directory listings (direct PDFs)
 *  - Moodle category trees for Primary (Gr 1-6) and Junior School (Gr 7-9)
 *  - pluginfile.php and embedded /ebooks/ links inside courses
 *
 * Usage:
 *   node scripts/harvest-kec-mirrors.mjs
 *   node scripts/harvest-kec-mirrors.mjs --ebooks-only
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EBOOKS_BASE,
  LMS_BASE,
  ROOT_CATEGORIES,
  GRADE_CATEGORY_IDS,
  EBOOK_CATEGORY_BY_GRADE,
  buildMirrorRecord,
  extractCategoryLinks,
  extractDirectoryLinks,
  extractLinksFromHtml,
  inferGradeFromText,
  inferSubjectFromText,
  isDownloadableFile,
} from './kec-harvest-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', 'knowledge-base', 'phase2', 'kec-mirrors.json');
const USER_AGENT = 'Mozilla/5.0 (compatible; KEC-Mirror-Harvester/1.0)';

const ebooksOnly = process.argv.includes('--ebooks-only');
const visitedCategories = new Set();
const visitedCourses = new Set();
const visitedDirs = new Set();
const mirrors = new Map();

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    redirect: 'follow',
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

function addMirror(record) {
  if (!record?.url || !isDownloadableFile(record.url)) return;
  const existing = mirrors.get(record.url);
  if (!existing) {
    mirrors.set(record.url, record);
    return;
  }
  for (const key of ['title', 'grade', 'subject', 'sourceUrl', 'courseId', 'categoryId']) {
    if (!existing[key] && record[key]) existing[key] = record[key];
  }
}

function resolveGrade(context, ...textParts) {
  return inferGradeFromText(...textParts) || context.grade || null;
}

function resolveSubject(context, ...textParts) {
  return inferSubjectFromText(...textParts) || context.subject || null;
}

async function crawlEbooksDirectory(startUrl = `${EBOOKS_BASE}/`, context = {}) {
  const queue = [startUrl];
  while (queue.length > 0) {
    const dirUrl = queue.shift();
    if (visitedDirs.has(dirUrl)) continue;
    visitedDirs.add(dirUrl);

    let html;
    try {
      html = await fetchText(dirUrl.endsWith('/') ? dirUrl : `${dirUrl}/`);
    } catch (error) {
      console.warn(`  ebooks skip ${dirUrl}: ${error.message}`);
      continue;
    }

    const entries = extractDirectoryLinks(html, dirUrl);
    for (const entry of entries) {
      if (entry.endsWith('/')) {
        queue.push(entry);
        continue;
      }
      const grade = resolveGrade(context, entry, dirUrl);
      const subject = resolveSubject(context, entry, dirUrl);
      addMirror(
        buildMirrorRecord({
          url: entry,
          title: decodeURIComponent(entry.split('/').pop()),
          grade,
          subject,
          sourceType: 'kec-ebooks-directory',
          sourceUrl: dirUrl,
        }),
      );
    }
  }
}

async function crawlCategory(categoryId, context = {}) {
  if (visitedCategories.has(categoryId)) return;
  visitedCategories.add(categoryId);

  const url = `${LMS_BASE}/course/index.php?categoryid=${categoryId}`;
  let html;
  try {
    html = await fetchText(url);
  } catch (error) {
    console.warn(`  category skip ${categoryId}: ${error.message}`);
    return;
  }

  const grade = resolveGrade(context, context.label || '', html);
  const { categories, courseLinks } = extractCategoryLinks(html);

  for (const course of courseLinks) {
    await crawlCourse(course.id, {
      ...context,
      grade: resolveGrade(context, course.label) || GRADE_CATEGORY_IDS[categoryId] || null,
      subject: resolveSubject(context, course.label),
      categoryId,
      courseLabel: course.label,
      courseUrl: course.url,
    });
  }

  for (const sub of categories) {
    if (visitedCategories.has(sub.id)) continue;
    await crawlCategory(sub.id, {
      ...context,
      grade: GRADE_CATEGORY_IDS[sub.id] || grade,
      label: sub.label,
      parentCategoryId: categoryId,
    });
  }
}

async function crawlCourse(courseId, context = {}) {
  if (visitedCourses.has(courseId)) return;
  visitedCourses.add(courseId);

  const courseUrl = context.courseUrl || `${LMS_BASE}/course/view.php?id=${courseId}`;
  let html;
  try {
    html = await fetchText(courseUrl);
  } catch (error) {
    console.warn(`  course skip ${courseId}: ${error.message}`);
    return;
  }

  const courseTitle = context.courseLabel || html.match(/<title>([^<]+)<\/title>/i)?.[1] || `course-${courseId}`;
  const grade = resolveGrade(context, courseTitle, html);
  const subject = resolveSubject(context, courseTitle, html);

  for (const link of extractLinksFromHtml(html, courseUrl)) {
    if (!isDownloadableFile(link)) continue;
    addMirror(
      buildMirrorRecord({
        url: link,
        title: decodeURIComponent(link.split('/').pop()),
        grade: resolveGrade(context, link, courseTitle),
        subject: resolveSubject(context, link, courseTitle),
        sourceType: link.includes('/ebooks/') ? 'kec-ebooks-embed' : 'kec-pluginfile',
        sourceUrl: courseUrl,
        courseId,
        categoryId: context.categoryId ?? null,
      }),
    );
  }

  const modPages = [...html.matchAll(/mod\/page\/view\.php\?id=(\d+)/g)].map((m) => Number(m[1]));
  for (const pageId of modPages) {
    const pageUrl = `${LMS_BASE}/mod/page/view.php?id=${pageId}`;
    try {
      const pageHtml = await fetchText(pageUrl);
      for (const link of extractLinksFromHtml(pageHtml, pageUrl)) {
        if (!isDownloadableFile(link)) continue;
        addMirror(
          buildMirrorRecord({
            url: link,
            title: decodeURIComponent(link.split('/').pop()),
            grade: resolveGrade(context, link, courseTitle),
            subject: resolveSubject(context, link, courseTitle),
            sourceType: link.includes('/ebooks/') ? 'kec-ebooks-embed' : 'kec-pluginfile',
            sourceUrl: pageUrl,
            courseId,
            categoryId: context.categoryId ?? null,
          }),
        );
      }
    } catch {
      // Non-fatal: some mod pages are gated or empty.
    }
  }
}

console.log('KEC mirror harvest starting...');

console.log('\n1) Crawling /ebooks/ directory listings');
await crawlEbooksDirectory();
console.log(`   found ${mirrors.size} files so far`);

if (!ebooksOnly) {
  console.log('\n2) Crawling Primary and Junior School LMS categories');
  for (const root of Object.values(ROOT_CATEGORIES)) {
    console.log(`   root: ${root.label} (${root.id})`);
    await crawlCategory(root.id, { label: root.label });
  }

  console.log('\n3) Crawling per-grade Ebook categories (Grades 1-3)');
  for (const [gradeCatId, ebookCatId] of Object.entries(EBOOK_CATEGORY_BY_GRADE)) {
    const grade = GRADE_CATEGORY_IDS[Number(gradeCatId)];
    console.log(`   ${grade}: category ${ebookCatId}`);
    await crawlCategory(Number(ebookCatId), { grade, label: `${grade} ebooks` });
  }
}

const records = [...mirrors.values()].sort((a, b) => a.url.localeCompare(b.url));
for (const record of records) {
  record.grade = inferGradeFromText(record.title, record.filename, record.url) || record.grade;
  record.subject = inferSubjectFromText(record.title, record.filename, record.url) || record.subject;
}
const summary = {
  generatedAt: new Date().toISOString(),
  source: 'lms.kec.ac.ke',
  totalMirrors: records.length,
  bySourceType: records.reduce((acc, item) => {
    acc[item.sourceType] = (acc[item.sourceType] || 0) + 1;
    return acc;
  }, {}),
  byGrade: records.reduce((acc, item) => {
    const key = item.grade || 'unknown';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {}),
  categoriesVisited: visitedCategories.size,
  coursesVisited: visitedCourses.size,
  ebookDirsVisited: visitedDirs.size,
  mirrors: records,
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(summary, null, 2)}\n`);

console.log('\nDone');
console.log(`  total mirrors: ${records.length}`);
console.log(`  categories visited: ${visitedCategories.size}`);
console.log(`  courses visited: ${visitedCourses.size}`);
console.log(`  ebook dirs visited: ${visitedDirs.size}`);
console.log(`  saved: ${OUTPUT}`);
