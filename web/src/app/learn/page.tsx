import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import { getGrades } from '@/lib/content-store';

export default function LearnPage() {
  const grades = getGrades();

  return (
    <PlatformLayout active="/learn">
      <h1 className="text-2xl font-bold">Choose Grade</h1>
      <p className="text-gray-600 mt-1">Select your child&apos;s grade to see all subjects and topics.</p>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {grades.map((g) => (
          <Link
            key={g.grade}
            href={`/learn/${encodeURIComponent(g.grade)}`}
            className="rounded-2xl border bg-white p-5 shadow-sm hover:border-kenya-green/40 transition"
          >
            <p className="font-bold text-lg text-kenya-black">{g.label}</p>
            <p className="text-sm text-gray-500 mt-1">{g.subjectCount} subjects · {g.topicCount} topics</p>
          </Link>
        ))}
      </div>
    </PlatformLayout>
  );
}
