import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import { getSubjects, getGrades, slugifySubject } from '@/lib/content-store';
import { notFound } from 'next/navigation';

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General Assessment',
  termly: 'Termly Exams',
  mock: 'Mock Exams',
  premium: 'Premium Exams',
};

export default async function RevisionGradePage({
  params,
}: {
  params: Promise<{ category: string; grade: string }>;
}) {
  const { category, grade } = await params;
  const label = CATEGORY_LABELS[category];
  if (!label) notFound();

  const gradeKey = decodeURIComponent(grade);
  const subjects = getSubjects(gradeKey);
  if (!subjects.length) notFound();
  const gradeLabel = getGrades().find((g) => g.grade === gradeKey)?.label || gradeKey;

  return (
    <PlatformLayout active="/revision">
      <Link href={`/revision/${category}`} className="text-sm text-kenya-green hover:underline">← {label}</Link>
      <h1 className="text-2xl font-bold mt-2">{gradeLabel}</h1>
      <p className="text-gray-600">Choose a subject</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {subjects.map((s) => (
          <Link
            key={s.subject}
            href={`/revision/${category}/${encodeURIComponent(gradeKey)}/${slugifySubject(s.subject)}`}
            className="rounded-2xl border bg-white p-5 shadow-sm hover:border-kenya-green/40 transition"
          >
            <p className="font-semibold text-kenya-black">{s.subject}</p>
            <p className="text-sm text-gray-500 mt-1">{s.topicCount} topics</p>
          </Link>
        ))}
      </div>
    </PlatformLayout>
  );
}
