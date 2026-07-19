#!/usr/bin/env node
/**
 * Local Google Drive preview DOM extractor (no Apify required).
 * Scrolls the preview container to lazy-load all textLayers before extraction.
 *
 * Usage:
 *   node scripts/extract-drive-preview-local.mjs --limit 3
 *   node scripts/extract-drive-preview-local.mjs --file-id 1xfUKusjuRlNi22arhYCWy3IS_obPhcvL
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  classifyExtractionStatus,
  normalizeDriveDocument,
  toPreviewUrl,
  DRIVE_VIEWER_SELECTORS,
  DRIVE_NEXT_PAGE_SELECTORS,
  scrollAndCollectDriveText,
  hasStrandContent,
  SCROLL_CONFIG,
} from './drive-preview-extract-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIVE_LINKS = join(__dirname, '..', 'knowledge-base', 'phase2', 'drive-links.json');
const OUTPUT = join(__dirname, '..', 'knowledge-base', 'phase3', 'curriculum-text.json');

function parseArgs(argv) {
  const args = { limit: 1, fileId: null, merge: argv.includes('--merge'), maxFlips: 80 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--limit') args.limit = Number(argv[++i]);
    if (argv[i] === '--file-id') args.fileId = argv[++i];
    if (argv[i] === '--max-flips') args.maxFlips = Number(argv[++i]);
  }
  return args;
}

function snapshotTitle(pages) {
  return pages[0]?.text?.split('\n').find((line) => line.trim().length > 3) || null;
}

function mergeCollectedPages(existing, incoming) {
  const seen = new Set(existing.map((p) => p.text.slice(0, 300)));
  for (const page of incoming) {
    const key = page.text.slice(0, 300);
    if (!seen.has(key) && page.text.trim()) {
      seen.add(key);
      existing.push(page);
    }
  }
  return existing;
}

async function extractPreview(page, link, maxFlips = 80) {
  const previewUrl = link.previewUrl?.replace(/\/view$/, '/preview') || toPreviewUrl(link.fileId);
  await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });

  for (const selector of DRIVE_VIEWER_SELECTORS) {
    try {
      await page.waitForSelector(selector, { timeout: 30000 });
      break;
    } catch {
      // try next
    }
  }
  await page.waitForTimeout(5000);

  const pages = [];
  let scrollStats = null;
  let signInBlocked = false;

  for (let flip = 0; flip < maxFlips; flip += 1) {
    const result = await scrollAndCollectDriveText(page, SCROLL_CONFIG);
    scrollStats = result.scrollStats;
    signInBlocked = signInBlocked || result.signInBlocked;
    mergeCollectedPages(pages, result.pages || []);

    const advanced = await page.evaluate((selectors) => {
      for (const selector of selectors) {
        const btn = document.querySelector(selector);
        if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
          btn.click();
          return true;
        }
      }
      return false;
    }, DRIVE_NEXT_PAGE_SELECTORS);

    if (!advanced) break;
    await page.waitForTimeout(2500);
  }

  const status = classifyExtractionStatus(pages, signInBlocked);
  const title = link.title || snapshotTitle(pages) || null;
  const fullText = pages.map((p) => p.text).join('\n\n');

  return normalizeDriveDocument({
    fileId: link.fileId,
    previewUrl,
    title,
    grade: link.folder,
    subject: null,
    sourceUrl: link.sourceUrl,
    pages,
    status: hasStrandContent(fullText) ? status : (fullText.length > 3000 ? status : 'partial'),
    scrollStats,
  });
}

const args = parseArgs(process.argv);
const catalog = JSON.parse(readFileSync(DRIVE_LINKS, 'utf8'));
let links = catalog.links || [];
if (args.fileId) links = links.filter((l) => l.fileId === args.fileId);
else links = links.slice(0, args.limit);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

const documents = [];
for (const link of links) {
  process.stdout.write(`Extracting ${link.fileId} ... `);
  try {
    const doc = await extractPreview(page, link, args.maxFlips);
    const strand = hasStrandContent(doc.extractedText) ? 'strands=yes' : 'strands=no';
    documents.push(doc);
    console.log(`${doc.status} (${doc.charCount} chars, ${doc.pageCount} layers, ${strand})`);
  } catch (error) {
    documents.push(normalizeDriveDocument({
      fileId: link.fileId,
      previewUrl: link.previewUrl || toPreviewUrl(link.fileId),
      title: link.title,
      grade: link.folder,
      sourceUrl: link.sourceUrl,
      pages: [],
      status: 'error',
      error: error.message,
    }));
    console.log(`error (${error.message})`);
  }
}

await browser.close();

let existing = { documents: [] };
if (args.merge && existsSync(OUTPUT)) {
  existing = JSON.parse(readFileSync(OUTPUT, 'utf8'));
}

const byId = new Map((existing.documents || []).map((d) => [d.fileId, d]));
for (const doc of documents) byId.set(doc.fileId, doc);

const merged = [...byId.values()].sort((a, b) => a.fileId.localeCompare(b.fileId));
const output = {
  generatedAt: new Date().toISOString(),
  source: 'drive-preview-dom-local-scroll',
  totalDocuments: merged.length,
  byStatus: merged.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {}),
  documents: merged,
};

mkdirSync(dirname(OUTPUT), { recursive: true });
writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
console.log(`\nSaved ${merged.length} documents to ${OUTPUT}`);
