#!/usr/bin/env node
/**
 * Extract plain text from downloaded textbook/programme files (EPUB + PDF).
 * Output: knowledge-base/textbooks/text/<grade>/<subject>/<slug>.json
 *
 * Usage:
 *   node scripts/extract-textbook-text.mjs
 *   node scripts/extract-textbook-text.mjs --grade grade-4
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { dirname, join, extname, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const RAW = join(ROOT, 'knowledge-base', 'textbooks', 'raw');
const TEXT_DIR = join(ROOT, 'knowledge-base', 'textbooks', 'text');
const INDEX = join(ROOT, 'knowledge-base', 'textbooks', 'textbook-index.json');

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

function walkFiles(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, acc);
    else if (/\.(epub|pdf)$/i.test(name)) acc.push(p);
  }
  return acc;
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractEpub(filePath) {
  const tmp = mkdtempSync(join(tmpdir(), 'epub-'));
  try {
    execFileSync('unzip', ['-qq', '-o', filePath, '-d', tmp], { stdio: 'ignore' });
    const pages = [];
    const walk = (d) => {
      for (const name of readdirSync(d)) {
        const p = join(d, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(xhtml|html|htm)$/i.test(name)) {
          const raw = readFileSync(p, 'utf8');
          let text = stripHtml(raw);
          // Drop common UI chrome from KICD radio programmes
          text = text
            .replace(/Remodal[\s\S]*?(?:Deny|OK)\s*/gi, ' ')
            .replace(/This page needs permission to play audio[\s\S]*?(?:Deny|OK)\s*/gi, ' ')
            .replace(/Responsive, lightweight, fast[\s\S]{0,400}?tracking\.\s*/gi, ' ')
            .replace(/[""]\s*to allow audio playback\s*(OK\s*)?(Deny\s*)?/gi, ' ')
            .replace(/\b(OK|Deny)\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (text.length > 40) pages.push(text);
        }
      }
    };
    walk(tmp);
    return pages.join('\n\n');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function extractPdf(filePath) {
  try {
    const out = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', filePath, '-'], {
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
    return out.replace(/\s+\n/g, '\n').trim();
  } catch {
    return '';
  }
}

function cleanTeachingText(text) {
  return String(text || '')
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inferTopicHints(title, text) {
  const blob = `${title}\n${text.slice(0, 1500)}`;
  const hints = [];
  const patterns = [
    /present continuous/i,
    /past continuous/i,
    /pronounc/i,
    /full stops?/i,
    /capital letters?/i,
    /scarecrow|wild animals/i,
    /compass/i,
    /physical features/i,
  ];
  for (const p of patterns) {
    const m = blob.match(p);
    if (m) hints.push(m[0].toLowerCase());
  }
  // PROG_N titles
  const prog = title.match(/PROG[_\s-]*(\d+)/i);
  if (prog) hints.push(`programme-${prog[1]}`);
  return [...new Set(hints)];
}

const args = parseArgs(process.argv);
let files = walkFiles(RAW);
if (args.grade) {
  files = files.filter((f) => f.includes(`/${args.grade}/`) || f.includes(`\\${args.grade}\\`));
}

console.log(`Extracting text from ${files.length} files...`);
const index = [];

for (const filePath of files) {
  const rel = relative(RAW, filePath);
  const parts = rel.split(/[/\\]/);
  const grade = parts[0] || 'unknown';
  const subject = parts[1] || 'general';
  const fileName = basename(filePath);
  const ext = extname(filePath).toLowerCase();
  const title = fileName.replace(/\.(epub|pdf)$/i, '');

  let text = '';
  try {
    text = ext === '.epub' ? extractEpub(filePath) : extractPdf(filePath);
  } catch (err) {
    console.log(`  FAIL ${rel}: ${err.message}`);
    continue;
  }
  text = cleanTeachingText(text);
  if (text.length < 80) {
    console.log(`  SKIP short: ${rel}`);
    continue;
  }

  const id = createHash('sha1').update(rel).digest('hex').slice(0, 16);
  const outDir = join(TEXT_DIR, grade, subject);
  mkdirSync(outDir, { recursive: true });
  const outFile = join(outDir, `${slugify(title)}.json`);
  const record = {
    id,
    title,
    grade,
    subject,
    sourceFile: rel,
    kind: ext.replace('.', ''),
    charCount: text.length,
    wordCount: text.split(/\s+/).length,
    topicHints: inferTopicHints(title, text),
    text,
    extractedAt: new Date().toISOString(),
  };
  writeFileSync(outFile, JSON.stringify(record, null, 2));
  index.push({ ...record, text: text.slice(0, 400) });
  console.log(`  OK ${grade}/${subject}: ${title} (${record.wordCount} words)`);
}

mkdirSync(dirname(INDEX), { recursive: true });
writeFileSync(
  INDEX,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      total: index.length,
      items: index,
    },
    null,
    2,
  ),
);
console.log(`\nIndex: ${INDEX} (${index.length} items)`);
