import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import { getGrades } from '@/lib/content-store';

export default function VideosPage() {
  const grades = getGrades();

  return (
    <PlatformLayout active="/videos">
      <h1 className="text-2xl font-bold">Video Hub</h1>
      <p className="text-gray-600 mt-1">Choose a grade, then subject and topic for lesson videos.</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {grades.map((g) => (
          <Link
            key={g.grade}
            href={`/videos/${encodeURIComponent(g.grade)}`}
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
