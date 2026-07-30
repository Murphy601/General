import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import { getSubjects, getGrades, slugifySubject, listExams } from '@/lib/content-store';
import { notFound } from 'next/navigation';

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General Assessment',
  termly: 'Termly Exams',
  mock: 'Mock Exams',
  premium: 'Premium Exams',
  vault: 'Past Paper Vault',
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
  const gradeLabel = getGrades().find((g) => g.grade === gradeKey)?.label || gradeKey;

  // Past Paper Vault: list subjects that actually have vault papers
  if (category === 'vault') {
    const papers = listExams(gradeKey, 'vault');
    const bySubject = new Map<string, number>();
    for (const p of papers) {
      bySubject.set(p.topic.subject, (bySubject.get(p.topic.subject) || 0) + 1);
    }
    const subjects = [...bySubject.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    return (
      <PlatformLayout active="/revision">
        <Link href={`/revision/${category}`} className="text-sm text-kenya-green hover:underline">
          ← {label}
        </Link>
        <h1 className="text-2xl font-bold mt-2">{gradeLabel}</h1>
        <p className="text-gray-600">Free KPSEA / open past papers — choose a subject</p>

        {subjects.length ? (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {subjects.map(([subject, count]) => (
              <Link
                key={subject}
                href={`/revision/vault/${encodeURIComponent(gradeKey)}/${slugifySubject(subject)}`}
                className="rounded-2xl border bg-white p-5 shadow-sm hover:border-kenya-green/40 transition"
              >
                <p className="font-semibold text-kenya-black">{subject}</p>
                <p className="text-sm text-kenya-green mt-1">
                  {count} paper{count === 1 ? '' : 's'}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed p-10 text-center text-gray-500">
            <p>No vault papers for this grade yet.</p>
            <p className="text-sm mt-2">KPSEA papers are listed under Grade 6.</p>
          </div>
        )}
      </PlatformLayout>
    );
  }

  const subjects = getSubjects(gradeKey);
  if (!subjects.length) notFound();

  return (
    <PlatformLayout active="/revision">
      <Link href={`/revision/${category}`} className="text-sm text-kenya-green hover:underline">
        ← {label}
      </Link>
      <h1 className="text-2xl font-bold mt-2">{gradeLabel}</h1>
      <p className="text-gray-600">Choose a subject</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {subjects.map((s) => {
          const papers = listExams(gradeKey, category, s.subject).length;
          return (
            <Link
              key={s.subject}
              href={`/revision/${category}/${encodeURIComponent(gradeKey)}/${slugifySubject(s.subject)}`}
              className="rounded-2xl border bg-white p-5 shadow-sm hover:border-kenya-green/40 transition"
            >
              <p className="font-semibold text-kenya-black">{s.subject}</p>
              <p className="text-sm text-gray-500 mt-1">
                {category === 'general'
                  ? `${s.topicCount} topics · ${papers} subject paper${papers === 1 ? '' : 's'}`
                  : papers > 0
                    ? `${papers} paper${papers === 1 ? '' : 's'}`
                    : 'No papers yet'}
              </p>
            </Link>
          );
        })}
      </div>
    </PlatformLayout>
  );
}
