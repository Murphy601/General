#!/usr/bin/env node
/**
 * Build the full RAG index: chunk curriculum text, optionally embed.
 *
 * Usage:
 *   node scripts/build-rag-index.mjs --chunks-only
 *   export OPENAI_API_KEY=...
 *   node scripts/build-rag-index.mjs
 */

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const chunksOnly = process.argv.includes('--chunks-only');

function run(script, extraArgs = []) {
  const result = spawnSync(process.execPath, [join(__dirname, script), ...extraArgs], {
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status || 1);
}

run('chunk-curriculum-text.mjs');
if (!chunksOnly) {
  run('embed-curriculum-chunks.mjs');
}
