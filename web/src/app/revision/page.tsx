import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';

const CATEGORIES = [
  { slug: 'general', label: 'General Assessment', desc: 'Topical revision quizzes by subject and topic' },
  { slug: 'termly', label: 'Termly Exams', desc: 'End of term assessment papers' },
  { slug: 'mock', label: 'Mock Exams', desc: 'KPSEA and national mock papers' },
  { slug: 'premium', label: 'Premium Exams', desc: 'Advanced revision papers' },
];

export default function RevisionPage() {
  return (
    <PlatformLayout active="/revision">
      <h1 className="text-2xl font-bold">Revision Hub</h1>
      <p className="text-gray-600 mt-1">Choose an assessment type, then pick grade, subject, and paper.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {CATEGORIES.map((cat) => (
          <Link
            key={cat.slug}
            href={`/revision/${cat.slug}`}
            className="rounded-2xl border bg-white p-5 shadow-sm hover:border-kenya-green/40 transition"
          >
            <h2 className="font-semibold text-kenya-black">{cat.label}</h2>
            <p className="text-sm text-gray-500 mt-1">{cat.desc}</p>
          </Link>
        ))}
      </div>
    </PlatformLayout>
  );
}
