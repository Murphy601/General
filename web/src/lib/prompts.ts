const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || 'openai/gpt-4o-mini';
const API_BASE = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

export function buildNotesPrompt(topic: {
  grade: string;
  subject: string;
  strand?: string;
  subStrand?: string;
}) {
  return `You are an expert Kenyan CBC curriculum developer aligned with KICD.

Using ONLY the curriculum excerpts provided, generate classroom-ready LEARNING NOTES for:
- Grade: ${topic.grade}
- Subject: ${topic.subject}
${topic.strand ? `- Strand: ${topic.strand}` : ''}
${topic.subStrand ? `- Sub-strand: ${topic.subStrand}` : ''}

Include:
1. **Student Notes** (~500 words) — kid-friendly, Kenyan examples (local names, foods, practices)
2. **Core Competencies** — which CBC competencies this topic builds
3. **Values & PCIs** — relevant values and Pertinent & Contemporary Issues
4. **Key Learning Outcomes** — bullet list from the curriculum excerpts
5. **Parent Tip** — one short activity parents can do at home

Rules: Use Kenyan context only. Format with numbered sections (1, 2, 3), lettered sub-points (A, B, C), and bullet lists. Make it easy for a child to revise.`;
}

export function buildExamPrompt(topic: {
  grade: string;
  subject: string;
  strand?: string;
  term?: string;
}) {
  return `You are an expert Kenyan CBC examiner creating assessment materials aligned with KICD.

Generate a Term ${topic.term || '1'} End-of-Term Assessment for:
- Grade: ${topic.grade}
- Subject: ${topic.subject}
${topic.strand ? `- Focus strand: ${topic.strand}` : ''}

Structure:
- **Section A:** 10 multiple-choice questions (1 mark each)
- **Section B:** 5 structured questions (4 marks each)
- **Section C:** 1 competency-based question (10 marks) integrating a PCI
- Total: 50 marks | Time: 1 hour 30 minutes

Also provide a complete **MARKING SCHEME** with mark allocation.

Rules: Every question must map to learning outcomes from the provided excerpts. Use Kenyan scenarios. Label SLO references where possible.`;
}

export function buildQuizPrompt(topic: {
  grade: string;
  subject: string;
  strand?: string;
  subStrand?: string;
  count?: number;
}) {
  return `You are a Kenyan CBC teacher creating a topical quiz.

Generate ${topic.count || 10} formative assessment questions for:
- Grade: ${topic.grade}
- Subject: ${topic.subject}
${topic.strand ? `- Strand: ${topic.strand}` : ''}
${topic.subStrand ? `- Sub-strand: ${topic.subStrand}` : ''}

Return valid JSON only:
{
  "title": "...",
  "questions": [
    {
      "question": "...",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 0,
      "marks": 1,
      "slo": "SLO reference",
      "explanation": "..."
    }
  ]
}

Mix multiple-choice and short-answer. Ground every question in the curriculum excerpts.`;
}

export function buildVideoScriptPrompt(topic: {
  grade: string;
  subject: string;
  strand?: string;
  subStrand?: string;
}) {
  return `You are a friendly Kenyan classroom teacher hosting an educational show for ${topic.grade} learners.

Write a 5-minute video script for:
- Subject: ${topic.subject}
${topic.strand ? `- Strand: ${topic.strand}` : ''}
${topic.subStrand ? `- Topic: ${topic.subStrand}` : ''}

Follow this timeline:
[0:00–0:45] THE HOOK — greet learners, exciting Kenyan real-world question
[0:45–3:00] CORE LESSON — 3 visual steps with [Visual: ...] cues
[3:00–4:15] QUICK QUIZ — 3 questions with [PAUSE 3 SECONDS]
[4:15–5:00] OUTRO — recap + encourage worksheet download

Tone: Encouraging, simple English, Kenyan children. 600–750 words total.

Return valid JSON:
{
  "title": "...",
  "sections": [
    { "time": "0:00", "label": "Hook", "content": "...", "visualCue": "..." }
  ],
  "suggestedImages": ["..."]
}`;
}

export async function callLLM(systemPrompt: string, context: string, userTask: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured. Add it to .env');

  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Curriculum excerpts from official KICD designs:\n\n${context}\n\n---\n\n${userTask}`,
        },
      ],
      temperature: 0.35,
      max_tokens: 3000,
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.choices[0].message.content as string;
}
