#!/usr/bin/env node
/**
 * Generate Apify web-scraper input for Google Drive preview DOM extraction.
 *
 * Usage:
 *   node scripts/generate-drive-visual-input.mjs
 *   node scripts/generate-drive-visual-input.mjs --limit 20
 *   node scripts/generate-drive-visual-input.mjs --grade grade-4
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { toPreviewUrl } from './drive-preview-extract-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIVE_LINKS = join(__dirname, '..', 'knowledge-base', 'phase2', 'drive-links.json');
const PAGE_FN_PATH = join(__dirname, 'drive-preview-page-function.js');
const OUTPUT = join(__dirname, 'kicd-drive-visual-harvest-input.json');

function parseArgs(argv) {
  const args = { limit: null, grade: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--limit') args.limit = Number(argv[++i]);
    if (argv[i] === '--grade') args.grade = argv[++i];
  }
  return args;
}

const args = parseArgs(process.argv);
const catalog = JSON.parse(readFileSync(DRIVE_LINKS, 'utf8'));
let links = catalog.links || [];

if (args.grade) links = links.filter((l) => l.folder === args.grade || l.folder?.includes(args.grade));
if (args.limit) links = links.slice(0, args.limit);

const pageFunction = await readFile(PAGE_FN_PATH, 'utf8');

const input = {
  runMode: 'PRODUCTION',
  startUrls: links.map((link) => ({
    url: (link.previewUrl || toPreviewUrl(link.fileId)).replace(/\/view$/, '/preview'),
    userData: {
      fileId: link.fileId,
      title: link.title,
      grade: link.folder,
      sourceUrl: link.sourceUrl,
    },
  })),
  linkSelector: '',
  injectJQuery: false,
  maxCrawlDepth: 0,
  maxConcurrency: 2,
  pageLoadTimeoutSecs: 120,
  pageFunctionTimeoutSecs: 180,
  headless: true,
  useChrome: true,
  closeCookieModals: true,
  proxyConfiguration: { useApifyProxy: true },
  pageFunction,
};

writeFileSync(OUTPUT, `${JSON.stringify(input, null, 2)}\n`);
console.log(`Wrote ${OUTPUT} with ${input.startUrls.length} preview URLs`);
