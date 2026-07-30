#!/usr/bin/env node
/**
 * Fetch an Apify dataset to a local JSON file for offline processing.
 *
 * Usage:
 *   node scripts/fetch-apify-dataset.mjs mvcpflci6yzv1OeQz knowledge-base/phase2/dataset-items.json
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { ApifyClient } from 'apify-client';

const [datasetId, outputPath] = process.argv.slice(2);

if (!datasetId || !outputPath) {
  console.error('Usage: node scripts/fetch-apify-dataset.mjs <datasetId> <outputPath>');
  process.exit(1);
}

if (!process.env.APIFY_TOKEN) {
  console.error('Missing APIFY_TOKEN');
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

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(items, null, 2)}\n`);
console.log(`Saved ${items.length} items to ${outputPath}`);
