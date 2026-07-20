import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCatalog } from '@/lib/catalog';

export default async function GradeBrowsePage({ params }: { params: Promise<{ grade: string }> }) {
  const { grade: gradeParam } = await params;
  const gradeKey = decodeURIComponent(gradeParam);
  const catalog = getCatalog();
  const group = catalog.byGrade[gradeKey];

  if (!group) notFound();

  const subjects = Object.entries(group.subjects).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/browse" className="text-sm text-kenya-green hover:underline">
        ← All grades
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold text-kenya-black">{group.label}</h1>
      <p className="mt-2 text-gray-600">
        {group.count} documents across {subjects.length} subjects
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map(([subject, info]) => (
          <Link
            key={subject}
            href={`/study/${encodeURIComponent(group.slug)}/${info.slug}`}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-kenya-green/40 hover:shadow transition"
          >
            <h2 className="font-semibold text-kenya-black">{subject}</h2>
            <p className="mt-1 text-sm text-gray-500">{info.count} document{info.count !== 1 ? 's' : ''}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
