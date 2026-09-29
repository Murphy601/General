import Link from 'next/link';
import { Suspense } from 'react';
import { PlatformLayout } from '@/components/PlatformLayout';
import { getContent, getTopics, findSubjectBySlug, getGrades } from '@/lib/content-store';
import { TopicViewer } from '@/components/TopicViewer';
import { notFound } from 'next/navigation';

export default async function TopicLessonPage({
  params,
}: {
  params: Promise<{ grade: string; subject: string; topic: string }>;
}) {
  const { grade, subject: subjectSlug, topic: topicSlug } = await params;
  const gradeKey = decodeURIComponent(grade);
  const subject = await findSubjectBySlug(gradeKey, decodeURIComponent(subjectSlug));
  if (!subject) notFound();

  const topics = await getTopics(gradeKey, subject);
  const topicMeta = topics.find((t) => t.slug === topicSlug || t.topicNumber === topicSlug);
  if (!topicMeta?.contentId) notFound();

  const content = await getContent(topicMeta.contentId);
  if (!content?.pages) notFound();

  const label = (await getGrades()).find((g) => g.grade === gradeKey)?.label || gradeKey;
  const topicIndex = topics.findIndex((t) => t.contentId === content.id);
  const prev = topicIndex > 0 ? topics[topicIndex - 1] : null;
  const next = topicIndex < topics.length - 1 ? topics[topicIndex + 1] : null;

  return (
    <PlatformLayout active="/learn">
      <Link href={`/learn/${encodeURIComponent(gradeKey)}/${encodeURIComponent(subjectSlug)}`} className="text-sm text-kenya-green hover:underline">
        ← {subject}
      </Link>

      <Suspense fallback={<div className="mt-6 text-gray-500">Loading lesson…</div>}>
        <TopicViewer
          content={{
            title: content.title,
            topic: content.topic,
            pages: content.pages,
            metadata: {
              priceKes: content.metadata?.priceKes,
              freePageCount: content.pages?.freePageCount || content.metadata?.freePageCount,
              totalStudyPages: content.metadata?.totalStudyPages,
              contentSource: content.metadata?.contentSource,
              lockPages: content.metadata?.lockPages,
            },
          }}
          // Pre-publish: keep multipage topics fully open unless lockPages is enabled.
          unlocked={
            content.metadata?.lockPages === true
              ? false
              : content.metadata?.access === 'free' ||
                Boolean(content.pages?.studyPages?.length)
          }
        />
      </Suspense>

      <div className="mt-8 flex justify-between gap-4">
        {prev?.contentId ? (
          <Link href={`/learn/${gradeKey}/${subjectSlug}/${prev.slug}`} className="text-sm text-kenya-green hover:underline">
            ← Previous: {prev.topicName}
          </Link>
        ) : <span />}
        {next?.contentId ? (
          <Link href={`/learn/${gradeKey}/${subjectSlug}/${next.slug}`} className="text-sm text-kenya-green hover:underline">
            Next: {next.topicName} →
          </Link>
        ) : <span />}
      </div>
    </PlatformLayout>
  );
}
