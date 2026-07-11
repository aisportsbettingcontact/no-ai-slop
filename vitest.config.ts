import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Single root Vitest config. Workspace packages resolve to their TypeScript
 * source (not built dist) via aliases, so unit tests never depend on build order
 * and always exercise the exact source under review.
 */
const src = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@nas/contracts': src('./packages/contracts/src/index.ts'),
      '@nas/crypto': src('./packages/crypto/src/index.ts'),
      '@nas/kernel-evidence': src('./packages/kernel-evidence/src/index.ts'),
      '@nas/kernel-authz': src('./packages/kernel-authz/src/index.ts'),
      '@nas/kernel-release': src('./packages/kernel-release/src/index.ts'),
      '@nas/anti-slop': src('./packages/anti-slop/src/index.ts'),
    },
  },
  test: {
    include: ['packages/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/**'],
    environment: 'node',
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['packages/**/src/**/*.ts'],
      exclude: ['packages/**/src/**/*.test.ts', 'packages/**/src/**/index.ts'],
    },
  },
});
