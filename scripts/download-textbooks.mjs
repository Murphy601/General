#!/usr/bin/env node
/**
 * Download KEC learner materials (PDF + EPUB) for Grade 4+ into knowledge-base/textbooks/raw/
 *
 * Usage:
 *   node scripts/download-textbooks.mjs
 *   node scripts/download-textbooks.mjs --grade grade-4
 *   node scripts/download-textbooks.mjs --limit 20
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { inferGradeFromText, inferSubjectFromText } from './kec-harvest-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MIRRORS = join(ROOT, 'knowledge-base', 'phase2', 'kec-mirrors.json');
const OUT_DIR = join(ROOT, 'knowledge-base', 'textbooks', 'raw');
const MANIFEST = join(ROOT, 'knowledge-base', 'textbooks', 'download-manifest.json');
const USER_AGENT = 'Mozilla/5.0 (compatible; CBC-Learn-Textbook-Harvest/1.0)';

function parseArgs(argv) {
  const args = { grade: null, limit: null, force: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--grade') args.grade = argv[++i];
    else if (argv[i] === '--limit') args.limit = Number(argv[++i]);
    else if (argv[i] === '--force') args.force = true;
  }
  return args;
}

function sanitize(name) {
  return String(name || 'file')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

function detectKind(url, buffer) {
  if (buffer.slice(0, 4).toString() === '%PDF') return 'pdf';
  if (buffer.slice(0, 2).toString() === 'PK') return 'epub';
  if (/\.epub/i.test(url)) return 'epub';
  if (/\.pdf/i.test(url)) return 'pdf';
  return null;
}

function resolveMeta(entry) {
  const title = entry.title || entry.filename || 'untitled';
  // Prefer filename/title grade over noisy LMS course context (many G1/G4 files mislabeled grade-9).
  const grade =
    inferGradeFromText(title, entry.filename) ||
    inferGradeFromText(entry.url) ||
    entry.grade ||
    'unknown';
  const subject =
    inferSubjectFromText(title, entry.filename, entry.url) ||
    entry.subject ||
    'general';
  return { title, grade, subject };
}

async function downloadOne(entry, force) {
  const meta = resolveMeta(entry);
  const cleanUrl = entry.url.replace(/\?forcedownload=1$/i, '');
  const baseName = sanitize(entry.filename || entry.title || 'file');
  const folder = join(OUT_DIR, meta.grade, meta.subject);
  mkdirSync(folder, { recursive: true });

  const response = await fetch(entry.url, {
    redirect: 'follow',
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) return { status: 'failed', reason: `HTTP ${response.status}`, ...meta };

  const buffer = Buffer.from(await response.arrayBuffer());
  const kind = detectKind(cleanUrl, buffer);
  if (!kind) {
    const head = buffer.toString('utf8', 0, 200);
    if (head.includes('<html') || head.includes('<!DOCTYPE')) {
      return { status: 'blocked', reason: 'html-not-file', ...meta };
    }
    return { status: 'failed', reason: 'unknown-format', ...meta };
  }

  const destName = baseName.toLowerCase().endsWith(`.${kind}`)
    ? baseName
    : `${baseName}.${kind}`;
  const destPath = join(folder, destName);
  if (!force && existsSync(destPath)) {
    return { status: 'skipped', path: destPath, kind, ...meta };
  }

  await pipeline(
    async function* () {
      yield buffer;
    },
    createWriteStream(destPath),
  );

  return {
    status: 'downloaded',
    path: destPath,
    kind,
    bytes: buffer.length,
    sourceUrl: entry.url,
    ...meta,
  };
}

function loadEntries(gradeFilter) {
  if (!existsSync(MIRRORS)) throw new Error(`Missing ${MIRRORS}. Run: npm run kec:harvest`);
  const data = JSON.parse(readFileSync(MIRRORS, 'utf8'));
  let entries = (data.mirrors || []).filter((m) => {
    const url = m.url || '';
    return /\.(pdf|epub)(\?|$)/i.test(url) || url.includes('/pluginfile.php/');
  });

  entries = entries.map((e) => {
    const meta = resolveMeta(e);
    return { ...e, ...meta };
  });

  entries = entries.filter((e) => {
    if (gradeFilter) return e.grade === gradeFilter;
    return true;
  });

  // Deduplicate by filename+grade+subject
  const seen = new Set();
  return entries.filter((e) => {
    const key = `${e.grade}|${e.subject}|${(e.filename || e.title || '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const args = parseArgs(process.argv);
let entries = loadEntries(args.grade);

// Sort: grade 4-12 first, then by subject
entries.sort((a, b) => {
  const ga = Number(String(a.grade).replace(/\D/g, '')) || 99;
  const gb = Number(String(b.grade).replace(/\D/g, '')) || 99;
  return ga - gb || String(a.subject).localeCompare(String(b.subject));
});

if (args.limit) entries = entries.slice(0, args.limit);

console.log(`Downloading ${entries.length} textbook/programme files...`);
const results = [];
for (const entry of entries) {
  try {
    const result = await downloadOne(entry, args.force);
    results.push(result);
    console.log(`  ${result.status}: ${result.grade}/${result.subject} — ${entry.title || entry.filename}`);
  } catch (err) {
    results.push({ status: 'error', reason: err.message, title: entry.title });
    console.log(`  error: ${entry.title} — ${err.message}`);
  }
}

mkdirSync(dirname(MANIFEST), { recursive: true });
const summary = {
  generatedAt: new Date().toISOString(),
  total: results.length,
  downloaded: results.filter((r) => r.status === 'downloaded').length,
  skipped: results.filter((r) => r.status === 'skipped').length,
  failed: results.filter((r) => r.status === 'failed' || r.status === 'blocked' || r.status === 'error').length,
  results,
};
writeFileSync(MANIFEST, JSON.stringify(summary, null, 2));
console.log(`\nDone. downloaded=${summary.downloaded} skipped=${summary.skipped} failed=${summary.failed}`);
console.log(`Manifest: ${MANIFEST}`);
