import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import { countExams, getGrades } from '@/lib/content-store';
import { notFound } from 'next/navigation';

const CATEGORY_LABELS: Record<string, string> = {
  general: 'General Assessment',
  termly: 'Termly Exams',
  mock: 'Mock Exams',
  premium: 'Premium Exams',
};

export default async function RevisionCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  const label = CATEGORY_LABELS[category];
  if (!label) notFound();

  const grades = getGrades();

  return (
    <PlatformLayout active="/revision">
      <Link href="/revision" className="text-sm text-kenya-green hover:underline">
        ← Revision Hub
      </Link>
      <h1 className="text-2xl font-bold mt-2">{label}</h1>
      <p className="text-gray-600">Choose a grade</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {grades.map((g) => {
          const papers = countExams(category, g.grade);
          return (
            <Link
              key={g.grade}
              href={`/revision/${category}/${encodeURIComponent(g.grade)}`}
              className="rounded-2xl border bg-white p-5 shadow-sm hover:border-kenya-green/40 transition"
            >
              <p className="font-bold text-lg text-kenya-black">{g.label}</p>
              <p className="text-sm text-gray-500 mt-1">{g.subjectCount} subjects</p>
              <p className="text-xs text-kenya-green mt-2">
                {papers > 0
                  ? `${papers} papers`
                  : category === 'general'
                    ? 'Topical quizzes available'
                    : 'No papers yet'}
              </p>
            </Link>
          );
        })}
      </div>
    </PlatformLayout>
  );
}
