// Storage abstraction. On Cloudflare Workers, data lives in the R2 bucket bound as CONTENT
// (uploaded by scripts/publish-r2.mjs). Locally it is derived from web/data/content and
// knowledge-base/phase5, so `next dev` works with no extra setup.
//
// Keys:
//   content/<id>.json          full record
//   index/<grade>.json         slim index entries for one grade (no pages/sources/body)
//   index/grades.json          grades that are published: string[]
//   index/counts.json          { [category]: { [grade]: number } } exam counts
//   curriculum/<grade>.json    one grade of curriculum-index.json
//   curriculum/grades.json     [{ grade, label, subjectCount, topicCount }]
import type { GeneratedContent } from './types';

type R2Like = { get(key: string): Promise<{ json<T>(): Promise<T> } | null> };

const cache = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 5 * 60 * 1000;

async function getBucket(): Promise<R2Like | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    const bucket = (ctx.env as { CONTENT?: R2Like }).CONTENT;
    return bucket || null;
  } catch {
    return null; // not running on Workers
  }
}

export function isWorkers(): boolean {
  return typeof (globalThis as { WebSocketPair?: unknown }).WebSocketPair !== 'undefined';
}

export async function readJson<T>(key: string, opts?: { cache?: boolean }): Promise<T | undefined> {
  const useCache = opts?.cache !== false && !key.startsWith('content/');
  if (useCache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T | undefined;
  }
  let value: T | undefined;
  const bucket = await getBucket();
  if (bucket) {
    const obj = await bucket.get(key);
    value = obj ? await obj.json<T>() : undefined;
  } else {
    value = await readLocal<T>(key);
  }
  if (useCache) cache.set(key, { at: Date.now(), value });
  return value;
}

// ---------------- local (Node) backend ----------------
type Fs = typeof import('node:fs');
type Path = typeof import('node:path');
let localIndex: GeneratedContent[] | null = null;
let localCurriculum: { grades: Array<{ grade: string; label: string; subjects: Record<string, { topics: unknown[] }> }> } | null = null;

async function node(): Promise<{ fs: Fs; path: Path }> {
  const fs = await import(/* webpackIgnore: true */ 'node:fs');
  const path = await import(/* webpackIgnore: true */ 'node:path');
  return { fs, path };
}

function slim(r: GeneratedContent) {
  const { pages: _p, sources: _s, body: _b, ...rest } = r as GeneratedContent & { body?: string };
  return rest;
}

async function loadLocalIndex(): Promise<GeneratedContent[]> {
  if (localIndex) return localIndex;
  const { fs, path } = await node();
  const p = path.join(process.cwd(), 'data', 'content', 'index.json');
  localIndex = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
  return localIndex!;
}

async function loadLocalCurriculum() {
  if (localCurriculum) return localCurriculum;
  const { fs, path } = await node();
  const p = path.join(process.cwd(), '..', 'knowledge-base', 'phase5', 'curriculum-index.json');
  localCurriculum = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { grades: [] };
  return localCurriculum!;
}

async function readLocal<T>(key: string): Promise<T | undefined> {
  const { fs, path } = await node();
  if (key.startsWith('content/')) {
    const p = path.join(process.cwd(), 'data', 'content', key.slice('content/'.length));
    if (!fs.existsSync(p)) return undefined;
    const raw = fs.readFileSync(p, 'utf8').trim();
    if (!raw) return undefined; // empty files are left behind when a topic is replaced
    try { return JSON.parse(raw) as T; } catch { return undefined; }
  }
  if (key === 'index/grades.json') return undefined; // undefined = no publish filter locally
  if (key === 'index/counts.json') return undefined;
  if (key.startsWith('index/')) {
    const grade = key.slice('index/'.length, -'.json'.length);
    return (await loadLocalIndex()).filter((r) => r.topic?.grade === grade).map(slim) as T;
  }
  if (key === 'curriculum/grades.json') {
    const c = await loadLocalCurriculum();
    return c.grades.map((g) => {
      const subs = Object.values(g.subjects).filter((s) => s.topics.length > 0);
      return { grade: g.grade, label: g.label, subjectCount: subs.length, topicCount: subs.reduce((a, s) => a + s.topics.length, 0) };
    }) as T;
  }
  if (key.startsWith('curriculum/')) {
    const grade = key.slice('curriculum/'.length, -'.json'.length);
    return (await loadLocalCurriculum()).grades.find((g) => g.grade === grade) as T | undefined;
  }
  return undefined;
}

// Local-only write path (used by /api/generate in dev). Not available on Workers.
export async function writeLocalContent(content: GeneratedContent): Promise<void> {
  if (isWorkers()) throw new Error('Content generation is not available on Cloudflare Workers; run it locally and re-publish.');
  const { fs, path } = await node();
  const dir = path.join(process.cwd(), 'data', 'content');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${content.id}.json`), JSON.stringify(content, null, 2));
  const index = (await loadLocalIndex()).filter((i) => i.id !== content.id);
  const preview = content.pages?.lesson?.slice(0, 200) || (content as { body?: string }).body?.slice(0, 200) || '';
  index.unshift({ ...content, body: preview + (preview.length >= 200 ? '…' : '') } as GeneratedContent);
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 2));
  localIndex = index;
}
