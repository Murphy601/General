/**
 * Check crawl status and preview dataset rows.
 *
 * Usage:
 *   node scripts/check-kicd-crawl.mjs <runId>
 */

import { ApifyClient } from 'apify-client';

const runId = process.argv[2];
if (!runId) {
  console.error('Usage: node scripts/check-kicd-crawl.mjs <runId>');
  process.exit(1);
}

if (!process.env.APIFY_TOKEN) {
  console.error('Missing APIFY_TOKEN');
  process.exit(1);
}

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
const run = await client.run(runId).get();

console.log('Status:', run.status);
console.log('Dataset:', run.defaultDatasetId);
console.log('Console:', `https://console.apify.com/actors/runs/${runId}`);

if (run.status === 'SUCCEEDED' && run.defaultDatasetId) {
  const { items, total } = await client.dataset(run.defaultDatasetId).listItems({ limit: 5 });
  console.log(`Preview ${items.length}/${total} items:`);
  for (const item of items) {
    console.log('-', item.url || item.loadedUrl, '| title:', item.metadata?.title || item.title || 'n/a');
  }
}
