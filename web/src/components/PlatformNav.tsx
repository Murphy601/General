import Link from 'next/link';

const tabs = [
  { href: '/', label: 'Dashboard', icon: '🏠' },
  { href: '/learn', label: 'Learning Docs', icon: '📖' },
  { href: '/revision', label: 'Revision Hub', icon: '📝' },
  { href: '/videos', label: 'Video Hub', icon: '🎥' },
  { href: '/studio', label: 'Studio', icon: '✨' },
  { href: '/pricing', label: 'Pricing', icon: '💳' },
];

export function PlatformNav({ active }: { active?: string }) {
  return (
    <header className="border-b border-kenya-green/20 bg-white sticky top-0 z-50">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center justify-between py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-kenya-green text-white font-bold">H</span>
            <div>
              <p className="font-bold text-kenya-black leading-tight">HighTech CBC Learners</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Revision & Lessons</p>
            </div>
          </Link>
          <Link href="/studio" className="hidden sm:inline-flex rounded-lg bg-kenya-green px-4 py-2 text-sm font-medium text-white">
            Create Content
          </Link>
        </div>
        <nav className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
          {tabs.map((tab) => {
            const isActive = active === tab.href || (tab.href !== '/' && active?.startsWith(tab.href));
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-kenya-green text-white' : 'text-gray-600 hover:bg-kenya-green/10 hover:text-kenya-green'
                }`}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
