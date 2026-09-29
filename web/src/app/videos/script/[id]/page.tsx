import { PlatformLayout } from '@/components/PlatformLayout';
import { getContent } from '@/lib/content-store';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export default async function VideoScriptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getContent(id);
  if (!item || item.type !== 'video-script') notFound();

  return (
    <PlatformLayout active="/videos">
      <Link href="/videos" className="text-sm text-kenya-green hover:underline">← Video Hub</Link>
      <article className="mt-4 space-y-6">
        <div className="rounded-2xl bg-kenya-black aspect-video flex items-center justify-center text-white">
          {item.metadata.videoUrl ? (
            <iframe src={item.metadata.videoUrl} className="w-full h-full rounded-2xl" allowFullScreen title={item.title} />
          ) : (
            <div className="text-center p-8">
              <p className="text-4xl mb-2">▶</p>
              <p className="text-sm text-gray-400">Video not rendered yet</p>
              <p className="text-xs text-gray-500 mt-2">Script ready — render with ElevenLabs + InVideo/HeyGen → Bunny.net</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">{item.title}</h1>
          <p className="text-sm text-gray-500 mt-1">{item.topic.gradeLabel} · {item.topic.subject}</p>

          {item.metadata.scriptSections ? (
            <div className="mt-6 space-y-4">
              {item.metadata.scriptSections.map((s, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <p className="text-xs font-semibold text-kenya-green">[{s.time}] {s.label}</p>
                  <p className="mt-2 text-sm text-gray-700">{s.content}</p>
                  {s.visualCue ? <p className="mt-1 text-xs text-gray-400 italic">Visual: {s.visualCue}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <pre className="mt-6 whitespace-pre-wrap font-sans text-sm text-gray-700">
              {item.pages?.quiz || item.body || ''}
            </pre>
          )}
        </div>
      </article>
    </PlatformLayout>
  );
}
