#!/usr/bin/env node
/**
 * Decompress curriculum-text.json.gz when the full JSON is missing or stale.
 *
 * Stale = gzip catalog is newer on disk, or gzip has more documents than the JSON.
 */
import { existsSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, '..', 'knowledge-base', 'phase3', 'curriculum-text.json');
const GZ_PATH = `${JSON_PATH}.gz`;

function readDocCount(bufOrStr) {
  const data = typeof bufOrStr === 'string' ? JSON.parse(bufOrStr) : JSON.parse(bufOrStr.toString('utf8'));
  return data.totalDocuments ?? (data.documents || []).length;
}

function needsDecompress() {
  if (!existsSync(GZ_PATH)) {
    if (!existsSync(JSON_PATH)) {
      console.error(`Missing ${GZ_PATH}. Pull latest git or copy from cloud agent.`);
      process.exit(1);
    }
    return false;
  }

  if (!existsSync(JSON_PATH)) return true;

  try {
    const jsonStat = statSync(JSON_PATH);
    const gzStat = statSync(GZ_PATH);
    // If gz is newer than json, refresh from gz (typical after git pull on Windows)
    if (gzStat.mtimeMs > jsonStat.mtimeMs + 1000) return true;

    const jsonCount = readDocCount(readFileSync(JSON_PATH, 'utf8'));
    const gzCount = readDocCount(gunzipSync(readFileSync(GZ_PATH)));
    if (gzCount > jsonCount) return true;

    console.log(`curriculum-text.json ready (${jsonCount} documents)`);
    return false;
  } catch (err) {
    console.warn(`Could not compare catalogs (${err.message}); will decompress gzip.`);
    return true;
  }
}

if (!needsDecompress()) {
  process.exit(0);
}

const json = gunzipSync(readFileSync(GZ_PATH));
writeFileSync(JSON_PATH, json);
const docs = readDocCount(json);
console.log(`Decompressed ${GZ_PATH} -> ${JSON_PATH} (${docs} documents)`);
