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

function cleanTopicName(name) {
  let s = normalizeTitle(name);
  s = s
    .replace(/[•·].*$/, '')
    .replace(/\(\s*\d+\s*(?:lessons?|hrs?|hours?|sessions?|vipindi)?\s*\)?/gi, '')
    .replace(/\b\d+\s*(?:lessons?|hrs?|hours?|sessions?|vipindi)\b/gi, '')
    .replace(/\(\s*\d+\s*$/g, '')
    // Cut curriculum bleed: "Position and Direction 5 3.2 Angles..."
    .replace(/\s+\d+\s+\d+\.\d+\s+[A-Z].*$/, '')
    .replace(/\s+\d+\.\d+\s+[A-Z].*$/, '')
    .replace(/\s+\d+\.\d+\s+Data Handling.*$/i, '')
    .replace(/\s+Total Number of Les.*$/i, '')
    .replace(/\b(?:learner|learners)\b.*$/i, '')
    .replace(/\bshould be able.*$/i, '')
    .replace(/,?\s*the\s*$/i, '')
    .replace(/\b\d+\)\s*.*$/, '')
    .replace(/\s*[-–]\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s.slice(0, 80);
}

export function displayTopicName(name) {
  return cleanTopicName(name);
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

const OUTCOME_RE =
  /By the end of (?:the (?:of the )?|this )?sub(?:[-\s]*strand|[-\s]*theme)?|By the end of the Sub\s*[Ss]trand|By the end the sub[-\s]*strand|By the end of the topic|Kufikia mwisho wa mada(?:\s*ndogo)?|Kufikia mwisho wa/i;

const DURATION_RE =
  /\(\s*(\d+)\s*(?:lessons?|hrs?|hours?|sessions?|vipindi)\s*\)|(\d+)\s*(?:lessons?|hrs?|hours?|sessions?)\b|\(Vipindi\s*(\d+)\)|Vipindi\s*(\d+)/i;

/**
 * Extract every sub-strand topic with its FULL KICD source text block.
 * Supports English, early-years (HRS), Arabic (sessions), Kiswahili (Vipindi / Kufikia mwisho).
 */
export function extractTopicBlocks(text) {
  const topics = [];
  const detailStart = text.search(
    /Strand Sub-Strand Specific Learning Outcomes|Theme\s+Sub-theme|Specific [Ll]earning [Oo]utcomes|Suggested [Ll]earning [Ee]xperiences|MADA\s+MADA\s*NDOGO|Strand\s+Sub-Strand|Strand\s+Sub\s*-?\s*strand/i,
  );
  const source = detailStart >= 0 ? text.slice(detailStart) : text;

  const anchors = [];

  // Form A: numbered X.Y or X.Y.Z topics where an outcome phrase follows nearby
  const numRe = /(?<!\d)(\d+)\.([1-9]\d*)(?:\.([1-9]\d*))?(?!\.\d)/g;
  let match;
  while ((match = numRe.exec(source)) !== null) {
    const window = source.slice(match.index, match.index + 900);
    const outcomeAt = window.search(OUTCOME_RE);
    if (outcomeAt === -1 || outcomeAt > 700) continue;

    // Prefer title up to duration marker when present (handles multi-column PDF tables)
    const local = source.slice(match.index, match.index + 500);
    const durInLocal = local.slice(match[0].length).match(DURATION_RE);
    let titleChunk;
    if (durInLocal && typeof durInLocal.index === 'number' && durInLocal.index < 480) {
      const region = local.slice(match[0].length, match[0].length + durInLocal.index);
      titleChunk = region
        .split('\n')
        .map((line) => {
          const trimmedStart = line.replace(/^\s+/, '');
          const indent = line.length - trimmedStart.length;
          if (indent > 45) return '';
          const cell = trimmedStart.split(/\s{2,}/)[0].trim();
          if (!cell) return '';
          if (/^By the end|^Kufikia|^a\)|^b\)|^c\)|^[•]/i.test(cell)) return '';
          if (/learner should|should be able/i.test(cell)) return '';
          return cell;
        })
        .filter(Boolean)
        .join(' ');
    } else {
      titleChunk = window.slice(match[0].length, outcomeAt);
    }

    const duration =
      durInLocal ||
      titleChunk.match(DURATION_RE) ||
      window.slice(outcomeAt).slice(0, 80).match(DURATION_RE);
    let topicName = cleanTopicName(
      titleChunk
        .replace(DURATION_RE, ' ')
        .replace(/\([^)]{0,40}\)/g, ' ')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' '),
    );
    if (topicName.length < 3 || topicName.length > 100) continue;
    if (/^[\d\s.]+$/.test(topicName)) continue;
    if (/^(strand|sub-?strand|theme|sub-?theme|mada|specific|suggested)$/i.test(topicName)) continue;
    if (!/[A-Za-zÀ-ÿ]{3,}/.test(topicName)) continue;

    const lessonCount = parseInt(duration?.[1] || duration?.[2] || duration?.[3] || duration?.[4] || '0', 10) || 0;
    const topicNumber = match[3] ? `${match[1]}.${match[2]}.${match[3]}` : `${match[1]}.${match[2]}`;
    anchors.push({
      topicNumber,
      topicName,
      strandNum: match[1],
      lessonCount,
      start: match.index,
    });
  }

  // Form B: Kiswahili / table rows with (Vipindi N) — outcome often appears BEFORE the duration
  {
    const simpleVipindi = /\(Vipindi\s*(\d+)\)/gi;
    let m2;
    let synthetic = 0;
    const vipindiAnchors = [];
    while ((m2 = simpleVipindi.exec(source)) !== null) {
      const before = source.slice(Math.max(0, m2.index - 180), m2.index);
      const lines = before
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      let topicName = '';
      for (let i = lines.length - 1; i >= 0; i -= 1) {
        // First cell of the line (before wide column gap or outcome letter)
        let cell = lines[i].split(/\s{2,}/)[0] || lines[i];
        cell = cell.split(/\sa\)\s/i)[0].replace(/\(Vipindi.*$/i, '').trim();
        cell = cleanTopicName(cell);
        if (cell.length < 3 || cell.length > 45) continue;
        if (/^(mada|matokeo|mapendekezo|maswali|yanayotarajiwa|ndogo)$/i.test(cell)) continue;
        if (/kufikia mwisho|mwanafunzi/i.test(cell)) continue;
        topicName = cell;
        break;
      }
      if (topicName.length < 3) continue;
      const around = source.slice(Math.max(0, m2.index - 400), m2.index + 400);
      if (!/Kufikia mwisho|mwanafunzi aweze|By the end/i.test(around)) continue;
      synthetic += 1;
      vipindiAnchors.push({
        topicNumber: `1.${synthetic}`,
        topicName,
        strandNum: '1',
        lessonCount: parseInt(m2[1], 10) || 0,
        start: m2.index,
      });
    }
    if (anchors.length < Math.max(3, vipindiAnchors.length / 2)) {
      for (const a of vipindiAnchors) anchors.push(a);
    }
  }

  anchors.sort((a, b) => a.start - b.start);

  // Drop overlapping false positives (same start within 30 chars)
  const filtered = [];
  for (const a of anchors) {
    const prev = filtered[filtered.length - 1];
    if (prev && a.start - prev.start < 30) continue;
    filtered.push(a);
  }

  for (let i = 0; i < filtered.length; i += 1) {
    const a = filtered[i];
    const end = i + 1 < filtered.length ? filtered[i + 1].start : Math.min(source.length, a.start + 20000);
    const strandName = findStrandName(source, a.start, a.strandNum);
    const rawText = source.slice(a.start, end).slice(0, 25000);

    topics.push({
      topicNumber: a.topicNumber,
      topicOrder: parseFloat(a.topicNumber) || topics.length + 1,
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
      const key = `${t.topicNumber}|${t.topicName.toLowerCase()}`;
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
  const wantName = String(topicName || '').toUpperCase().slice(0, 20);
  for (const doc of docs) {
    const topics = extractTopicBlocks(doc.extractedText || '');
    // Prefer exact topic number + cleanest name
    const numberMatches = topics.filter((t) => t.topicNumber === topicNumber);
    if (numberMatches.length) {
      const named = wantName
        ? numberMatches.find((t) => cleanTopicName(t.topicName).toUpperCase().includes(wantName) || t.topicName.toUpperCase().includes(wantName))
        : null;
      const best =
        named ||
        numberMatches.sort((a, b) => cleanTopicName(a.topicName).length - cleanTopicName(b.topicName).length)[0];
      return { ...best, topicName: cleanTopicName(best.topicName), fileId: doc.fileId, grade, subject };
    }
    if (wantName) {
      const byName = topics.find((t) => cleanTopicName(t.topicName).toUpperCase().includes(wantName));
      if (byName) {
        return { ...byName, topicName: cleanTopicName(byName.topicName), fileId: doc.fileId, grade, subject };
      }
    }
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
  'pp1', 'pp2',
  'pre-primary', 'lower-primary',
  'grade-1', 'grade-2', 'grade-3',
  'grade-4', 'grade-5', 'grade-6', 'grade-7', 'grade-8', 'grade-9',
  'grade-10', 'grade-11', 'grade-12',
  'sne/visual-impairment/pp1', 'sne/visual-impairment/pp2',
  'sne/hearing-impairment/pp1', 'sne/hearing-impairment/pp2',
  'sne/physical-impairment/pp1', 'sne/physical-impairment/pp2',
];

export function gradeSortKey(grade) {
  const idx = GRADE_ORDER.indexOf(grade);
  return idx === -1 ? 999 + grade.charCodeAt(0) : idx;
}

export { CURRICULUM_PATH, INDEX_PATH, slugify };
