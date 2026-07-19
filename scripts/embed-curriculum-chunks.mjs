#!/usr/bin/env node
/**
 * Generate embeddings for curriculum chunks.
 *
 * Requires OPENAI_API_KEY for cloud embeddings.
 * Use --dry-run to validate chunk input without calling the API.
 *
 * Usage:
 *   export OPENAI_API_KEY=...
 *   node scripts/embed-curriculum-chunks.mjs
 *   node scripts/embed-curriculum-chunks.mjs --dry-run
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_INPUT = join(__dirname, '..', 'knowledge-base', 'phase4', 'curriculum-chunks.json');
const DEFAULT_OUTPUT = join(__dirname, '..', 'knowledge-base', 'phase4', 'curriculum-embeddings.json');

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    batchSize: 64,
    dryRun: argv.includes('--dry-run'),
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.input = argv[++i];
    else if (argv[i] === '--output') args.output = argv[++i];
    else if (argv[i] === '--model') args.model = argv[++i];
    else if (argv[i] === '--batch-size') args.batchSize = Number(argv[++i]);
  }
  return args;
}

async function embedBatch(texts, model, apiKey) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI embeddings failed (${response.status}): ${body}`);
  }
  const data = await response.json();
  return data.data.map((row) => row.embedding);
}

const args = parseArgs(process.argv);
if (!existsSync(args.input)) {
  console.error(`Missing ${args.input}. Run: node scripts/chunk-curriculum-text.mjs`);
  process.exit(1);
}

const input = JSON.parse(readFileSync(args.input, 'utf8'));
const chunks = input.chunks || [];

if (args.dryRun) {
  console.log(`Dry run: ${chunks.length} chunks ready for embedding`);
  console.log(`Model: ${args.model}`);
  process.exit(0);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Missing OPENAI_API_KEY. Set it or use --dry-run.');
  process.exit(1);
}

const records = [];
for (let i = 0; i < chunks.length; i += args.batchSize) {
  const batch = chunks.slice(i, i + args.batchSize);
  const texts = batch.map((chunk) => chunk.text);
  process.stdout.write(`Embedding ${i + 1}-${i + batch.length} of ${chunks.length} ... `);
  const vectors = await embedBatch(texts, args.model, apiKey);
  for (let j = 0; j < batch.length; j += 1) {
    records.push({
      ...batch[j],
      embeddingModel: args.model,
      embedding: vectors[j],
    });
  }
  console.log('done');
}

const output = {
  generatedAt: new Date().toISOString(),
  source: args.input,
  embeddingModel: args.model,
  dimensions: records[0]?.embedding?.length || 0,
  totalRecords: records.length,
  records,
};

mkdirSync(dirname(args.output), { recursive: true });
writeFileSync(args.output, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Saved ${records.length} embeddings to ${args.output}`);
