#!/usr/bin/env node
/**
 * Ingest local Pre-Primary and Lower Primary PDFs into curriculum-text.json
 * so PP1, PP2, Grade 1–3 appear with correct subject sections.
 *
 * Usage:
 *   node scripts/ingest-early-years-pdfs.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PDF_ROOT = join(ROOT, 'knowledge-base', 'pdfs');
const CURRICULUM = join(ROOT, 'knowledge-base', 'phase3', 'curriculum-text.json');
const GZ = join(ROOT, 'knowledge-base', 'phase3', 'curriculum-text.json.gz');

const SOURCES = [
  {
    path: join(PDF_ROOT, 'pre-primary', 'Pre-Primary 1 Curriculum Designs.pdf'),
    grade: 'pp1',
    mode: 'pp-bundle',
  },
  {
    path: join(PDF_ROOT, 'pre-primary', 'Pre-Primary 2 Curriculum Designs.pdf'),
    grade: 'pp2',
    mode: 'pp-bundle',
  },
  {
    path: join(PDF_ROOT, 'lower-primary', 'Lower Primary Vol 1 (Kiswahili, Literacy, English).pdf'),
    mode: 'lower-vol',
  },
  {
    path: join(PDF_ROOT, 'lower-primary', 'Lower Primary Vol 2 (Maths, Environmental, Hygiene).pdf'),
    mode: 'lower-vol',
  },
  {
    path: join(PDF_ROOT, 'lower-primary', 'Lower Primary Vol 3 (Religious Education).pdf'),
    mode: 'lower-vol',
  },
  {
    path: join(PDF_ROOT, 'lower-primary', 'Lower Primary Vol 4 (Movement & Creative).pdf'),
    mode: 'lower-vol',
  },
];

/** Exact chapter titles as they appear on form-feed pages (not TOC). */
const PP_CHAPTERS = [
  'LANGUAGE ACTIVITIES',
  'MATHEMATICAL ACTIVITIES',
  'MATHEMATICS ACTIVITIES',
  'MATHEMATICS CURRICULUM DESIGN',
  'PSYCHOMOTOR AND CREATIVE ACTIVITIES',
  'ENVIRONMENTAL ACTIVITIES',
  'CHRISTIAN RELIGIOUS EDUCATION',
  'ISLAMIC RELIGIOUS EDUCATION ACTIVITIES',
  'HINDU RELIGIOUS EDUCATION',
];

const LOWER_CHAPTERS = [
  'KISWAHILI ACTIVITIES',
  'LITERACY ACTIVITIES',
  'ENGLISH ACTIVITIES',
  'MATHEMATICS ACTIVITIES',
  'ENVIRONMENTAL ACTIVITIES',
  'HYGIENE AND NUTRITION ACTIVITIES',
  'CHRISTIAN RELIGIOUS EDUCATION ACTIVITIES',
  'CHRISTIAN RELIGIOUS EDUCATION',
  'ISLAMIC RELIGIOUS EDUCATION ACTIVITIES',
  'ISLAMIC RELIGIOUS EDUCATION',
  'HINDU RELIGIOUS EDUCATION',
  'HINDU RELIGIOUS ACTIVITIES',
  'MOVEMENT AND CREATIVE ACTIVITIES',
];

const GRADE_MARKERS = [
  { grade: 'grade-1', patterns: [/^GRADE\s+ONE\s*$/i, /^GREDI\s+YA\s+KWANZA\s*$/i, /^GRADE\s+1\s*$/i] },
  { grade: 'grade-2', patterns: [/^GRADE\s+TWO\s*$/i, /^GREDI\s+YA\s+PILI\s*$/i, /^GRADE\s+2\s*$/i] },
  { grade: 'grade-3', patterns: [/^GRADE\s+THREE\s*$/i, /^GREDI\s+YA\s+TATU\s*$/i, /^GRADE\s+3\s*$/i] },
];

function pdfText(path) {
  return execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', path, '-'], {
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
  });
}

function fileIdFor(path, grade, subject) {
  return createHash('sha1').update(`${path}|${grade}|${subject}`).digest('hex').slice(0, 28);
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Find chapter starts: form-feed page with the heading alone on a line,
 * skipping TOC rows that are followed by leader dots.
 */
function findChapterStarts(text, headings) {
  const hits = [];
  for (const heading of headings) {
    const re = new RegExp(`(?:^|\\f)\\s*${escapeRe(heading)}\\s*$`, 'gim');
    let m;
    while ((m = re.exec(text)) !== null) {
      const start = m.index + (m[0].startsWith('\f') ? 1 : 0);
      // Align to heading text itself
      const headingIdx = text.toUpperCase().indexOf(heading.toUpperCase(), Math.max(0, m.index));
      if (headingIdx < 0 || headingIdx > m.index + m[0].length) continue;
      const after = text.slice(headingIdx + heading.length, headingIdx + heading.length + 12);
      if (/\.{3,}/.test(after)) continue; // TOC
      if (text.length - headingIdx < 2500) continue; // trailing junk
      hits.push({ heading, idx: headingIdx });
    }
  }

  // Keep earliest body occurrence per heading (first non-TOC after preface)
  const byHeading = new Map();
  for (const hit of hits.sort((a, b) => a.idx - b.idx)) {
    const key = hit.heading.toUpperCase();
    // Prefer the last form-feed occurrence in the first 90% of the doc for PP
    // but if we already have one and this is much later and substantial, replace
    const prev = byHeading.get(key);
    if (!prev) {
      byHeading.set(key, hit);
      continue;
    }
    // Replace if previous looks like a duplicate near TOC region and this is later
    if (hit.idx > prev.idx + 500) byHeading.set(key, hit);
  }

  return [...byHeading.values()].sort((a, b) => a.idx - b.idx);
}

function splitChapters(text, headings) {
  const starts = findChapterStarts(text, headings);
  const parts = [];
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i].idx;
    const end = i + 1 < starts.length ? starts[i + 1].idx : text.length;
    if (end - start < 2000) continue;
    parts.push({
      subject: normalizeSubject(starts[i].heading),
      text: text.slice(start, end),
    });
  }
  return parts;
}

function findGradeStarts(subjectText) {
  const found = [];
  const lines = subjectText.split(/\n/);
  let offset = 0;
  for (const line of lines) {
    const trimmed = line.replace(/\f/g, '').trim();
    for (const marker of GRADE_MARKERS) {
      if (marker.patterns.some((re) => re.test(trimmed))) {
        found.push({ grade: marker.grade, idx: offset + line.indexOf(trimmed) });
        break;
      }
    }
    offset += line.length + 1;
  }

  // Deduplicate consecutive same grade (keep first)
  const deduped = [];
  for (const f of found.sort((a, b) => a.idx - b.idx)) {
    if (deduped.length && deduped[deduped.length - 1].grade === f.grade) continue;
    // Prefer later occurrence if earlier is tiny TOC-ish (within first 800 chars of subject)
    if (deduped.length && f.grade === deduped[deduped.length - 1].grade) continue;
    deduped.push(f);
  }

  // If TOC + body both have Grade One/Two/Three early, keep the last complete sequence
  // Strategy: keep the last occurrence of each grade that still leaves >= 1500 chars
  const lastByGrade = new Map();
  for (const f of found.sort((a, b) => a.idx - b.idx)) {
    lastByGrade.set(f.grade, f);
  }
  const ordered = [...lastByGrade.values()].sort((a, b) => a.idx - b.idx);
  const out = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const start = ordered[i].idx;
    const end = i + 1 < ordered.length ? ordered[i + 1].idx : subjectText.length;
    if (end - start < 1500) continue;
    out.push({ grade: ordered[i].grade, text: subjectText.slice(start, end) });
  }
  return out;
}

function normalizeSubject(name) {
  let s = String(name || 'General')
    .replace(/ CURRICULUM DESIGN$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  if (s === 'MATHEMATICAL ACTIVITIES') s = 'MATHEMATICS ACTIVITIES';
  if (s === 'MATHEMATICS') s = 'MATHEMATICS ACTIVITIES';
  if (s === 'CHRISTIAN RELIGIOUS EDUCATION ACTIVITIES') s = 'CHRISTIAN RELIGIOUS EDUCATION';
  if (s === 'ISLAMIC RELIGIOUS EDUCATION ACTIVITIES') s = 'ISLAMIC RELIGIOUS EDUCATION';
  if (s === 'HINDU RELIGIOUS ACTIVITIES') s = 'HINDU RELIGIOUS EDUCATION';
  return s;
}

function makeDoc({ fileId, grade, subject, title, text, sourcePath }) {
  return {
    fileId,
    title,
    subject: normalizeSubject(subject),
    grade,
    status: 'extracted',
    charCount: text.length,
    pageCount: Math.max(1, Math.round(text.length / 1800)),
    extractedText: text,
    sourceUrl: `local://${sourcePath}`,
    previewUrl: null,
    ingestedFrom: 'local-pdf',
  };
}

if (!existsSync(CURRICULUM)) {
  console.error('Missing curriculum-text.json. Run npm run curriculum:prepare first.');
  process.exit(1);
}

const catalog = JSON.parse(readFileSync(CURRICULUM, 'utf8'));
catalog.documents = catalog.documents || [];

const before = catalog.documents.length;
catalog.documents = catalog.documents.filter((d) => d.ingestedFrom !== 'local-pdf');
console.log(`Removed ${before - catalog.documents.length} previous local-pdf docs`);

const added = [];

for (const src of SOURCES) {
  if (!existsSync(src.path)) {
    console.log(`SKIP missing: ${src.path}`);
    continue;
  }
  console.log(`Extracting ${basename(src.path)}...`);
  const fullText = pdfText(src.path);

  if (src.mode === 'pp-bundle') {
    const parts = splitChapters(fullText, PP_CHAPTERS);
    console.log(`  PP subjects found: ${parts.map((p) => p.subject).join(', ')}`);
    for (const part of parts) {
      const subject = normalizeSubject(part.subject);
      const fileId = fileIdFor(src.path, src.grade, subject);
      const doc = makeDoc({
        fileId,
        grade: src.grade,
        subject,
        title: `${src.grade.toUpperCase()} — ${subject}`,
        text: part.text,
        sourcePath: src.path,
      });
      catalog.documents.push(doc);
      added.push(`${doc.grade}/${doc.subject} (${doc.charCount} chars)`);
    }
  }

  if (src.mode === 'lower-vol') {
    const parts = splitChapters(fullText, LOWER_CHAPTERS);
    console.log(`  Subject sections: ${parts.map((p) => p.subject).join(', ')}`);
    for (const part of parts) {
      const subject = normalizeSubject(part.subject);
      const gradeParts = findGradeStarts(part.text);
      if (!gradeParts.length) {
        console.log(`  WARN no grade split for ${subject}`);
        continue;
      }
      for (const gp of gradeParts) {
        const fileId = fileIdFor(src.path, gp.grade, subject);
        const doc = makeDoc({
          fileId,
          grade: gp.grade,
          subject,
          title: `${gp.grade} — ${subject}`,
          text: gp.text,
          sourcePath: src.path,
        });
        catalog.documents.push(doc);
        added.push(`${doc.grade}/${doc.subject} (${doc.charCount} chars)`);
      }
    }
  }
}

catalog.totalDocuments = catalog.documents.length;
catalog.generatedAt = new Date().toISOString();
writeFileSync(CURRICULUM, JSON.stringify(catalog));
writeFileSync(GZ, gzipSync(Buffer.from(JSON.stringify(catalog))));
console.log(`\nAdded ${added.length} documents:`);
for (const a of added) console.log(`  ${a}`);
console.log(`Catalog now has ${catalog.documents.length} documents`);
console.log('Updated curriculum-text.json.gz');
console.log('Next: npm run content:index && npm run content:generate -- --grade pp1 --no-llm --delay 0');
