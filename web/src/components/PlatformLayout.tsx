import { PlatformNav } from '@/components/PlatformNav';

export function PlatformLayout({ children, active }: { children: React.ReactNode; active?: string }) {
  return (
    <>
      <PlatformNav active={active} />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t border-gray-200 bg-kenya-black text-gray-400 mt-12">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm">
          HighTech CBC Learners · KICD-grounded content · M-Pesa payments coming soon
        </div>
      </footer>
    </>
  );
}
