#!/usr/bin/env node
/**
 * Download KICD PDFs into knowledge-base/pdfs/[grade]/ from:
 *  - Google Drive direct URLs (knowledge-base/phase2/drive-links.json)
 *  - Direct KICD wp-content links (knowledge-base/phase2/pdf-catalog.json)
 *
 * Usage:
 *   node scripts/download-kicd-pdfs.mjs
 *   node scripts/download-kicd-pdfs.mjs --direct-only
 *   node scripts/download-kicd-pdfs.mjs --drive-only --limit 5
 *   node scripts/download-kicd-pdfs.mjs --kec-only
 */

import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { sanitizeFilename, sourceUrlToPdfFolder } from './kicd-drive-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PDF_ROOT = join(ROOT, 'knowledge-base', 'pdfs');
const DRIVE_LINKS = join(ROOT, 'knowledge-base', 'phase2', 'drive-links.json');
const KEC_MIRRORS = join(ROOT, 'knowledge-base', 'phase2', 'kec-mirrors.json');
const PDF_CATALOG = join(ROOT, 'knowledge-base', 'phase2', 'pdf-catalog.json');
const MANIFEST = join(ROOT, 'knowledge-base', 'phase2', 'download-manifest.json');

const USER_AGENT = 'Mozilla/5.0 (compatible; KICD-CBC-Crawler/1.0)';

function parseArgs(argv) {
  return {
    directOnly: argv.includes('--direct-only'),
    driveOnly: argv.includes('--drive-only'),
    kecOnly: argv.includes('--kec-only'),
    limit: (() => {
      const idx = argv.indexOf('--limit');
      return idx >= 0 ? Number(argv[idx + 1]) : null;
    })(),
    force: argv.includes('--force'),
  };
}

function isPdfBuffer(buffer) {
  return buffer.length >= 4 && buffer.slice(0, 4).toString() === '%PDF';
}

async function downloadToFile(url, destPath, { force = false } = {}) {
  if (!force && existsSync(destPath)) {
    return { status: 'skipped', reason: 'exists' };
  }

  const response = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    return { status: 'failed', reason: `HTTP ${response.status}` };
  }

  const contentType = response.headers.get('content-type') || '';
  const buffer = Buffer.from(await response.arrayBuffer());

  if (!isPdfBuffer(buffer)) {
    const text = buffer.toString('utf8', 0, Math.min(buffer.length, 500));
    if (text.includes("Can't download file") || text.includes('Google Drive')) {
      return { status: 'blocked', reason: 'google-drive-download-restricted' };
    }
    if (contentType.includes('text/html')) {
      return { status: 'blocked', reason: 'html-response-not-pdf' };
    }
    return { status: 'failed', reason: `unexpected-content-type:${contentType || 'unknown'}` };
  }

  mkdirSync(dirname(destPath), { recursive: true });
  await pipeline(
    async function* () {
      yield buffer;
    },
    createWriteStream(destPath),
  );

  return { status: 'downloaded', bytes: buffer.length };
}

function loadDriveEntries() {
  if (!existsSync(DRIVE_LINKS)) return [];
  const data = JSON.parse(readFileSync(DRIVE_LINKS, 'utf8'));
  return data.links || [];
}

function loadKecEntries() {
  if (!existsSync(KEC_MIRRORS)) return [];
  const data = JSON.parse(readFileSync(KEC_MIRRORS, 'utf8'));
  return (data.mirrors || []).map((entry) => ({
    type: 'kec',
    url: entry.url,
    title: entry.title,
    folder: entry.grade || 'kec',
    filename: sanitizeFilename(entry.filename || entry.title),
  }));
}

function loadDirectEntries() {
  if (!existsSync(PDF_CATALOG)) return [];
  return JSON.parse(readFileSync(PDF_CATALOG, 'utf8'));
}

const args = parseArgs(process.argv);
const manifest = {
  generatedAt: new Date().toISOString(),
  downloaded: [],
  skipped: [],
  blocked: [],
  failed: [],
};

const jobs = [];

if (!args.driveOnly && !args.kecOnly) {
  for (const entry of loadDirectEntries()) {
    jobs.push({
      type: 'direct',
      url: entry.url,
      title: entry.title,
      folder: entry.level || 'general',
      filename: sanitizeFilename(entry.title || entry.url.split('/').pop()),
    });
  }
}

if (!args.directOnly && !args.kecOnly) {
  for (const entry of loadDriveEntries()) {
    jobs.push({
      type: 'drive',
      url: entry.downloadUrl,
      title: entry.title,
      folder: entry.folder || sourceUrlToPdfFolder(entry.sourceUrl || ''),
      filename: sanitizeFilename(entry.title || `${entry.fileId}.pdf`),
      fileId: entry.fileId,
      previewUrl: entry.previewUrl,
    });
  }
}

if (!args.directOnly && !args.driveOnly) {
  for (const entry of loadKecEntries()) {
    jobs.push({
      type: 'kec',
      url: entry.url,
      title: entry.title,
      folder: entry.folder || 'kec',
      filename: sanitizeFilename(entry.filename || entry.title),
    });
  }
}

const selected = args.limit ? jobs.slice(0, args.limit) : jobs;
console.log(`Downloading ${selected.length} PDFs into ${PDF_ROOT}`);

for (const job of selected) {
  const destPath = join(PDF_ROOT, job.folder, job.filename);
  process.stdout.write(`${job.type}: ${job.filename} ... `);

  try {
    const result = await downloadToFile(job.url, destPath, { force: args.force });
    const record = {
      ...job,
      destPath: destPath.replace(`${ROOT}/`, ''),
      ...result,
    };

    if (result.status === 'downloaded') {
      manifest.downloaded.push(record);
      console.log(`ok (${result.bytes} bytes)`);
    } else if (result.status === 'skipped') {
      manifest.skipped.push(record);
      console.log('skipped');
    } else if (result.status === 'blocked') {
      manifest.blocked.push(record);
      console.log(`blocked (${result.reason})`);
    } else {
      manifest.failed.push(record);
      console.log(`failed (${result.reason})`);
    }
  } catch (error) {
    const record = { ...job, status: 'failed', reason: error.message };
    manifest.failed.push(record);
    console.log(`error (${error.message})`);
  }
}

mkdirSync(dirname(MANIFEST), { recursive: true });
writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);

console.log('\nSummary');
console.log(`  downloaded: ${manifest.downloaded.length}`);
console.log(`  skipped:    ${manifest.skipped.length}`);
console.log(`  blocked:    ${manifest.blocked.length}`);
console.log(`  failed:     ${manifest.failed.length}`);
console.log(`Manifest: ${MANIFEST}`);
