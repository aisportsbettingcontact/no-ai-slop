import { describe, expect, it } from 'vitest';
import { resourceMatches } from './resource.js';

describe('resourceMatches', () => {
  it('matches exact resources', () => {
    expect(resourceMatches('net://api.github.com', 'net://api.github.com')).toBe(true);
    expect(resourceMatches('net://api.github.com', 'net://evil.com')).toBe(false);
  });

  it('`**` matches any suffix including slashes', () => {
    expect(resourceMatches('repo://web/src/**', 'repo://web/src/app/page.tsx')).toBe(true);
    expect(resourceMatches('repo://web/src/**', 'repo://web/src')).toBe(false); // trailing slash needed
    expect(resourceMatches('repo://web/**', 'repo://web/anything/at/all')).toBe(true);
  });

  it('`*` matches within a single segment only', () => {
    expect(resourceMatches('secret://GITHUB_*', 'secret://GITHUB_TOKEN')).toBe(true);
    expect(resourceMatches('repo://web/*', 'repo://web/file.ts')).toBe(true);
    expect(resourceMatches('repo://web/*', 'repo://web/nested/file.ts')).toBe(false);
  });

  it('does not let a pattern escape its scheme', () => {
    expect(resourceMatches('repo://web/**', 'net://web/x')).toBe(false);
  });

  it('treats regex metacharacters as literals', () => {
    expect(resourceMatches('secret://A.B', 'secret://AxB')).toBe(false);
    expect(resourceMatches('secret://A.B', 'secret://A.B')).toBe(true);
  });

  it('never matches empty inputs (deny-friendly)', () => {
    expect(resourceMatches('', 'anything')).toBe(false);
    expect(resourceMatches('repo://**', '')).toBe(false);
  });

  it('rejects control characters so `*` cannot over-match across a newline injection', () => {
    // Regression: `[^/]*` would otherwise match a newline, letting a secret pattern
    // over-match `secret://GITHUB_TOKEN\n<anything>`.
    expect(resourceMatches('secret://GITHUB_*', 'secret://GITHUB_TOKEN\nEVIL')).toBe(false);
    expect(resourceMatches('repo://web/**', 'repo://web/a\nb')).toBe(false);
    expect(resourceMatches('secret://\tx', 'secret://\tx')).toBe(false);
    // A clean single-segment secret still matches.
    expect(resourceMatches('secret://GITHUB_*', 'secret://GITHUB_TOKEN')).toBe(true);
  });
});
