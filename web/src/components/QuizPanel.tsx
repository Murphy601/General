'use client';

import { useState } from 'react';
import type { QuizQuestion } from '@/lib/types';

export function QuizPanel() {
  const [grade, setGrade] = useState('grade-4');
  const [subject, setSubject] = useState('Agriculture');
  const [count, setCount] = useState(5);
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  async function generateQuiz(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSubmitted(false);
    setAnswers({});

    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, subject, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate quiz');
      setQuestions(data.questions || []);
    } catch (err) {
      setError((err as Error).message);
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }

  const score = submitted
    ? questions.reduce((acc, q, i) => acc + (answers[i] === q.correctIndex ? 1 : 0), 0)
    : 0;

  return (
    <div className="space-y-6">
      <form onSubmit={generateQuiz} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="font-display text-xl font-semibold text-kenya-black">Generate a practice quiz</h2>
        <p className="mt-1 text-sm text-gray-500">Questions are generated from official CBC curriculum content.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-gray-600">Grade</span>
            <input
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
              placeholder="grade-4"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
              placeholder="Agriculture"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600">Questions</span>
            <input
              type="number"
              min={3}
              max={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2"
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="mt-4 rounded-xl bg-kenya-green px-6 py-2.5 text-sm font-medium text-white hover:bg-kenya-green/90 disabled:opacity-50"
        >
          {loading ? 'Generating...' : 'Generate Quiz'}
        </button>
        {error && <p className="mt-3 text-sm text-kenya-red">{error}</p>}
      </form>

      {questions.length > 0 && (
        <div className="space-y-4">
          {submitted && (
            <div className="rounded-xl bg-kenya-green/10 px-4 py-3 text-kenya-green font-medium">
              Score: {score} / {questions.length}
            </div>
          )}
          {questions.map((q, qi) => (
            <div key={qi} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="font-medium text-kenya-black">
                {qi + 1}. {q.question}
              </p>
              <div className="mt-3 space-y-2">
                {q.options.map((opt, oi) => {
                  const selected = answers[qi] === oi;
                  const isCorrect = q.correctIndex === oi;
                  let cls = 'border-gray-200 hover:border-kenya-green/40';
                  if (submitted) {
                    if (isCorrect) cls = 'border-kenya-green bg-kenya-green/5';
                    else if (selected) cls = 'border-kenya-red bg-kenya-red/5';
                  } else if (selected) cls = 'border-kenya-green bg-kenya-green/5';

                  return (
                    <button
                      key={oi}
                      type="button"
                      disabled={submitted}
                      onClick={() => setAnswers((prev) => ({ ...prev, [qi]: oi }))}
                      className={`w-full rounded-lg border px-4 py-2 text-left text-sm transition ${cls}`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {submitted && (
                <p className="mt-3 text-sm text-gray-600 border-t border-gray-100 pt-3">{q.explanation}</p>
              )}
            </div>
          ))}
          {!submitted && (
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              className="rounded-xl bg-kenya-black px-6 py-2.5 text-sm font-medium text-white"
            >
              Check Answers
            </button>
          )}
        </div>
      )}
    </div>
  );
}
