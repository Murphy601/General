import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import type { RagSource } from './types';

const ROOT = join(process.cwd(), '..');
const EMBEDDINGS_JSONL = join(ROOT, 'knowledge-base', 'phase4', 'curriculum-embeddings.jsonl');
const EMBEDDINGS_META = join(ROOT, 'knowledge-base', 'phase4', 'curriculum-embeddings.meta.json');
const CHUNKS_PATH = join(ROOT, 'knowledge-base', 'phase4', 'curriculum-chunks.json');

const MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';
const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'openai/gpt-4o-mini';
const API_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

export function isRagAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY) && existsSync(EMBEDDINGS_JSONL);
}

function cosineSimilarity(a: number[], b: number[]): number {
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

async function embedQuery(text: string, apiKey: string): Promise<number[]> {
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

async function searchJsonl(queryVector: number[], topK = 6): Promise<RagSource[]> {
  const ranked: RagSource[] = [];
  const rl = createInterface({
    input: createReadStream(EMBEDDINGS_JSONL, 'utf8'),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    const record = JSON.parse(line);
    const score = cosineSimilarity(queryVector, record.embedding);
    const item: RagSource = {
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

function keywordFallback(query: string, topK = 6): RagSource[] {
  if (!existsSync(CHUNKS_PATH)) return [];
  const data = JSON.parse(readFileSync(CHUNKS_PATH, 'utf8'));
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = (data.chunks || []).map(
    (chunk: { id: string; grade: string; subject: string; title: string; text: string }) => {
      const hay = `${chunk.subject} ${chunk.title} ${chunk.text}`.toLowerCase();
      const score = terms.reduce((acc, term) => acc + (hay.includes(term) ? 1 : 0), 0);
      return { ...chunk, score: score / Math.max(terms.length, 1) };
    },
  );
  return scored
    .filter((c: { score: number }) => c.score > 0)
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .slice(0, topK)
    .map((c: { id: string; grade: string; subject: string; title: string; text: string; score: number }) => ({
      id: c.id,
      grade: c.grade,
      subject: c.subject,
      title: c.title,
      text: c.text,
      score: c.score,
    }));
}

async function generateAnswer(query: string, sources: RagSource[], apiKey: string): Promise<string> {
  const context = sources
    .map((s, i) => `[${i + 1}] ${s.subject} (${s.grade}): ${s.text}`)
    .join('\n\n');

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful Kenyan CBC curriculum revision assistant. Answer using only the provided curriculum excerpts. Cite strand or learning outcome details when available. If the context is insufficient, say so clearly. Use clear, student-friendly language.',
        },
        {
          role: 'user',
          content: `Question: ${query}\n\nCurriculum excerpts:\n${context}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 800,
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.choices[0].message.content as string;
}

export async function queryRag(
  query: string,
  options: { topK?: number; generateAnswer?: boolean; grade?: string; subject?: string } = {},
): Promise<{ sources: RagSource[]; answer?: string; ragAvailable: boolean }> {
  const apiKey = process.env.OPENAI_API_KEY;
  const topK = options.topK ?? 6;
  let augmentedQuery = query;
  if (options.grade) augmentedQuery += ` ${options.grade}`;
  if (options.subject) augmentedQuery += ` ${options.subject}`;

  let sources: RagSource[] = [];

  if (apiKey && existsSync(EMBEDDINGS_JSONL)) {
    const queryVector = await embedQuery(augmentedQuery, apiKey);
    sources = await searchJsonl(queryVector, topK);
  } else {
    sources = keywordFallback(augmentedQuery, topK);
  }

  let answer: string | undefined;
  if (options.generateAnswer && apiKey && sources.length > 0) {
    answer = await generateAnswer(query, sources, apiKey);
  }

  return { sources, answer, ragAvailable: Boolean(apiKey && existsSync(EMBEDDINGS_JSONL)) };
}

export function getEmbeddingMeta() {
  if (!existsSync(EMBEDDINGS_META)) return null;
  return JSON.parse(readFileSync(EMBEDDINGS_META, 'utf8'));
}
