#!/usr/bin/env node
/**
 * Local fallback: fetch KICD hub pages and extract Google Drive file IDs.
 * Use when Apify is unavailable or to refresh links without a crawl run.
 *
 * Usage:
 *   node scripts/harvest-drive-links-local.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collectDriveLinksFromItem,
  extractAllFileIds,
  extractPdfMeta,
} from './kicd-drive-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const URLS = JSON.parse(readFileSync(join(__dirname, 'kicd-phase2-urls.json'), 'utf8'));
const OUTPUT = join(__dirname, '..', 'knowledge-base', 'phase2', 'drive-links.json');

const CURRICULUM_URLS = URLS.filter((url) =>
  url.includes('/curriculum-designs/') &&
  !url.endsWith('/curriculum-designs/') &&
  !url.endsWith('/regular-curriculum-designs/') &&
  !url.endsWith('/sne-curriculum-designs/'),
);

async function fetchPage(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KICD-CBC-Crawler/1.0)' },
  });
  const html = await response.text();
  const driveLinks = extractAllFileIds(html).map((id) => `https://drive.google.com/file/d/${id}/view`);
  return {
    url,
    html,
    driveLinks,
    pdfMeta: extractPdfMeta(html),
  };
}

const items = [];
for (const url of CURRICULUM_URLS) {
  process.stdout.write(`Fetching ${url} ... `);
  try {
    const item = await fetchPage(url);
    items.push(item);
    console.log(`${item.driveLinks.length} links`);
  } catch (error) {
    console.log(`error (${error.message})`);
  }
}

const allLinks = items.flatMap((item) => collectDriveLinksFromItem(item));
const byId = new Map();
for (const link of allLinks) byId.set(link.fileId, link);
const links = [...byId.values()].sort((a, b) => a.fileId.localeCompare(b.fileId));

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(
  OUTPUT,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceItems: items.length,
      uniqueDriveFiles: links.length,
      source: 'local-html-harvest',
      links,
    },
    null,
    2,
  )}\n`,
);

console.log(`\nSaved ${links.length} unique Drive file IDs to ${OUTPUT}`);
