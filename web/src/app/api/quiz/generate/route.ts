import { NextResponse } from 'next/server';
import { queryRag } from '@/lib/rag';
import type { QuizQuestion } from '@/lib/types';

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'openai/gpt-4o-mini';
const API_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { grade = 'grade-4', subject = 'Agriculture', count = 5 } = body;
    const apiKey = process.env.OPENAI_API_KEY;

    const query = `${grade} ${subject} learning outcomes strands assessment`;
    const { sources } = await queryRag(query, { grade, subject, topK: 8, generateAnswer: false });

    if (!sources.length) {
      return NextResponse.json(
        { error: 'No curriculum content found for this grade and subject. Try different values.' },
        { status: 404 },
      );
    }

    if (!apiKey) {
      return NextResponse.json({
        questions: buildFallbackQuiz(sources, Math.min(count, 5)),
        mode: 'fallback',
      });
    }

    const context = sources.map((s, i) => `[${i + 1}] ${s.text}`).join('\n\n');
    const response = await fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          {
            role: 'system',
            content: `You generate CBC practice quiz questions. Return ONLY valid JSON array with ${count} objects: {"question":"...","options":["A","B","C","D"],"correctIndex":0,"explanation":"..."}. Questions must be based only on the provided curriculum excerpts. correctIndex is 0-based.`,
          },
          {
            role: 'user',
            content: `Grade: ${grade}\nSubject: ${subject}\n\nCurriculum excerpts:\n${context}`,
          },
        ],
        temperature: 0.4,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    const raw = data.choices[0].message.content as string;
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    const questions: QuizQuestion[] = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return NextResponse.json({ questions: questions.slice(0, count), mode: 'ai' });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

function buildFallbackQuiz(sources: { text: string; subject: string }[], count: number): QuizQuestion[] {
  return sources.slice(0, count).map((s, i) => ({
    question: `Which topic is covered in this ${s.subject} curriculum excerpt?`,
    options: [
      s.text.slice(0, 60).trim() + '...',
      'Unrelated administrative content',
      'Foreign language instruction only',
      'Sports and recreation only',
    ],
    correctIndex: 0,
    explanation: `This excerpt is from the official CBC curriculum: ${s.text.slice(0, 150)}...`,
  }));
}
