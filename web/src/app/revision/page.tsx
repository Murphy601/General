import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import { countExams } from '@/lib/content-store';

const CATEGORIES = [
  {
    slug: 'general',
    label: 'General Assessment',
    desc: 'Subject papers plus topical revision quizzes by topic',
  },
  {
    slug: 'termly',
    label: 'Termly Exams',
    desc: 'End of term assessment papers (Term 1, 2 and 3)',
  },
  {
    slug: 'mock',
    label: 'Mock Exams',
    desc: 'KPSEA-style and end-of-year mock papers',
  },
  {
    slug: 'premium',
    label: 'Premium Exams',
    desc: 'Longer advanced revision papers',
  },
] as const;

export default function RevisionPage() {
  return (
    <PlatformLayout active="/revision">
      <h1 className="text-2xl font-bold">Revision Hub</h1>
      <p className="text-gray-600 mt-1">
        Choose an assessment type, then pick grade, subject, and paper. Papers are original CBC assessments
        written from official KICD Curriculum Design outcomes — not copied from commercial textbooks.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CATEGORIES.map((cat) => {
          const n = countExams(cat.slug);
          return (
            <Link
              key={cat.slug}
              href={`/revision/${cat.slug}`}
              className="rounded-2xl border bg-white p-5 shadow-sm hover:border-kenya-green/40 transition"
            >
              <h2 className="font-semibold text-kenya-black">{cat.label}</h2>
              <p className="text-sm text-gray-500 mt-1">{cat.desc}</p>
              <p className="text-xs text-kenya-green mt-3 font-medium">
                {n > 0 ? `${n} papers ready` : cat.slug === 'general' ? 'Topical quizzes + papers' : 'Papers coming soon'}
              </p>
            </Link>
          );
        })}
      </div>
    </PlatformLayout>
  );
}
