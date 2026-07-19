#!/usr/bin/env node
/** Apply Phase 2 subject discoveries to knowledge-base page.json files */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'knowledge-base');
const phase2 = JSON.parse(readFileSync(join(ROOT, 'phase2', 'dataset-summary.json'), 'utf8'));

function walk(dir, files = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, files);
    else if (f === 'page.json') files.push(p);
  }
  return files;
}

const pages = walk(ROOT);
let updated = 0;

for (const file of pages) {
  const page = JSON.parse(readFileSync(file, 'utf8'));
  const gradeMatch = file.match(/regular\/(grade-\d+)/);
  const sneMatch = file.match(/sne\/([^/]+)\/([^/]+)/);

  if (gradeMatch && phase2.subjectsByGrade[gradeMatch[1]]) {
    page.subjects = phase2.subjectsByGrade[gradeMatch[1]];
    page.phase2Updated = true;
    updated++;
  }

  if (sneMatch) {
    const [, type, grade] = sneMatch;
    const key = type === 'hearing-impairment' && grade === 'pp1' ? 'hi-pp' :
      type === 'hearing-impairment' && grade === 'grade-four-4-designs' ? 'hi-grade-4' : null;
    if (key && phase2.sneSubjects[key]) {
      page.subjects = phase2.sneSubjects[key];
      page.phase2Updated = true;
      updated++;
    }
  }

  page.phase2RunId = phase2.phase2RunId;
  writeFileSync(file, JSON.stringify(page, null, 2) + '\n');
}

const index = JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8'));
index.phase2RunId = phase2.phase2RunId;
index.phase2DatasetId = phase2.phase2DatasetId;
index.phase2Stats = {
  totalPages: phase2.totalPages,
  subjectsMappedGrades: Object.keys(phase2.subjectsByGrade).length,
  pagesUpdated: updated,
};
writeFileSync(join(ROOT, 'index.json'), JSON.stringify(index, null, 2) + '\n');
console.log(`Updated ${updated} page.json files with Phase 2 subjects`);
