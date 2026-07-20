'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

type Tab = 'lesson' | 'quiz' | 'answers';

export function TopicViewer({
  content,
  initialTab,
}: {
  content: {
    title: string;
    topic: { gradeLabel: string; subject: string; topicNumber?: string };
    pages: { lesson: string; quiz: string; answers: string };
  };
  initialTab?: Tab;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const [tab, setTab] = useState<Tab>(initialTab || tabParam || 'lesson');

  useEffect(() => {
    if (tabParam && ['lesson', 'quiz', 'answers'].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [tabParam]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'lesson', label: 'Lesson' },
    { id: 'quiz', label: 'Revision Quiz' },
    { id: 'answers', label: 'Answers' },
  ];

  const text = tab === 'lesson' ? content.pages.lesson : tab === 'quiz' ? content.pages.quiz : content.pages.answers;

  return (
    <div>
      <p className="text-sm text-gray-500">{content.topic.gradeLabel} · {content.topic.subject}</p>
      <h1 className="text-2xl font-bold text-kenya-black mt-1">{content.title}</h1>

      <div className="mt-6 flex gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${
              tab === t.id ? 'border-kenya-green text-kenya-green' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <article className="mt-6 rounded-2xl border bg-white p-6 md:p-8 shadow-sm">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">{text}</pre>
      </article>
    </div>
  );
}
