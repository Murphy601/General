import Link from 'next/link';
import type { PublicUser } from '@/lib/membership';

const tabs = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/docs', label: 'Learning Docs', icon: '📖' },
  { href: '/revision', label: 'Revision Hub', icon: '📝' },
  { href: '/videos', label: 'Video Hub', icon: '🎥' },
  { href: '/studio', label: 'Studio', icon: '✨' },
  { href: '/pricing', label: 'Pricing', icon: '💳' },
  { href: '/account', label: 'Account', icon: '👤' },
];

function tabIsActive(href: string, active?: string) {
  if (href === '/docs') {
    return active === '/docs' || active === '/learn' || Boolean(active?.startsWith('/learn'));
  }
  return active === href || (href !== '/' && Boolean(active?.startsWith(href)));
}

export function PlatformNav({ active, user }: { active?: string; user?: PublicUser | null }) {
  const accountLabel = user ? user.name.split(' ')[0] || 'Account' : 'Sign in';

  return (
    <header className="border-b border-kenya-green/20 bg-white sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-kenya-green text-white font-bold">H</span>
            <div>
              <p className="font-bold text-kenya-black leading-tight">HighTech CBC Learners</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">PP1–Grade 12 · Revision & Lessons</p>
            </div>
          </Link>
          <div className="hidden sm:flex items-center gap-2">
            <Link href="/account" className="rounded-lg border border-kenya-green/30 px-4 py-2 text-sm font-medium text-kenya-green">
              {accountLabel}
            </Link>
            <Link href="/studio" className="rounded-lg bg-kenya-green px-4 py-2 text-sm font-medium text-white">
              Create Content
            </Link>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {tabs.map((tab) => {
            const isActive = tabIsActive(tab.href, active);
            const label = tab.href === '/account' ? accountLabel : tab.label;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-kenya-green text-white' : 'text-gray-600 hover:bg-kenya-green/10 hover:text-kenya-green'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
