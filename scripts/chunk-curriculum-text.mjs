#!/usr/bin/env node
/**
 * Chunk curriculum-text.json for RAG indexing.
 *
 * Usage:
 *   node scripts/chunk-curriculum-text.mjs
 *   node scripts/chunk-curriculum-text.mjs --input knowledge-base/phase3/curriculum-text.json
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chunkCurriculumDocuments, isUsableDocument } from './rag-chunk-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_INPUT = join(__dirname, '..', 'knowledge-base', 'phase3', 'curriculum-text.json');
const DEFAULT_OUTPUT = join(__dirname, '..', 'knowledge-base', 'phase4', 'curriculum-chunks.json');

function parseArgs(argv) {
  const args = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, maxChars: 1200, overlap: 150 };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.input = argv[++i];
    else if (argv[i] === '--output') args.output = argv[++i];
    else if (argv[i] === '--max-chars') args.maxChars = Number(argv[++i]);
    else if (argv[i] === '--overlap') args.overlap = Number(argv[++i]);
  }
  return args;
}

const args = parseArgs(process.argv);
const catalog = JSON.parse(readFileSync(args.input, 'utf8'));
const documents = catalog.documents || [];
const usable = documents.filter(isUsableDocument);
const chunks = chunkCurriculumDocuments(usable, {
  maxChars: args.maxChars,
  overlap: args.overlap,
});

const byGrade = {};
const bySubject = {};
for (const chunk of chunks) {
  const g = chunk.grade || 'unknown';
  const s = chunk.subject || 'unknown';
  byGrade[g] = (byGrade[g] || 0) + 1;
  bySubject[s] = (bySubject[s] || 0) + 1;
}

const output = {
  generatedAt: new Date().toISOString(),
  source: args.input,
  totalDocuments: documents.length,
  usableDocuments: usable.length,
  totalChunks: chunks.length,
  byGrade,
  bySubject,
  chunks,
};

mkdirSync(dirname(args.output), { recursive: true });
writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`);

console.log(`Documents: ${documents.length} total, ${usable.length} usable`);
console.log(`Chunks: ${chunks.length}`);
console.log(`Saved: ${args.output}`);
