import { redirect } from 'next/navigation';
import Link from 'next/link';

export default function DocsRedirect() {
  if (process.env.STATIC_EXPORT === '1') {
    return (
      <main className="mx-auto max-w-xl p-10">
        <p className="text-lg">Lessons are in Learning Docs.</p>
        <Link href="/learn/" className="mt-4 inline-block text-kenya-green underline">
          Open Grade 4 lessons
        </Link>
      </main>
    );
  }
  redirect('/learn');
}
