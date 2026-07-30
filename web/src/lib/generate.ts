import { queryRag } from './rag';
import { getContextChunks, formatGradeLabel } from './curriculum-source';
import { buildExamPrompt, buildNotesPrompt, buildQuizPrompt, buildVideoScriptPrompt, callLLM } from './prompts';
import { saveContent } from './content-store';
import type { ContentType, GeneratedContent, QuizItem, VideoScriptSection } from './types';
import type { RagSource } from './types';

export interface GenerateRequest {
  type: ContentType;
  grade: string;
  gradeLabel?: string;
  subject: string;
  strand?: string;
  subStrand?: string;
  term?: string;
  questionCount?: number;
  access?: 'free' | 'paid' | 'subscription';
  priceKes?: number;
}

function buildContext(sources: RagSource[]) {
  return sources.map((s, i) => `[${i + 1}] ${s.subject} (${s.grade}):\n${s.text}`).join('\n\n');
}

async function getSources(req: GenerateRequest): Promise<RagSource[]> {
  const direct = getContextChunks({
    grade: req.grade,
    subject: req.subject,
    strand: req.strand,
    subStrand: req.subStrand,
    maxChunks: 6,
  });

  if (direct.length) return direct;

  const query = [req.grade, req.subject, req.strand, req.subStrand, 'strands learning outcomes'].filter(Boolean).join(' ');
  const { sources } = await queryRag(query, { grade: req.grade, subject: req.subject, topK: 8, generateAnswer: false });
  return sources;
}

export async function generateContent(req: GenerateRequest): Promise<GeneratedContent> {
  const sources = await getSources(req);

  if (!sources.length) {
    throw new Error(
      `No KICD curriculum found for ${req.grade} / ${req.subject}. Run: npm run content:index then npm run content:generate -- --grade ${req.grade}`,
    );
  }

  const context = buildContext(sources);
  const topic = {
    grade: req.grade,
    gradeLabel: req.gradeLabel || formatGradeLabel(req.grade),
    subject: req.subject,
    strand: req.strand,
    subStrand: req.subStrand,
  };

  let body = '';
  let title = '';
  const metadata: GeneratedContent['metadata'] = {
    createdAt: new Date().toISOString(),
    wordCount: 0,
    reviewed: false,
    access: req.access || 'paid',
    priceKes: req.priceKes,
  };

  switch (req.type) {
    case 'notes': {
      const prompt = buildNotesPrompt(topic);
      body = await callLLM(prompt, context, 'Generate clear revision notes with numbered sections and bullet points.');
      title = `${topic.gradeLabel} ${topic.subject}${topic.strand ? ` — ${topic.strand}` : ''}`;
      break;
    }
    case 'exam': {
      const prompt = buildExamPrompt({ ...topic, term: req.term });
      body = await callLLM(prompt, context, 'Generate the full exam paper and marking scheme now.');
      title = `${topic.gradeLabel} ${topic.subject} — Term ${req.term || '1'} Exam`;
      const schemeMatch = body.match(/#{0,3}\s*MARKING SCHEME[\s\S]*/i);
      if (schemeMatch) metadata.markingScheme = schemeMatch[0];
      break;
    }
    case 'quiz': {
      const prompt = buildQuizPrompt({ ...topic, count: req.questionCount });
      const raw = await callLLM(prompt, context, 'Generate the quiz JSON now.');
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        title = parsed.title || `${topic.gradeLabel} ${topic.subject} Quiz`;
        metadata.questions = parsed.questions as QuizItem[];
        body = formatQuizAsMarkdown(parsed.questions);
      } else {
        body = raw;
        title = `${topic.gradeLabel} ${topic.subject} Quiz`;
      }
      break;
    }
    case 'video-script': {
      const prompt = buildVideoScriptPrompt(topic);
      const raw = await callLLM(prompt, context, 'Generate the video script JSON now.');
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        title = parsed.title || `${topic.gradeLabel} ${topic.subject} Video`;
        metadata.scriptSections = parsed.sections as VideoScriptSection[];
        body = (parsed.sections as VideoScriptSection[])
          .map((s) => `## [${s.time}] ${s.label}\n${s.content}\n*Visual: ${s.visualCue || 'TBD'}*`)
          .join('\n\n');
      } else {
        body = raw;
        title = `${topic.gradeLabel} ${topic.subject} Video Script`;
      }
      break;
    }
    default:
      throw new Error(`Unknown content type: ${req.type}`);
  }

  metadata.wordCount = body.split(/\s+/).length;

  const { randomUUID } = await import('node:crypto');
  const content: GeneratedContent = {
    id: randomUUID(),
    type: req.type,
    title,
    topic: {
      grade: topic.grade,
      gradeLabel: topic.gradeLabel,
      subject: topic.subject,
      strand: topic.strand,
      subStrand: topic.subStrand,
    },
    body,
    metadata,
    sources: sources.slice(0, 4).map((s) => ({
      id: s.id,
      subject: s.subject,
      grade: s.grade,
      excerpt: s.text.slice(0, 200),
    })),
  };

  saveContent(content);
  return content;
}

function formatQuizAsMarkdown(questions: QuizItem[]) {
  return questions
    .map((q, i) => {
      let block = `### ${i + 1}. ${q.question}`;
      if (q.options?.length) {
        block += '\n' + q.options.map((o, j) => `- ${String.fromCharCode(65 + j)}. ${o}`).join('\n');
      }
      if (q.explanation) block += `\n\n*Answer: ${q.options?.[q.correctIndex ?? 0] || q.answer} — ${q.explanation}*`;
      return block;
    })
    .join('\n\n');
}
