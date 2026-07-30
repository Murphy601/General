#!/usr/bin/env node
/**
 * Build knowledge-base folder structure from Apify dataset export or Phase 1 snapshot.
 * Usage: node scripts/build-knowledge-base.mjs [dataset-json-path]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'knowledge-base');

// Phase 1 crawl results (dataset 4rvft4eo7PKWlPekp)
const PHASE1_ITEMS = [
  { url: 'https://kicd.ac.ke/cbc-materials/', title: 'CBC MATERIALS', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/approved-cbc-course-materials/', title: 'Approved CBC Course Materials', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/approved-complementary-materials/', title: 'Approved Complementary Materials', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/grade-11-textbook-procurement/', title: 'Grade 11 Textbooks Procurement', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/guidelines-on-parental-empowerment-and-engagement/', title: 'Guidelines on Parental Empowerment and Engagement', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/popular-slides-on-cbc/', title: 'Popular Slides on CBC', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/values-based-education-materials/', title: 'Values-based Education Materials', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/pre-primary/', title: 'Pre-Primary Curriculum Designs', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/lower-primary/', title: 'Lower Primary', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/', title: 'Curriculum Designs', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/', title: 'Regular Curriculum Designs', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/sne-curriculum-designs/', title: 'SNE Curriculum Designs', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/diploma-in-teacher-education/', title: 'Diploma in Teacher Education', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/sne-curriculum-designs/prevocational-curriculum-designs/', title: 'PREVOCATIONAL CURRICULUM DESIGNS', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/sne-curriculum-designs/vocational-level-designs/', title: 'VOCATIONAL LEVEL DESIGNS', status: 200, depth: 0 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/', title: 'Grade Four Designs', status: 200, depth: 1 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-five-designs/', title: 'Grade Five Designs', status: 200, depth: 1 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/', title: 'Grade Six Designs', status: 200, depth: 1 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/', title: 'Grade Seven Designs', status: 200, depth: 1 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/', title: 'Grade Eight Designs', status: 200, depth: 1 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/', title: 'Grade Nine Designs', status: 200, depth: 1 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-ten/', title: 'Grade Ten', status: 200, depth: 1 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eleven/', title: 'Grade Eleven', status: 200, depth: 1 },
  { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-twelve/', title: 'Grade Twelve', status: 200, depth: 1 },
];

const SNE_HI = [
  'hi-pp1-designs', 'hi-pp2-designs', 'hi-grade-one-1-designs', 'hi-grade-two-2-designs',
  'hi-grade-three-3-designs', 'hi-grade-four-4-designs', 'hi-grade-five5-designs',
  'hi-grade-six-6-designs', 'hi-grade-seven7', 'hi-grade-8', 'hi-grade-9', 'hi-grade-10',
];
const SNE_PI = [
  'pi-pp1-designs', 'pi-pp2-designs', 'pi-grade-one-1-design', 'pi-grade-two-2-designs',
  'pi-grade-three3-designs', 'pi-grade-four4-designs', 'pi-grade-five5-designs',
  'pi-grade-six-6-designs', 'pi-grade-seven7', 'pi-grade-8', 'pi-grade-9', 'pi-grade-10',
];
const SNE_VI = [
  'vi-pp1-designs', 'vi-pp2-designs', 'vi-grade-one-1-designs', 'vi-grade-two-2-designs',
  'vi-grade-three-3-designs', 'vi-grade-four-4-designs', 'vi-grade-five-5-designs',
  'vi-grade-six-6-designs', 'vi-grade-seven7', 'vi-grade-8', 'vi-grade-9', 'vi-grade-10',
];

const SNE_BASE = 'https://kicd.ac.ke/cbc-materials/curriculum-designs/sne-curriculum-designs/';

for (const slug of SNE_HI) {
  PHASE1_ITEMS.push({ url: SNE_BASE + slug + '/', title: `HI ${slug}`, status: 200, depth: 0, sneType: 'hearing-impairment' });
}
for (const slug of SNE_PI) {
  PHASE1_ITEMS.push({ url: SNE_BASE + slug + '/', title: `PI ${slug}`, status: 200, depth: 0, sneType: 'physical-impairment' });
}
for (const slug of SNE_VI) {
  PHASE1_ITEMS.push({ url: SNE_BASE + slug + '/', title: `VI ${slug}`, status: 200, depth: 0, sneType: 'visual-impairment' });
}

function classify(url) {
  if (url.includes('/sne-curriculum-designs/hi-')) return { category: 'sne', sub: 'hearing-impairment' };
  if (url.includes('/sne-curriculum-designs/pi-')) return { category: 'sne', sub: 'physical-impairment' };
  if (url.includes('/sne-curriculum-designs/vi-')) return { category: 'sne', sub: 'visual-impairment' };
  if (url.includes('/sne-curriculum-designs/prevocational')) return { category: 'sne', sub: 'prevocational' };
  if (url.includes('/sne-curriculum-designs/vocational')) return { category: 'sne', sub: 'vocational' };
  if (url.includes('/pre-primary')) return { category: 'pre-primary', sub: null };
  if (url.includes('/lower-primary')) return { category: 'lower-primary', sub: null };
  if (url.match(/grade-(four|five|six|seven|eight|nine|ten|eleven|twelve)/)) return { category: 'regular', sub: null };
  if (url.includes('/curriculum-designs/')) return { category: 'curriculum-roots', sub: null };
  return { category: 'general', sub: null };
}

function slugFromUrl(url) {
  const path = new URL(url).pathname.replace(/\/$/, '');
  return path.split('/').pop() || 'index';
}

function gradeLabel(url) {
  const m = url.match(/grade-(four|five|six|seven|eight|nine|ten|eleven|twelve)/);
  if (!m) return null;
  const map = { four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12' };
  return `grade-${map[m[1]]}`;
}

function sneGradeLabel(url) {
  const slug = slugFromUrl(url);
  if (slug.includes('pp1')) return 'pp1';
  if (slug.includes('pp2')) return 'pp2';
  const g = slug.match(/grade[- ]?(\d+|one|two|three|four|five|six|seven|eight|nine|ten)/i);
  if (g) return g[0].replace(/grade[- ]?/i, 'grade-').toLowerCase();
  return slug;
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function writePage(dir, item, extra = {}) {
  ensureDir(dir);
  const page = {
    url: item.url,
    title: item.title,
    httpStatus: item.status,
    crawlDepth: item.depth ?? 0,
    phase: 1,
    pdfLinks: [],
    subjectLinks: [],
    ...extra,
  };
  writeFileSync(join(dir, 'page.json'), JSON.stringify(page, null, 2) + '\n');
  return page;
}

const urlMap = {
  phase1RunId: 'Q6BEwe9YErgWNFAOm',
  phase1DatasetId: '4rvft4eo7PKWlPekp',
  generatedAt: new Date().toISOString(),
  general: [],
  prePrimary: [],
  lowerPrimary: [],
  curriculumRoots: [],
  regular: {},
  sne: {
    hearingImpairment: {},
    physicalImpairment: {},
    visualImpairment: {},
    prevocational: [],
    vocational: [],
  },
  brokenUrls: [
    { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/grade-four-designs/', fix: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-four-designs/' },
    { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/grade-five-designs/', fix: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-five-designs/' },
    { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/grade-six-designs/', fix: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-six-designs/' },
    { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/grade-seven-designs/', fix: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-seven-designs/' },
    { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/grade-eight-designs/', fix: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eight-designs/' },
    { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/grade-nine-designs/', fix: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-nine-designs/' },
    { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/grade-ten/', fix: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-ten/' },
    { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/grade-eleven/', fix: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-eleven/' },
    { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/regular-curriculum-designs/grade-twelve/', fix: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/grade-twelve/' },
    { url: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/sne-curriculum-designs/pi-grade-eight8/', fix: 'https://kicd.ac.ke/cbc-materials/curriculum-designs/sne-curriculum-designs/pi-grade-8/' },
  ],
};

const allPages = [];

for (const item of PHASE1_ITEMS) {
  if (item.status !== 200) continue;
  const { category, sub } = classify(item.url);
  const entry = { url: item.url, title: item.title, category, subcategory: sub };
  let dir;

  if (category === 'general') {
    dir = join(ROOT, 'general', slugFromUrl(item.url));
    urlMap.general.push(entry);
  } else if (category === 'pre-primary') {
    dir = join(ROOT, 'pre-primary', slugFromUrl(item.url));
    urlMap.prePrimary.push(entry);
  } else if (category === 'lower-primary') {
    dir = join(ROOT, 'lower-primary', slugFromUrl(item.url));
    urlMap.lowerPrimary.push(entry);
  } else if (category === 'curriculum-roots') {
    dir = join(ROOT, 'curriculum-roots', slugFromUrl(item.url));
    urlMap.curriculumRoots.push(entry);
  } else if (category === 'regular') {
    const g = gradeLabel(item.url);
    dir = join(ROOT, 'regular', g);
    urlMap.regular[g] = entry;
  } else if (category === 'sne') {
    if (sub === 'prevocational') {
      dir = join(ROOT, 'sne', 'prevocational', slugFromUrl(item.url));
      urlMap.sne.prevocational.push(entry);
    } else if (sub === 'vocational') {
      dir = join(ROOT, 'sne', 'vocational', slugFromUrl(item.url));
      urlMap.sne.vocational.push(entry);
    } else {
      const grade = sneGradeLabel(item.url);
      const sneKey = sub === 'hearing-impairment' ? 'hearingImpairment' : sub === 'physical-impairment' ? 'physicalImpairment' : 'visualImpairment';
      dir = join(ROOT, 'sne', sub, grade);
      if (!urlMap.sne[sneKey][grade]) urlMap.sne[sneKey][grade] = [];
      urlMap.sne[sneKey][grade].push(entry);
    }
  }

  if (dir) {
    const page = writePage(dir, item);
    allPages.push({ ...entry, path: dir.replace(ROOT + '/', '') });
  }
}

writeFileSync(join(ROOT, 'url-map.json'), JSON.stringify(urlMap, null, 2) + '\n');
writeFileSync(join(ROOT, 'index.json'), JSON.stringify({
  version: 1,
  phase1RunId: urlMap.phase1RunId,
  phase1DatasetId: urlMap.phase1DatasetId,
  phase2RunId: null,
  phase2DatasetId: null,
  generatedAt: urlMap.generatedAt,
  totalPages: allPages.length,
  pages: allPages,
  urlMapFile: 'url-map.json',
}, null, 2) + '\n');

console.log(`Built knowledge-base with ${allPages.length} pages`);
console.log(`  general: ${urlMap.general.length}`);
console.log(`  pre-primary: ${urlMap.prePrimary.length}`);
console.log(`  lower-primary: ${urlMap.lowerPrimary.length}`);
console.log(`  curriculum-roots: ${urlMap.curriculumRoots.length}`);
console.log(`  regular grades: ${Object.keys(urlMap.regular).length}`);
console.log(`  sne HI: ${Object.keys(urlMap.sne.hearingImpairment).length} grades`);
console.log(`  sne PI: ${Object.keys(urlMap.sne.physicalImpairment).length} grades`);
console.log(`  sne VI: ${Object.keys(urlMap.sne.visualImpairment).length} grades`);
