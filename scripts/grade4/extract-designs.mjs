#!/usr/bin/env node
/**
 * Write each official Grade 4 KICD curriculum design as plain text to
 * knowledge-base/grade-4/designs/<slug>.txt so syllabus entries can be checked word-for-word.
 *
 * Usage: node scripts/grade4/extract-designs.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { GRADE4_SUBJECTS } from './subjects.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const JSON_PATH = join(ROOT, 'knowledge-base', 'phase3', 'curriculum-text.json');
const GZ_PATH = `${JSON_PATH}.gz`;
const OUT_DIR = join(ROOT, 'knowledge-base', 'grade-4', 'designs');

function loadCatalog() {
  if (existsSync(JSON_PATH)) return JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  return JSON.parse(gunzipSync(readFileSync(GZ_PATH)).toString('utf8'));
}

const catalog = loadCatalog();
mkdirSync(OUT_DIR, { recursive: true });

const manifest = [];
for (const s of GRADE4_SUBJECTS) {
  const doc = catalog.documents.find((d) => d.fileId === s.fileId);
  if (!doc?.extractedText) throw new Error(`Design ${s.fileId} (${s.subject}) missing from curriculum-text`);
  const text = doc.extractedText.replace(/\r\n/g, '\n');
  writeFileSync(join(OUT_DIR, `${s.slug}.txt`), text);
  const pages = (text.match(/Page \d+ of (\d+)/) || [])[1];
  manifest.push({
    slug: s.slug,
    subject: s.subject,
    fileId: s.fileId,
    sourceUrl: doc.sourceUrl || doc.previewUrl || `https://drive.google.com/file/d/${s.fileId}/view`,
    pages: pages ? Number(pages) : null,
    chars: text.length,
    publisher: 'Kenya Institute of Curriculum Development (KICD)',
    edition: 'First Published 2017, Revised 2024',
  });
  console.log(`${s.slug.padEnd(24)} ${String(text.length).padStart(7)} chars`);
}
writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Wrote ${manifest.length} designs to ${OUT_DIR}`);
