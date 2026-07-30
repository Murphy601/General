#!/usr/bin/env node
/**
 * Run local Drive preview extraction in batches (no Apify token required).
 *
 * Usage:
 *   node scripts/run-drive-visual-local-batch.mjs --batch-size 50
 *   node scripts/run-drive-visual-local-batch.mjs --offset 50 --batch-size 50
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DRIVE_LINKS = join(__dirname, '..', 'knowledge-base', 'phase2', 'drive-links.json');

function parseArgs(argv) {
  const args = { offset: 0, batchSize: 50, merge: true };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--offset') args.offset = Number(argv[++i]);
    else if (argv[i] === '--batch-size') args.batchSize = Number(argv[++i]);
    else if (argv[i] === '--no-merge') args.merge = false;
  }
  return args;
}

const args = parseArgs(process.argv);
const catalog = JSON.parse(readFileSync(DRIVE_LINKS, 'utf8'));
const links = catalog.links || [];
const slice = links.slice(args.offset, args.offset + args.batchSize);

if (!slice.length) {
  console.log('No links in this batch.');
  process.exit(0);
}

console.log(`Batch offset=${args.offset} size=${slice.length} of ${links.length}`);

for (const link of slice) {
  const cmd = [
    join(__dirname, 'extract-drive-preview-local.mjs'),
    '--file-id',
    link.fileId,
  ];
  if (args.merge) cmd.push('--merge');
  const result = spawnSync(process.execPath, cmd, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`Failed on ${link.fileId}`);
  }
}

console.log(`Finished batch offset=${args.offset}`);
