import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import { getSubjects, getGrades, getTopics, findSubjectBySlug, slugifySubject } from '@/lib/content-store';
import { notFound } from 'next/navigation';

export default async function GradeSubjectsPage({ params }: { params: Promise<{ grade: string }> }) {
  const { grade } = await params;
  const gradeKey = decodeURIComponent(grade);
  const subjects = getSubjects(gradeKey);
  if (!subjects.length) notFound();
  const label = getGrades().find((g) => g.grade === gradeKey)?.label || gradeKey;

  return (
    <PlatformLayout active="/learn">
      <Link href="/learn" className="text-sm text-kenya-green hover:underline">← All Grades</Link>
      <h1 className="text-2xl font-bold mt-2">{label}</h1>
      <p className="text-gray-600">Choose a subject</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {subjects.map((s) => (
          <Link
            key={s.subject}
            href={`/learn/${encodeURIComponent(gradeKey)}/${slugifySubject(s.subject)}`}
            className="rounded-2xl border bg-white p-5 shadow-sm hover:border-kenya-green/40 transition"
          >
            <p className="font-semibold text-kenya-black">{s.subject}</p>
            <p className="text-sm text-gray-500 mt-1">
              {s.topicCount} topics{s.generatedCount > 0 ? ` · ${s.generatedCount} lessons ready` : ''}
            </p>
          </Link>
        ))}
      </div>
    </PlatformLayout>
  );
}
