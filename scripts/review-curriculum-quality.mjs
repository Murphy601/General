#!/usr/bin/env node
/**
 * Review curriculum-text.json extraction quality.
 *
 * Usage:
 *   node scripts/review-curriculum-quality.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = join(__dirname, '..', 'knowledge-base', 'phase3', 'curriculum-text.json');

if (!existsSync(INPUT)) {
  console.error(`Missing ${INPUT}`);
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(INPUT, 'utf8'));
const docs = catalog.documents || [];

const byStatus = {};
let totalChars = 0;
let usable = 0;

for (const doc of docs) {
  byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;
  totalChars += doc.charCount || 0;
  if (doc.charCount >= 300 && doc.status !== 'empty' && doc.status !== 'error') usable += 1;
}

const avgChars = docs.length ? Math.round(totalChars / docs.length) : 0;
const passRate = docs.length ? ((usable / docs.length) * 100).toFixed(1) : '0.0';

console.log('Curriculum Text Quality Review');
console.log('==============================');
console.log(`Source: ${catalog.source}`);
console.log(`Generated: ${catalog.generatedAt}`);
console.log(`Documents: ${docs.length}`);
console.log(`By status:`, byStatus);
console.log(`Avg chars/doc: ${avgChars}`);
console.log(`Usable (>=300 chars): ${usable} (${passRate}%)`);

const samples = docs
  .filter((d) => d.charCount >= 500)
  .slice(0, 5)
  .map((d) => ({
    fileId: d.fileId,
    grade: d.grade,
    status: d.status,
    charCount: d.charCount,
    preview: d.extractedText?.slice(0, 120)?.replace(/\s+/g, ' '),
  }));

if (samples.length) {
  console.log('\nSample extractions:');
  for (const s of samples) {
    console.log(`- ${s.fileId} [${s.grade}] ${s.status} (${s.charCount} chars)`);
    console.log(`  "${s.preview}..."`);
  }
}

const pilotPass = usable / Math.max(docs.length, 1) >= 0.7;
console.log(`\nPilot gate (>=70% usable): ${pilotPass ? 'PASS' : 'FAIL'}`);
process.exit(pilotPass ? 0 : 1);
