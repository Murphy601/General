#!/usr/bin/env node
// One-off: builds content-authoring/grade-4/<subject>/{manifest.json,curriculum-source.txt}
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { SUBJECTS } from './parse.mjs';

const ROOT = join(import.meta.dirname, '..', '..');
const CONTENT = join(ROOT, 'web', 'data', 'content');
const OUT = join(ROOT, 'content-authoring', 'grade-4');
const docs = JSON.parse(gunzipSync(readFileSync(join(ROOT, 'knowledge-base/phase3/curriculum-text.json.gz'))).toString()).documents
  .filter((d) => d.grade === 'grade-4');
const docById = new Map(docs.map((d) => [d.fileId, d]));

const recs = [];
for (const f of readdirSync(CONTENT)) {
  if (!f.endsWith('.json') || f === 'index.json') continue;
  try {
    const d = JSON.parse(readFileSync(join(CONTENT, f), 'utf8'));
    if (d?.topic?.grade === 'grade-4' && d.type === 'topic-lesson') recs.push(d);
  } catch { /* skip broken */ }
}
const slugOf = Object.fromEntries(Object.entries(SUBJECTS).map(([k, v]) => [v, k]));
for (const [slug, subject] of Object.entries(SUBJECTS)) {
  const dir = join(OUT, slug);
  mkdirSync(join(dir, 'lessons'), { recursive: true });
  mkdirSync(join(dir, 'bank'), { recursive: true });
  const mine = recs.filter((r) => r.topic.subject === subject);
  const groups = new Map();
  for (const r of mine) {
    const key = r.topic.topicNumber + '|' + r.topic.topicName.toLowerCase().replace(/[^a-z؀-ۿ一-鿿]+/g, '');
    if (!groups.has(key)) groups.set(key, { topicNumber: r.topic.topicNumber, topicName: r.topic.topicName.replace(/\s*\(?\d+\)?$/, '').trim(), topicOrder: r.topic.topicOrder, existingLessonIds: [], excerpt: r.sources?.[0]?.excerpt || '' });
    groups.get(key).existingLessonIds.push(r.id);
  }
  const topics = [...groups.values()].sort((a, b) => a.topicOrder - b.topicOrder);
  const srcIds = [...new Set(mine.flatMap((r) => (r.sources || []).map((s) => s.id)))];
  const design = srcIds.map((id) => docById.get(id)).filter(Boolean).sort((a, b) => b.charCount - a.charCount)[0];
  if (design) writeFileSync(join(dir, 'curriculum-source.txt'), design.extractedText);
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify({
    subject, slug, grade: 'grade-4',
    note: 'topics = what the current (bad) build knows about. Compare with curriculum-source.txt (the full KICD design, OCR text) and cover the real Grade 4 syllabus. Add lessons for real topics missing here; set "retire": true only for entries that are OCR noise / not real topics.',
    designChars: design?.charCount || 0, topics,
  }, null, 2));
  console.log(slug, topics.length, 'topics', design ? design.charCount + ' chars design' : 'NO DESIGN DOC');
}
