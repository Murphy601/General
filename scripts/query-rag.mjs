#!/usr/bin/env node
/**
 * Simple cosine-similarity search over curriculum embeddings.
 *
 * Usage:
 *   export OPENAI_API_KEY=...
 *   node scripts/query-rag.mjs "Grade 4 agriculture strands"
 */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX = join(__dirname, '..', 'knowledge-base', 'phase4', 'curriculum-embeddings.json');
const MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

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
  const response = await fetch('https://api.openai.com/v1/embeddings', {
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

const query = process.argv.slice(2).join(' ').trim();
if (!query) {
  console.error('Usage: node scripts/query-rag.mjs "your question"');
  process.exit(1);
}
if (!existsSync(INDEX)) {
  console.error(`Missing ${INDEX}. Run: node scripts/build-rag-index.mjs`);
  process.exit(1);
}

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const index = JSON.parse(readFileSync(INDEX, 'utf8'));
const queryVector = await embedQuery(query, apiKey);
const ranked = index.records
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

console.log(JSON.stringify({ query, results: ranked }, null, 2));
