import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentType, GeneratedContent, CurriculumGrade } from './types';
import { GRADE_ORDER } from './types';

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
    return JSON.parse(readFileSync(filePath, 'utf8'));
  }
  return readIndex().find((i) => i.id === id);
}

export function getCurriculumIndex(): { grades: CurriculumGrade[] } | null {
  if (!existsSync(CURRICULUM_INDEX)) return null;
  return JSON.parse(readFileSync(CURRICULUM_INDEX, 'utf8'));
}

export function getGrades(): Array<{ grade: string; label: string; subjectCount: number; topicCount: number }> {
  const index = getCurriculumIndex();
  if (!index) return [];

  return index.grades
    .map((g) => ({
      grade: g.grade,
      label: g.label,
      subjectCount: Object.keys(g.subjects).length,
      topicCount: Object.values(g.subjects).reduce((acc, s) => acc + s.topics.length, 0),
    }))
    .sort((a, b) => {
      const ia = GRADE_ORDER.indexOf(a.grade);
      const ib = GRADE_ORDER.indexOf(b.grade);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
}

export function getSubjects(grade: string) {
  const index = getCurriculumIndex();
  const g = index?.grades.find((x) => x.grade === grade);
  if (!g) return [];
  return Object.values(g.subjects)
    .map((s) => ({
      subject: s.subject,
      topicCount: s.topics.length,
      generatedCount: listContent({ grade, subject: s.subject, type: 'topic-lesson' }).length,
    }))
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
    const content = generated.find(
      (c) =>
        sameSubject(c.topic.subject, s.subject) &&
        (c.topic.topicNumber === t.topicNumber || c.topic.subStrand === t.topicName || c.topic.slug === t.slug),
    );
    return { ...t, contentId: content?.id, hasLesson: Boolean(content) };
  });
}

function sameSubject(a: string, b: string) {
  const na = String(a || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const nb = String(b || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return na === nb || na.includes(nb) || nb.includes(na);
}

export function getExamTypesForCategory(category: string): ContentType[] {
  switch (category) {
    case 'general':
      return ['quiz', 'exam'];
    case 'termly':
      return ['termly-exam', 'exam'];
    case 'mock':
      return ['mock-exam', 'exam'];
    case 'premium':
      return ['premium-exam', 'exam'];
    default:
      return ['exam', 'quiz'];
  }
}

export function listExams(grade: string, category: string, subject?: string) {
  const types = getExamTypesForCategory(category);
  let items = listContent({ grade }).filter((i) => types.includes(i.type));
  if (subject) {
    items = items.filter((i) => i.topic.subject.toLowerCase().includes(subject.toLowerCase()));
  }
  return items;
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
  return subjects.find((s) => slugifySubject(s.subject) === subjectSlug)?.subject;
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
