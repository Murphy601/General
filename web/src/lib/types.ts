export interface CatalogDocument {
  fileId: string;
  title: string;
  subject: string;
  subjectSlug: string;
  grade: string;
  gradeLabel: string;
  gradeSlug: string;
  previewUrl: string;
  sourceUrl: string;
  charCount: number;
  pageCount: number;
  excerpt: string;
}

export interface GradeGroup {
  slug: string;
  label: string;
  count: number;
  subjects: Record<
    string,
    {
      slug: string;
      count: number;
      documents: string[];
    }
  >;
}

export interface Catalog {
  generatedAt: string;
  totalDocuments: number;
  documents: CatalogDocument[];
  byGrade: Record<string, GradeGroup>;
  bySubject: Record<string, number>;
}

export interface RagSource {
  id: string;
  grade: string;
  subject: string;
  title: string;
  text: string;
  score: number;
}

export interface RagResponse {
  query: string;
  answer?: string;
  sources: RagSource[];
  ragAvailable: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  sourceId?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: RagSource[];
}
