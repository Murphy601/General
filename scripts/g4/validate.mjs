#!/usr/bin/env node
// Usage: node scripts/g4/validate.mjs <subject-slug>   (or --all)
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { SUBJECTS, PAGE_KINDS, loadLessons, loadBank } from './parse.mjs';

const ROOT = join(import.meta.dirname, '..', '..', 'content-authoring', 'grade-4');
const BANNED = [
  /use insults/i, /avoid reading anything/i, /copy random text/i, /local context for/i,
  /practis(e|ing) .{0,40}: focus on/i, /anchor:/i, /clue from the topic/i, /learning outcome/i,
  /suggested (learning )?experiences/i, /belongs to number and measurement/i, /lorem ipsum/i,
  /\bTODO\b|\bTBD\b|\bXXX\b/, /,\./, /\bday-to\.$/m, /\[\s*diagram\s*\]/i, /figure-prompt/i,
  /in your own words and give one (clear )?example from/i, /one Kenyan example linked to/i,
];
const MIN_WORDS_PER_PAGE = 120;
const MIN_PAGES = 12;
const MAX_PAGES = 20;
const REQUIRED_KINDS = ['practice', 'mistakes', 'real-life', 'summary'];

function words(s) { return (s.match(/\S+/g) || []).length; }

function validateSubject(slug) {
  const dir = join(ROOT, slug);
  const problems = []; const notes = [];
  if (!existsSync(join(dir, 'manifest.json'))) return { problems: [`${slug}: no manifest.json`], notes };
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const lessons = loadLessons(dir);
  const seen = new Set();
  let figs = 0;
  for (const L of lessons) {
    const f = `${slug}/${L.file}`;
    for (const e of L.errors) problems.push(e);
    if (!L.meta) continue;
    if (!L.meta.topicNumber || !L.meta.topicName) problems.push(`${f}: front matter needs topicNumber and topicName`);
    const key = L.meta.topicNumber;
    if (seen.has(key)) problems.push(`${f}: duplicate topic ${key}`);
    seen.add(key);
    if (L.pages.length < MIN_PAGES) problems.push(`${f}: only ${L.pages.length} pages (min ${MIN_PAGES})`);
    if (L.pages.length > MAX_PAGES) problems.push(`${f}: ${L.pages.length} pages (max ${MAX_PAGES})`);
    const kinds = new Set(L.pages.map((p) => p.kind));
    for (const p of L.pages) if (!PAGE_KINDS.includes(p.kind)) problems.push(`${f}: page ${p.pageNumber} needs a kind after the title, e.g. "## PAGE 3: Title | example" (one of ${PAGE_KINDS.join(', ')})`);
    for (const k of REQUIRED_KINDS) if (!kinds.has(k)) problems.push(`${f}: lesson needs a page of kind "${k}"`);
    if (!kinds.has('activity') && !kinds.has('project')) problems.push(`${f}: lesson needs a page of kind "activity" or "project"`);
    if (kinds.size < 7) problems.push(`${f}: only ${kinds.size} different page kinds (min 7) - make the pages diverse`);
    const titles = L.pages.map((p) => p.title.toLowerCase());
    if (new Set(titles).size !== titles.length) problems.push(`${f}: duplicate page titles`);
    L.pages.forEach((p, i) => {
      if (p.pageNumber !== i + 1) problems.push(`${f}: page numbering must be 1..n (got ${p.pageNumber} at position ${i + 1})`);
      const w = words(p.text.replace(/<svg[\s\S]*?<\/svg>/g, ''));
      if (w < MIN_WORDS_PER_PAGE) problems.push(`${f}: page ${p.pageNumber} has only ${w} words (min ${MIN_WORDS_PER_PAGE})`);
      for (const fig of p.figures) {
        figs++;
        if (!fig.svg) problems.push(`${f}: page ${p.pageNumber} figure without <svg>`);
        else {
          if (!/viewBox=/.test(fig.svg)) problems.push(`${f}: figure svg needs viewBox`);
          const open = (fig.svg.match(/<(?!\/|!|\?)[a-zA-Z][^>]*[^/]>/g) || []).length;
          const close = (fig.svg.match(/<\/[a-zA-Z]+>/g) || []).length;
          const selfc = (fig.svg.match(/<[a-zA-Z][^>]*\/>/g) || []).length;
          if (open !== close) problems.push(`${f}: figure svg tags unbalanced (open ${open}, close ${close}, self-closed ${selfc})`);
          if (/<script|onload=|onclick=|href="http/i.test(fig.svg)) problems.push(`${f}: unsafe content in svg`);
        }
        if (!fig.caption || !fig.alt) problems.push(`${f}: figure needs caption and alt`);
      }
      for (const re of BANNED) if (re.test(p.raw.replace(/<svg[\s\S]*?<\/svg>/g, ""))) problems.push(`${f}: page ${p.pageNumber} matches banned pattern ${re}`);
    });
    if (L.quiz.length < 10) problems.push(`${f}: quiz has ${L.quiz.length} items (min 10)`);
    L.quiz.forEach((q) => {
      const tag = `${f}: quiz Q${q.n}`;
      if (!q.answer.trim()) problems.push(`${tag}: missing Answer`);
      if (q.options.length) {
        if (q.options.length !== 4) problems.push(`${tag}: MCQ needs exactly 4 options`);
        if (new Set(q.options.map((o) => o.toLowerCase())).size !== q.options.length) problems.push(`${tag}: duplicate options`);
        if (!/^[A-D]\b/.test(q.answer)) problems.push(`${tag}: MCQ Answer must start with A-D`);
      }
      if (!q.why.trim()) problems.push(`${tag}: missing Why (explanation or working)`);
      for (const re of BANNED) if (re.test(q.q + q.answer + q.why + q.options.join(' '))) problems.push(`${tag}: banned pattern ${re}`);
    });
    const mcq = L.quiz.filter((q) => q.options.length).length;
    if (mcq < 5 || L.quiz.length - mcq < 3) problems.push(`${f}: quiz needs >=5 MCQ and >=3 written items`);
  }
  const paraSeen = new Map();
  for (const L of lessons) {
    if (!L.pages) continue;
    for (const pg of L.pages) {
      for (const para of pg.text.replace(/\[DIAGRAM\][\s\S]*?\[\/DIAGRAM\]/g, '').split(/\n\s*\n/)) {
        const n = para.split(/\s+/).join(' ').toLowerCase();
        if (n.length < 80 || /^(#|\d+\.|[a-d]\))/.test(n)) continue;
        if (paraSeen.has(n) && paraSeen.get(n) !== L.file) problems.push(`${slug}/${L.file}: paragraph copied from ${paraSeen.get(n)}: "${n.slice(0, 60)}…"`);
        else paraSeen.set(n, L.file);
      }
    }
  }
  const retired = new Set(existsSync(join(dir, 'retire.json')) ? JSON.parse(readFileSync(join(dir, 'retire.json'), 'utf8')) : []);
  const haveNums = new Set(lessons.filter((l) => l.meta).map((l) => l.meta.topicNumber));
  for (const t of manifest.topics) {
    if (!haveNums.has(t.topicNumber) && !retired.has(t.topicNumber)) {
      problems.push(`${slug}: manifest topic ${t.topicNumber} "${t.topicName}" has no lesson (write it, or list its number in retire.json if it is OCR noise)`);
    }
  }
  const bank = loadBank(dir);
  for (const e of bank.errors) problems.push(`${slug}: ${e}`);
  if (bank.mcq.length < 400) problems.push(`${slug}: bank has ${bank.mcq.length} MCQ (min 400)`);
  if (bank.short.length < 160) problems.push(`${slug}: bank has ${bank.short.length} short-answer items (min 160)`);
  const tset = new Set(lessons.filter((l) => l.meta).map((l) => l.meta.topicNumber));
  const qseen = new Set();
  bank.mcq.forEach((q, i) => {
    const tag = `${slug}/bank/${q._file} mcq#${i}`;
    if (!q.q || !Array.isArray(q.options) || q.options.length !== 4) return problems.push(`${tag}: needs q and 4 options`);
    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) problems.push(`${tag}: answer must be 0-3`);
    if (new Set(q.options.map((o) => String(o).trim().toLowerCase())).size !== 4) problems.push(`${tag}: duplicate options "${q.q.slice(0, 50)}"`);
    if (!q.explanation) problems.push(`${tag}: missing explanation`);
    if (!tset.has(String(q.topic))) problems.push(`${tag}: topic "${q.topic}" has no lesson`);
    const k = q.q.trim().toLowerCase();
    if (qseen.has(k)) problems.push(`${tag}: duplicate question text "${q.q.slice(0, 50)}"`);
    qseen.add(k);
    for (const re of BANNED) if (re.test(q.q + q.options.join(' ') + (q.explanation || ''))) problems.push(`${tag}: banned pattern ${re}`);
  });
  bank.short.forEach((q, i) => {
    const tag = `${slug}/bank/${q._file} short#${i}`;
    if (!q.q || !q.answer || !Number.isInteger(q.marks) || q.marks < 2 || q.marks > 6) problems.push(`${tag}: needs q, answer, integer marks 2-6`);
    if (!tset.has(String(q.topic))) problems.push(`${tag}: topic "${q.topic}" has no lesson`);
    const k = (q.q || '').trim().toLowerCase();
    if (qseen.has(k)) problems.push(`${tag}: duplicate question text`);
    qseen.add(k);
  });
  notes.push(`${slug}: ${lessons.length} lessons, ${lessons.reduce((a, l) => a + (l.pages?.length || 0), 0)} pages, ${figs} figures, bank ${bank.mcq.length} MCQ / ${bank.short.length} short`);
  return { problems, notes };
}

const arg = process.argv[2];
const slugs = arg === '--all' ? Object.keys(SUBJECTS) : [arg];
let bad = 0;
for (const s of slugs) {
  if (!SUBJECTS[s]) { console.error(`unknown subject ${s}`); process.exit(2); }
  const { problems, notes } = validateSubject(s);
  notes.forEach((n) => console.log(n));
  problems.slice(0, 60).forEach((p) => console.log('  ✗ ' + p));
  if (problems.length > 60) console.log(`  … ${problems.length - 60} more problems`);
  bad += problems.length;
}
console.log(bad ? `\n${bad} problem(s)` : '\nOK');
process.exit(bad ? 1 : 0);
