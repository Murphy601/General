import { PlatformLayout } from '@/components/PlatformLayout';
import { getContent, slugifySubject } from '@/lib/content-store';
import { notFound } from 'next/navigation';
import Link from 'next/link';

const TYPE_TO_CATEGORY: Record<string, string> = {
  exam: 'general',
  quiz: 'general',
  'termly-exam': 'termly',
  'mock-exam': 'mock',
  'premium-exam': 'premium',
  'past-paper': 'vault',
};

export default async function RevisionPaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getContent(id);
  if (!item) notFound();

  const examTypes = ['exam', 'quiz', 'mock-exam', 'termly-exam', 'premium-exam', 'past-paper'];
  if (!examTypes.includes(item.type)) notFound();

  const body = item.pages?.quiz || item.body || '';
  const answers = item.pages?.answers || item.metadata.markingScheme || '';
  const category = item.metadata.category || TYPE_TO_CATEGORY[item.type] || 'general';
  const backHref = `/revision/${category}/${encodeURIComponent(item.topic.grade)}/${slugifySubject(item.topic.subject)}`;
  const externalUrl = item.metadata.externalUrl;
  const downloadUrl = item.metadata.downloadUrl;

  return (
    <PlatformLayout active="/revision">
      <Link href={backHref} className="text-sm text-kenya-green hover:underline">
        ← Back to {item.topic.subject}
      </Link>
      <article className="mt-4 rounded-2xl border bg-white p-6 md:p-8 shadow-sm">
        <p className="text-sm text-gray-500">
          {item.topic.gradeLabel} · {item.topic.subject}
          {item.metadata.term ? ` · Term ${item.metadata.term}` : ''}
          {item.metadata.series ? ` · ${item.metadata.series}` : ''}
        </p>
        <h1 className="mt-1 text-2xl font-bold">{item.title}</h1>

        {item.type === 'past-paper' ? (
          <p className="mt-2 text-xs text-gray-500">
            Listed from {item.metadata.sourceSite || 'an open education catalog'} for free revision practice.
          </p>
        ) : item.metadata.contentSource === 'original-from-kicd-design' ? (
          <p className="mt-2 text-xs text-gray-500">
            Original paper generated from KICD Curriculum Design outcomes (Strategy 2).
          </p>
        ) : null}

        {externalUrl ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-xl bg-kenya-green px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Open PDF
            </a>
            {downloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-semibold text-kenya-black hover:border-kenya-green/40"
              >
                Download
              </a>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6">
          <h2 className="font-bold text-kenya-green mb-3">
            {item.type === 'past-paper' ? 'Paper details' : 'Exam Paper'}
          </h2>
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">{body}</pre>
        </div>

        {answers ? (
          <div className="mt-8 border-t pt-6">
            <h2 className="font-bold text-kenya-green mb-3">Marking Scheme / Answers</h2>
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800">{answers}</pre>
          </div>
        ) : null}
      </article>
    </PlatformLayout>
  );
}
