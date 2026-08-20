import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentType, GeneratedContent, CurriculumGrade } from './types';
import { GRADE_ORDER, gradeStage } from './types';

const ROOT = join(process.cwd(), '..');
const CONTENT_DIR = join(process.cwd(), 'data', 'content');
const INDEX_PATH = join(CONTENT_DIR, 'index.json');
const CURRICULUM_INDEX = join(ROOT, 'knowledge-base', 'phase5', 'curriculum-index.json');
type AssetsFetcher = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

const cache: {
  index?: GeneratedContent[];
  curriculum?: { grades: CurriculumGrade[] } | null;
  assets?: AssetsFetcher | null;
  assetsResolved?: boolean;
  lessons?: Record<string, GeneratedContent[]>;
  videos?: Record<string, GeneratedContent[]>;
  examCounts?: ExamCounts;
  examIdMap?: Record<string, { grade: string; category: string; subjectSlug: string }>;
  examPacks?: Record<string, GeneratedContent[]>;
} = {};

type ExamCounts = {
  general?: number;
  termly?: number;
  mock?: number;
  premium?: number;
  vault?: number;
  byGrade?: Record<string, Record<string, number>>;
};

function ensureDir() {
  mkdirSync(CONTENT_DIR, { recursive: true });
}

async function getAssets(): Promise<AssetsFetcher | null> {
  if (cache.assetsResolved) return cache.assets ?? null;
  cache.assetsResolved = true;
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const ctx = await getCloudflareContext({ async: true });
    cache.assets = ctx?.env?.ASSETS ?? null;
  } catch {
    cache.assets = null;
  }
  return cache.assets ?? null;
}

async function onCloudflare() {
  return Boolean(await getAssets());
}

async function readAssetJson<T>(pathname: string): Promise<T | undefined> {
  const assets = await getAssets();
  if (assets) {
    const res = await assets.fetch(new Request(new URL(pathname, 'https://assets.local')));
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  }
  const diskPath = join(process.cwd(), 'public', pathname.replace(/^\//, ''));
  if (!existsSync(diskPath)) return undefined;
  return JSON.parse(readFileSync(diskPath, 'utf8')) as T;
}

function readIndex(): GeneratedContent[] {
  if (cache.index) return cache.index;
  ensureDir();
  if (!existsSync(INDEX_PATH)) return [];
  cache.index = JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as GeneratedContent[];
  return cache.index;
}

export async function listContent(filters?: {
  type?: ContentType | ContentType[];
  grade?: string;
  subject?: string;
  category?: string;
}) {
  let items: GeneratedContent[] = (await onCloudflare())
    ? await listContentFromAssets(filters)
    : readIndex();

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

async function listContentFromAssets(filters?: {
  type?: ContentType | ContentType[];
  grade?: string;
  category?: string;
}): Promise<GeneratedContent[]> {
  const types = filters?.type ? (Array.isArray(filters.type) ? filters.type : [filters.type]) : null;
  const wantsLessons = !types || types.includes('topic-lesson');
  const wantsVideos = !types || types.includes('video-script');
  const examTypes = (types || []).filter((t) =>
    ['exam', 'termly-exam', 'mock-exam', 'premium-exam', 'past-paper'].includes(t),
  );
  const wantsExams = !types || examTypes.length > 0;

  const out: GeneratedContent[] = [];
  const grades = filters?.grade ? [filters.grade] : GRADE_ORDER.filter((g) => !g.startsWith('sne/'));

  if (wantsLessons) {
    for (const grade of grades) {
      out.push(...(await loadLessonIndex(grade)));
    }
  }
  if (wantsVideos) {
    for (const grade of grades) {
      out.push(...(await loadVideoIndex(grade)));
    }
  }
  if (wantsExams) {
    const category = filters?.category;
    for (const grade of grades) {
      out.push(...(await loadExamListings(grade, category)));
    }
  }
  return out;
}

async function loadLessonIndex(grade: string) {
  if (cache.lessons?.[grade]) return cache.lessons[grade];
  const rows =
    (await readAssetJson<GeneratedContent[]>(`/data/runtime/lessons/${grade}.json`)) || [];
  cache.lessons = cache.lessons || {};
  cache.lessons[grade] = rows;
  return rows;
}

async function loadVideoIndex(grade: string) {
  if (cache.videos?.[grade]) return cache.videos[grade];
  const rows =
    (await readAssetJson<GeneratedContent[]>(`/data/runtime/videos/${grade}.json`)) || [];
  cache.videos = cache.videos || {};
  cache.videos[grade] = rows;
  return rows;
}

async function loadExamListings(grade: string, category?: string) {
  const map = await loadExamIdMap();
  const ids = Object.entries(map).filter(([, loc]) => {
    if (loc.grade !== grade) return false;
    if (category && loc.category !== category) return false;
    return true;
  });
  const packs = new Map<string, GeneratedContent[]>();
  const out: GeneratedContent[] = [];
  for (const [id, loc] of ids) {
    const key = `${loc.grade}/${loc.category}/${loc.subjectSlug}.json`;
    if (!packs.has(key)) {
      packs.set(key, (await loadExamPack(loc.grade, loc.category, loc.subjectSlug)) || []);
    }
    const paper = packs.get(key)?.find((p) => p.id === id);
    if (paper) out.push(paper);
  }
  return out;
}

async function loadExamIdMap() {
  if (cache.examIdMap) return cache.examIdMap;
  cache.examIdMap =
    (await readAssetJson<Record<string, { grade: string; category: string; subjectSlug: string }>>(
      '/data/runtime/exam-id-map.json',
    )) || {};
  return cache.examIdMap;
}

async function loadExamPack(grade: string, category: string, subjectSlug: string) {
  const key = `${grade}/${category}/${subjectSlug}`;
  if (cache.examPacks?.[key]) return cache.examPacks[key];
  const rows =
    (await readAssetJson<GeneratedContent[]>(
      `/data/runtime/exam-packs/${grade}/${category}/${subjectSlug}.json`,
    )) || [];
  cache.examPacks = cache.examPacks || {};
  cache.examPacks[key] = rows;
  return rows;
}

async function loadExamCounts() {
  if (cache.examCounts) return cache.examCounts;
  cache.examCounts =
    (await readAssetJson<ExamCounts>('/data/runtime/exam-counts.json')) || {};
  return cache.examCounts;
}

export async function getContent(id: string): Promise<GeneratedContent | undefined> {
  if (await onCloudflare()) {
    const fromFile = await readAssetJson<GeneratedContent>(`/data/content/${id}.json`);
    if (fromFile) return hydrateStudyPages(fromFile);
    const loc = (await loadExamIdMap())[id];
    if (loc) {
      const pack = await loadExamPack(loc.grade, loc.category, loc.subjectSlug);
      const paper = pack.find((p) => p.id === id);
      return paper ? hydrateStudyPages(paper) : undefined;
    }
    return undefined;
  }

  const filePath = join(CONTENT_DIR, `${id}.json`);
  if (existsSync(filePath)) {
    const raw = readFileSync(filePath, 'utf8').trim();
    if (raw) {
      try {
        return hydrateStudyPages(JSON.parse(raw) as GeneratedContent);
      } catch {
        /* fall through to index */
      }
    }
  }
  const fromIndex = readIndex().find((i) => i.id === id);
  return fromIndex ? hydrateStudyPages(fromIndex) : undefined;
}

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

export async function getCurriculumIndex(): Promise<{ grades: CurriculumGrade[] } | null> {
  if (cache.curriculum !== undefined) return cache.curriculum;
  if (await onCloudflare()) {
    cache.curriculum =
      (await readAssetJson<{ grades: CurriculumGrade[] }>('/data/runtime/curriculum-index.json')) ||
      null;
    return cache.curriculum;
  }
  if (!existsSync(CURRICULUM_INDEX)) {
    cache.curriculum = null;
    return null;
  }
  cache.curriculum = JSON.parse(readFileSync(CURRICULUM_INDEX, 'utf8')) as {
    grades: CurriculumGrade[];
  };
  return cache.curriculum;
}

export async function getGrades(options?: { includeEmpty?: boolean; includeSne?: boolean }): Promise<
  Array<{
    grade: string;
    label: string;
    stage: string;
    subjectCount: number;
    topicCount: number;
  }>
> {
  const index = await getCurriculumIndex();
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

export async function getSubjects(grade: string, options?: { includeEmpty?: boolean }) {
  const index = await getCurriculumIndex();
  const g = index?.grades.find((x) => x.grade === grade);
  if (!g) return [];
  const generated = await listContent({ grade, type: 'topic-lesson' });
  return Object.values(g.subjects)
    .map((s) => ({
      subject: s.subject,
      topicCount: s.topics.length,
      generatedCount: generated.filter((c) => sameSubject(c.topic.subject, s.subject)).length,
    }))
    .filter((s) => options?.includeEmpty || s.topicCount > 0)
    .filter((s) => !/^general$/i.test(s.subject))
    .sort((a, b) => a.subject.localeCompare(b.subject));
}

export async function getTopics(grade: string, subject: string) {
  const index = await getCurriculumIndex();
  const g = index?.grades.find((x) => x.grade === grade);
  const s =
    g?.subjects[subject] ||
    Object.values(g?.subjects || {}).find((x) => x.subject.toLowerCase().includes(subject.toLowerCase()));
  if (!s) return [];

  const generated = await listContent({ grade, subject: s.subject, type: 'topic-lesson' });
  return s.topics.map((t) => {
    const matches = generated.filter(
      (c) =>
        sameSubject(c.topic.subject, s.subject) &&
        (c.topic.topicNumber === t.topicNumber || c.topic.subStrand === t.topicName || c.topic.slug === t.slug),
    );
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
  if (await onCloudflare()) {
    let items: GeneratedContent[] = [];
    if (subject) {
      items = await loadExamPack(grade, category, slugifySubject(subject));
    } else {
      items = await loadExamListings(grade, category);
    }
    return items.sort((a, b) => {
      const ta = a.metadata.term ?? 0;
      const tb = b.metadata.term ?? 0;
      if (ta !== tb) return ta - tb;
      return a.title.localeCompare(b.title);
    });
  }

  const types = getExamTypesForCategory(category);
  let items = (await listContent({ grade, category })).filter((i) => types.includes(i.type));
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
  if (await onCloudflare()) {
    const counts = await loadExamCounts();
    if (grade && category) return counts.byGrade?.[grade]?.[category] || 0;
    if (category) return (counts[category as keyof ExamCounts] as number) || 0;
    return ['general', 'termly', 'mock', 'premium', 'vault'].reduce(
      (sum, key) => sum + (Number(counts[key as keyof ExamCounts]) || 0),
      0,
    );
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

  if (await onCloudflare()) {
    const map = await loadExamIdMap();
    const loc = Object.values(map).find((row) => row.grade === grade && row.subjectSlug === subjectSlug);
    if (!loc) return undefined;
    const pack = await loadExamPack(loc.grade, loc.category, loc.subjectSlug);
    return pack[0]?.topic.subject;
  }

  const fromPapers = (await listContent({ grade })).find(
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
  cache.index = index;
}

export function seedSamplesIfEmpty() {
  /* no-op: real content from batch generator */
}
