import { PlatformLayout } from '@/components/PlatformLayout';
import { getContent } from '@/lib/content-store';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function RevisionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = getContent(id);
  if (!item || (item.type !== 'exam' && item.type !== 'quiz')) notFound();

  return (
    <PlatformLayout active="/revision">
      <Link href="/revision" className="text-sm text-kenya-green hover:underline">← Revision Hub</Link>
      <article className="mt-4 rounded-2xl border bg-white p-6 md:p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">{item.topic.gradeLabel} · {item.topic.subject}</p>
            <h1 className="mt-1 text-2xl font-bold">{item.title}</h1>
          </div>
          {item.metadata.priceKes ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
              KSh {item.metadata.priceKes}
            </span>
          ) : null}
        </div>
        <div className="mt-6 prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">{item.body}</div>
        {item.metadata.markingScheme ? (
          <div className="mt-8 border-t pt-6">
            <h2 className="font-bold text-kenya-green">Marking Scheme</h2>
            <div className="mt-3 prose prose-sm whitespace-pre-wrap text-gray-700">{item.metadata.markingScheme}</div>
          </div>
        ) : null}
        {item.metadata.questions ? (
          <div className="mt-8 border-t pt-6 space-y-4">
            <h2 className="font-bold text-kenya-green">Questions</h2>
            {item.metadata.questions.map((q, i) => (
              <div key={i} className="rounded-lg border p-4">
                <p className="font-medium">{i + 1}. {q.question}</p>
                {q.options?.map((o, j) => (
                  <p key={j} className="text-sm text-gray-600 ml-4">{String.fromCharCode(65 + j)}. {o}</p>
                ))}
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-8 rounded-xl bg-kenya-green/5 border border-kenya-green/20 p-4 text-sm">
          <strong>M-Pesa checkout coming soon.</strong> Parents pay and download instantly.
        </div>
      </article>
    </PlatformLayout>
  );
}
