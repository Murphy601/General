import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import { getTopics, findSubjectBySlug, listVideoScripts } from '@/lib/content-store';
import { notFound } from 'next/navigation';

export default async function VideoTopicPage({
  params,
}: {
  params: Promise<{ grade: string; subject: string; topic: string }>;
}) {
  const { grade, subject: subjectSlug, topic: topicSlug } = await params;
  const gradeKey = decodeURIComponent(grade);
  const subject = findSubjectBySlug(gradeKey, decodeURIComponent(subjectSlug));
  if (!subject) notFound();

  const topics = getTopics(gradeKey, subject);
  const topicMeta = topics.find((t) => t.slug === topicSlug || t.topicNumber === topicSlug);
  if (!topicMeta) notFound();

  const scripts = listVideoScripts(gradeKey, subject);
  const script = scripts.find(
    (s) => s.topic.subStrand === topicMeta.topicName || s.topic.topicNumber === topicMeta.topicNumber,
  );
  if (!script) notFound();

  const sections = script.metadata.scriptSections || [];

  return (
    <PlatformLayout active="/videos">
      <Link href={`/videos/${encodeURIComponent(gradeKey)}/${encodeURIComponent(subjectSlug)}`} className="text-sm text-kenya-green hover:underline">
        ← {subject}
      </Link>
      <h1 className="text-2xl font-bold mt-2">{script.title}</h1>
      <p className="text-sm text-gray-500">{script.topic.gradeLabel} · {script.topic.subject}</p>

      <article className="mt-6 rounded-2xl border bg-white p-6 md:p-8 shadow-sm space-y-6">
        {sections.length ? (
          sections.map((sec, i) => (
            <div key={i} className="border-b pb-4 last:border-0">
              <p className="text-xs font-medium text-kenya-green">{sec.time} — {sec.label}</p>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-gray-800">{sec.content}</pre>
              {sec.visualCue ? <p className="mt-1 text-xs text-gray-500">Visual: {sec.visualCue}</p> : null}
            </div>
          ))
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-sm text-gray-800">{script.body}</pre>
        )}
      </article>
    </PlatformLayout>
  );
}
