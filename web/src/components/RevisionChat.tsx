'use client';

import { useState } from 'react';
import type { ChatMessage, RagSource } from '@/lib/types';

export function RevisionChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Karibu! Ask me about CBC learning outcomes, strands, or revision topics. Try: "Grade 4 agriculture learning outcomes"',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [grade, setGrade] = useState('');
  const [subject, setSubject] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = input.trim();
    if (!query || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setLoading(true);

    try {
      const res = await fetch('/api/rag/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, grade: grade || undefined, subject: subject || undefined, generateAnswer: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer || formatSourcesOnly(data.sources),
          sources: data.sources,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Sorry, something went wrong: ${(err as Error).message}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <input
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            placeholder="Filter grade (e.g. grade-4)"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Filter subject (e.g. Agriculture)"
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-kenya-green text-white'
                  : 'bg-gray-50 text-gray-800 border border-gray-100'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-3 border-t border-gray-200 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sources</p>
                  {msg.sources.slice(0, 3).map((s) => (
                    <SourceCard key={s.id} source={s} />
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="text-sm text-gray-500 animate-pulse">Searching curriculum...</div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-100 p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about strands, outcomes, or topics..."
          className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-kenya-green focus:outline-none focus:ring-2 focus:ring-kenya-green/20"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-kenya-green px-5 py-3 text-sm font-medium text-white hover:bg-kenya-green/90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function SourceCard({ source }: { source: RagSource }) {
  return (
    <div className="rounded-lg bg-white p-2 text-xs text-gray-600 border border-gray-100">
      <p className="font-medium text-kenya-green">
        {source.subject} · {source.grade}
      </p>
      <p className="mt-1 line-clamp-2">{source.text}</p>
    </div>
  );
}

function formatSourcesOnly(sources: RagSource[]): string {
  if (!sources?.length) return 'No matching curriculum content found. Try rephrasing your question.';
  return `Found ${sources.length} relevant excerpts:\n\n${sources
    .slice(0, 3)
    .map((s, i) => `${i + 1}. ${s.subject} (${s.grade}): ${s.text.slice(0, 200)}...`)
    .join('\n\n')}`;
}
