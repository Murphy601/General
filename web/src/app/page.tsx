import Link from 'next/link';
import { getCatalog, getGradeGroups } from '@/lib/catalog';
import { GradeCard } from '@/components/GradeCard';

export default function HomePage() {
  const catalog = getCatalog();
  const grades = getGradeGroups().slice(0, 12);

  return (
    <div>
      <section className="relative overflow-hidden bg-gradient-to-br from-kenya-green via-[#0a4d0a] to-kenya-black text-white">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_50%,#f5c518_0%,transparent_50%)]" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
          <p className="text-kenya-gold font-medium text-sm uppercase tracking-widest">Kenya CBC Platform</p>
          <h1 className="mt-3 font-display text-4xl md:text-6xl font-bold leading-tight max-w-3xl">
            Learn smarter with official curriculum resources
          </h1>
          <p className="mt-5 text-lg text-green-100 max-w-2xl">
            Browse {catalog.totalDocuments}+ KICD curriculum designs, ask the revision assistant about strands and
            learning outcomes, and generate practice quizzes.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/browse"
              className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-kenya-green hover:bg-green-50 transition"
            >
              Browse Curriculum
            </Link>
            <Link
              href="/revision"
              className="rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 transition"
            >
              Ask Revision Assistant
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              title: 'Curriculum Library',
              desc: '584 curriculum designs across grades 4–12, SNE pathways, and more — sourced from KICD.',
              href: '/browse',
            },
            {
              title: 'AI Revision',
              desc: 'RAG-powered search over curriculum chunks. Ask about strands, outcomes, and topics.',
              href: '/revision',
            },
            {
              title: 'Practice Quizzes',
              desc: 'Auto-generated multiple-choice questions from curriculum content for self-assessment.',
              href: '/quiz',
            },
          ].map((feature) => (
            <Link
              key={feature.href}
              href={feature.href}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:border-kenya-green/30 hover:shadow transition"
            >
              <h3 className="font-display text-lg font-semibold text-kenya-black">{feature.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{feature.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-white border-y border-gray-200">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <div className="flex items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display text-2xl font-bold text-kenya-black">Browse by grade</h2>
              <p className="mt-1 text-gray-500">Select a grade to explore subjects and curriculum designs</p>
            </div>
            <Link href="/browse" className="text-sm font-medium text-kenya-green hover:underline">
              View all grades →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grades.map((g) => (
              <GradeCard
                key={g.key}
                gradeKey={g.key}
                label={g.label}
                count={g.count}
                subjectCount={Object.keys(g.subjects).length}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
