'use client';

import { useSearchParams } from 'next/navigation';
import { useState, useEffect, type ReactNode } from 'react';

type Tab = 'lesson' | 'quiz' | 'answers';

function renderRichText(text: string): ReactNode[] {
  const lines = String(text || '').split('\n');
  const nodes: ReactNode[] = [];
  let buffer: string[] = [];

  const flush = (key: string) => {
    if (!buffer.length) return;
    const block = buffer.join('\n').trimEnd();
    buffer = [];
    if (!block) return;
    nodes.push(
      <div key={key} className="mb-4 whitespace-pre-wrap leading-7">
        {block}
      </div>,
    );
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const imageMatch = line.match(/^\[\[image:([^\]|]+)\|?([^\]]*)\]\]$/);
    const isSection = /^(SECTION|SEHEMU)([\s:]|$)/i.test(trimmed);
    const isSkill = /^▸\s+/.test(trimmed);
    const isLessonTitle = /^LESSON:/i.test(trimmed);
    const isBlank = trimmed === '';

    if (imageMatch) {
      flush(`p-${i}`);
      const src = imageMatch[1].trim();
      const alt = imageMatch[2]?.trim() || 'Lesson illustration';
      nodes.push(
        <figure key={`img-${i}`} className="my-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="w-full max-w-2xl rounded-xl border border-gray-200 shadow-sm bg-white"
            loading="lazy"
          />
          {alt ? <figcaption className="mt-2 text-xs text-gray-500">{alt}</figcaption> : null}
        </figure>,
      );
      return;
    }

    if (isLessonTitle) {
      flush(`p-${i}`);
      nodes.push(
        <h2 key={`h-${i}`} className="text-xl font-bold text-kenya-black mb-6">
          {line.replace(/^LESSON:\s*/i, '')}
        </h2>,
      );
      return;
    }

    if (isSection) {
      flush(`p-${i}`);
      nodes.push(
        <h3 key={`s-${i}`} className="mt-10 mb-4 pt-4 border-t border-gray-100 text-base font-bold text-kenya-green tracking-wide">
          {trimmed}
        </h3>,
      );
      return;
    }

    if (isSkill) {
      flush(`p-${i}`);
      nodes.push(
        <h4 key={`sk-${i}`} className="mt-8 mb-3 text-sm font-bold text-kenya-black">
          {trimmed}
        </h4>,
      );
      return;
    }

    if (isBlank) {
      flush(`p-${i}`);
      return;
    }

    buffer.push(line);
  });

  flush('p-end');
  return nodes;
}

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
      <p className="text-sm text-gray-500">
        {content.topic.gradeLabel} · {content.topic.subject}
      </p>
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
        {tab === 'lesson' ? (
          <div className="font-sans text-[15px] text-gray-800">{renderRichText(text)}</div>
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-gray-800">{text}</pre>
        )}
      </article>
    </div>
  );
}
