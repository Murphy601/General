import { PlatformLayout } from '@/components/PlatformLayout';
import { GradePicker } from '@/components/GradePicker';
import Link from 'next/link';
import { getGrades } from '@/lib/content-store';

export default async function HomePage() {
  const grades = await getGrades({ includeSne: false });

  return (
    <PlatformLayout active="/">
      <section className="rounded-2xl bg-gradient-to-br from-kenya-green to-[#0a4d0a] text-white p-8">
        <p className="text-green-100 text-sm font-semibold uppercase tracking-wide">PP1 · PP2 · Grade 1–12</p>
        <h1 className="text-3xl font-bold mt-1">HighTech CBC Learners</h1>
        <p className="mt-2 text-green-100 max-w-2xl">
          Full lessons by grade, subject, and topic — starting at Pre-Primary (PP1 and PP2), then Grade 1 through Grade 12.
          Each topic has a thorough lesson, revision quiz, and answer key.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/learn" className="inline-block rounded-xl bg-white px-6 py-3 text-sm font-semibold text-kenya-green">
            Start Learning →
          </Link>
          <Link href="/learn/pp1" className="inline-block rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white">
            Open PP1
          </Link>
          <Link href="/learn/pp2" className="inline-block rounded-xl border border-white/40 px-6 py-3 text-sm font-semibold text-white">
            Open PP2
          </Link>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold mb-4">Select Grade</h2>
        <GradePicker grades={grades} dense />
      </section>
    </PlatformLayout>
  );
}
