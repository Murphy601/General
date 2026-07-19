#!/usr/bin/env node
/**
 * Local Google Drive preview DOM extractor (no Apify required).
 * Validates the visual extraction approach before cloud runs.
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
} from './drive-preview-extract-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIVE_LINKS = join(__dirname, '..', 'knowledge-base', 'phase2', 'drive-links.json');
const OUTPUT = join(__dirname, '..', 'knowledge-base', 'phase3', 'curriculum-text.json');

function parseArgs(argv) {
  const args = { limit: 1, fileId: null, merge: argv.includes('--merge') };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--limit') args.limit = Number(argv[++i]);
    if (argv[i] === '--file-id') args.fileId = argv[++i];
  }
  return args;
}

function snapshotTitle(pages) {
  return pages[0]?.text?.split('\n').find((line) => line.trim().length > 3) || null;
}

async function extractPreview(page, link, maxPages = 10) {
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
  const seen = new Set();

  for (let i = 0; i < maxPages; i += 1) {
    const snapshot = await page.evaluate(() => {
      const signInBlocked = /sign in/i.test(document.body.innerText) &&
        !!document.querySelector('a[href*="accounts.google.com"]');
      const layerText = [...document.querySelectorAll('.textLayer, motion-page-content, [data-page-index]')]
        .map((el) => el.innerText.trim())
        .filter(Boolean)
        .join('\n');
      const spanText = [...document.querySelectorAll('.textLayer span, motion-text-track span')]
        .map((s) => s.textContent.trim())
        .filter(Boolean)
        .join(' ');
      const docText = document.querySelector('[role="document"]')?.innerText?.trim() || '';
      const bodyText = document.body.innerText.trim();
      const text = [layerText, spanText, docText, bodyText].find((t) => t.length > 80) || bodyText;
      const pageMatch = bodyText.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
      return {
        signInBlocked,
        text,
        currentPage: pageMatch ? Number(pageMatch[1]) : null,
        totalPages: pageMatch ? Number(pageMatch[2]) : null,
        charCount: text.length,
        title: document.title.replace(/ - Google Drive$/, '').trim(),
      };
    });

    const hash = snapshot.text.slice(0, 200);
    if (seen.has(hash)) break;
    seen.add(hash);

    pages.push({
      pageNumber: snapshot.currentPage || i + 1,
      totalPages: snapshot.totalPages,
      charCount: snapshot.charCount,
      text: snapshot.text,
      signInBlocked: snapshot.signInBlocked,
    });

    if (snapshot.signInBlocked) break;

    const advanced = await page.evaluate(() => {
      for (const selector of ['[aria-label="Next page"]', '[data-tooltip="Next page"]']) {
        const btn = document.querySelector(selector);
        if (btn && !btn.disabled && btn.getAttribute('aria-disabled') !== 'true') {
          btn.click();
          return true;
        }
      }
      return false;
    });
    if (!advanced) break;
    await page.waitForTimeout(2500);
  }

  const signInBlocked = pages.some((p) => p.signInBlocked);
  const status = classifyExtractionStatus(pages, signInBlocked);
  const title = link.title || snapshotTitle(pages) || null;

  return normalizeDriveDocument({
    fileId: link.fileId,
    previewUrl,
    title,
    grade: link.folder,
    subject: null,
    sourceUrl: link.sourceUrl,
    pages,
    status,
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
    const doc = await extractPreview(page, link);
    documents.push(doc);
    console.log(`${doc.status} (${doc.charCount} chars, ${doc.pageCount} pages)`);
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
  source: 'drive-preview-dom-local',
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
