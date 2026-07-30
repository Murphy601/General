#!/usr/bin/env node
/**
 * Extract unique Google Drive file IDs from an Apify dataset export or dataset ID.
 *
 * Usage:
 *   node scripts/extract-drive-links.mjs knowledge-base/phase2/dataset-items.json
 *   node scripts/extract-drive-links.mjs --dataset mvcpflci6yzv1OeQz
 *   node scripts/extract-drive-links.mjs --from-phase2
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApifyClient } from 'apify-client';
import { collectDriveLinksFromItem } from './kicd-drive-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT = join(ROOT, 'knowledge-base', 'phase2', 'drive-links.json');
const PHASE2_DATASET = 'mvcpflci6yzv1OeQz';

function parseArgs(argv) {
  const args = { input: null, dataset: null, fromPhase2: false };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--dataset') {
      args.dataset = argv[i + 1];
      i += 1;
    } else if (argv[i] === '--from-phase2') {
      args.fromPhase2 = true;
    } else if (!argv[i].startsWith('--')) {
      args.input = argv[i];
    }
  }
  return args;
}

async function loadItems(args) {
  if (args.input) {
    const raw = JSON.parse(readFileSync(args.input, 'utf8'));
    return Array.isArray(raw) ? raw : raw.items || [];
  }

  const datasetId = args.dataset || (args.fromPhase2 ? PHASE2_DATASET : null);
  if (!datasetId) {
    console.error('Provide a dataset JSON path, --dataset <id>, or --from-phase2');
    process.exit(1);
  }

  if (!process.env.APIFY_TOKEN) {
    console.error('Missing APIFY_TOKEN required to fetch dataset from Apify.');
    process.exit(1);
  }

  const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
  const items = [];
  let offset = 0;
  const limit = 250;

  while (true) {
    const { items: batch, total } = await client.dataset(datasetId).listItems({ offset, limit });
    items.push(...batch);
    offset += batch.length;
    if (batch.length === 0 || offset >= total) break;
  }

  return items;
}

function dedupeLinks(links) {
  const byId = new Map();
  for (const link of links) {
    const existing = byId.get(link.fileId);
    if (!existing) {
      byId.set(link.fileId, link);
      continue;
    }
    if (!existing.title && link.title) existing.title = link.title;
    if (!existing.sourceUrl && link.sourceUrl) existing.sourceUrl = link.sourceUrl;
  }
  return [...byId.values()].sort((a, b) => a.fileId.localeCompare(b.fileId));
}

const args = parseArgs(process.argv);
const items = await loadItems(args);
const allLinks = items.flatMap((item) => collectDriveLinksFromItem(item));
const uniqueLinks = dedupeLinks(allLinks);

mkdirSync(dirname(OUTPUT), { recursive: true });
const summary = {
  generatedAt: new Date().toISOString(),
  sourceItems: items.length,
  uniqueDriveFiles: uniqueLinks.length,
  sourceDataset: args.dataset || (args.fromPhase2 ? PHASE2_DATASET : args.input),
  links: uniqueLinks,
};

writeFileSync(OUTPUT, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Extracted ${uniqueLinks.length} unique Google Drive file IDs from ${items.length} pages`);
console.log(`Saved: ${OUTPUT}`);
