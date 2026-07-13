'use client';

import { useEffect, useState } from 'react';
import { Button } from './primitives.js';

type Theme = 'light' | 'dark';

/**
 * Explicit light/dark toggle. Defaults to the OS preference (via CSS) until the
 * user chooses; the choice is stamped on <html data-theme> and persisted. Keeping
 * this the only client component keeps the rest of the UI as server components.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem('nas-theme');
    if (stored === 'light' || stored === 'dark') {
      setTheme(stored);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    if (!theme) return;
    document.documentElement.setAttribute('data-theme', theme);
    window.localStorage.setItem('nas-theme', theme);
  }, [theme]);

  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  return (
    <Button
      type="button"
      variant="ghost"
      compact
      aria-label={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    >
      {theme === 'dark' ? 'Light' : 'Dark'}
    </Button>
  );
}
