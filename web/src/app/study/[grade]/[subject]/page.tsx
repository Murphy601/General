import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDocumentsByGradeSubject } from '@/lib/catalog';

export default async function StudyPage({
  params,
}: {
  params: Promise<{ grade: string; subject: string }>;
}) {
  const { grade, subject } = await params;
  const gradeSlug = decodeURIComponent(grade);
  const subjectSlug = decodeURIComponent(subject);
  const documents = getDocumentsByGradeSubject(gradeSlug, subjectSlug);

  if (!documents.length) notFound();

  const sample = documents[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link href={`/browse/${encodeURIComponent(sample.grade)}`} className="text-sm text-kenya-green hover:underline">
        ← {sample.gradeLabel}
      </Link>
      <h1 className="mt-4 font-display text-3xl font-bold text-kenya-black">{sample.subject}</h1>
      <p className="mt-2 text-gray-600">{documents.length} curriculum design{documents.length !== 1 ? 's' : ''}</p>

      <div className="mt-8 space-y-4">
        {documents.map((doc) => (
          <Link
            key={doc.fileId}
            href={`/document/${doc.fileId}`}
            className="block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-kenya-green/40 transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-kenya-black">{doc.title}</h2>
                <p className="mt-2 text-sm text-gray-600 line-clamp-2">{doc.excerpt}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {doc.pageCount} pages · {(doc.charCount / 1000).toFixed(0)}k characters
                </p>
              </div>
              <span className="shrink-0 text-kenya-green text-sm font-medium">Open →</span>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 rounded-xl bg-kenya-green/5 border border-kenya-green/20 p-4">
        <p className="text-sm text-gray-700">
          Want to revise this subject?{' '}
          <Link
            href={`/revision?grade=${encodeURIComponent(sample.grade)}&subject=${encodeURIComponent(sample.subject)}`}
            className="font-medium text-kenya-green hover:underline"
          >
            Ask the revision assistant →
          </Link>
        </p>
      </div>
    </div>
  );
}
