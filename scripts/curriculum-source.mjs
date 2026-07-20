/**
 * Direct lookup in curriculum-text.json — does not depend on embeddings/chunks.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferSubject, isUsableDocument } from './rag-chunk-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURRICULUM_PATH = join(__dirname, '..', 'knowledge-base', 'phase3', 'curriculum-text.json');
const INDEX_PATH = join(__dirname, '..', 'knowledge-base', 'phase5', 'curriculum-index.json');

let catalogCache = null;
let indexCache = null;

function normalize(s) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function subjectMatches(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  return na.includes(nb) || nb.includes(na) || na === nb;
}

function getCatalog() {
  if (!catalogCache) {
    if (!existsSync(CURRICULUM_PATH)) throw new Error(`Missing ${CURRICULUM_PATH}. Run: npm run curriculum:prepare`);
    catalogCache = JSON.parse(readFileSync(CURRICULUM_PATH, 'utf8'));
  }
  return catalogCache;
}

export function getIndex() {
  if (!indexCache && existsSync(INDEX_PATH)) {
    indexCache = JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
  }
  return indexCache;
}

export function inferDocSubject(doc) {
  return doc.subject || inferSubject(doc.extractedText, doc.title) || 'General';
}

export function listDocuments({ grade, subject } = {}) {
  const docs = (getCatalog().documents || []).filter(isUsableDocument);
  return docs.filter((doc) => {
    if (grade && doc.grade !== grade) return false;
    if (subject && !subjectMatches(inferDocSubject(doc), subject)) return false;
    return true;
  });
}

export function extractStrands(text) {
  const strands = [];
  const seen = new Set();
  const re = /STRAND\s+(\d+(?:\.\d+)?)\s*[:\.]?\s*([^\n]+)/gi;
  let m;
  while ((m = re.exec(text))) {
    const name = m[2].replace(/\s+/g, ' ').trim().replace(/\.+$/, '').replace(/\s*\d+\s*$/, '');
    if (name.length < 4 || name.length > 120) continue;
    if (/^\.+|NATIONAL GOALS|FOREWORD/i.test(name)) continue;
    const key = `${m[1]}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    strands.push({ number: m[1], name });
  }
  return strands;
}

export function extractSubStrands(text, strandNumber) {
  const subStrands = [];
  const seen = new Set();
  const prefix = strandNumber ? `SUB[- ]?STRAND\\s+${strandNumber.replace('.', '\\.')}\\.` : 'SUB[- ]?STRAND';
  const re = new RegExp(`${prefix}\\s*(\\d+(?:\\.\\d+)?)?\\s*[:\.]?\\s*([^\\n]+)`, 'gi');
  let m;
  while ((m = re.exec(text))) {
    const name = (m[2] || m[1] || '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
    if (name.length < 4 || name.length > 120) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    subStrands.push({ number: m[1] || '', name });
  }
  return subStrands;
}

export function sliceStrandText(text, strandName) {
  const upper = text.toUpperCase();
  const target = strandName.toUpperCase();
  const idx = upper.indexOf(target);
  if (idx === -1) return text.slice(0, 8000);
  return text.slice(Math.max(0, idx - 200), idx + 12000);
}

export function getContextChunks({ grade, subject, strand, subStrand, maxChunks = 6 }) {
  const docs = listDocuments({ grade, subject });
  if (!docs.length) return [];

  const chunks = [];
  for (const doc of docs) {
    const text = doc.extractedText || '';
    let slice = text;
    if (strand) slice = sliceStrandText(text, strand);
    if (subStrand) {
      const idx = slice.toUpperCase().indexOf(subStrand.toUpperCase());
      if (idx !== -1) slice = slice.slice(Math.max(0, idx - 300), idx + 8000);
    }
    chunks.push({
      id: doc.fileId,
      grade: doc.grade,
      subject: inferDocSubject(doc),
      title: inferDocSubject(doc),
      text: slice.slice(0, 10000),
      score: 1,
    });
  }

  return chunks.slice(0, maxChunks);
}

export function formatGradeLabel(grade) {
  if (!grade) return 'Unknown';
  return grade
    .replace(/^sne\//, 'SNE / ')
    .replace(/\//g, ' / ')
    .replace(/grade-/gi, 'Grade ')
    .replace(/\bpp(\d)\b/gi, 'PP$1')
    .replace(/\bgrade-/gi, 'Grade ');
}

export { CURRICULUM_PATH, INDEX_PATH };
