'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, type ReactNode } from 'react';

type Tab = 'lesson' | 'quiz' | 'answers';

type StudyPage = {
  pageNumber: number;
  title: string;
  body: string;
  free?: boolean;
};

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
    const isSection = /^(SECTION|SEHEMU|PAGE\s+\d+)([\s:]|$)/i.test(trimmed);
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
        <h3
          key={`s-${i}`}
          className="mt-10 mb-4 pt-4 border-t border-gray-100 text-base font-bold text-kenya-green tracking-wide"
        >
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

function PaywallCard({
  pageNumber,
  title,
  priceKes,
}: {
  pageNumber: number;
  title: string;
  priceKes?: number;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-8 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Page locked</p>
      <h3 className="mt-2 text-xl font-bold text-kenya-black">
        Page {pageNumber}: {title}
      </h3>
      <p className="mt-3 text-sm text-gray-600 max-w-md mx-auto">
        You have finished the free preview pages for this topic. Unlock the remaining study pages to keep
        learning — M-Pesa payment comes in Phase 2.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/pricing"
          className="inline-flex rounded-xl bg-kenya-green px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          Unlock full topic{priceKes ? ` · KSh ${priceKes}` : ''}
        </Link>
        <span className="text-xs text-gray-500">Free preview already shown above</span>
      </div>
    </div>
  );
}

export function TopicViewer({
  content,
  initialTab,
  unlocked = false,
}: {
  content: {
    title: string;
    topic: { gradeLabel: string; subject: string; topicNumber?: string };
    pages: {
      lesson: string;
      quiz: string;
      answers: string;
      studyPages?: StudyPage[];
      freePageCount?: number;
    };
    metadata?: {
      priceKes?: number;
      freePageCount?: number;
      totalStudyPages?: number;
      contentSource?: string;
    };
  };
  initialTab?: Tab;
  /** When true, all study pages are readable (subscriber / purchased). */
  unlocked?: boolean;
}) {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as Tab | null;
  const pageParam = Number(searchParams.get('page') || '1');
  const [tab, setTab] = useState<Tab>(initialTab || tabParam || 'lesson');

  const studyPages = content.pages.studyPages || [];
  const freeCount = content.pages.freePageCount || content.metadata?.freePageCount || 3;
  const hasMulti = studyPages.length > 0;
  const maxPage = hasMulti ? studyPages.length : 1;
  const [pageNum, setPageNum] = useState(Math.min(Math.max(pageParam || 1, 1), maxPage));

  useEffect(() => {
    if (tabParam && ['lesson', 'quiz', 'answers'].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [tabParam]);

  useEffect(() => {
    if (pageParam >= 1 && pageParam <= maxPage) setPageNum(pageParam);
  }, [pageParam, maxPage]);

  const tabs: { id: Tab; label: string }[] = [
    { id: 'lesson', label: hasMulti ? 'Study Pages' : 'Lesson' },
    { id: 'quiz', label: 'Revision Quiz' },
    { id: 'answers', label: 'Answers' },
  ];

  const current = hasMulti ? studyPages.find((p) => p.pageNumber === pageNum) : null;
  const canRead =
    !hasMulti || unlocked || current?.free === true || (current?.pageNumber || 1) <= freeCount;

  const text =
    tab === 'quiz'
      ? content.pages.quiz
      : tab === 'answers'
        ? content.pages.answers
        : hasMulti
          ? canRead
            ? current?.body || ''
            : ''
          : content.pages.lesson;

  return (
    <div>
      <p className="text-sm text-gray-500">
        {content.topic.gradeLabel} · {content.topic.subject}
      </p>
      <h1 className="text-2xl font-bold text-kenya-black mt-1">{content.title}</h1>
      {hasMulti ? (
        <div className="mt-3 rounded-xl border border-kenya-green/25 bg-kenya-green/5 px-4 py-3">
          <p className="text-sm font-semibold text-kenya-green">
            Multi-page study · {studyPages.length} pages
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Scroll page by page. Pages 1–{freeCount} are free preview. Page {freeCount + 1}+ locks until payment.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-700">
          Single-page lesson (old template). Grade 8 Integrated Science should show multi-page study after sync.
        </p>
      )}

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

      {tab === 'lesson' && hasMulti ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {studyPages.map((p) => {
            const locked = !(unlocked || p.free || p.pageNumber <= freeCount);
            const active = p.pageNumber === pageNum;
            return (
              <button
                key={p.pageNumber}
                type="button"
                onClick={() => setPageNum(p.pageNumber)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition ${
                  active
                    ? 'bg-kenya-green text-white border-kenya-green'
                    : locked
                      ? 'bg-gray-50 text-gray-400 border-gray-200'
                      : 'bg-white text-kenya-black border-gray-200 hover:border-kenya-green/40'
                }`}
                title={locked ? 'Locked — unlock to continue' : p.title}
              >
                {locked ? `🔒 ${p.pageNumber}` : `Page ${p.pageNumber}`}
              </button>
            );
          })}
        </div>
      ) : null}

      <article className="mt-6 rounded-2xl border bg-white p-6 md:p-8 shadow-sm">
        {tab === 'lesson' && hasMulti && !canRead && current ? (
          <PaywallCard
            pageNumber={current.pageNumber}
            title={current.title}
            priceKes={content.metadata?.priceKes}
          />
        ) : tab === 'lesson' ? (
          <div className="font-sans text-[15px] text-gray-800">{renderRichText(text)}</div>
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm leading-7 text-gray-800">{text}</pre>
        )}
      </article>

      {tab === 'lesson' && hasMulti ? (
        <div className="mt-4 flex justify-between gap-3">
          <button
            type="button"
            disabled={pageNum <= 1}
            onClick={() => setPageNum((n) => Math.max(1, n - 1))}
            className="text-sm text-kenya-green disabled:text-gray-300"
          >
            ← Previous page
          </button>
          <p className="text-xs text-gray-500 self-center">
            Page {pageNum} of {studyPages.length}
            {current && !(unlocked || current.free || current.pageNumber <= freeCount) ? ' · locked' : ''}
          </p>
          <button
            type="button"
            disabled={pageNum >= studyPages.length}
            onClick={() => setPageNum((n) => Math.min(studyPages.length, n + 1))}
            className="text-sm text-kenya-green disabled:text-gray-300"
          >
            Next page →
          </button>
        </div>
      ) : null}
    </div>
  );
}
