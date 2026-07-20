import Link from 'next/link';

const links = [
  { href: '/', label: 'Home' },
  { href: '/browse', label: 'Browse' },
  { href: '/revision', label: 'Revision' },
  { href: '/quiz', label: 'Quiz' },
];

export function Header() {
  return (
    <header className="border-b border-kenya-green/20 bg-white/90 backdrop-blur sticky top-0 z-50">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-kenya-green text-white font-bold text-lg shadow">
            C
          </span>
          <div>
            <p className="font-display text-lg font-bold text-kenya-black leading-tight">CBC Learn</p>
            <p className="text-xs text-gray-500">Kenya Competency-Based Curriculum</p>
          </div>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-kenya-green/10 hover:text-kenya-green transition"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/revision"
          className="md:hidden rounded-lg bg-kenya-green px-3 py-2 text-sm font-medium text-white"
        >
          Ask
        </Link>
      </div>
    </header>
  );
}
