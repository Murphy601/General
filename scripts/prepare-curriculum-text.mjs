#!/usr/bin/env node
/**
 * Decompress curriculum-text.json.gz if the full JSON is missing.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(__dirname, '..', 'knowledge-base', 'phase3', 'curriculum-text.json');
const GZ_PATH = `${JSON_PATH}.gz`;

if (existsSync(JSON_PATH)) {
  const docs = JSON.parse(readFileSync(JSON_PATH, 'utf8')).totalDocuments;
  if (docs >= 500) {
    console.log(`curriculum-text.json ready (${docs} documents)`);
    process.exit(0);
  }
}

if (!existsSync(GZ_PATH)) {
  console.error(`Missing ${GZ_PATH}. Pull latest git or copy from cloud agent.`);
  process.exit(1);
}

const json = gunzipSync(readFileSync(GZ_PATH));
writeFileSync(JSON_PATH, json);
const docs = JSON.parse(json.toString()).totalDocuments;
console.log(`Decompressed ${GZ_PATH} -> ${JSON_PATH} (${docs} documents)`);
