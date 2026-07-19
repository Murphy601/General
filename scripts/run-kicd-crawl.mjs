/**
 * Run the KICD curriculum hub crawl on Apify.
 *
 * Prerequisites:
 *   export APIFY_TOKEN="your_token"   # https://console.apify.com/settings/integrations
 *
 * Usage:
 *   node scripts/run-kicd-crawl.mjs
 *   node scripts/run-kicd-crawl.mjs --wait
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ApifyClient } from 'apify-client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const input = JSON.parse(readFileSync(join(__dirname, 'kicd-crawl-input.json'), 'utf8'));
const waitForFinish = process.argv.includes('--wait');

if (!process.env.APIFY_TOKEN) {
  console.error('Missing APIFY_TOKEN. Create one at https://console.apify.com/settings/integrations');
  process.exit(1);
}

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

const run = await client.actor('apify/website-content-crawler').call(input, {
  waitSecs: waitForFinish ? 300 : 0,
});

console.log('Run started:', run.id);
console.log('Console URL:', `https://console.apify.com/actors/runs/${run.id}`);
console.log('Default dataset ID:', run.defaultDatasetId);

if (!waitForFinish) {
  console.log('\nRe-check status later with:');
  console.log(`  node scripts/check-kicd-crawl.mjs ${run.id}`);
  process.exit(0);
}

const { items } = await client.dataset(run.defaultDatasetId).listItems({ limit: 1000 });
console.log(`\nFinished. Dataset items: ${items.length}`);
console.log(JSON.stringify(items.slice(0, 3), null, 2));
