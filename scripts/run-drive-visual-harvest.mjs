#!/usr/bin/env node
/**
 * Run Google Drive preview DOM extraction via Apify web-scraper.
 *
 * Prerequisites:
 *   export APIFY_TOKEN="your_token"
 *
 * Usage:
 *   node scripts/generate-drive-visual-input.mjs --limit 10
 *   node scripts/run-drive-visual-harvest.mjs
 *   node scripts/run-drive-visual-harvest.mjs --wait
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApifyClient } from 'apify-client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT = join(__dirname, 'kicd-drive-visual-harvest-input.json');
const waitForFinish = process.argv.includes('--wait');

if (!process.env.APIFY_TOKEN) {
  console.error('Missing APIFY_TOKEN. Create one at https://console.apify.com/settings/integrations');
  process.exit(1);
}

let input;
try {
  input = JSON.parse(readFileSync(INPUT, 'utf8'));
} catch {
  console.error(`Missing ${INPUT}. Run: node scripts/generate-drive-visual-input.mjs`);
  process.exit(1);
}

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const run = await client.actor('apify/web-scraper').call(input, {
  waitSecs: waitForFinish ? 3600 : 0,
});

console.log('Drive visual harvest started:', run.id);
console.log('Console URL:', `https://console.apify.com/actors/runs/${run.id}`);
console.log('Default dataset ID:', run.defaultDatasetId);

if (!waitForFinish) {
  console.log('\nAfter it finishes, merge results with:');
  console.log(`  node scripts/merge-curriculum-text.mjs --dataset ${run.defaultDatasetId}`);
  process.exit(0);
}

const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 5000 });
console.log(`\nFinished. Dataset items: ${items.length}`);
console.log('Merge with: node scripts/merge-curriculum-text.mjs --dataset', run.defaultDatasetId);
