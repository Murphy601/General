import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import { GradePicker } from '@/components/GradePicker';
import { getGrades } from '@/lib/content-store';

export default async function DocsPage() {
  const grades = await getGrades({ includeSne: false });

  return (
    <PlatformLayout active="/docs">
      <p className="text-sm font-semibold uppercase tracking-wide text-kenya-green">Learning Docs</p>
      <h1 className="text-3xl font-bold mt-1">PP1, PP2, then Grade 1–12</h1>
      <p className="text-gray-600 mt-2 max-w-2xl">
        HighTech CBC Learners starts at Pre-Primary. Open PP1 or PP2 first — they are listed before Grade 1.
        Lessons, quizzes, and revision papers follow the same order.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/learn/pp1" className="rounded-xl bg-kenya-green px-5 py-2.5 text-sm font-semibold text-white">
          PP1 lessons
        </Link>
        <Link href="/learn/pp2" className="rounded-xl border border-kenya-green px-5 py-2.5 text-sm font-semibold text-kenya-green">
          PP2 lessons
        </Link>
        <Link href="/learn" className="rounded-xl border px-5 py-2.5 text-sm font-semibold text-gray-700">
          All grades
        </Link>
      </div>

      <section className="mt-10 rounded-2xl border bg-white p-6">
        <h2 className="font-bold text-lg">Run the latest site from <code className="text-kenya-green">main</code></h2>
        <p className="text-sm text-gray-600 mt-2">
          Do not pull the old <code>cursor/cbc-learning-website-0ec7</code> branch. On Windows or macOS:
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-kenya-black p-4 text-sm text-green-100">{`git checkout main
git pull origin main
cd web
npm run dev`}</pre>
        <p className="text-sm text-gray-600 mt-3">
          Live site:{' '}
          <a className="text-kenya-green font-semibold" href="https://hightech-cbc-learners.mikeal-murphy.workers.dev">
            hightech-cbc-learners.mikeal-murphy.workers.dev
          </a>
          . Accounts are at <Link href="/account" className="text-kenya-green font-semibold">/account</Link>
          ; M-Pesa checkout is at <Link href="/pricing" className="text-kenya-green font-semibold">/pricing</Link>.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-bold mb-4">Browse by grade</h2>
        <GradePicker grades={grades} />
      </section>
    </PlatformLayout>
  );
}
