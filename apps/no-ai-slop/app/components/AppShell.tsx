import type { ReactNode } from 'react';
import { ThemeToggle } from '@nas/ui';
import { NavLinks } from './NavLinks';

/**
 * The persistent shell: left navigation on desktop/tablet (collapses to a top bar
 * below 1024px via base.css), with the product name and theme control. One shell,
 * used by every screen, so the user always knows where they are.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="nas-shell">
      <aside className="nas-sidebar">
        <div className="nas-spread">
          <span className="nas-brand">No AI Slop</span>
          <ThemeToggle />
        </div>
        <NavLinks />
      </aside>
      <main className="nas-main">{children}</main>
    </div>
  );
}
