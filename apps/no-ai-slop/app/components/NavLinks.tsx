'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Overview' },
  { href: '/release', label: 'Release decision' },
  { href: '/evidence', label: 'Evidence chain' },
  { href: '/system', label: 'Product system' },
] as const;

/**
 * Primary navigation. Only lists screens that actually exist — an anti-slop rule
 * (no empty nav items, no unnecessary dashboards). Marks the current page for
 * both sighted users and assistive technology via aria-current.
 */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav className="nas-nav" aria-label="Primary">
      {ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className="nas-nav__link"
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
