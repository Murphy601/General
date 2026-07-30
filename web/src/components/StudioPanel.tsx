'use client';

import { useState } from 'react';
import type { ContentType } from '@/lib/types';

const CONTENT_TYPES: { value: ContentType; label: string; desc: string }[] = [
  { value: 'notes', label: 'Revision Notes', desc: 'Numbered, easy-to-read notes with Kenyan examples' },
  { value: 'quiz', label: 'Topical Quiz', desc: 'Multiple-choice revision questions' },
  { value: 'exam', label: 'Termly Exam', desc: 'Full paper + marking scheme' },
  { value: 'video-script', label: 'Video Script', desc: '5-min lesson script for Video Hub' },
];

const GRADES = [
  'grade-4', 'grade-5', 'grade-6', 'grade-7', 'grade-8', 'grade-9', 'grade-10', 'grade-11', 'grade-12',
];

export function StudioPanel() {
  const [type, setType] = useState<ContentType>('notes');
  const [grade, setGrade] = useState('grade-7');
  const [subject, setSubject] = useState('Agriculture');
  const [strand, setStrand] = useState('');
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
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
        body: JSON.stringify({ type, grade, subject, strand: strand || undefined }),
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

  async function handleBatchGrade() {
    setBatchLoading(true);
    setError('');
    try {
      const res = await fetch('/api/generate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, types: ['notes', 'quiz'] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Batch failed');
      setResult({ id: '', title: `Batch started: ${data.message}`, type: 'batch' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBatchLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <form onSubmit={handleGenerate} className="lg:col-span-2 space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="font-bold text-lg text-kenya-black">Content Studio</h2>
          <p className="text-sm text-gray-500 mt-1">Generate one topic, or batch-generate an entire grade below.</p>
        </div>

        <div className="grid gap-2">
          {CONTENT_TYPES.map((ct) => (
            <button
              key={ct.value}
              type="button"
              onClick={() => setType(ct.value)}
              className={`rounded-xl border p-3 text-left transition ${
                type === ct.value ? 'border-kenya-green bg-kenya-green/5' : 'border-gray-200'
              }`}
            >
              <p className="font-medium text-sm">{ct.label}</p>
              <p className="text-xs text-gray-500">{ct.desc}</p>
            </button>
          ))}
        </div>

        <div className="grid gap-3">
          <label className="text-sm">
            Grade
            <select value={grade} onChange={(e) => setGrade(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2">
              {GRADES.map((g) => (
                <option key={g} value={g}>{g.replace('grade-', 'Grade ')}</option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Subject
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" />
          </label>
          <label className="text-sm">
            Strand (optional — leave blank for full subject)
            <input value={strand} onChange={(e) => setStrand(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="e.g. Food Production Processes" />
          </label>
        </div>

        <button type="submit" disabled={loading} className="w-full rounded-xl bg-kenya-green py-3 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? 'Generating…' : 'Generate One Topic'}
        </button>

        <button
          type="button"
          disabled={batchLoading}
          onClick={handleBatchGrade}
          className="w-full rounded-xl border-2 border-kenya-green py-3 text-sm font-semibold text-kenya-green disabled:opacity-50"
        >
          {batchLoading ? 'Starting…' : `Auto-Generate ALL subjects in ${grade.replace('grade-', 'Grade ')}`}
        </button>

        {error && <p className="text-sm text-kenya-red">{error}</p>}
        {result && result.type !== 'batch' && (
          <p className="text-sm text-kenya-green">
            ✓ <a href={viewPath(result.type, result.id)} className="underline">{result.title}</a>
          </p>
        )}
        {result?.type === 'batch' && <p className="text-sm text-kenya-green">✓ {result.title}</p>}
      </form>

      <div className="lg:col-span-3 space-y-4">
        <div className="rounded-2xl border bg-kenya-green/5 border-kenya-green/20 p-6">
          <h3 className="font-bold text-kenya-black">Auto-generate everything (recommended)</h3>
          <p className="mt-2 text-sm text-gray-600">
            Don&apos;t generate manually one-by-one. Run this in PowerShell to generate revision notes + quizzes for every subject and strand in a grade:
          </p>
          <pre className="mt-3 rounded-lg bg-kenya-black text-green-400 p-4 text-xs overflow-x-auto">
{`npm run content:index
npm run content:generate -- --grade grade-7
npm run content:generate -- --all   # all grades (takes hours)`}
          </pre>
        </div>
        <div className="rounded-2xl border bg-white p-6 shadow-sm text-sm text-gray-600 space-y-2">
          <p><strong>1.</strong> KICD curriculum PDFs (584 docs) → source text</p>
          <p><strong>2.</strong> Strands & sub-strands extracted automatically</p>
          <p><strong>3.</strong> AI writes revision notes + quizzes per topic</p>
          <p><strong>4.</strong> Content appears in Learning Docs & Revision Hub</p>
        </div>
      </div>
    </div>
  );
}

function viewPath(type: string, id: string) {
  if (type === 'notes') return `/docs/${id}`;
  if (type === 'video-script') return `/videos/script/${id}`;
  return `/revision/paper/${id}`;
}
