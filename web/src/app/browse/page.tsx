import Link from 'next/link';
import { getGradeGroups } from '@/lib/catalog';
import { GradeCard } from '@/components/GradeCard';

export default function BrowsePage() {
  const grades = getGradeGroups();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold text-kenya-black">Browse Curriculum</h1>
      <p className="mt-2 text-gray-600">Explore curriculum designs organized by grade and learning area.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {grades.map((g) => (
          <GradeCard
            key={g.key}
            gradeKey={g.key}
            label={g.label}
            count={g.count}
            subjectCount={Object.keys(g.subjects).length}
          />
        ))}
      </div>
    </div>
  );
}
