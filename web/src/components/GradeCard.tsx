import Link from 'next/link';

interface GradeCardProps {
  gradeKey: string;
  label: string;
  count: number;
  subjectCount: number;
}

export function GradeCard({ gradeKey, label, count, subjectCount }: GradeCardProps) {
  return (
    <Link
      href={`/browse/${encodeURIComponent(gradeKey)}`}
      className="group rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-kenya-green/40 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-semibold text-kenya-black group-hover:text-kenya-green">
            {label}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {count} documents · {subjectCount} subjects
          </p>
        </div>
        <span className="rounded-full bg-kenya-green/10 px-3 py-1 text-xs font-medium text-kenya-green">
          View
        </span>
      </div>
    </Link>
  );
}
