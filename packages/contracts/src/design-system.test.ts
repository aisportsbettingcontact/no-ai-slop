import { describe, expect, it } from 'vitest';
import {
  DesignSystemRegistry,
  DesignTokenDef,
  validateDesignSystemRegistry,
  type ComponentDef,
} from './index.js';

/** A minimal, internally consistent registry used as the base for every case. */
function baseRegistry(): DesignSystemRegistry {
  return DesignSystemRegistry.parse({
    schemaVersion: 1,
    name: 'Test System',
    version: '1.0.0',
    principles: [
      {
        id: 'principle.one-primary-action',
        name: 'One primary action',
        statement: 'Every screen has one dominant task and one primary action.',
        rationale: 'Competing primary actions dilute the user decision.',
      },
    ],
    owners: [
      {
        id: 'owner.design-systems',
        name: 'Design Systems',
        responsibility: 'Owns tokens, components, and system governance.',
      },
    ],
    tokens: [
      {
        id: 'palette.mint.600',
        tier: 'primitive',
        category: 'color',
        description: 'Mint 600 palette step.',
        value: '#0a7c6d',
      },
      {
        id: 'color.accent',
        tier: 'semantic',
        category: 'color',
        description: 'The single action accent.',
        aliasOf: 'palette.mint.600',
        cssVariable: '--nas-accent',
      },
      {
        id: 'space.4',
        tier: 'primitive',
        category: 'spacing',
        description: '12px spacing step.',
        value: '12px',
        cssVariable: '--nas-space-4',
      },
    ],
    components: [
      {
        id: 'component.button',
        name: 'Button',
        atomicLevel: 'atom',
        category: 'input',
        purpose: 'Trigger a single action.',
        sourcePath: 'packages/ui/src/components/primitives.tsx',
        followsPrinciples: ['principle.one-primary-action'],
        usesTokens: ['color.accent'],
        states: [
          { state: 'focus_visible', behavior: 'Shows a 2px focus ring.' },
          { state: 'disabled', behavior: 'Dimmed, not clickable.' },
        ],
        responsiveBehavior: 'Full-width below the tablet breakpoint when in a form.',
        ownerId: 'owner.design-systems',
        version: '1.0.0',
        status: 'stable',
      },
      {
        id: 'component.search-form',
        name: 'SearchForm',
        atomicLevel: 'molecule',
        category: 'input',
        purpose: 'Submit a search query.',
        sourcePath: 'packages/ui/src/components/search.tsx',
        composedOf: ['component.button'],
        followsPrinciples: ['principle.one-primary-action'],
        responsiveBehavior: 'Stacks vertically on mobile.',
        ownerId: 'owner.design-systems',
        version: '1.0.0',
        status: 'stable',
      },
    ],
    patterns: [
      {
        id: 'pattern.primary-action',
        name: 'Primary action',
        kind: 'functional',
        purpose: 'Exactly one primary button per screen.',
        consistsOf: ['component.button'],
        conditionsOfUse: 'Use on every screen with a dominant task.',
      },
    ],
    accessibilityRules: [],
    exceptions: [],
  });
}

describe('DesignTokenDef', () => {
  it('accepts exactly one value source', () => {
    expect(
      DesignTokenDef.safeParse({
        id: 'color.text',
        tier: 'semantic',
        category: 'color',
        description: 'Primary text color.',
        valueByTheme: { light: '#1d1d1f', dark: '#f5f5f7' },
      }).success,
    ).toBe(true);
  });

  it('rejects a token with zero or multiple value sources', () => {
    const none = DesignTokenDef.safeParse({
      id: 'color.text',
      tier: 'semantic',
      category: 'color',
      description: 'No value at all.',
    });
    expect(none.success).toBe(false);
    const both = DesignTokenDef.safeParse({
      id: 'color.text',
      tier: 'semantic',
      category: 'color',
      description: 'Two value sources.',
      value: '#000000',
      aliasOf: 'palette.gray.900',
    });
    expect(both.success).toBe(false);
  });

  it('rejects a primitive token that aliases (primitives are roots)', () => {
    expect(
      DesignTokenDef.safeParse({
        id: 'palette.gray.900',
        tier: 'primitive',
        category: 'color',
        description: 'Primitive alias — forbidden.',
        aliasOf: 'palette.gray.800',
      }).success,
    ).toBe(false);
  });

  it('rejects malformed ids and css variables', () => {
    expect(
      DesignTokenDef.safeParse({
        id: 'ColorAccent',
        tier: 'semantic',
        category: 'color',
        description: 'Bad id.',
        value: '#fff',
      }).success,
    ).toBe(false);
    expect(
      DesignTokenDef.safeParse({
        id: 'color.accent',
        tier: 'semantic',
        category: 'color',
        description: 'Bad css var prefix.',
        value: '#fff',
        cssVariable: '--other-accent',
      }).success,
    ).toBe(false);
  });
});

describe('validateDesignSystemRegistry — referential integrity', () => {
  it('accepts an internally consistent registry', () => {
    const result = validateDesignSystemRegistry(baseRegistry());
    expect(result.problems).toEqual([]);
    expect(result.valid).toBe(true);
    expect(result.counts.components).toBe(2);
  });

  it('flags duplicate ids in any section', () => {
    const registry = baseRegistry();
    registry.tokens.push(registry.tokens[0]!);
    const result = validateDesignSystemRegistry(registry);
    expect(result.valid).toBe(false);
    expect(result.problems.some((p) => p.code === 'REG_DUPLICATE_ID')).toBe(true);
  });

  it('flags a component that references a missing token', () => {
    const registry = baseRegistry();
    registry.components[0]!.usesTokens.push('color.does-not-exist');
    const result = validateDesignSystemRegistry(registry);
    expect(result.problems).toContainEqual(
      expect.objectContaining({ code: 'REG_MISSING_TOKEN', path: 'components/component.button' }),
    );
  });

  it('flags missing principles, owners, rules, and pattern references', () => {
    const registry = baseRegistry();
    registry.components[0]!.followsPrinciples.push('principle.ghost');
    registry.components[0]!.accessibility.push('rule.ghost');
    registry.components[0]!.ownerId = 'owner.ghost';
    registry.patterns[0]!.consistsOf.push('component.ghost');
    const codes = validateDesignSystemRegistry(registry).problems.map((p) => p.code);
    expect(codes).toContain('REG_MISSING_PRINCIPLE');
    expect(codes).toContain('REG_MISSING_RULE');
    expect(codes).toContain('REG_MISSING_OWNER');
    expect(codes).toContain('REG_MISSING_COMPONENT');
  });

  it('flags an alias to a missing token and an alias to an equal-or-higher tier', () => {
    const registry = baseRegistry();
    registry.tokens.push(
      DesignTokenDef.parse({
        id: 'color.broken',
        tier: 'semantic',
        category: 'color',
        description: 'Alias to nothing.',
        aliasOf: 'palette.ghost',
      }),
      DesignTokenDef.parse({
        id: 'color.sideways',
        tier: 'semantic',
        category: 'color',
        description: 'Alias to a same-tier token.',
        aliasOf: 'color.accent',
      }),
    );
    const codes = validateDesignSystemRegistry(registry).problems.map((p) => p.code);
    expect(codes).toContain('REG_ALIAS_MISSING');
    expect(codes).toContain('REG_ALIAS_TIER');
  });

  it('flags duplicate css variables', () => {
    const registry = baseRegistry();
    registry.tokens.push(
      DesignTokenDef.parse({
        id: 'color.accent-2',
        tier: 'semantic',
        category: 'color',
        description: 'Steals an existing css variable.',
        value: '#123456',
        cssVariable: '--nas-accent',
      }),
    );
    const result = validateDesignSystemRegistry(registry);
    expect(result.problems.some((p) => p.code === 'REG_DUPLICATE_CSS_VARIABLE')).toBe(true);
  });

  it('enforces atomic composition: atoms compose nothing, levels point downward', () => {
    const registry = baseRegistry();
    // An atom that composes another component.
    registry.components[0]!.composedOf = ['component.search-form'];
    // A molecule that composes a same-level component.
    registry.components[1]!.composedOf = ['component.search-form'];
    const codes = validateDesignSystemRegistry(registry).problems.map((p) => p.code);
    expect(codes).toContain('REG_ATOM_COMPOSED');
    expect(codes).toContain('REG_COMPOSITION_LEVEL');
  });

  it('requires deprecation records and status to agree, both directions', () => {
    const registry = baseRegistry();
    const [button, searchForm] = registry.components as [ComponentDef, ComponentDef];
    button.status = 'deprecated'; // no deprecation record
    searchForm.deprecation = {
      reason: 'Replaced by a combined header search.',
      since: '1.1.0',
      migration: 'Use component.button until the replacement ships.',
    }; // status still stable
    const problems = validateDesignSystemRegistry(registry).problems.filter(
      (p) => p.code === 'REG_DEPRECATION_MISMATCH',
    );
    expect(problems).toHaveLength(2);
  });

  it('flags deprecation.replacedBy pointing at a missing component', () => {
    const registry = baseRegistry();
    registry.components[0]!.status = 'deprecated';
    registry.components[0]!.deprecation = {
      reason: 'Superseded.',
      since: '1.1.0',
      replacedBy: 'component.ghost',
      migration: 'Swap imports.',
    };
    const codes = validateDesignSystemRegistry(registry).problems.map((p) => p.code);
    expect(codes).toContain('REG_MISSING_COMPONENT');
  });

  it('is deterministic: problems come back sorted by path then code', () => {
    const registry = baseRegistry();
    registry.components[1]!.ownerId = 'owner.ghost';
    registry.components[0]!.usesTokens.push('color.ghost');
    const a = validateDesignSystemRegistry(registry);
    const b = validateDesignSystemRegistry(registry);
    expect(a).toEqual(b);
    const paths = a.problems.map((p) => p.path);
    expect(paths).toEqual([...paths].sort((x, y) => x.localeCompare(y)));
  });
});
