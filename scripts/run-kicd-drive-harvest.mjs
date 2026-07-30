/**
 * Run the KICD Google Drive link harvest on Apify (web-scraper).
 *
 * Prerequisites:
 *   export APIFY_TOKEN="your_token"
 *
 * Usage:
 *   node scripts/run-kicd-drive-harvest.mjs
 *   node scripts/run-kicd-drive-harvest.mjs --wait
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApifyClient } from 'apify-client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const input = JSON.parse(readFileSync(join(__dirname, 'kicd-drive-harvest-input.json'), 'utf8'));
const waitForFinish = process.argv.includes('--wait');

if (!process.env.APIFY_TOKEN) {
  console.error('Missing APIFY_TOKEN. Create one at https://console.apify.com/settings/integrations');
  process.exit(1);
}

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const run = await client.actor('apify/web-scraper').call(input, {
  waitSecs: waitForFinish ? 900 : 0,
});

console.log('Drive harvest run started:', run.id);
console.log('Console URL:', `https://console.apify.com/actors/runs/${run.id}`);
console.log('Default dataset ID:', run.defaultDatasetId);

if (!waitForFinish) {
  console.log('\nAfter it finishes, extract links with:');
  console.log(`  node scripts/extract-drive-links.mjs --dataset ${run.defaultDatasetId}`);
  console.log('Then download PDFs with:');
  console.log('  node scripts/download-kicd-pdfs.mjs');
  process.exit(0);
}

const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 5000 });
console.log(`\nFinished. Dataset items: ${items.length}`);
