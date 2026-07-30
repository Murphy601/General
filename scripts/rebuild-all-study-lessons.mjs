#!/usr/bin/env node
/**
 * Rebuild ALL learner study lessons for PP1–Grade 9 (Strategy 2).
 * Usage: node scripts/rebuild-all-study-lessons.mjs
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const grades = [
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

for (const grade of grades) {
  console.log(`\n########## ${grade} ##########`);
  const r = spawnSync(
    process.execPath,
    ['scripts/batch-generate-lessons.mjs', '--grade', grade, '--no-llm', '--delay', '0', '--reset'],
    { cwd: root, stdio: 'inherit' },
  );
  if (r.status !== 0) {
    console.error(`Failed on ${grade}`);
    process.exit(r.status || 1);
  }
}

console.log('\nAll PP1–Grade 9 study lessons rebuilt.');

// Multi-page Grade 8 Integrated Science (notes + paywall) must win over the
// single-page classroom template — always re-apply after a full rebuild.
console.log('\n########## grade-8 integrated science (multi-page) ##########');
const g8 = spawnSync(process.execPath, ['scripts/build-g8-integrated-science-pages.mjs'], {
  cwd: root,
  stdio: 'inherit',
});
if (g8.status !== 0) {
  console.error('Failed rebuilding Grade 8 Integrated Science multi-page lessons');
  process.exit(g8.status || 1);
}

console.log('\nRebuild complete (multi-page G8 Integrated Science restored).');
