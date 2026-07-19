#!/usr/bin/env node
/**
 * Merge Phase 2 Apify dataset into knowledge-base (subjects + PDF links).
 * Usage: node scripts/merge-phase2-results.mjs <datasetId>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApifyClient } from 'apify-client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'knowledge-base');
const datasetId = process.argv[2];

if (!datasetId) {
  console.error('Usage: node scripts/merge-phase2-results.mjs <datasetId>');
  process.exit(1);
}

if (!process.env.APIFY_TOKEN) {
  console.error('Missing APIFY_TOKEN');
  process.exit(1);
}

const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

function extractPdfLinks(text = '') {
  const re = /https:\/\/kicd\.ac\.ke\/wp-content\/uploads\/[^\s)"'<>]+\.pdf/gi;
  return [...new Set((text.match(re) || []).map(u => u.replace(/\\$/, '')))];
}

function extractLinks(text = '') {
  const re = /https:\/\/kicd\.ac\.ke\/cbc-materials\/[^\s)"'<>]+/gi;
  return [...new Set(text.match(re) || [])];
}

function slugFromUrl(url) {
  return new URL(url).pathname.replace(/\/$/, '').split('/').pop() || 'index';
}

function classifyUrl(url) {
  if (url.includes('.pdf')) return 'pdf';
  if (url.includes('/sne-curriculum-designs/hi-')) return 'sne-hi';
  if (url.includes('/sne-curriculum-designs/pi-')) return 'sne-pi';
  if (url.includes('/sne-curriculum-designs/vi-')) return 'sne-vi';
  if (url.match(/grade-(four|five|six|seven|eight|nine|ten|eleven|twelve)/)) return 'regular';
  return 'other';
}

const { items } = await client.dataset(datasetId).listItems({ limit: 1000 });
console.log(`Fetched ${items.length} items from dataset ${datasetId}`);

const pdfCatalog = [];
const subjectPages = [];
const byUrl = new Map();

for (const item of items) {
  const url = item.url || item['crawl.loadedUrl'] || '';
  const text = [item.text, item.markdown, item.html].filter(Boolean).join('\n');
  const pdfs = extractPdfLinks(text);
  const links = extractLinks(text).filter(l => l !== url);
  const depth = item['crawl.depth'] ?? item.crawl?.depth ?? null;
  const title = item.metadata?.title || item['metadata.title'] || '';

  byUrl.set(url, { url, title, depth, pdfs, links, textLength: text.length });

  if (url.includes('.pdf') || item['crawl.contentType']?.includes('pdf')) {
    pdfCatalog.push({ url, title, parent: item['crawl.referrerUrl'] || null });
  }

  if (depth === 1 || depth === 2) {
    subjectPages.push({ url, title, depth, pdfs, linkCount: links.length });
  }

  for (const pdf of pdfs) {
    pdfCatalog.push({ url: pdf, title: pdf.split('/').pop(), parent: url });
  }
}

// Deduplicate PDF catalog
const uniquePdfs = [...new Map(pdfCatalog.map(p => [p.url, p])).values()];

mkdirSync(join(ROOT, 'phase2'), { recursive: true });
writeFileSync(join(ROOT, 'phase2', 'dataset-summary.json'), JSON.stringify({
  datasetId,
  totalItems: items.length,
  uniqueUrls: byUrl.size,
  pdfCount: uniquePdfs.length,
  subjectPageCount: subjectPages.length,
  mergedAt: new Date().toISOString(),
}, null, 2) + '\n');

writeFileSync(join(ROOT, 'phase2', 'pdf-catalog.json'), JSON.stringify(uniquePdfs, null, 2) + '\n');
writeFileSync(join(ROOT, 'phase2', 'subject-pages.json'), JSON.stringify(subjectPages, null, 2) + '\n');

// Update index.json
const indexPath = join(ROOT, 'index.json');
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
index.phase2DatasetId = datasetId;
index.phase2MergedAt = new Date().toISOString();
index.phase2Stats = {
  totalItems: items.length,
  pdfCount: uniquePdfs.length,
  subjectPages: subjectPages.length,
};
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');

// Write discovered PDFs into subjects/ folder
const subjectsDir = join(ROOT, 'subjects');
mkdirSync(subjectsDir, { recursive: true });
for (const page of subjectPages) {
  const file = join(subjectsDir, `${slugFromUrl(page.url)}.json`);
  writeFileSync(file, JSON.stringify(page, null, 2) + '\n');
}

console.log(`PDFs discovered: ${uniquePdfs.length}`);
console.log(`Subject/child pages: ${subjectPages.length}`);
console.log(`Written to knowledge-base/phase2/`);
