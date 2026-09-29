#!/usr/bin/env node
// Publish content to the Cloudflare R2 bucket read by the Workers site.
//
//   node scripts/publish-r2.mjs --grades grade-4            # stage + upload
//   node scripts/publish-r2.mjs --grades grade-4,grade-5 --stage-only
//
// Objects (see web/src/lib/storage.ts):
//   content/<id>.json  index/<grade>.json  index/grades.json  index/counts.json
//   curriculum/<grade>.json  curriculum/grades.json
// Pass ALL grades you want live every time: index/grades.json is overwritten with the list you pass.
// Requires wrangler login (or CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID) and the bucket to exist:
//   npx wrangler r2 bucket create cbc-content
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = join(import.meta.dirname, '..');
const WEB = join(ROOT, 'web');
const CONTENT = join(WEB, 'data', 'content');
const STAGE = join(WEB, '.r2-stage');
const argv = process.argv.slice(2);
const arg = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : d; };
const grades = (arg('grades', '') || '').split(',').map((s) => s.trim()).filter(Boolean);
const bucket = arg('bucket', 'cbc-content');
const concurrency = Number(arg('concurrency', '6'));
const stageOnly = argv.includes('--stage-only');
const local = argv.includes('--local'); // upload to wrangler's local R2 simulator (for cf:preview)
if (!grades.length) { console.error('usage: publish-r2.mjs --grades grade-4[,grade-5] [--bucket name] [--stage-only]'); process.exit(2); }

const put = (key, obj) => {
  const f = join(STAGE, key);
  mkdirSync(join(f, '..'), { recursive: true });
  writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj));
};

if (!argv.includes('--resume')) rmSync(STAGE, { recursive: true, force: true });
const index = JSON.parse(readFileSync(join(CONTENT, 'index.json'), 'utf8'));
const curriculum = JSON.parse(readFileSync(join(ROOT, 'knowledge-base', 'phase5', 'curriculum-index.json'), 'utf8'));
const slim = ({ pages, sources, body, ...rest }) => rest;
const CATS = ['general', 'termly', 'mock', 'premium', 'vault'];
const counts = Object.fromEntries(CATS.map((c) => [c, {}]));
let objects = 0, missing = 0;

for (const grade of grades) {
  const recs = index.filter((r) => r.topic?.grade === grade);
  if (!recs.length) console.warn(`warning: no records for ${grade}`);
  put(`index/${grade}.json`, recs.map(slim));
  for (const r of recs) {
    const f = join(CONTENT, `${r.id}.json`);
    if (!existsSync(f) || !readFileSync(f, 'utf8').trim()) { missing++; continue; }
    put(`content/${r.id}.json`, readFileSync(f, 'utf8'));
    objects++;
    const cat = r.metadata?.category;
    if (cat && counts[cat] && /exam|past-paper/.test(r.type)) counts[cat][grade] = (counts[cat][grade] || 0) + 1;
  }
  const cg = curriculum.grades.find((g) => g.grade === grade);
  if (cg) put(`curriculum/${grade}.json`, cg);
}
put('index/grades.json', grades);
put('index/counts.json', counts);
put('curriculum/grades.json', curriculum.grades.map((g) => {
  const subs = Object.values(g.subjects).filter((s) => s.topics.length > 0);
  return { grade: g.grade, label: g.label, subjectCount: subs.length, topicCount: subs.reduce((a, s) => a + s.topics.length, 0) };
}));
console.log(`staged ${objects} content records for ${grades.join(', ')} (${missing} index entries had no file) in ${STAGE}`);
if (stageOnly) process.exit(0);

// Upload with a small worker pool. Metadata objects first so the site never sees content without an index.
const all = [];
const walk = (dir, rel = '') => {
  for (const name of readdirSync(dir, { withFileTypes: true })) {
    const p = rel ? `${rel}/${name.name}` : name.name;
    if (name.isDirectory()) walk(join(dir, name.name), p); else all.push(p);
  }
};
walk(STAGE);
all.sort((a, b) => (a.startsWith('content/') ? 1 : 0) - (b.startsWith('content/') ? 1 : 0));
let done = 0, failed = [];
const logFile = join(STAGE, '.uploaded');
const already = new Set(argv.includes('--resume') && existsSync(logFile) ? readFileSync(logFile, 'utf8').split('\n') : []);
const todo = all.filter((k) => !already.has(k));
const attemptPut = (key) => new Promise((resolve) => {
  const p = spawn('npx', ['wrangler', 'r2', 'object', 'put', `${bucket}/${key}`, '--file', join(STAGE, key), '--content-type', 'application/json', local ? '--local' : '--remote'],
    { cwd: WEB, stdio: ['ignore', 'ignore', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => resolve(code === 0 ? '' : err.slice(-300)));
});
const run = async (key) => {
  let err = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    err = await attemptPut(key);
    if (!err) break;
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
  if (err) failed.push({ key, err });
  else appendFileSync(logFile, key + '\n');
  if (++done % 50 === 0 || done === todo.length) console.log(`uploaded ${done}/${todo.length}`);
};
let next = 0;
await Promise.all(Array.from({ length: concurrency }, async () => { while (next < todo.length) await run(todo[next++]); }));
if (failed.length) {
  console.error(`${failed.length} uploads failed (re-run with --resume to retry only those), e.g.`, failed.slice(0, 3));
  process.exit(1);
}
console.log('done');
