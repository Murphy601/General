import { PlatformLayout } from '@/components/PlatformLayout';
import { getContent } from '@/lib/content-store';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function RevisionPaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = getContent(id);
  if (!item) notFound();

  const examTypes = ['exam', 'quiz', 'mock-exam', 'termly-exam', 'premium-exam'];
  if (!examTypes.includes(item.type)) notFound();

  const body = item.pages?.quiz || item.body || '';
  const answers = item.pages?.answers || item.metadata.markingScheme || '';

  return (
    <PlatformLayout active="/revision">
      <Link href="/revision" className="text-sm text-kenya-green hover:underline">← Revision Hub</Link>
      <article className="mt-4 rounded-2xl border bg-white p-6 md:p-8 shadow-sm">
        <p className="text-sm text-gray-500">{item.topic.gradeLabel} · {item.topic.subject}</p>
        <h1 className="mt-1 text-2xl font-bold">{item.title}</h1>

        <div className="mt-6">
          <h2 className="font-bold text-kenya-green mb-3">Exam Paper</h2>
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
