import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentType, GeneratedContent, CurriculumGrade } from './types';
import { GRADE_ORDER, gradeStage } from './types';

const ROOT = join(process.cwd(), '..');
const CONTENT_DIR = join(process.cwd(), 'data', 'content');
const INDEX_PATH = join(CONTENT_DIR, 'index.json');
const CURRICULUM_INDEX = join(ROOT, 'knowledge-base', 'phase5', 'curriculum-index.json');

function ensureDir() {
  mkdirSync(CONTENT_DIR, { recursive: true });
}

function readIndex(): GeneratedContent[] {
  ensureDir();
  if (!existsSync(INDEX_PATH)) return [];
  return JSON.parse(readFileSync(INDEX_PATH, 'utf8'));
}

export function listContent(filters?: {
  type?: ContentType | ContentType[];
  grade?: string;
  subject?: string;
  category?: string;
}) {
  let items = readIndex();
  if (filters?.type) {
    const types = Array.isArray(filters.type) ? filters.type : [filters.type];
    items = items.filter((i) => types.includes(i.type));
  }
  if (filters?.grade) items = items.filter((i) => i.topic.grade === filters.grade);
  if (filters?.subject) {
    items = items.filter((i) => i.topic.subject.toLowerCase().includes(filters.subject!.toLowerCase()));
  }
  if (filters?.category) {
    items = items.filter((i) => i.metadata.category === filters.category);
  }
  return items.sort((a, b) => {
    const orderA = a.topic.topicOrder ?? 999;
    const orderB = b.topic.topicOrder ?? 999;
    return orderA - orderB;
  });
}

export function getContent(id: string): GeneratedContent | undefined {
  const filePath = join(CONTENT_DIR, `${id}.json`);
  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, 'utf8').trim();
    // Empty files are left behind when a topic is replaced; ignore them.
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as GeneratedContent;
        return hydrateStudyPages(parsed);
      } catch {
        /* fall through to index */
      }
    }
  }
  const fromIndex = readIndex().find((i) => i.id === id);
  return fromIndex ? hydrateStudyPages(fromIndex) : undefined;
}

/** Prefer full studyPages; if bodies were stripped in the index, rebuild from PAGE markers. */
function hydrateStudyPages(content: GeneratedContent): GeneratedContent {
  if (!content.pages) return content;
  const pages = content.pages.studyPages || [];
  const hasBodies = pages.some((p) => Boolean(p.body?.trim()));
  if (pages.length && hasBodies) return content;

  const fromLesson = parseStudyPagesFromLesson(content.pages.lesson || '');
  if (!fromLesson.length) return content;

  const freeCount = content.pages.freePageCount || content.metadata?.freePageCount || 3;
  return {
    ...content,
    pages: {
      ...content.pages,
      freePageCount: freeCount,
      studyPages: fromLesson.map((p) => ({
        ...p,
        free: p.pageNumber <= freeCount,
      })),
    },
  };
}

function parseStudyPagesFromLesson(lesson: string) {
  const text = String(lesson || '');
  if (!/^PAGE\s+\d+/im.test(text) && !/\nPAGE\s+\d+/i.test(text)) return [];
  const parts = text.split(/(?=^PAGE\s+\d+)/im).filter((p) => /^PAGE\s+\d+/i.test(p.trim()));
  return parts.map((block, idx) => {
    const first = block.trim().split('\n')[0] || '';
    const m = first.match(/^PAGE\s+(\d+)\s*:\s*(.+)$/i);
    const pageNumber = m ? Number(m[1]) : idx + 1;
    const title = (m?.[2] || `Page ${pageNumber}`).trim();
    return { pageNumber, title, body: block.trim(), free: true };
  });
}

export function getCurriculumIndex(): { grades: CurriculumGrade[] } | null {
  if (!existsSync(CURRICULUM_INDEX)) return null;
  return JSON.parse(readFileSync(CURRICULUM_INDEX, 'utf8'));
}

export function getGrades(options?: { includeEmpty?: boolean; includeSne?: boolean }): Array<{
  grade: string;
  label: string;
  stage: string;
  subjectCount: number;
  topicCount: number;
}> {
  const index = getCurriculumIndex();
  if (!index) return [];

  return index.grades
    .map((g) => {
      const subjects = Object.values(g.subjects);
      const withTopics = subjects.filter((s) => s.topics.length > 0);
      return {
        grade: g.grade,
        label: g.label,
        stage: gradeStage(g.grade),
        subjectCount: withTopics.length,
        topicCount: withTopics.reduce((acc, s) => acc + s.topics.length, 0),
      };
    })
    .filter((g) => {
      if (!options?.includeEmpty && g.topicCount === 0) return false;
      if (!options?.includeSne && g.grade.startsWith('sne/')) return false;
      if (g.grade === 'curriculum-designs') return false;
      return true;
    })
    .sort((a, b) => {
      const ia = GRADE_ORDER.indexOf(a.grade);
      const ib = GRADE_ORDER.indexOf(b.grade);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
}

export function getSubjects(grade: string, options?: { includeEmpty?: boolean }) {
  const index = getCurriculumIndex();
  const g = index?.grades.find((x) => x.grade === grade);
  if (!g) return [];
  return Object.values(g.subjects)
    .map((s) => ({
      subject: s.subject,
      topicCount: s.topics.length,
      generatedCount: listContent({ grade, subject: s.subject, type: 'topic-lesson' }).length,
    }))
    .filter((s) => options?.includeEmpty || s.topicCount > 0)
    .filter((s) => !/^general$/i.test(s.subject))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

export function getTopics(grade: string, subject: string) {
  const index = getCurriculumIndex();
  const g = index?.grades.find((x) => x.grade === grade);
  const s = g?.subjects[subject] || Object.values(g?.subjects || {}).find((x) =>
    x.subject.toLowerCase().includes(subject.toLowerCase()),
  );
  if (!s) return [];

  // Must filter by subject — topic numbers like 1.4 repeat across subjects.
  const generated = listContent({ grade, subject: s.subject, type: 'topic-lesson' });
  return s.topics.map((t) => {
    const matches = generated.filter(
      (c) =>
        sameSubject(c.topic.subject, s.subject) &&
        (c.topic.topicNumber === t.topicNumber || c.topic.subStrand === t.topicName || c.topic.slug === t.slug),
    );
    // Prefer newest student multipage notes over older classroom templates.
    const content =
      matches.find((c) => String(c.metadata?.contentSource || '').includes('g8-is-student')) ||
      matches.find((c) => String(c.metadata?.contentSource || '').includes('multipage')) ||
      matches.sort((a, b) => String(b.metadata?.createdAt || '').localeCompare(String(a.metadata?.createdAt || '')))[0];
    return { ...t, contentId: content?.id, hasLesson: Boolean(content) };
  });
}

function sameSubject(a: string, b: string) {
  const na = String(a || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const nb = String(b || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function getExamTypesForCategory(category: string): ContentType[] {
  // Keep types distinct so each Revision Hub category only lists its own papers.
  switch (category) {
    case 'general':
      return ['exam'];
    case 'termly':
      return ['termly-exam'];
    case 'mock':
      return ['mock-exam'];
    case 'premium':
      return ['premium-exam'];
    case 'vault':
      return ['past-paper'];
    default:
      return ['exam', 'termly-exam', 'mock-exam', 'premium-exam', 'past-paper'];
  }
}

export function listExams(grade: string, category: string, subject?: string) {
  const types = getExamTypesForCategory(category);
  let items = listContent({ grade, category }).filter((i) => types.includes(i.type));
  // Fallback for older records that have the right type but no metadata.category
  if (!items.length) {
    items = listContent({ grade }).filter((i) => types.includes(i.type));
  }
  if (subject) {
    items = items.filter((i) => sameSubject(i.topic.subject, subject));
  }
  return items.sort((a, b) => {
    const ta = a.metadata.term ?? 0;
    const tb = b.metadata.term ?? 0;
    if (ta !== tb) return ta - tb;
    return a.title.localeCompare(b.title);
  });
}

export function countExams(category?: string, grade?: string): number {
  const types = category
    ? getExamTypesForCategory(category)
    : (['exam', 'termly-exam', 'mock-exam', 'premium-exam', 'past-paper'] as ContentType[]);
  return listContent({
    grade,
    category,
    type: types,
  }).length;
}

export function listVideoScripts(grade: string, subject?: string) {
  let items = listContent({ type: 'video-script', grade });
  if (subject) {
    items = items.filter((i) => i.topic.subject.toLowerCase().includes(subject.toLowerCase()));
  }
  return items;
}

export function slugifySubject(subject: string) {
  return subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function findSubjectBySlug(grade: string, subjectSlug: string) {
  const subjects = getSubjects(grade);
  const fromCurriculum = subjects.find((s) => slugifySubject(s.subject) === subjectSlug)?.subject;
  if (fromCurriculum) return fromCurriculum;

  // Fall back to subjects present on revision papers (e.g. Past Paper Vault)
  const fromPapers = listContent({ grade }).find(
    (i) => slugifySubject(i.topic.subject) === subjectSlug,
  )?.topic.subject;
  return fromPapers;
}

export function saveContent(content: GeneratedContent) {
  ensureDir();
  writeFileSync(join(CONTENT_DIR, `${content.id}.json`), JSON.stringify(content, null, 2));
  let index = readIndex().filter((i) => i.id !== content.id);
  const preview = content.pages?.lesson?.slice(0, 200) || content.body?.slice(0, 200) || '';
  index.unshift({ ...content, body: preview + (preview.length >= 200 ? '…' : '') });
  writeFileSync(INDEX_PATH, JSON.stringify(index, null, 2));
}

export function seedSamplesIfEmpty() {
  /* no-op: real content from batch generator */
}
