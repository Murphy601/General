import Link from 'next/link';
import { PlatformLayout } from '@/components/PlatformLayout';
import { GradePicker } from '@/components/GradePicker';
import { getGrades } from '@/lib/content-store';

export default async function LearnPage() {
  const grades = await getGrades({ includeSne: false });

  return (
    <PlatformLayout active="/learn">
      <h1 className="text-2xl font-bold">Choose Grade</h1>
      <p className="text-gray-600 mt-1">
        Pre-Primary comes first: <Link href="/learn/pp1" className="text-kenya-green font-semibold">PP1</Link>
        {' '}and <Link href="/learn/pp2" className="text-kenya-green font-semibold">PP2</Link>, then Grade 1–12.
      </p>

      <div className="mt-8">
        <GradePicker grades={grades} />
      </div>
    </PlatformLayout>
  );
}
