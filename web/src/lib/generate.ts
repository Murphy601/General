import { randomUUID } from 'node:crypto';
import { queryRag } from './rag';
import { buildExamPrompt, buildNotesPrompt, buildQuizPrompt, buildVideoScriptPrompt, callLLM } from './prompts';
import { saveContent } from './content-store';
import type { ContentType, GeneratedContent, QuizItem, VideoScriptSection } from './types';

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

function formatGradeLabel(grade: string) {
  return grade
    .replace(/^sne\//, 'SNE / ')
    .replace(/grade-/gi, 'Grade ')
    .replace(/\//g, ' / ');
}

function buildContext(sources: { text: string; subject: string; grade: string; id: string }[]) {
  return sources.map((s, i) => `[${i + 1}] ${s.subject} (${s.grade}):\n${s.text}`).join('\n\n');
}

export async function generateContent(req: GenerateRequest): Promise<GeneratedContent> {
  const query = [req.grade, req.subject, req.strand, req.subStrand, 'learning outcomes strands'].filter(Boolean).join(' ');
  const { sources } = await queryRag(query, { grade: req.grade, subject: req.subject, topK: 8, generateAnswer: false });

  if (!sources.length) {
    throw new Error('No matching KICD curriculum found for this grade/subject. Try different values.');
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
      body = await callLLM(prompt, context, 'Generate the learning notes bundle now.');
      title = `${topic.gradeLabel} ${topic.subject}${topic.subStrand ? ` — ${topic.subStrand}` : ''}`;
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

  const content: GeneratedContent = {
    id: randomUUID(),
    type: req.type,
    title,
    topic,
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
