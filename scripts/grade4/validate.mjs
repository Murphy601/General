#!/usr/bin/env node
/**
 * Validate Grade 4 syllabus files against the official KICD design text, and lesson packs against the syllabus.
 * Exits non-zero when any error is found.
 *
 * Usage:
 *   node scripts/grade4/validate.mjs                 # all subjects that have a syllabus file
 *   node scripts/grade4/validate.mjs mathematics     # one subject
 *   node scripts/grade4/validate.mjs mathematics 1.1 # one lesson pack
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GRADE4_SUBJECTS, subjectBySlug } from './subjects.mjs';
import { BANNED_INTRO_FRAMES } from '../study-drama/config.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const G4_DIR = join(__dirname, '..', '..', 'knowledge-base', 'grade-4');

const BANNED_TEXT = [
  /lorem ipsum/i,
  /\bTODO\b/,
  /\bTBD\b/,
  /\[insert/i,
  /as an ai\b/i,
  /language model/i,
  /\bplaceholder\b/i,
  ...BANNED_INTRO_FRAMES,
];

const SYLLABUS_LIST_FIELDS = [
  'content',
  'learningExperiences',
  'keyInquiryQuestions',
  'coreCompetencies',
  'values',
  'pcis',
  'links',
];

export function normalize(text) {
  return String(text || '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function designSource(slug) {
  const raw = readFileSync(join(G4_DIR, 'designs', `${slug}.txt`), 'utf8');
  // Drop running page headers ("Page 17 of 70" + folio) so sentences split by a page break still match.
  const cleaned = raw.replace(/Page \d+ of \d+\s*\n\s*[ivxlcdm\d]*\s*\n/gi, '\n');
  return normalize(cleaned);
}

const FRAGMENT_WINDOW = 6000;

function occurrences(source, piece) {
  const out = [];
  for (let i = source.indexOf(piece); i !== -1 && out.length < 50; i = source.indexOf(piece, i + 1)) out.push(i);
  return out;
}

/** True if `pieces` appear in order, each starting within FRAGMENT_WINDOW of the previous one's end. */
function piecesInOrder(source, pieces) {
  for (const start of occurrences(source, pieces[0])) {
    let end = start + pieces[0].length;
    let ok = true;
    for (const piece of pieces.slice(1)) {
      const idx = source.indexOf(piece, end);
      if (idx === -1 || idx - end > FRAGMENT_WINDOW) {
        ok = false;
        break;
      }
      end = idx + piece.length;
    }
    if (ok) return true;
  }
  return false;
}

/**
 * Exact match, or the text split at word boundaries into up to 3 in-order fragments that sit close together
 * in the design (sentences broken by page breaks or by the neighbouring table column).
 */
function matchInSource(source, text) {
  const needle = normalize(text);
  if (!needle) return { ok: false };
  if (source.includes(needle)) return { ok: true, parts: 1 };

  const words = String(text).split(/\s+/).map(normalize).filter(Boolean);
  const join = (a, b) => words.slice(a, b).join('');
  const minPiece = 6;
  for (let i = 1; i < words.length; i += 1) {
    const a = join(0, i);
    const b = join(i, words.length);
    if (a.length >= minPiece && b.length >= minPiece && piecesInOrder(source, [a, b])) return { ok: true, parts: 2 };
  }
  for (let i = 1; i < words.length - 1; i += 1) {
    const a = join(0, i);
    if (a.length < minPiece || !source.includes(a)) continue;
    for (let j = i + 1; j < words.length; j += 1) {
      const b = join(i, j);
      const c = join(j, words.length);
      if (b.length >= minPiece && c.length >= minPiece && piecesInOrder(source, [a, b, c])) return { ok: true, parts: 3 };
    }
  }
  return { ok: false };
}

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) if (k !== 'svg' && k !== 'check') collectStrings(v, out);
  }
  return out;
}

function evalCheck(expr) {
  if (expr === null || expr === undefined || expr === '') return null;
  const bare = String(expr).replace(/Math\.(round|floor|ceil|abs|min|max)\b/g, '');
  if (!/^[\d\s+\-*/%().,<>=!&|]+$/.test(bare)) return 'contains characters other than numbers and operators';
  try {
    return Function(`"use strict"; return (${expr});`)() === true ? true : 'evaluates to false';
  } catch (err) {
    return `does not parse (${err.message})`;
  }
}

function wordCount(s) {
  return String(s || '').split(/\s+/).filter(Boolean).length;
}

/** `syllabus/<slug>.json`, or every `syllabus/<slug>/*.json` part merged in strand order. */
export function loadSyllabus(slug) {
  const file = join(G4_DIR, 'syllabus', `${slug}.json`);
  const dir = join(G4_DIR, 'syllabus', slug);
  const parts = [];
  if (existsSync(file)) parts.push(JSON.parse(readFileSync(file, 'utf8')));
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.json')).sort()) {
      parts.push(JSON.parse(readFileSync(join(dir, name), 'utf8')));
    }
  }
  if (!parts.length) return null;
  const strandKey = (n) => String(n).split('.').map(Number);
  const strands = parts
    .flatMap((p) => p.strands || [])
    .sort((a, b) => {
      const [x1, x2 = 0] = strandKey(a.number);
      const [y1, y2 = 0] = strandKey(b.number);
      return x1 - y1 || x2 - y2;
    });
  return {
    subject: parts[0].subject,
    slug: parts[0].slug,
    totalLessons: parts.find((p) => p.totalLessons)?.totalLessons ?? null,
    strands,
  };
}

export function listSubStrands(syllabus) {
  return syllabus.strands.flatMap((strand) => strand.subStrands.map((sub) => ({ strand, sub })));
}

function validateSyllabus(slug, syllabus, report) {
  const meta = subjectBySlug(slug);
  if (syllabus.subject !== meta.subject) report.error(`subject should be "${meta.subject}"`);
  if (syllabus.slug !== slug) report.error(`slug should be "${slug}"`);
  const source = designSource(slug);
  const seen = new Set();

  for (const { strand, sub } of listSubStrands(syllabus)) {
    const where = `sub-strand ${sub.number}`;
    if (seen.has(sub.number)) report.error(`${where}: duplicate number`);
    seen.add(sub.number);
    if (!sub.name) report.error(`${where}: missing name`);
    if (!strand.name) report.error(`strand ${strand.number}: missing name`);
    if (!Number.isFinite(sub.lessons) || sub.lessons < 1) report.error(`${where}: lessons must be a positive number`);
    if (!Array.isArray(sub.outcomes) || !sub.outcomes.length) report.error(`${where}: no outcomes`);

    const ids = new Set();
    for (const o of sub.outcomes || []) {
      if (!/^[a-z]$/.test(o.id || '')) report.error(`${where}: outcome id "${o.id}" should be a single letter`);
      if (ids.has(o.id)) report.error(`${where}: duplicate outcome id ${o.id}`);
      ids.add(o.id);
      const m = matchInSource(source, o.text);
      if (!m.ok) report.error(`${where} outcome ${o.id}: not found in design: "${o.text}"`);
    }
    if (!(sub.keyInquiryQuestions || []).length) report.warn(`${where}: no key inquiry questions`);
    if (!(sub.learningExperiences || []).length) report.error(`${where}: no learning experiences`);
    for (const field of SYLLABUS_LIST_FIELDS) {
      for (const text of sub[field] || []) {
        if (!matchInSource(source, text).ok) report.error(`${where} ${field}: not found in design: "${text}"`);
      }
    }
  }
}

function validateLesson(slug, syllabus, pack, report) {
  const found = listSubStrands(syllabus).find(({ sub }) => sub.number === pack.subStrand);
  if (!found) {
    report.error(`sub-strand ${pack.subStrand} is not in the syllabus`);
    return;
  }
  const { sub } = found;
  const isMaths = slug === 'mathematics';
  if (pack.subject !== syllabus.subject) report.error(`subject should be "${syllabus.subject}"`);
  if (pack.title !== sub.name) report.error(`title should be "${sub.name}"`);
  if (wordCount(pack.overview) < 15) report.error('overview is too short');

  const lessons = pack.lessons || [];
  const minLessons = Math.min(sub.lessons, Math.max(2, Math.ceil(sub.outcomes.length / 3)));
  if (lessons.length < minLessons) report.error(`needs at least ${minLessons} lessons (has ${lessons.length})`);

  const outcomeIds = new Set(sub.outcomes.map((o) => o.id));
  const covered = new Set();
  let checks = 0;
  let checkable = 0;

  const countCheck = (item, where) => {
    checkable += 1;
    const res = evalCheck(item.check);
    if (res === true) checks += 1;
    else if (res !== null) report.error(`${where}: check "${item.check}" ${res}`);
  };

  lessons.forEach((lesson, i) => {
    const where = `lesson ${lesson.number ?? i + 1}`;
    if (lesson.number !== i + 1) report.error(`${where}: lessons must be numbered 1, 2, 3…`);
    if (!lesson.title) report.error(`${where}: missing title`);
    for (const id of lesson.outcomes || []) {
      if (!outcomeIds.has(id)) report.error(`${where}: unknown outcome "${id}"`);
      covered.add(id);
    }
    if (!(lesson.outcomes || []).length) report.error(`${where}: no outcomes`);
    if (!(lesson.objectives || []).length) report.error(`${where}: no objectives`);
    if (wordCount(lesson.intro) < 15) report.error(`${where}: intro is too short`);
    if (wordCount(lesson.notes) < 120) report.error(`${where}: notes are too short (${wordCount(lesson.notes)} words, need 120+)`);
    if (!lesson.activity?.steps?.length) report.error(`${where}: activity needs steps`);
    if ((lesson.practice || []).length < 2) report.error(`${where}: needs at least 2 practice questions`);
    for (const [j, ex] of (lesson.examples || []).entries()) {
      if (!ex.problem || !ex.answer) report.error(`${where} example ${j + 1}: needs problem and answer`);
      countCheck(ex, `${where} example ${j + 1}`);
    }
    for (const [j, p] of (lesson.practice || []).entries()) {
      if (!p.question || !String(p.answer ?? '').trim()) report.error(`${where} practice ${j + 1}: needs question and answer`);
      countCheck(p, `${where} practice ${j + 1}`);
    }
    if (lesson.diagram?.svg) {
      const svg = lesson.diagram.svg;
      if (!/^\s*<svg[\s>]/i.test(svg) || !/<\/svg>\s*$/i.test(svg)) report.error(`${where}: diagram must be a single <svg> element`);
      if (/<script|\son\w+\s*=|javascript:|xlink:href\s*=\s*["']http|<foreignObject/i.test(svg)) {
        report.error(`${where}: diagram contains scripts, handlers or external links`);
      }
    }
  });

  for (const id of outcomeIds) if (!covered.has(id)) report.error(`outcome ${id} is not taught in any lesson`);

  const quiz = pack.quiz || [];
  if (quiz.length < 8) report.error(`quiz needs at least 8 questions (has ${quiz.length})`);
  const quizOutcomes = new Set();
  quiz.forEach((q, i) => {
    const where = `quiz ${i + 1}`;
    if (!q.question) report.error(`${where}: missing question`);
    if (!String(q.answer ?? '').trim()) report.error(`${where}: missing answer`);
    if (q.outcome && !outcomeIds.has(q.outcome)) report.error(`${where}: unknown outcome "${q.outcome}"`);
    if (q.outcome) quizOutcomes.add(q.outcome);
    if (q.options) {
      if (q.options.length < 3) report.error(`${where}: multiple choice needs 3+ options`);
      const idx = String(q.answer).trim().toUpperCase().charCodeAt(0) - 65;
      if (!/^[A-Z]$/.test(String(q.answer).trim()) || idx >= q.options.length) {
        report.error(`${where}: answer must be the letter of one option`);
      }
    }
    countCheck(q, where);
  });
  if (quizOutcomes.size < Math.ceil(outcomeIds.size * 0.5)) {
    report.warn(`quiz covers only ${quizOutcomes.size}/${outcomeIds.size} outcomes`);
  }
  if (isMaths && checkable && checks / checkable < 0.5) {
    report.error(`mathematics needs a passing check on at least half of examples/practice/quiz (${checks}/${checkable})`);
  }
  if (!(pack.sources || []).length) report.error('sources are required');

  for (const s of collectStrings(pack)) {
    for (const re of BANNED_TEXT) if (re.test(s)) report.error(`banned text ${re}: "${s.slice(0, 80)}"`);
    if (/(…|\.\.\.)\s*$/.test(s.trim()) && s.length > 40) report.warn(`text ends with an ellipsis: "${s.slice(-60)}"`);
  }
}

function makeReport(label) {
  const errors = [];
  const warnings = [];
  return {
    label,
    errors,
    warnings,
    error: (m) => errors.push(m),
    warn: (m) => warnings.push(m),
  };
}

export function validateSubject(slug, onlySubStrand) {
  const reports = [];
  const syllabus = loadSyllabus(slug);
  if (!syllabus) return reports;

  const sr = makeReport(`${slug}/syllabus`);
  validateSyllabus(slug, syllabus, sr);
  reports.push(sr);

  const dir = join(G4_DIR, 'lessons', slug);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  for (const file of files) {
    const number = file.replace(/\.json$/, '');
    if (onlySubStrand && number !== onlySubStrand) continue;
    const r = makeReport(`${slug}/${number}`);
    try {
      const pack = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      if (pack.subStrand !== number) r.error(`file name ${file} does not match subStrand ${pack.subStrand}`);
      validateLesson(slug, syllabus, pack, r);
    } catch (err) {
      r.error(`invalid JSON: ${err.message}`);
    }
    reports.push(r);
  }

  const have = new Set(files.map((f) => f.replace(/\.json$/, '')));
  const missing = listSubStrands(syllabus).map(({ sub }) => sub.number).filter((n) => !have.has(n));
  if (missing.length && !onlySubStrand) sr.warn(`no lesson pack yet for: ${missing.join(', ')}`);
  return reports;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [, , slugArg, subArg] = process.argv;
  const slugs = slugArg ? [slugArg] : GRADE4_SUBJECTS.map((s) => s.slug);
  if (slugArg && !subjectBySlug(slugArg)) {
    console.error(`Unknown subject slug "${slugArg}"`);
    process.exit(2);
  }
  let errorCount = 0;
  for (const slug of slugs) {
    for (const r of validateSubject(slug, subArg)) {
      errorCount += r.errors.length;
      const status = r.errors.length ? 'FAIL' : 'ok  ';
      console.log(`${status} ${r.label}${r.warnings.length ? ` (${r.warnings.length} warnings)` : ''}`);
      for (const e of r.errors) console.log(`     ✗ ${e}`);
      for (const w of r.warnings) console.log(`     ! ${w}`);
    }
  }
  console.log(errorCount ? `\n${errorCount} error(s)` : '\nAll checks passed');
  process.exit(errorCount ? 1 : 0);
}
