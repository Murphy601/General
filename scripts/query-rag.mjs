#!/usr/bin/env node
/**
 * Cosine-similarity search over curriculum embeddings (JSONL, memory-safe).
 *
 * Usage:
 *   set OPENAI_API_KEY=...
 *   set OPENAI_BASE_URL=https://openrouter.ai/api/v1
 *   node scripts/query-rag.mjs "Grade 4 agriculture strands"
 */

import './load-env.mjs';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_JSONL = join(__dirname, '..', 'knowledge-base', 'phase4', 'curriculum-embeddings.jsonl');
const INDEX_META = join(__dirname, '..', 'knowledge-base', 'phase4', 'curriculum-embeddings.meta.json');
const INDEX_LEGACY = join(__dirname, '..', 'knowledge-base', 'phase4', 'curriculum-embeddings.json');
const MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const API_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

function cosineSimilarity(a, b) {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedQuery(text, apiKey) {
  const response = await fetch(`${API_BASE}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, input: text }),
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.data[0].embedding;
}

async function searchJsonl(queryVector, path, topK = 5) {
  const ranked = [];
  const rl = createInterface({ input: createReadStream(path, 'utf8'), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    const score = cosineSimilarity(queryVector, record.embedding);
  const item = {
      score,
      id: record.id,
      grade: record.grade,
      subject: record.subject,
      title: record.title,
      text: record.text,
    };
    if (ranked.length < topK) {
      ranked.push(item);
      ranked.sort((a, b) => b.score - a.score);
    } else if (score > ranked[ranked.length - 1].score) {
      ranked[ranked.length - 1] = item;
      ranked.sort((a, b) => b.score - a.score);
    }
  }
  return ranked;
}

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: node scripts/query-rag.mjs "your question"');
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

let results;
const queryVector = await embedQuery(query, apiKey);

if (existsSync(INDEX_JSONL)) {
  results = await searchJsonl(queryVector, INDEX_JSONL);
} else if (existsSync(INDEX_LEGACY)) {
  const index = JSON.parse(readFileSync(INDEX_LEGACY, 'utf8'));
  results = index.records
    .map((record) => ({
      score: cosineSimilarity(queryVector, record.embedding),
      id: record.id,
      grade: record.grade,
      subject: record.subject,
      title: record.title,
      text: record.text,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
} else {
  console.error(`Missing ${INDEX_JSONL}. Run: npm run rag:build`);
  process.exit(1);
}

const meta = existsSync(INDEX_META) ? JSON.parse(readFileSync(INDEX_META, 'utf8')) : null;
console.log(JSON.stringify({ query, indexRecords: meta?.totalRecords, results }, null, 2));
