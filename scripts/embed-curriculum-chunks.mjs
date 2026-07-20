#!/usr/bin/env node
/**
 * Generate embeddings for curriculum chunks (streams to JSONL to avoid OOM).
 *
 * Usage:
 *   set OPENAI_API_KEY=...
 *   set OPENAI_BASE_URL=https://openrouter.ai/api/v1
 *   node scripts/embed-curriculum-chunks.mjs
 *   node scripts/embed-curriculum-chunks.mjs --resume
 */

import './load-env.mjs';
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdirSync,
  existsSync,
} from 'node:fs';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_INPUT = join(__dirname, '..', 'knowledge-base', 'phase4', 'curriculum-chunks.json');
const DEFAULT_OUTPUT = join(__dirname, '..', 'knowledge-base', 'phase4', 'curriculum-embeddings.jsonl');
const DEFAULT_META = join(__dirname, '..', 'knowledge-base', 'phase4', 'curriculum-embeddings.meta.json');

function parseArgs(argv) {
  const args = {
    input: DEFAULT_INPUT,
    output: DEFAULT_OUTPUT,
    meta: DEFAULT_META,
    model: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
    batchSize: 32,
    dryRun: argv.includes('--dry-run'),
    resume: argv.includes('--resume'),
  };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.input = argv[++i];
    else if (argv[i] === '--output') args.output = argv[++i];
    else if (argv[i] === '--meta') args.meta = argv[++i];
    else if (argv[i] === '--model') args.model = argv[++i];
    else if (argv[i] === '--batch-size') args.batchSize = Number(argv[++i]);
  }
  return args;
}

const API_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

async function embedBatch(texts, model, apiKey) {
  const response = await fetch(`${API_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, input: texts }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Embeddings failed (${response.status}): ${body}`);
  }
  const data = await response.json();
  return data.data.map((row) => row.embedding);
}

async function countJsonlLines(path) {
  if (!existsSync(path)) return 0;
  const rl = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    if (line.trim()) count += 1;
  }
  return count;
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
if (!apiKey || apiKey.includes('PASTE_YOUR') || apiKey === 'your_new_key_here' || apiKey === 'your_key_here') {
  console.error('Missing or placeholder OPENAI_API_KEY.');
  console.error('Copy .env.example to .env and paste your OpenRouter key, then re-run.');
  process.exit(1);
}

mkdirSync(dirname(args.output), { recursive: true });

let startAt = 0;
if (args.resume && existsSync(args.output)) {
  startAt = await countJsonlLines(args.output);
  console.log(`Resuming from chunk ${startAt + 1} (${startAt} already written)`);
} else if (!args.resume && existsSync(args.output)) {
  writeFileSync(args.output, '');
}

let dimensions = 0;
let written = startAt;

for (let i = startAt; i < chunks.length; i += args.batchSize) {
  const batch = chunks.slice(i, i + args.batchSize);
  const texts = batch.map((chunk) => chunk.text);
  process.stdout.write(`Embedding ${i + 1}-${i + batch.length} of ${chunks.length} ... `);
  const vectors = await embedBatch(texts, args.model, apiKey);
  for (let j = 0; j < batch.length; j += 1) {
    const record = {
      ...batch[j],
      embeddingModel: args.model,
      embedding: vectors[j],
    };
    if (!dimensions && record.embedding?.length) dimensions = record.embedding.length;
    appendFileSync(args.output, `${JSON.stringify(record)}\n`);
    written += 1;
  }
  console.log('done');
}

const meta = {
  generatedAt: new Date().toISOString(),
  source: args.input,
  embeddingModel: args.model,
  dimensions,
  totalRecords: written,
  format: 'jsonl',
  dataFile: args.output,
};
writeFileSync(args.meta, `${JSON.stringify(meta, null, 2)}\n`);
console.log(`Saved ${written} embeddings to ${args.output}`);
console.log(`Meta: ${args.meta}`);
