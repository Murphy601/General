import { PlatformLayout } from '@/components/PlatformLayout';
import { ContentCard } from '@/components/ContentCard';
import { listContent, seedSamplesIfEmpty } from '@/lib/content-store';

export default function DocsPage() {
  seedSamplesIfEmpty();
  const items = listContent({ type: 'notes' });

  return (
    <PlatformLayout active="/docs">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">📖 Learning Docs</h1>
        <p className="text-gray-600 mt-1">AI-generated notes grounded in KICD strands — kid-friendly, Kenyan examples, parent tips.</p>
      </div>
      {items.length === 0 ? (
        <EmptyState type="notes" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </PlatformLayout>
  );
}

function EmptyState({ type }: { type: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center">
      <p className="text-gray-500">No content yet. Use Studio to generate your first {type}.</p>
      <a href="/studio" className="mt-3 inline-block text-kenya-green font-medium">Open Studio →</a>
    </div>
  );
}
