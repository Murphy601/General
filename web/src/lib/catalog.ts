import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalog, CatalogDocument } from './types';

const ROOT = join(process.cwd(), '..');
const CATALOG_PATH = join(process.cwd(), 'public', 'data', 'catalog.json');
const CURRICULUM_PATH = join(ROOT, 'knowledge-base', 'phase3', 'curriculum-text.json');
const CHUNKS_PATH = join(ROOT, 'knowledge-base', 'phase4', 'curriculum-chunks.json');

let catalogCache: Catalog | null = null;

export function getCatalog(): Catalog {
  if (!catalogCache) {
    catalogCache = JSON.parse(readFileSync(CATALOG_PATH, 'utf8')) as Catalog;
  }
  return catalogCache;
}

export function getDocument(fileId: string): CatalogDocument | undefined {
  return getCatalog().documents.find((d) => d.fileId === fileId);
}

export function getDocumentsByGradeSubject(gradeSlug: string, subjectSlug: string): CatalogDocument[] {
  return getCatalog().documents.filter(
    (d) => d.gradeSlug === gradeSlug && d.subjectSlug === subjectSlug,
  );
}

export function getGradeGroups() {
  const catalog = getCatalog();
  return Object.entries(catalog.byGrade)
    .map(([key, group]) => ({ key, ...group }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function getDocumentText(fileId: string): string | null {
  if (!existsSync(CURRICULUM_PATH)) return null;
  const raw = readFileSync(CURRICULUM_PATH, 'utf8');
  const marker = `"fileId": "${fileId}"`;
  const idx = raw.indexOf(marker);
  if (idx === -1) return null;
  const textKey = '"extractedText": "';
  const textStart = raw.indexOf(textKey, idx);
  if (textStart === -1) return null;
  const start = textStart + textKey.length;
  let end = start;
  while (end < raw.length) {
    if (raw[end] === '"' && raw[end - 1] !== '\\') break;
    end += 1;
  }
  return JSON.parse(`"${raw.slice(start, end)}"`);
}

export function getChunksForDocument(fileId: string) {
  if (!existsSync(CHUNKS_PATH)) return [];
  const data = JSON.parse(readFileSync(CHUNKS_PATH, 'utf8'));
  return (data.chunks || []).filter((c: { fileId: string }) => c.fileId === fileId);
}

export function searchCatalog(query: string, limit = 20): CatalogDocument[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return getCatalog()
    .documents.filter(
      (d) =>
        d.subject.toLowerCase().includes(q) ||
        d.title.toLowerCase().includes(q) ||
        d.gradeLabel.toLowerCase().includes(q) ||
        d.excerpt.toLowerCase().includes(q),
    )
    .slice(0, limit);
}

export { ROOT, CATALOG_PATH, CURRICULUM_PATH, CHUNKS_PATH };
