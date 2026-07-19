#!/usr/bin/env node
/**
 * Summarize harvested Google Drive links by grade folder.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIVE_LINKS = join(__dirname, '..', 'knowledge-base', 'phase2', 'drive-links.json');
const OUTPUT = join(__dirname, '..', 'knowledge-base', 'phase2', 'drive-catalog-summary.json');

const data = JSON.parse(readFileSync(DRIVE_LINKS, 'utf8'));
const byFolder = {};

for (const link of data.links) {
  byFolder[link.folder] = (byFolder[link.folder] || 0) + 1;
}

const summary = {
  generatedAt: new Date().toISOString(),
  uniqueDriveFiles: data.links.length,
  source: data.source,
  byFolder: Object.fromEntries(
    Object.entries(byFolder).sort(([a], [b]) => a.localeCompare(b)),
  ),
};

writeFileSync(OUTPUT, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Wrote ${OUTPUT}`);
console.log(`Total unique Drive files: ${summary.uniqueDriveFiles}`);
