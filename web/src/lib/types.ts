export interface RagSource {
  id: string;
  grade: string;
  subject: string;
  title: string;
  text: string;
  score: number;
}

export type ContentType = 'notes' | 'exam' | 'quiz' | 'video-script';
export type AccessTier = 'free' | 'paid' | 'subscription';

export interface TopicRef {
  grade: string;
  gradeLabel: string;
  subject: string;
  strand?: string;
  subStrand?: string;
}

export interface GeneratedContent {
  id: string;
  type: ContentType;
  title: string;
  topic: TopicRef;
  body: string;
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
