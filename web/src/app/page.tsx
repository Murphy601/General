import { PlatformLayout } from '@/components/PlatformLayout';
import Link from 'next/link';
import { getGrades } from '@/lib/content-store';

export default function HomePage() {
  const grades = getGrades();

  return (
    <PlatformLayout active="/">
      <section className="rounded-2xl bg-gradient-to-br from-kenya-green to-[#0a4d0a] text-white p-8">
        <h1 className="text-3xl font-bold">CBC Learn</h1>
        <p className="mt-2 text-green-100 max-w-2xl">
          Full lessons by grade, subject, and topic. Each topic has a thorough lesson, revision quiz, and answer key.
        </p>
        <Link href="/learn" className="mt-6 inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-kenya-green">
          Start Learning →
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold mb-4">Select Grade</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {grades.filter((g) => g.grade.startsWith('grade-')).map((g) => (
            <Link
              key={g.grade}
              href={`/learn/${encodeURIComponent(g.grade)}`}
              className="rounded-xl border bg-white p-4 hover:border-kenya-green/40 transition text-center"
            >
              <p className="font-bold text-lg">{g.label}</p>
              <p className="text-xs text-gray-500">{g.topicCount} topics</p>
            </Link>
          ))}
        </div>
      </section>
    </PlatformLayout>
  );
}
