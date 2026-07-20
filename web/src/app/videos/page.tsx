import { PlatformLayout } from '@/components/PlatformLayout';
import { ContentCard } from '@/components/ContentCard';
import { listContent, seedSamplesIfEmpty } from '@/lib/content-store';

export default function VideosPage() {
  seedSamplesIfEmpty();
  const items = listContent({ type: 'video-script' });

  return (
    <PlatformLayout active="/videos">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">🎥 Video Hub</h1>
        <p className="text-gray-600 mt-1">
          Cached 5-minute lesson reels. Generate script once → render video → upload to Bunny.net → embed here.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} />
        ))}
      </div>
      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed p-12 text-center text-gray-500">
          <p>No videos yet. Generate a script in Studio, then render and upload.</p>
          <a href="/studio" className="mt-2 inline-block text-kenya-green font-medium">Open Studio →</a>
        </div>
      )}
    </PlatformLayout>
  );
}
