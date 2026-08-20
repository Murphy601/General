import { PlatformNav } from '@/components/PlatformNav';
import { getCurrentUser } from '@/lib/auth';

export async function PlatformLayout({ children, active }: { children: React.ReactNode; active?: string }) {
  const user = await getCurrentUser();

  return (
    <>
      <PlatformNav active={active} user={user} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t border-gray-200 bg-kenya-black text-gray-400 mt-12">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm">
          HighTech CBC Learners · PP1–Grade 12 · Pay with M-Pesa
        </div>
      </footer>
    </>
  );
}
