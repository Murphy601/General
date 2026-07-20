#!/usr/bin/env node
/**
 * Ingest Grade 1–3 regular Mathematics pupil books:
 * - extract page text for topic matching
 * - render page images into web/public/media for lessons
 *
 * Usage:
 *   node scripts/ingest-pupil-books.mjs
 *   node scripts/ingest-pupil-books.mjs --grade grade-1
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PDF_ROOT = join(ROOT, 'knowledge-base', 'pdfs');
const TEXT_ROOT = join(ROOT, 'knowledge-base', 'textbooks', 'text');
const INDEX_PATH = join(ROOT, 'knowledge-base', 'textbooks', 'textbook-index.json');
const MEDIA_ROOT = join(ROOT, 'web', 'public', 'media', 'pupil-books');

const BOOKS = [
  {
    grade: 'grade-1',
    subject: 'mathematics',
    subjectAliases: ['MATHEMATICS ACTIVITIES', 'MATHEMATICS'],
    path: join(PDF_ROOT, 'grade-1', 'ISBN_REGULAR_ GRADE 1 PUPILS BOOK FINAL BOOK 30th.pdf'),
    title: 'Mathematics Pupil Book Grade 1',
  },
  {
    grade: 'grade-2',
    subject: 'mathematics',
    subjectAliases: ['MATHEMATICS ACTIVITIES', 'MATHEMATICS'],
    path: join(PDF_ROOT, 'grade-2', 'ISBN_REGULAR _ GRADE 2 PUPILS BOOK FINAL BOOK 30th.pdf'),
    title: 'Mathematics Pupil Book Grade 2',
  },
  {
    grade: 'grade-3',
    subject: 'mathematics',
    subjectAliases: ['MATHEMATICS ACTIVITIES', 'MATHEMATICS'],
    path: join(PDF_ROOT, 'grade-3', 'ISBN_PUPILS BOOK_ GRADE 3 22nd Dec.pdf'),
    title: 'Mathematics Pupil Book Grade 3',
  },
];

function parseArgs(argv) {
  const args = { grade: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--grade') args.grade = argv[++i];
  }
  return args;
}

function slugify(s) {
  return String(s || 'item')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function pageCount(pdfPath) {
  const out = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
  const m = out.match(/Pages:\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

function extractPageText(pdfPath, page) {
  return execFileSync(
    'pdftotext',
    ['-layout', '-enc', 'UTF-8', '-f', String(page), '-l', String(page), pdfPath, '-'],
    { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 },
  );
}

function renderPage(pdfPath, page, outBase) {
  // JPEG ~100 DPI keeps size reasonable for the web
  execFileSync(
    'pdftoppm',
    ['-f', String(page), '-l', String(page), '-jpeg', '-r', '110', pdfPath, outBase],
    { stdio: 'ignore' },
  );
  // pdftoppm appends -1, -01, or -001 depending on version/page count
  const dir = dirname(outBase);
  const base = basename(outBase);
  const found = readdirSync(dir).find((f) => f.startsWith(base) && f.endsWith('.jpg'));
  return found ? join(dir, found) : null;
}

function topicHintsFromPage(text) {
  const hints = new Set();
  const lower = text.toLowerCase();
  const patterns = [
    /number names?/g,
    /counting/g,
    /whole numbers?/g,
    /tens and ones/g,
    /place value/g,
    /addition/g,
    /subtraction/g,
    /multiplication/g,
    /division/g,
    /patterns?/g,
    /shapes?/g,
    /measurement/g,
    /length/g,
    /mass/g,
    /capacity/g,
    /time/g,
    /money/g,
    /position/g,
    /fractions?/g,
    /sorting/g,
    /matching/g,
    /ordering/g,
  ];
  for (const re of patterns) {
    const m = lower.match(re);
    if (m) m.forEach((x) => hints.add(x));
  }
  // Capture lesson title line after Week N Lesson N
  const titleMatch = text.match(/Week\s+\d+\s+Lesson\s+\d+\s*\n([A-Za-z][^\n]{2,60})/i);
  if (titleMatch) hints.add(titleMatch[1].trim().toLowerCase());
  return [...hints];
}

function cleanPageText(text) {
  return String(text || '')
    .replace(/Property of the Government of Kenya/gi, '')
    .replace(/NOT FOR SALE/gi, '')
    .replace(/\f/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const args = parseArgs(process.argv);
let index = { generatedAt: new Date().toISOString(), total: 0, items: [] };
if (existsSync(INDEX_PATH)) {
  index = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
}

// Remove previous pupil-book entries for grades we will rebuild
const rebuildGrades = new Set(
  BOOKS.filter((b) => !args.grade || b.grade === args.grade).map((b) => b.grade),
);
index.items = (index.items || []).filter(
  (item) => !(item.kind === 'pupil-book' && rebuildGrades.has(item.grade)),
);

for (const book of BOOKS) {
  if (args.grade && book.grade !== args.grade) continue;
  if (!existsSync(book.path)) {
    console.log(`SKIP missing: ${book.path}`);
    continue;
  }

  const pages = pageCount(book.path);
  console.log(`\n${book.title}: ${pages} pages`);

  const outDir = join(TEXT_ROOT, book.grade, book.subject);
  const mediaDir = join(MEDIA_ROOT, book.grade, book.subject);
  mkdirSync(outDir, { recursive: true });
  mkdirSync(mediaDir, { recursive: true });

  const pageRecords = [];
  // Skip front matter; start from page 6 where lessons usually begin
  const startPage = 6;
  for (let p = startPage; p <= pages; p += 1) {
    let text = '';
    try {
      text = cleanPageText(extractPageText(book.path, p));
    } catch (err) {
      console.log(`  page ${p}: text extract failed (${err.message})`);
      continue;
    }
    if (text.length < 40) continue;

    const pageId = String(p).padStart(3, '0');
    const mediaBase = join(mediaDir, `page-${pageId}`);
    let imageRel = null;
    try {
      const rendered = renderPage(book.path, p, mediaBase);
      if (rendered && existsSync(rendered)) {
        // Normalize filename to page-NNN.jpg
        const target = join(mediaDir, `page-${pageId}.jpg`);
        if (rendered !== target) {
          writeFileSync(target, readFileSync(rendered));
          try {
            execFileSync('rm', ['-f', rendered], { stdio: 'ignore' });
          } catch {
            /* ignore */
          }
        }
        imageRel = `/media/pupil-books/${book.grade}/${book.subject}/page-${pageId}.jpg`;
      }
    } catch (err) {
      console.log(`  page ${p}: image render failed (${err.message})`);
    }

    pageRecords.push({
      page: p,
      text,
      image: imageRel,
      hints: topicHintsFromPage(text),
    });

    if (p % 25 === 0) console.log(`  processed page ${p}/${pages}`);
  }

  const bookSlug = slugify(book.title);
  const bookJsonPath = join(outDir, `${bookSlug}.json`);
  const fullText = pageRecords.map((r) => `--- Page ${r.page} ---\n${r.text}`).join('\n\n');
  writeFileSync(
    bookJsonPath,
    JSON.stringify(
      {
        title: book.title,
        grade: book.grade,
        subject: book.subject,
        kind: 'pupil-book',
        pages: pageRecords,
        text: fullText,
        sourceFile: book.path,
      },
      null,
      2,
    ),
  );

  const id = createHash('sha1').update(book.path).digest('hex').slice(0, 16);
  index.items.push({
    id,
    title: book.title,
    grade: book.grade,
    subject: book.subject,
    subjectAliases: book.subjectAliases,
    sourceFile: book.path,
    kind: 'pupil-book',
    charCount: fullText.length,
    wordCount: fullText.split(/\s+/).length,
    topicHints: [...new Set(pageRecords.flatMap((r) => r.hints))].slice(0, 40),
    text: fullText.slice(0, 1500),
    pagesFile: `${book.grade}/${book.subject}/${bookSlug}.json`,
    pageCount: pageRecords.length,
    extractedAt: new Date().toISOString(),
  });

  console.log(`  saved ${pageRecords.length} lesson pages + images`);
}

index.total = index.items.length;
index.generatedAt = new Date().toISOString();
writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
console.log(`\nTextbook index now has ${index.total} items`);
