import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import { getTopics, findSubjectBySlug, getGrades } from '@/lib/content-store';
import { learnSubjectParams } from '@/lib/static-params';
import { notFound } from 'next/navigation';

export function generateStaticParams() {
  return learnSubjectParams();
}

export default async function SubjectTopicsPage({
  params,
}: {
  params: Promise<{ grade: string; subject: string }>;
}) {
  const { grade, subject: subjectSlug } = await params;
  const gradeKey = decodeURIComponent(grade);
  const subject = findSubjectBySlug(gradeKey, decodeURIComponent(subjectSlug));
  if (!subject) notFound();

  const topics = getTopics(gradeKey, subject);
  const label = getGrades().find((g) => g.grade === gradeKey)?.label || gradeKey;

  return (
    <PlatformLayout active="/learn">
      <Link href={`/learn/${encodeURIComponent(gradeKey)}`} className="text-sm text-kenya-green hover:underline">
        ← {label}
      </Link>
      <h1 className="text-2xl font-bold mt-2">{subject}</h1>
      <p className="text-gray-600">{topics.length} topics — study in order from Topic 1</p>

      <ol className="mt-8 space-y-3">
        {topics.map((t, i) => (
          <li key={t.topicNumber + t.topicName}>
            {t.strand && t.strand !== topics[i - 1]?.strand ? (
              <h2 className={`${i ? 'mt-8' : ''} mb-3 text-sm font-bold uppercase tracking-wide text-kenya-green`}>
                {t.strand}
              </h2>
            ) : null}
            {t.contentId ? (
              <Link
                href={`/learn/${encodeURIComponent(gradeKey)}/${encodeURIComponent(subjectSlug)}/${t.slug || t.topicNumber}`}
                className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm hover:border-kenya-green/40 transition"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kenya-green text-white font-bold text-sm">
                  {t.topicOrder}
                </span>
                <div>
                  <p className="font-semibold text-kenya-black">Topic {t.topicNumber}: {t.topicName}</p>
                  <p className="text-xs text-kenya-green">Lesson · Quiz · Answers</p>
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-4 rounded-2xl border border-dashed border-gray-300 p-4 text-gray-400">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 font-bold text-sm">
                  {t.topicOrder}
                </span>
                <div>
                  <p className="font-medium">Topic {t.topicNumber}: {t.topicName}</p>
                  <p className="text-xs">Coming soon</p>
                </div>
              </div>
            )}
          </li>
        ))}
      </ol>
    </PlatformLayout>
  );
}
