import Link from 'next/link';
import { STAGE_ORDER } from '@/lib/types';

export type GradeCard = {
  grade: string;
  label: string;
  stage: string;
  subjectCount: number;
  topicCount: number;
};

export function GradePicker({
  grades,
  hrefBase = '/learn',
  dense = false,
}: {
  grades: GradeCard[];
  hrefBase?: string;
  dense?: boolean;
}) {
  const byStage = STAGE_ORDER.map((stage) => ({
    stage,
    grades: grades.filter((g) => g.stage === stage),
  })).filter((g) => g.grades.length > 0);

  return (
    <div className="space-y-10">
      {byStage.map(({ stage, grades: stageGrades }) => (
        <section key={stage}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-kenya-green mb-3">{stage}</h2>
          <div className={`grid gap-3 sm:grid-cols-2 ${dense ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
            {stageGrades.map((g) => (
              <Link
                key={g.grade}
                href={`${hrefBase}/${encodeURIComponent(g.grade)}`}
                className={`rounded-xl border bg-white hover:border-kenya-green/40 transition ${
                  dense ? 'p-4 text-center' : 'rounded-2xl p-5 shadow-sm'
                }`}
              >
                <p className="font-bold text-lg text-kenya-black">{g.label}</p>
                <p className={`text-gray-500 ${dense ? 'text-xs' : 'text-sm mt-1'}`}>
                  {dense ? `${g.topicCount} topics` : `${g.subjectCount} subjects · ${g.topicCount} topics`}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {grades.length === 0 ? <p className="text-gray-500">No grades with topics yet. Run content indexing.</p> : null}
    </div>
  );
}
