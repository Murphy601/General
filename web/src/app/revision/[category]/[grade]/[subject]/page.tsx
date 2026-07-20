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

function PaperList({
  exams,
  emptyLabel,
}: {
  exams: ReturnType<typeof listExams>;
  emptyLabel: string;
}) {
  if (!exams.length) {
    return (
      <div className="rounded-2xl border border-dashed p-10 text-center text-gray-500">
        <p>{emptyLabel}</p>
        <p className="text-sm mt-2">
          Generate with <code className="text-xs bg-gray-100 px-1 rounded">npm run content:generate-exams:all</code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {exams.map((exam) => (
        <Link
          key={exam.id}
          href={`/revision/paper/${exam.id}`}
          className="block rounded-2xl border bg-white p-4 shadow-sm hover:border-kenya-green/40 transition"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-kenya-black">{exam.title}</p>
              <p className="text-xs text-gray-500 mt-1">
                {exam.topic.gradeLabel} · {exam.topic.subject}
                {exam.metadata.questionCount ? ` · ${exam.metadata.questionCount} questions` : ''}
              </p>
            </div>
            {exam.metadata.access && exam.metadata.access !== 'free' ? (
              <span className="shrink-0 text-xs rounded-full bg-amber-50 text-amber-800 px-2 py-1">
                {exam.metadata.priceKes ? `KSh ${exam.metadata.priceKes}` : 'Premium'}
              </span>
            ) : (
              <span className="shrink-0 text-xs rounded-full bg-green-50 text-green-700 px-2 py-1">Free</span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

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
      <Link
        href={`/revision/${category}/${encodeURIComponent(gradeKey)}`}
        className="text-sm text-kenya-green hover:underline"
      >
        ← {gradeLabel}
      </Link>
      <h1 className="text-2xl font-bold mt-2">{subject}</h1>
      <p className="text-gray-600">{catLabel}</p>

      {category === 'general' ? (
        <div className="mt-8 space-y-10">
          <section>
            <h2 className="font-semibold text-kenya-black mb-3">Subject papers</h2>
            <PaperList exams={exams} emptyLabel="No general assessment paper for this subject yet." />
          </section>

          <section>
            <h2 className="font-semibold text-kenya-black mb-1">Topical revision quizzes</h2>
            <p className="text-sm text-gray-500 mb-4">
              Open a topic to practise the quiz, then check answers at the end of the lesson.
            </p>
            <ol className="space-y-3">
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
                        <p className="font-semibold text-kenya-black">
                          Topic {t.topicNumber}: {t.topicName}
                        </p>
                        <p className="text-xs text-kenya-green">Revision quiz + answers</p>
                      </div>
                    </Link>
                  ) : (
                    <div className="flex items-center gap-4 rounded-2xl border border-dashed border-gray-300 p-4 text-gray-400">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-200 font-bold text-sm">
                        {t.topicOrder}
                      </span>
                      <div>
                        <p className="font-medium">
                          Topic {t.topicNumber}: {t.topicName}
                        </p>
                        <p className="text-xs">Lesson not generated yet</p>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        </div>
      ) : (
        <div className="mt-8">
          <PaperList exams={exams} emptyLabel={`No ${catLabel.toLowerCase()} papers for this subject yet.`} />
        </div>
      )}
    </PlatformLayout>
  );
}
