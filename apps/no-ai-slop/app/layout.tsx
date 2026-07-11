import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@nas/ui/tokens.css';
import '@nas/ui/base.css';
import { AppShell } from './components/AppShell';

export const metadata: Metadata = {
  title: 'No AI Slop — Control',
  description:
    'A controlled AI application development platform: deliberate product thinking, ' +
    'authenticated evidence, and defensible releases.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
