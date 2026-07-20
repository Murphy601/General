'use client';

import { useState } from 'react';
import type { ContentType } from '@/lib/types';

const CONTENT_TYPES: { value: ContentType; label: string; desc: string }[] = [
  { value: 'notes', label: 'Learning Notes', desc: 'Kid-friendly notes with Kenyan examples' },
  { value: 'exam', label: 'Termly Exam', desc: 'Full paper + marking scheme' },
  { value: 'quiz', label: 'Topical Quiz', desc: 'Formative assessment questions' },
  { value: 'video-script', label: 'Video Script', desc: '5-min lesson script for Video Hub' },
];

export function StudioPanel() {
  const [type, setType] = useState<ContentType>('notes');
  const [grade, setGrade] = useState('grade-4');
  const [subject, setSubject] = useState('Agriculture');
  const [strand, setStrand] = useState('');
  const [subStrand, setSubStrand] = useState('');
  const [term, setTerm] = useState('1');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ id: string; title: string; type: string } | null>(null);
  const [error, setError] = useState('');

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, grade, subject, strand: strand || undefined, subStrand: subStrand || undefined, term }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form onSubmit={handleGenerate} className="lg:col-span-2 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="font-bold text-lg text-kenya-black">Content Studio</h2>
          <p className="text-sm text-gray-500 mt-1">
            AI generates materials grounded in official KICD curriculum. Review before publishing.
          </p>
        </div>

        <div className="grid gap-2">
          {CONTENT_TYPES.map((ct) => (
            <button
              key={ct.value}
              type="button"
              onClick={() => setType(ct.value)}
              className={`rounded-xl border p-3 text-left transition ${
                type === ct.value ? 'border-kenya-green bg-kenya-green/5' : 'border-gray-200 hover:border-kenya-green/30'
              }`}
            >
              <p className="font-medium text-sm">{ct.label}</p>
              <p className="text-xs text-gray-500">{ct.desc}</p>
            </button>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-gray-600">Grade</span>
            <input value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="grade-4" />
          </label>
          <label className="text-sm">
            <span className="text-gray-600">Subject</span>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Agriculture" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-gray-600">Strand (optional)</span>
            <input value={strand} onChange={(e) => setStrand(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Crop Production" />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="text-gray-600">Sub-strand / Topic (optional)</span>
            <input value={subStrand} onChange={(e) => setSubStrand(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Land Preparation" />
          </label>
          {type === 'exam' && (
            <label className="text-sm">
              <span className="text-gray-600">Term</span>
              <select value={term} onChange={(e) => setTerm(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
                <option value="1">Term 1</option>
                <option value="2">Term 2</option>
                <option value="3">Term 3</option>
              </select>
            </label>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-kenya-green py-3 text-sm font-semibold text-white hover:bg-kenya-green/90 disabled:opacity-50"
        >
          {loading ? 'Generating from KICD…' : 'Generate Content'}
        </button>
        {error && <p className="text-sm text-kenya-red">{error}</p>}
      </form>

      <div className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-kenya-black">How it works</h3>
        <ol className="mt-3 space-y-2 text-sm text-gray-600 list-decimal list-inside">
          <li>KICD curriculum designs are searched via RAG (your harvested materials)</li>
          <li>AI drafts notes, exams, quizzes, or video scripts using those exact strands & outcomes</li>
          <li>A TSC teacher reviews and approves before selling</li>
          <li>Published to Learning Docs, Revision Hub, or Video Hub</li>
        </ol>

        {result && (
          <div className="mt-6 rounded-xl bg-kenya-green/10 border border-kenya-green/20 p-4">
            <p className="font-medium text-kenya-green">Generated: {result.title}</p>
            <a href={viewPath(result.type, result.id)} className="mt-2 inline-block text-sm text-kenya-green underline">
              View content →
            </a>
          </div>
        )}

        <div className="mt-6 rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
          <strong>Next steps for Video Hub:</strong> Take the generated script → ElevenLabs voice → InVideo/HeyGen render → upload to Bunny.net → paste embed URL.
        </div>
      </div>
    </div>
  );
}

function viewPath(type: string, id: string) {
  if (type === 'notes') return `/docs/${id}`;
  if (type === 'video-script') return `/videos/${id}`;
  return `/revision/${id}`;
}
