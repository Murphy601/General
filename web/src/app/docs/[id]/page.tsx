import { PlatformLayout } from '@/components/PlatformLayout';
import { ContentCard } from '@/components/ContentCard';
import { getContent } from '@/lib/content-store';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function DocDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = getContent(id);
  if (!item || item.type !== 'notes') notFound();

  return (
    <PlatformLayout active="/docs">
      <Link href="/docs" className="text-sm text-kenya-green hover:underline">← Learning Docs</Link>
      <article className="mt-4 rounded-2xl border bg-white p-6 md:p-8 shadow-sm">
        <p className="text-sm text-gray-500">{item.topic.gradeLabel} · {item.topic.subject}</p>
        <h1 className="mt-1 text-2xl font-bold">{item.title}</h1>
        <div className="mt-6 prose prose-sm max-w-none whitespace-pre-wrap text-gray-700">{item.body}</div>
        {item.sources.length > 0 && (
          <div className="mt-8 border-t pt-4">
            <p className="text-xs font-semibold uppercase text-gray-400">Grounded in KICD</p>
            {item.sources.map((s) => (
              <p key={s.id} className="mt-1 text-xs text-gray-500">{s.subject} — {s.excerpt}…</p>
            ))}
          </div>
        )}
      </article>
    </PlatformLayout>
  );
}
