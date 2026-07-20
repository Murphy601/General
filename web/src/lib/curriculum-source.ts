import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), '..');
const CURRICULUM_PATH = join(ROOT, 'knowledge-base', 'phase3', 'curriculum-text.json');

let catalogCache: { documents: Array<Record<string, unknown>> } | null = null;

function normalize(s: string) {
  return String(s || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function subjectMatches(a: string, b: string) {
  const na = normalize(a);
  const nb = normalize(b);
  return na.includes(nb) || nb.includes(na);
}

function inferSubject(text: string, title?: string): string | null {
  const sample = `${title || ''}\n${text.slice(0, 3000)}`;
  const patterns = [
    /JUNIOR SCHOOL CURRICULUM DESIGN\s*\n+([A-Z][A-Z\s&]+?)\s*\n/i,
    /PRIMARY SCHOOL CURRICULUM DESIGN\s*\n+([A-Z][A-Z\s&]+?)\s*\n/i,
    /SENIOR SCHOOL CURRICULUM DESIGN\s*\n+([A-Z][A-Z\s&]+?)\s*\n/i,
    /UPPER PRIMARY LEVEL DESIGNS\s*\n+([A-Z][A-Z\s&]+?)\s*\n/i,
  ];
  for (const p of patterns) {
    const m = sample.match(p);
    if (m?.[1] && m[1].length > 2 && m[1].length < 60) return m[1].replace(/\s+/g, ' ').trim();
  }
  return null;
}

function getCatalog() {
  if (!catalogCache) {
    if (!existsSync(CURRICULUM_PATH)) return { documents: [] };
    catalogCache = JSON.parse(readFileSync(CURRICULUM_PATH, 'utf8'));
  }
  return catalogCache!;
}

export function listDocuments(filters?: { grade?: string; subject?: string }) {
  const docs = (getCatalog().documents || []).filter(
    (d) => d.extractedText && String(d.extractedText).length > 500 && d.status !== 'error',
  );
  return docs.filter((doc) => {
    const grade = String(doc.grade || '');
    const subj = String(doc.subject || inferSubject(String(doc.extractedText), String(doc.title)) || '');
    if (filters?.grade && grade !== filters.grade) return false;
    if (filters?.subject && !subjectMatches(subj, filters.subject)) return false;
    return true;
  });
}

function sliceStrandText(text: string, strand: string) {
  const idx = text.toUpperCase().indexOf(strand.toUpperCase());
  if (idx === -1) return text.slice(0, 10000);
  return text.slice(Math.max(0, idx - 200), idx + 12000);
}

export function getContextChunks(options: {
  grade: string;
  subject: string;
  strand?: string;
  subStrand?: string;
  maxChunks?: number;
}) {
  const docs = listDocuments({ grade: options.grade, subject: options.subject });
  if (!docs.length) return [];

  return docs.slice(0, options.maxChunks ?? 6).map((doc) => {
    let text = String(doc.extractedText || '');
    if (options.strand) text = sliceStrandText(text, options.strand);
    if (options.subStrand) {
      const idx = text.toUpperCase().indexOf(options.subStrand.toUpperCase());
      if (idx !== -1) text = text.slice(Math.max(0, idx - 300), idx + 8000);
    }
    const subject = String(doc.subject || inferSubject(text, String(doc.title)) || options.subject);
    return {
      id: String(doc.fileId),
      grade: String(doc.grade),
      subject,
      title: subject,
      text: text.slice(0, 10000),
      score: 1,
    };
  });
}

export function formatGradeLabel(grade: string) {
  return grade
    .replace(/^sne\//, 'SNE / ')
    .replace(/\//g, ' / ')
    .replace(/grade-/gi, 'Grade ')
    .replace(/\bpp(\d)\b/gi, 'PP$1');
}
