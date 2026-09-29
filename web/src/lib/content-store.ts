import type { ContentType, GeneratedContent, CurriculumGrade } from './types';
import { GRADE_ORDER, gradeStage } from './types';
import { readJson, writeLocalContent } from './storage';

type GradeSummary = { grade: string; label: string; subjectCount: number; topicCount: number };

/** Grades present in the published bucket. undefined = no filter (local dev). */
async function publishedGrades(): Promise<string[] | undefined> {
  return readJson<string[]>('index/grades.json');
}

async function readGradeIndex(grade: string): Promise<GeneratedContent[]> {
  return (await readJson<GeneratedContent[]>(`index/${grade}.json`)) || [];
}

async function allGradeKeys(): Promise<string[]> {
  const published = await publishedGrades();
  if (published) return published;
  return ((await readJson<GradeSummary[]>('curriculum/grades.json')) || []).map((g) => g.grade);
}

export async function listContent(filters?: {
  type?: ContentType | ContentType[];
  grade?: string;
  subject?: string;
  category?: string;
}) {
  let items: GeneratedContent[];
  if (filters?.grade) {
    items = await readGradeIndex(filters.grade);
  } else {
    items = (await Promise.all((await allGradeKeys()).map(readGradeIndex))).flat();
  }
  if (filters?.type) {
    const types = Array.isArray(filters.type) ? filters.type : [filters.type];
    items = items.filter((i) => types.includes(i.type));
  }
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

export async function getContent(id: string): Promise<GeneratedContent | undefined> {
  if (!/^[A-Za-z0-9_-]+$/.test(id)) return undefined;
  const parsed = await readJson<GeneratedContent>(`content/${id}.json`);
  return parsed ? hydrateStudyPages(parsed) : undefined;
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

export async function getCurriculumGrade(grade: string): Promise<CurriculumGrade | undefined> {
  return readJson<CurriculumGrade>(`curriculum/${grade}.json`);
}

export async function getGrades(options?: { includeEmpty?: boolean; includeSne?: boolean }): Promise<
  Array<{ grade: string; label: string; stage: string; subjectCount: number; topicCount: number }>
> {
  const list = (await readJson<GradeSummary[]>('curriculum/grades.json')) || [];
  const published = await publishedGrades();

  return list
    .map((g) => ({ ...g, stage: gradeStage(g.grade) }))
    .filter((g) => {
      if (published && !published.includes(g.grade)) return false;
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

export async function getSubjects(grade: string, options?: { includeEmpty?: boolean }) {
  const g = await getCurriculumGrade(grade);
  if (!g) return [];
  const lessons = await listContent({ grade, type: 'topic-lesson' });
  return Object.values(g.subjects)
    .map((s) => ({
      subject: s.subject,
      topicCount: s.topics.length,
      generatedCount: lessons.filter((c) => c.topic.subject.toLowerCase().includes(s.subject.toLowerCase())).length,
    }))
    .filter((s) => options?.includeEmpty || s.topicCount > 0)
    .filter((s) => !/^general$/i.test(s.subject))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

export async function getTopics(grade: string, subject: string) {
  const g = await getCurriculumGrade(grade);
  const s = g?.subjects[subject] || Object.values(g?.subjects || {}).find((x) =>
    x.subject.toLowerCase().includes(subject.toLowerCase()),
  );
  if (!s) return [];

  // Must filter by subject — topic numbers like 1.4 repeat across subjects.
  const generated = await listContent({ grade, subject: s.subject, type: 'topic-lesson' });
  return s.topics.map((t) => {
    const matches = generated.filter(
      (c) =>
        sameSubject(c.topic.subject, s.subject) &&
        (c.topic.topicNumber === t.topicNumber || c.topic.subStrand === t.topicName || c.topic.slug === t.slug),
    );
    // Prefer Study-Content & Drama Engine output.
    const content =
      matches.find((c) => String(c.metadata?.contentSource || '').includes('study-drama-engine-v1')) ||
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

export async function listExams(grade: string, category: string, subject?: string) {
  const types = getExamTypesForCategory(category);
  let items = (await listContent({ grade, category })).filter((i) => types.includes(i.type));
  // Fallback for older records that have the right type but no metadata.category
  if (!items.length) {
    items = (await listContent({ grade })).filter((i) => types.includes(i.type));
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

export async function countExams(category?: string, grade?: string): Promise<number> {
  // Precomputed by scripts/publish-r2.mjs on Workers; falls back to counting the index locally.
  const counts = await readJson<Record<string, Record<string, number>>>('index/counts.json');
  if (counts) {
    const cats = category ? [category] : Object.keys(counts);
    let n = 0;
    for (const c of cats) {
      const byGrade = counts[c] || {};
      n += grade ? byGrade[grade] || 0 : Object.values(byGrade).reduce((a, b) => a + b, 0);
    }
    return n;
  }
  const types = category
    ? getExamTypesForCategory(category)
    : (['exam', 'termly-exam', 'mock-exam', 'premium-exam', 'past-paper'] as ContentType[]);
  return (await listContent({ grade, category, type: types })).length;
}

export async function listVideoScripts(grade: string, subject?: string) {
  let items = await listContent({ type: 'video-script', grade });
  if (subject) {
    items = items.filter((i) => i.topic.subject.toLowerCase().includes(subject.toLowerCase()));
  }
  return items;
}

export function slugifySubject(subject: string) {
  return subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function findSubjectBySlug(grade: string, subjectSlug: string) {
  const subjects = await getSubjects(grade);
  const fromCurriculum = subjects.find((s) => slugifySubject(s.subject) === subjectSlug)?.subject;
  if (fromCurriculum) return fromCurriculum;

  // Fall back to subjects present on revision papers (e.g. Past Paper Vault)
  const fromPapers = (await listContent({ grade })).find(
    (i) => slugifySubject(i.topic.subject) === subjectSlug,
  )?.topic.subject;
  return fromPapers;
}

export async function saveContent(content: GeneratedContent) {
  await writeLocalContent(content);
}

export function seedSamplesIfEmpty() {
  /* no-op: real content from batch generator */
}
