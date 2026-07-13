import { describe, expect, it } from 'vitest';
import type { ArchitectureRules, ObservedDependencyGraph } from '@nas/contracts';
import { computeImpact } from './impact.js';

const rules: ArchitectureRules = {
  schemaVersion: 1,
  layers: [
    { id: 'layer.contracts', name: 'Contracts', description: 'Schemas.', order: 0 },
    { id: 'layer.kernels', name: 'Kernels', description: 'Kernels.', order: 1 },
    { id: 'layer.interface', name: 'Interface', description: 'CLI + app.', order: 2 },
  ],
  modules: [
    {
      id: 'mod.contracts',
      layerId: 'layer.contracts',
      path: 'packages/contracts',
      purpose: 'Schemas.',
      dimensionsOnChange: ['maintainability', 'code_clarity'],
      evidenceOnChange: ['test'],
    },
    {
      id: 'mod.kernel',
      layerId: 'layer.kernels',
      path: 'packages/kernel',
      purpose: 'Kernel.',
      dimensionsOnChange: ['architecture_depth', 'security_impact'],
      evidenceOnChange: ['test', 'command'],
    },
    {
      id: 'mod.app',
      layerId: 'layer.interface',
      path: 'apps/app',
      purpose: 'App.',
      dimensionsOnChange: ['product_correctness', 'accessibility'],
      evidenceOnChange: ['browser_run', 'accessibility_result'],
    },
  ],
  allowedExceptions: [],
};

const graph: ObservedDependencyGraph = {
  schemaVersion: 1,
  generatedBy: 'test-fixture',
  moduleFiles: {
    'mod.contracts': ['packages/contracts/src/index.ts'],
    'mod.kernel': ['packages/kernel/src/log.ts'],
    'mod.app': ['apps/app/page.tsx'],
  },
  dependencies: [
    { from: 'mod.kernel', to: 'mod.contracts' },
    { from: 'mod.app', to: 'mod.contracts' },
    { from: 'mod.app', to: 'mod.kernel' },
  ],
};

describe('computeImpact', () => {
  it('propagates a foundational change to every transitive dependent', () => {
    const report = computeImpact(rules, graph, ['packages/contracts/src/index.ts']);
    expect(report.changedModules).toEqual(['mod.contracts']);
    expect(report.impactedModules).toEqual(['mod.app', 'mod.kernel']);
    // Union of dimensions from changed + impacted modules, in canonical order.
    expect(report.impactedDimensions).toEqual([
      'product_correctness',
      'accessibility',
      'code_clarity',
      'architecture_depth',
      'security_impact',
      'maintainability',
    ]);
    expect(report.requiredEvidence).toEqual([
      'command',
      'test',
      'browser_run',
      'accessibility_result',
    ]);
  });

  it('keeps a leaf change local: nothing depends on the app', () => {
    const report = computeImpact(rules, graph, ['apps/app/page.tsx']);
    expect(report.changedModules).toEqual(['mod.app']);
    expect(report.impactedModules).toEqual([]);
    expect(report.impactedDimensions).toEqual(['product_correctness', 'accessibility']);
  });

  it('maps a new file by module-path prefix when the scan has not seen it', () => {
    const report = computeImpact(rules, graph, ['packages/kernel/src/brand-new.ts']);
    expect(report.changedModules).toEqual(['mod.kernel']);
    expect(report.unmappedFiles).toEqual([]);
  });

  it('surfaces unmapped files instead of dropping them', () => {
    const report = computeImpact(rules, graph, ['README.md', 'apps/app/page.tsx']);
    expect(report.unmappedFiles).toEqual(['README.md']);
    expect(report.changedModules).toEqual(['mod.app']);
  });

  it('is deterministic regardless of input order', () => {
    const files = ['apps/app/page.tsx', 'packages/contracts/src/index.ts', 'README.md'];
    const a = computeImpact(rules, graph, files);
    const b = computeImpact(rules, graph, [...files].reverse());
    expect(a).toEqual(b);
    expect(a.changedFiles).toEqual([...a.changedFiles].sort());
  });

  it('handles the empty change set without inventing impact', () => {
    const report = computeImpact(rules, graph, []);
    expect(report.changedModules).toEqual([]);
    expect(report.impactedModules).toEqual([]);
    expect(report.impactedDimensions).toEqual([]);
    expect(report.requiredEvidence).toEqual([]);
  });
});
