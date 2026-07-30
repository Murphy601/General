import Link from 'next/link';
import type { GeneratedContent } from '@/lib/types';

export function ContentCard({ item }: { item: GeneratedContent }) {
  const href = contentHref(item);
  const badge = accessBadge(item.metadata.access, item.metadata.priceKes);

  return (
    <Link href={href} className="group block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-kenya-green/40 hover:shadow transition">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-400">{typeLabel(item.type)}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>{badge.label}</span>
      </div>
      <h3 className="mt-2 font-semibold text-kenya-black group-hover:text-kenya-green">{item.title}</h3>
      <p className="mt-1 text-sm text-gray-500">
        {item.topic.gradeLabel} · {item.topic.subject}
        {item.topic.strand ? ` · ${item.topic.strand}` : ''}
      </p>
      <p className="mt-2 text-sm text-gray-600 line-clamp-2">{(item.body || item.pages?.lesson || '').replace(/[#*]/g, '')}</p>
    </Link>
  );
}

function contentHref(item: GeneratedContent) {
  if (item.type === 'topic-lesson' && item.topic.grade && item.topic.slug) {
    const subjectSlug = item.topic.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `/learn/${encodeURIComponent(item.topic.grade)}/${subjectSlug}/${item.topic.slug}`;
  }
  if (item.type === 'notes') return `/docs/${item.id}`;
  if (item.type === 'video-script') return `/videos/script/${item.id}`;
  return `/revision/paper/${item.id}`;
}

function typeLabel(type: string) {
  const map: Record<string, string> = {
    notes: 'Learning Doc',
    exam: 'Exam',
    quiz: 'Quiz',
    'video-script': 'Video Lesson',
  };
  return map[type] || type;
}

function accessBadge(access: string, price?: number) {
  if (access === 'free') return { label: 'Free', cls: 'bg-green-100 text-green-700' };
  if (access === 'subscription') return { label: 'Premium', cls: 'bg-purple-100 text-purple-700' };
  return { label: price ? `KSh ${price}` : 'Paid', cls: 'bg-amber-100 text-amber-800' };
}
