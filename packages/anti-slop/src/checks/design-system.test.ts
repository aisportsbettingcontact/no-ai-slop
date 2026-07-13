import { describe, expect, it } from 'vitest';
import {
  SystemFinding,
  type DesignSystemRegistry,
  type DesignSystemScanFacts,
} from '@nas/contracts';
import { checkDesignSystem } from './design-system.js';

const NOW = '2026-07-13T12:00:00.000Z';
const FUTURE = '2027-01-01T00:00:00.000Z';
const PAST = '2026-01-01T00:00:00.000Z';

function registry(overrides: Partial<DesignSystemRegistry> = {}): DesignSystemRegistry {
  return {
    schemaVersion: 1,
    name: 'Fixture System',
    version: '1.0.0',
    principles: [
      {
        id: 'principle.clarity',
        name: 'Clarity',
        statement: 'One question per screen.',
        rationale: 'Focus.',
      },
    ],
    owners: [{ id: 'owner.ds', name: 'DS', responsibility: 'Owns the system.' }],
    tokens: [
      {
        id: 'color.accent',
        tier: 'semantic',
        category: 'color',
        description: 'Accent.',
        value: '#0a7c6d',
        cssVariable: '--nas-accent',
      },
    ],
    components: [
      {
        id: 'component.button',
        name: 'Button',
        atomicLevel: 'atom',
        category: 'input',
        purpose: 'Trigger an action.',
        sourcePath: 'packages/ui/src/components/primitives.tsx',
        composedOf: [],
        variants: [],
        props: [],
        states: [
          { state: 'focus_visible', behavior: 'Focus ring.' },
          { state: 'disabled', behavior: 'Dimmed.' },
        ],
        usesTokens: ['color.accent'],
        followsPrinciples: ['principle.clarity'],
        accessibility: [],
        responsiveBehavior: 'Fixed height.',
        prohibitedUses: [],
        requiredEvidence: [],
        ownerId: 'owner.ds',
        version: '1.0.0',
        status: 'stable',
        tests: [],
      },
    ],
    patterns: [],
    accessibilityRules: [],
    exceptions: [],
    ...overrides,
  };
}

const cleanScan: DesignSystemScanFacts = {
  rawValues: [],
  exportedComponents: ['Button'],
  missingRegistryPaths: [],
};

describe('checkDesignSystem', () => {
  it('returns zero findings for a coherent system and clean scan', () => {
    expect(checkDesignSystem(registry(), cleanScan, NOW)).toEqual([]);
  });

  it('flags a raw value in a governed path as a serious design_consistency finding', () => {
    const findings = checkDesignSystem(
      registry(),
      {
        ...cleanScan,
        rawValues: [{ path: 'packages/ui/src/base.css', line: 42, value: '#ff0000' }],
      },
      NOW,
    );
    expect(findings).toHaveLength(1);
    const finding = SystemFinding.parse(findings[0]);
    expect(finding).toMatchObject({
      code: 'DS_RAW_VALUE',
      severity: 'serious',
      dimension: 'design_consistency',
      location: { path: 'packages/ui/src/base.css', line: 42 },
    });
  });

  it('suppresses a raw value covered by an ACTIVE exception, exactly scoped', () => {
    const withException = registry({
      exceptions: [
        {
          id: 'exception.breakpoint',
          scope: 'packages/ui/src/base.css::1023px',
          rationale: 'Media queries cannot read custom properties.',
          ownerId: 'owner.ds',
          expiresAt: FUTURE,
          remediation: 'Use custom media when supported.',
        },
      ],
    });
    const scan: DesignSystemScanFacts = {
      ...cleanScan,
      rawValues: [
        { path: 'packages/ui/src/base.css', line: 300, value: '1023px' },
        { path: 'packages/ui/src/base.css', line: 301, value: '17px' },
      ],
    };
    const findings = checkDesignSystem(withException, scan, NOW);
    // The excepted value is suppressed; the unexcepted one still blocks.
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ code: 'DS_RAW_VALUE', location: { line: 301 } });
  });

  it('an EXPIRED exception suppresses nothing and is itself a finding', () => {
    const withExpired = registry({
      exceptions: [
        {
          id: 'exception.stale',
          scope: 'packages/ui/src/base.css::1023px',
          rationale: 'Was temporary.',
          ownerId: 'owner.ds',
          expiresAt: PAST,
          remediation: 'Replace with tokens.',
        },
      ],
    });
    const findings = checkDesignSystem(
      withExpired,
      {
        ...cleanScan,
        rawValues: [{ path: 'packages/ui/src/base.css', line: 300, value: '1023px' }],
      },
      NOW,
    );
    const codes = findings.map((f) => f.code).sort();
    expect(codes).toEqual(['DS_EXCEPTION_EXPIRED', 'DS_RAW_VALUE']);
  });

  it('flags a registry entry whose sourcePath or tests point at no real file', () => {
    const findings = checkDesignSystem(
      registry(),
      {
        ...cleanScan,
        missingRegistryPaths: [
          { componentId: 'component.button', path: 'packages/ui/src/ghost.test.tsx' },
        ],
      },
      NOW,
    );
    expect(findings).toEqual([
      expect.objectContaining({
        code: 'DS_BROKEN_REFERENCE',
        severity: 'serious',
        rationale: expect.stringContaining('packages/ui/src/ghost.test.tsx'),
      }),
    ]);
  });

  it('flags an exported component with no registry entry', () => {
    const findings = checkDesignSystem(
      registry(),
      { ...cleanScan, exportedComponents: ['Button', 'MysteryWidget'] },
      NOW,
    );
    expect(findings).toEqual([
      expect.objectContaining({ code: 'DS_UNREGISTERED_COMPONENT', severity: 'serious' }),
    ]);
  });

  it('maps registry integrity problems to DS_BROKEN_REFERENCE findings', () => {
    const broken = registry();
    broken.components[0]!.usesTokens.push('color.ghost');
    const findings = checkDesignSystem(broken, cleanScan, NOW);
    expect(findings).toEqual([
      expect.objectContaining({ code: 'DS_BROKEN_REFERENCE', dimension: 'maintainability' }),
    ]);
  });

  it('maps duplicate registry entries to DS_DUPLICATE_COMPONENT findings', () => {
    const duplicated = registry();
    duplicated.components.push(duplicated.components[0]!);
    const findings = checkDesignSystem(duplicated, cleanScan, NOW);
    expect(findings.some((f) => f.code === 'DS_DUPLICATE_COMPONENT')).toBe(true);
  });

  it('flags an interactive component without a documented focus state', () => {
    const undocumented = registry();
    undocumented.components[0]!.states = [{ state: 'default', behavior: 'Rests.' }];
    const findings = checkDesignSystem(undocumented, cleanScan, NOW);
    expect(findings).toEqual([
      expect.objectContaining({ code: 'DS_UNDOCUMENTED_STATE', dimension: 'interaction_quality' }),
    ]);
  });

  it('is deterministic and sorted by location', () => {
    const scan: DesignSystemScanFacts = {
      exportedComponents: ['Button', 'ZWidget', 'AWidget'],
      rawValues: [
        { path: 'z.css', line: 1, value: '#fff' },
        { path: 'a.css', line: 9, value: '#000' },
        { path: 'a.css', line: 2, value: '#111' },
      ],
      missingRegistryPaths: [],
    };
    const a = checkDesignSystem(registry(), scan, NOW);
    const b = checkDesignSystem(registry(), scan, NOW);
    expect(a).toEqual(b);
    expect(a.map((f) => `${f.location.path}:${f.location.line ?? 0}`)).toEqual([
      'a.css:2',
      'a.css:9',
      'packages/ui/src/index.ts:0',
      'packages/ui/src/index.ts:0',
      'z.css:1',
    ]);
  });
});
