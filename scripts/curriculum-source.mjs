/**
 * Extract full KICD topic blocks (sub-strands) with complete curriculum text.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inferSubject, isUsableDocument } from './rag-chunk-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CURRICULUM_PATH = join(__dirname, '..', 'knowledge-base', 'phase3', 'curriculum-text.json');
const INDEX_PATH = join(__dirname, '..', 'knowledge-base', 'phase5', 'curriculum-index.json');

let catalogCache = null;

function normalize(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function subjectMatches(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  return na.includes(nb) || nb.includes(na);
}

function slugify(value) {
  return String(value || 'topic')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function getCatalog() {
  if (!catalogCache) {
    if (!existsSync(CURRICULUM_PATH)) throw new Error(`Missing ${CURRICULUM_PATH}`);
    catalogCache = JSON.parse(readFileSync(CURRICULUM_PATH, 'utf8'));
  }
  return catalogCache;
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

export function isKiswahiliSubject(subject) {
  return /KISWAHILI|SWAHILI/i.test(subject);
}

function normalizeTitle(s) {
  return String(s || '')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\d.\s]+/, '')
    .replace(/Strand Sub-Strand.*$/i, '')
    .trim();
}

function findStrandName(source, position, strandNum) {
  const before = source.slice(Math.max(0, position - 4000), position);
  const re = new RegExp(`${strandNum}\\.0\\s*(?:\\n|[ \\t]+)([\\s\\S]*?)(?=\\n${strandNum}\\.[1-9]|$)`, 'gi');
  let match;
  let last = null;
  while ((match = re.exec(before)) !== null) last = match;
  if (!last) return `Strand ${strandNum}`;
  return normalizeTitle(last[1]).slice(0, 80) || `Strand ${strandNum}`;
}

/**
 * Extract every sub-strand topic with its FULL KICD source text block.
 * Parses the detailed "Specific Learning Outcomes" section only (not the summary table).
 */
export function extractTopicBlocks(text) {
  const topics = [];
  const detailStart = text.search(/Strand Sub-Strand Specific Learning Outcomes/i);
  const source = detailStart >= 0 ? text.slice(detailStart) : text;

  // Sub-strands are X.Y where Y >= 1 (X.0 is only the strand header).
  const lessonRe = /(\d+)\.([1-9]\d*)\.?\s*(?:\n|[ \t]+)([\s\S]*?)\((\d+)\s*lessons?\)/gi;

  const anchors = [];
  let match;
  while ((match = lessonRe.exec(source)) !== null) {
    const strandNum = match[1];
    const subNum = match[2];

    const after = source.slice(match.index + match[0].length);
    const byEnd = after.search(/By the end of the sub[-\s]*strand/i);
    if (byEnd === -1) continue;

    const topicNumber = `${strandNum}.${subNum}`;
    const topicName = normalizeTitle(match[3]);
    if (topicName.length < 3 || topicName.length > 120) continue;

    anchors.push({
      topicNumber,
      topicName,
      strandNum,
      lessonCount: parseInt(match[4], 10) || 0,
      start: match.index,
      bodyStart: match.index + match[0].length + byEnd,
    });
  }

  for (let i = 0; i < anchors.length; i += 1) {
    const a = anchors[i];
    const end = i + 1 < anchors.length ? anchors[i + 1].start : Math.min(source.length, a.start + 20000);
    const before = source.slice(Math.max(0, a.start - 800), a.start);
    const strandName = findStrandName(source, a.start, a.strandNum);
    const rawText = source.slice(a.start, end).slice(0, 25000);

    topics.push({
      topicNumber: a.topicNumber,
      topicOrder: parseFloat(a.topicNumber.replace('.', '')) || topics.length + 1,
      strandNumber: a.strandNum,
      strandName,
      topicName: a.topicName,
      lessonCount: a.lessonCount,
      rawText,
      slug: slugify(`${a.topicNumber}-${a.topicName}`),
    });
  }

  const seen = new Set();
  return topics
    .filter((t) => {
      const key = `${t.topicNumber}|${t.topicName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.topicOrder - b.topicOrder);
}

export function extractAllTopicsForDocument(doc) {
  const subject = inferDocSubject(doc);
  const topics = extractTopicBlocks(doc.extractedText || '');
  return topics.map((t, idx) => ({
    ...t,
    topicOrder: idx + 1,
    grade: doc.grade,
    subject,
    fileId: doc.fileId,
  }));
}

export function getTopicSourceText({ grade, subject, topicNumber, topicName }) {
  const docs = listDocuments({ grade, subject });
  for (const doc of docs) {
    const topics = extractTopicBlocks(doc.extractedText || '');
    const match = topics.find(
      (t) =>
        t.topicNumber === topicNumber ||
        (topicName && t.topicName.toUpperCase().includes(topicName.toUpperCase().slice(0, 20))),
    );
    if (match) return { ...match, fileId: doc.fileId, grade, subject };
  }
  return null;
}

export function formatGradeLabel(grade) {
  if (!grade) return 'Unknown';
  return grade
    .replace(/^sne\//, 'SNE / ')
    .replace(/\//g, ' / ')
    .replace(/grade-/gi, 'Grade ')
    .replace(/\bpp(\d)\b/gi, 'PP$1');
}

export const GRADE_ORDER = [
  'sne/visual-impairment/pp1', 'sne/visual-impairment/pp2',
  'sne/hearing-impairment/pp1', 'sne/hearing-impairment/pp2',
  'sne/physical-impairment/pp1', 'sne/physical-impairment/pp2',
  'pre-primary', 'pp1', 'pp2',
  'lower-primary', 'grade-1', 'grade-2', 'grade-3',
  'grade-4', 'grade-5', 'grade-6', 'grade-7', 'grade-8', 'grade-9',
  'grade-10', 'grade-11', 'grade-12',
];

export function gradeSortKey(grade) {
  const idx = GRADE_ORDER.indexOf(grade);
  return idx === -1 ? 999 + grade.charCodeAt(0) : idx;
}

export { CURRICULUM_PATH, INDEX_PATH, slugify };
