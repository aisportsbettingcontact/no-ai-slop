import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { DesignSystemRegistry, validateDesignSystemRegistry } from '@nas/contracts';
import * as UI from './index.js';
import { designSystemRegistry } from './registry.js';
import { breakpoints } from './tokens.js';

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const tokensCss = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const baseCss = readFileSync(new URL('./base.css', import.meta.url), 'utf8');

/** Extract the body of the first `{...}` block following `selector`. */
function extractBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `selector not found in css: ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(open + 1, close);
}

function parseVars(block: string): Map<string, string> {
  const vars = new Map<string, string>();
  for (const match of block.matchAll(/(--nas-[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    vars.set(match[1]!, match[2]!.replace(/\s+/g, ' ').trim());
  }
  return vars;
}

const lightVars = parseVars(extractBlock(tokensCss, ':root {'));
const darkVars = parseVars(extractBlock(tokensCss, ":root[data-theme='dark']"));
const osDarkVars = parseVars(extractBlock(tokensCss, ":root:not([data-theme='light'])"));

describe('registry — schema and referential integrity', () => {
  it('parses against the DesignSystemRegistry contract', () => {
    expect(() => DesignSystemRegistry.parse(designSystemRegistry)).not.toThrow();
  });

  it('has zero referential-integrity problems', () => {
    const result = validateDesignSystemRegistry(designSystemRegistry);
    expect(result.problems).toEqual([]);
    expect(result.valid).toBe(true);
  });
});

describe('registry ↔ tokens.css sync (neither can drift)', () => {
  const registryByVar = new Map(
    designSystemRegistry.tokens
      .filter((t) => t.cssVariable !== undefined)
      .map((t) => [t.cssVariable!, t] as const),
  );

  it('every registry cssVariable exists in :root with the exact value', () => {
    for (const [cssVar, token] of registryByVar) {
      const cssValue = lightVars.get(cssVar);
      expect(cssValue, `${cssVar} missing from tokens.css :root`).toBeDefined();
      const expected =
        token.valueByTheme !== undefined ? String(token.valueByTheme.light) : String(token.value);
      expect(cssValue, cssVar).toBe(expected);
    }
  });

  it('every themed registry token has the exact dark value in the dark block', () => {
    for (const [cssVar, token] of registryByVar) {
      if (token.valueByTheme === undefined) continue;
      expect(darkVars.get(cssVar), `${cssVar} missing from dark theme`).toBe(
        String(token.valueByTheme.dark),
      );
    }
  });

  it('every --nas-* custom property in tokens.css is claimed by exactly one registry token', () => {
    const unclaimed = [...lightVars.keys()].filter((cssVar) => !registryByVar.has(cssVar));
    expect(unclaimed, 'tokens.css defines custom properties the registry does not know').toEqual(
      [],
    );
  });

  it('the OS-preference dark block mirrors the explicit dark theme exactly', () => {
    expect(Object.fromEntries(osDarkVars)).toEqual(Object.fromEntries(darkVars));
  });
});

describe('registry ↔ component exports (completeness)', () => {
  it('every component exported from @nas/ui has a registry entry', () => {
    const exported = Object.entries(UI)
      .filter(([name, value]) => typeof value === 'function' && /^[A-Z]/.test(name))
      .map(([name]) => name);
    expect(exported.length).toBeGreaterThan(0);
    const registered = new Set(designSystemRegistry.components.map((c) => c.name));
    const missing = exported.filter((name) => !registered.has(name));
    expect(missing, 'exported components missing a registry entry').toEqual([]);
  });

  it('every registered sourcePath and test path exists in the repository', () => {
    for (const component of designSystemRegistry.components) {
      expect(existsSync(`${repoRoot}${component.sourcePath}`), component.sourcePath).toBe(true);
      for (const testPath of component.tests) {
        expect(existsSync(`${repoRoot}${testPath}`), testPath).toBe(true);
      }
    }
  });
});

describe('registry exceptions are real, owned, and mirror-tested', () => {
  it('the base.css media-query breakpoint equals breakpoint.desktop - 1 and is excepted', () => {
    const mediaMatches = [...baseCss.matchAll(/@media\s*\(max-width:\s*(\d+)px\)/g)];
    expect(mediaMatches).toHaveLength(1);
    expect(Number(mediaMatches[0]![1])).toBe(breakpoints.desktop - 1);
    const exception = designSystemRegistry.exceptions.find(
      (e) => e.scope === `packages/ui/src/base.css::${mediaMatches[0]![1]}px`,
    );
    expect(exception, 'media-query breakpoint must have an exception record').toBeDefined();
  });

  it('every exception names an owner, an expiry, and a remediation', () => {
    for (const exception of designSystemRegistry.exceptions) {
      expect(exception.ownerId.length).toBeGreaterThan(0);
      expect(Number.isNaN(Date.parse(exception.expiresAt))).toBe(false);
      expect(exception.remediation.length).toBeGreaterThan(0);
    }
  });
});
