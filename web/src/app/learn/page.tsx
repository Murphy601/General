import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import { getGrades } from '@/lib/content-store';

const STAGE_ORDER = ['Pre-Primary', 'Lower Primary', 'Upper Primary', 'Junior School', 'Senior School', 'SNE', 'Other'];

export default function LearnPage() {
  const grades = await getGrades({ includeSne: false });
  const byStage = STAGE_ORDER.map((stage) => ({
    stage,
    grades: grades.filter((g) => g.stage === stage),
  })).filter((g) => g.grades.length > 0);

  return (
    <PlatformLayout active="/learn">
      <h1 className="text-2xl font-bold">Choose Grade</h1>
      <p className="text-gray-600 mt-1">Select your child&apos;s grade to see subjects and topics with learning materials.</p>

      <div className="mt-8 space-y-10">
        {byStage.map(({ stage, grades: stageGrades }) => (
          <section key={stage}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-kenya-green mb-3">{stage}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {stageGrades.map((g) => (
                <Link
                  key={g.grade}
                  href={`/learn/${encodeURIComponent(g.grade)}`}
                  className="rounded-2xl border bg-white p-5 shadow-sm hover:border-kenya-green/40 transition"
                >
                  <p className="font-bold text-lg text-kenya-black">{g.label}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {g.subjectCount} subjects · {g.topicCount} topics
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      {grades.length === 0 ? (
        <p className="mt-8 text-gray-500">No grades with topics yet. Run content indexing.</p>
      ) : null}
    </PlatformLayout>
  );
}
