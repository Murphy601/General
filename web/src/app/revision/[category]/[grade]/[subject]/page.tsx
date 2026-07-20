import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import {
  getTopics,
  findSubjectBySlug,
  getGrades,
  listExams,
  slugifySubject,
} from '@/lib/content-store';
import { notFound } from 'next/navigation';

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General Assessment',
  termly: 'Termly Exams',
  mock: 'Mock Exams',
  premium: 'Premium Exams',
};

export default async function RevisionSubjectPage({
  params,
}: {
  params: Promise<{ category: string; grade: string; subject: string }>;
}) {
  const { category, grade, subject: subjectSlug } = await params;
  const catLabel = CATEGORY_LABELS[category];
  if (!catLabel) notFound();

  const gradeKey = decodeURIComponent(grade);
  const subject = findSubjectBySlug(gradeKey, decodeURIComponent(subjectSlug));
  if (!subject) notFound();

  const gradeLabel = getGrades().find((g) => g.grade === gradeKey)?.label || gradeKey;
  const topics = getTopics(gradeKey, subject);
  const exams = listExams(gradeKey, category, subject);

  return (
    <PlatformLayout active="/revision">
      <Link href={`/revision/${category}/${encodeURIComponent(gradeKey)}`} className="text-sm text-kenya-green hover:underline">
        ← {gradeLabel}
      </Link>
      <h1 className="text-2xl font-bold mt-2">{subject}</h1>
      <p className="text-gray-600">{catLabel}</p>

      {category === 'general' ? (
        <ol className="mt-8 space-y-3">
          {topics.map((t) => (
            <li key={t.topicNumber + t.topicName}>
              {t.contentId ? (
                <Link
                  href={`/learn/${encodeURIComponent(gradeKey)}/${slugifySubject(subject)}/${t.slug || t.topicNumber}?tab=quiz`}
                  className="flex items-center gap-4 rounded-2xl border bg-white p-4 shadow-sm hover:border-kenya-green/40 transition"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kenya-green text-white font-bold text-sm">
                    {t.topicOrder}
                  </span>
                  <div>
                    <p className="font-semibold text-kenya-black">Topic {t.topicNumber}: {t.topicName}</p>
                    <p className="text-xs text-kenya-green">Revision Quiz, then Answers at end of topic</p>
                  </div>
                </Link>
              ) : (
                <div className="flex items-center gap-4 rounded-2xl border border-dashed border-gray-300 p-4 text-gray-400">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 font-bold text-sm">
                    {t.topicOrder}
                  </span>
                  <div>
                    <p className="font-medium">Topic {t.topicNumber}: {t.topicName}</p>
                    <p className="text-xs">Lesson not generated yet</p>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-8 space-y-3">
          {exams.length ? (
            exams.map((exam) => (
              <Link
                key={exam.id}
                href={`/revision/paper/${exam.id}`}
                className="block rounded-2xl border bg-white p-4 shadow-sm hover:border-kenya-green/40 transition"
              >
                <p className="font-semibold text-kenya-black">{exam.title}</p>
                <p className="text-xs text-gray-500 mt-1">{exam.topic.gradeLabel} · {exam.topic.subject}</p>
              </Link>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed p-10 text-center text-gray-500">
              <p>No {catLabel.toLowerCase()} papers for this subject yet.</p>
              <p className="text-sm mt-2">Run content generation or use Studio to create exam papers.</p>
            </div>
          )}
        </div>
      )}
    </PlatformLayout>
  );
}
