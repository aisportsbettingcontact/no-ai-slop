import { describe, expect, it } from 'vitest';
import { ArchitectureRules, ObservedDependencyGraph, SystemFinding } from './index.js';

const validRules = {
  schemaVersion: 1,
  layers: [
    {
      id: 'layer.contracts',
      name: 'Contracts',
      description: 'Types and runtime schemas.',
      order: 0,
    },
    { id: 'layer.kernels', name: 'Kernels', description: 'Certification kernels.', order: 2 },
  ],
  modules: [
    {
      id: '@nas/contracts',
      layerId: 'layer.contracts',
      path: 'packages/contracts',
      purpose: 'Single source of truth for domain types.',
      dimensionsOnChange: ['code_clarity', 'maintainability'],
      evidenceOnChange: ['test'],
    },
  ],
  allowedExceptions: [
    {
      from: '@nas/kernel-authz',
      to: '@nas/kernel-evidence',
      rationale: 'Authorization receipts are sealed as evidence.',
    },
  ],
};

describe('ArchitectureRules schema', () => {
  it('accepts a well-formed rules document', () => {
    expect(ArchitectureRules.safeParse(validRules).success).toBe(true);
  });

  it('rejects malformed layer ids, missing dimension lists, and unknown schema versions', () => {
    expect(
      ArchitectureRules.safeParse({
        ...validRules,
        layers: [{ ...validRules.layers[0], id: 'Contracts' }],
      }).success,
    ).toBe(false);
    expect(
      ArchitectureRules.safeParse({
        ...validRules,
        modules: [{ ...validRules.modules[0], dimensionsOnChange: [] }],
      }).success,
    ).toBe(false);
    expect(ArchitectureRules.safeParse({ ...validRules, schemaVersion: 2 }).success).toBe(false);
  });

  it('requires a rationale on every allowed exception (no silent edges)', () => {
    expect(
      ArchitectureRules.safeParse({
        ...validRules,
        allowedExceptions: [{ from: 'a', to: 'b', rationale: '' }],
      }).success,
    ).toBe(false);
  });
});

describe('ObservedDependencyGraph schema', () => {
  it('accepts a scanned graph and rejects a hand-shaped one missing attribution', () => {
    const graph = {
      schemaVersion: 1,
      generatedBy: 'scripts/check-architecture.mjs',
      moduleFiles: { '@nas/contracts': ['packages/contracts/src/index.ts'] },
      dependencies: [{ from: '@nas/kernel-evidence', to: '@nas/contracts' }],
    };
    expect(ObservedDependencyGraph.safeParse(graph).success).toBe(true);
    expect(ObservedDependencyGraph.safeParse({ ...graph, generatedBy: '' }).success).toBe(false);
  });
});

describe('SystemFinding schema', () => {
  it('requires code, severity, dimension, location, rationale, and remediation', () => {
    const finding = {
      code: 'ARCH_FORBIDDEN_EDGE',
      severity: 'critical',
      dimension: 'architecture_depth',
      location: { path: 'packages/ui/src/index.ts' },
      rationale: '@nas/ui imports @nas/kernel-release, an upward dependency.',
      remediation: 'Move the shared type into @nas/contracts and import it from there.',
    };
    expect(SystemFinding.safeParse(finding).success).toBe(true);
    expect(SystemFinding.safeParse({ ...finding, code: 'MADE_UP_CODE' }).success).toBe(false);
    expect(SystemFinding.safeParse({ ...finding, remediation: '' }).success).toBe(false);
    expect(SystemFinding.parse(finding).evidenceIds).toEqual([]);
  });
});
