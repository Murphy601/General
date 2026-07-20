export interface RagSource {
  id: string;
  grade: string;
  subject: string;
  title: string;
  text: string;
  score: number;
}

export type ContentType = 'topic-lesson' | 'notes' | 'exam' | 'quiz' | 'video-script' | 'mock-exam' | 'termly-exam' | 'premium-exam';
export type AccessTier = 'free' | 'paid' | 'subscription';
export type RevisionCategory = 'general' | 'termly' | 'mock' | 'premium';

export interface TopicRef {
  grade: string;
  gradeLabel: string;
  subject: string;
  strand?: string;
  subStrand?: string;
  topicNumber?: string;
  topicOrder?: number;
  slug?: string;
}

export interface LessonPages {
  lesson: string;
  quiz: string;
  answers: string;
}

export interface GeneratedContent {
  id: string;
  type: ContentType;
  title: string;
  topic: TopicRef;
  body?: string;
  pages?: LessonPages;
  metadata: {
    createdAt: string;
    wordCount: number;
    reviewed: boolean;
    access: AccessTier;
    priceKes?: number;
    videoUrl?: string;
    thumbnailUrl?: string;
    markingScheme?: string;
    questions?: QuizItem[];
    scriptSections?: VideoScriptSection[];
    questionCount?: number;
    category?: RevisionCategory;
    term?: number | null;
    contentSource?: string;
  };
  sources: Array<{ id: string; subject: string; grade: string; excerpt: string }>;
}

export interface QuizItem {
  question: string;
  options?: string[];
  correctIndex?: number;
  answer?: string;
  marks?: number;
  slo?: string;
  explanation?: string;
}

export interface VideoScriptSection {
  time: string;
  label: string;
  content: string;
  visualCue?: string;
}

export interface CurriculumGrade {
  grade: string;
  label: string;
  subjects: Record<string, { subject: string; topics: Array<{ topicNumber: string; topicName: string; slug: string; topicOrder: number }> }>;
}

export interface MembershipPlan {
  id: string;
  name: string;
  priceKes: number;
  period: 'once' | 'month' | 'term';
  unlocks: string[];
}

export const PLANS: MembershipPlan[] = [
  { id: 'free', name: 'Free', priceKes: 0, period: 'once', unlocks: ['dashboard', 'samples'] },
  { id: 'single', name: 'Single Download', priceKes: 100, period: 'once', unlocks: ['one-revision'] },
  { id: 'monthly', name: 'Monthly All-Access', priceKes: 300, period: 'month', unlocks: ['docs', 'videos', 'revision'] },
  { id: 'termly', name: 'Termly All-Access', priceKes: 750, period: 'term', unlocks: ['docs', 'videos', 'revision', 'exams'] },
];

export const GRADE_ORDER = [
  'pp1', 'pp2',
  'grade-1', 'grade-2', 'grade-3', 'grade-4', 'grade-5', 'grade-6',
  'grade-7', 'grade-8', 'grade-9', 'grade-10', 'grade-11', 'grade-12',
  'sne/visual-impairment/pp1', 'sne/visual-impairment/pp2',
  'sne/hearing-impairment/pp1', 'sne/hearing-impairment/pp2',
  'sne/physical-impairment/pp1', 'sne/physical-impairment/pp2',
];

export function gradeStage(grade: string): string {
  if (grade === 'pp1' || grade === 'pp2') return 'Pre-Primary';
  if (/^grade-[123]$/.test(grade)) return 'Lower Primary';
  if (/^grade-[456]$/.test(grade)) return 'Upper Primary';
  if (/^grade-[789]$/.test(grade)) return 'Junior School';
  if (/^grade-1[012]$/.test(grade)) return 'Senior School';
  if (grade.startsWith('sne/')) return 'SNE';
  return 'Other';
}
