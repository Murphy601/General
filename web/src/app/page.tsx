import { PlatformLayout } from '@/components/PlatformLayout';
import { ContentCard } from '@/components/ContentCard';
import { listContent, seedSamplesIfEmpty } from '@/lib/content-store';
import Link from 'next/link';

export default function DashboardPage() {
  seedSamplesIfEmpty();
  const recent = listContent().slice(0, 6);
  const notes = listContent({ type: 'notes' }).length;
  const exams = listContent({ type: 'exam' }).length + listContent({ type: 'quiz' }).length;
  const videos = listContent({ type: 'video-script' }).length;

  return (
    <PlatformLayout active="/">
      <section className="rounded-2xl bg-gradient-to-br from-kenya-green to-[#0a4d0a] text-white p-8">
        <p className="text-kenya-gold text-sm font-medium uppercase tracking-widest">CBC Revision Platform</p>
        <h1 className="mt-2 text-3xl md:text-4xl font-bold">Learn. Revise. Pass.</h1>
        <p className="mt-3 text-green-100 max-w-2xl">
          Not another KICD document dump — we turn official curriculum into notes, exams, quizzes, and video lessons
          parents and teachers actually pay for.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/studio" className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-kenya-green">
            Open Content Studio
          </Link>
          <Link href="/pricing" className="rounded-xl border border-white/40 px-5 py-2.5 text-sm font-semibold">
            View Plans
          </Link>
        </div>
      </section>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Learning Docs', count: notes, href: '/docs', icon: '📖' },
          { label: 'Revision Items', count: exams, href: '/revision', icon: '📝' },
          { label: 'Video Lessons', count: videos, href: '/videos', icon: '🎥' },
        ].map((stat) => (
          <Link key={stat.href} href={stat.href} className="rounded-2xl border bg-white p-5 shadow-sm hover:border-kenya-green/40 transition">
            <span className="text-2xl">{stat.icon}</span>
            <p className="mt-2 text-2xl font-bold text-kenya-black">{stat.count}</p>
            <p className="text-sm text-gray-500">{stat.label}</p>
          </Link>
        ))}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Continue learning</h2>
          <Link href="/studio" className="text-sm text-kenya-green font-medium">+ Generate new</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recent.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-2xl border border-kenya-green/20 bg-kenya-green/5 p-6">
        <h2 className="font-bold text-kenya-black">Your content pipeline</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-4 text-sm">
          {['KICD PDFs (RAG)', 'AI Draft', 'Teacher Review', 'Publish & Sell'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-kenya-green text-white text-xs font-bold">{i + 1}</span>
              <span className="text-gray-700">{step}</span>
            </div>
          ))}
        </div>
      </section>
    </PlatformLayout>
  );
}
