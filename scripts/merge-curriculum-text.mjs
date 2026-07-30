#!/usr/bin/env node
/**
 * Merge Apify Drive preview extraction dataset into curriculum-text.json.
 *
 * Usage:
 *   node scripts/merge-curriculum-text.mjs --dataset <datasetId>
 *   node scripts/merge-curriculum-text.mjs knowledge-base/phase3/sample-dataset.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApifyClient } from 'apify-client';
import { normalizeDriveDocument } from './drive-preview-extract-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT = join(__dirname, '..', 'knowledge-base', 'phase3', 'curriculum-text.json');

function parseArgs(argv) {
  const args = { input: null, dataset: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--dataset') args.dataset = argv[++i];
    else if (!argv[i].startsWith('--')) args.input = argv[i];
  }
  return args;
}

async function loadItems(args) {
  if (args.input) {
    const raw = JSON.parse(readFileSync(args.input, 'utf8'));
    return Array.isArray(raw) ? raw : raw.items || raw.documents || [];
  }
  if (!args.dataset) {
    console.error('Provide --dataset <id> or a local JSON file path');
    process.exit(1);
  }
  if (!process.env.APIFY_TOKEN) {
    console.error('Missing APIFY_TOKEN for dataset fetch');
    process.exit(1);
  }
  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const items = [];
  let offset = 0;
  while (true) {
    const { items: batch, total } = await client.dataset(args.dataset).listItems({ offset, limit: 250 });
    items.push(...batch);
    offset += batch.length;
    if (!batch.length || offset >= total) break;
  }
  return items;
}

function itemToDocument(item) {
  return normalizeDriveDocument({
    fileId: item.fileId,
    previewUrl: item.previewUrl,
    title: item.title,
    grade: item.grade,
    subject: item.subject,
    sourceUrl: item.sourceUrl,
    pages: (item.pages || []).map((p) => ({
      pageNumber: p.pageNumber,
      totalPages: p.totalPages,
      charCount: p.charCount,
      text: p.text,
    })),
    status: item.status || 'unknown',
    error: item.error || null,
  });
}

const args = parseArgs(process.argv);
const items = await loadItems(args);

let existing = { documents: [] };
if (existsSync(OUTPUT)) {
  existing = JSON.parse(readFileSync(OUTPUT, 'utf8'));
}

const byId = new Map((existing.documents || []).map((d) => [d.fileId, d]));
for (const item of items) {
  if (!item.fileId) continue;
  byId.set(item.fileId, itemToDocument(item));
}

const documents = [...byId.values()].sort((a, b) => a.fileId.localeCompare(b.fileId));
const output = {
  generatedAt: new Date().toISOString(),
  source: args.dataset ? `apify-dataset:${args.dataset}` : args.input,
  totalDocuments: documents.length,
  byStatus: documents.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {}),
  documents,
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Merged ${items.length} items -> ${documents.length} total documents`);
console.log(`Saved: ${OUTPUT}`);
