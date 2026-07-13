import { describe, expect, it } from 'vitest';
import {
  SystemFinding,
  type ArchitectureRules,
  type ObservedDependencyGraph,
} from '@nas/contracts';
import { architectureFindings, checkArchitecture } from './architecture.js';

function rules(overrides: Partial<ArchitectureRules> = {}): ArchitectureRules {
  return {
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
        dimensionsOnChange: ['maintainability'],
        evidenceOnChange: ['test'],
      },
      {
        id: 'mod.kernel',
        layerId: 'layer.kernels',
        path: 'packages/kernel',
        purpose: 'Kernel.',
        dimensionsOnChange: ['architecture_depth'],
        evidenceOnChange: ['test'],
      },
      {
        id: 'mod.app',
        layerId: 'layer.interface',
        path: 'apps/app',
        purpose: 'App.',
        dimensionsOnChange: ['product_correctness'],
        evidenceOnChange: ['browser_run'],
      },
    ],
    allowedExceptions: [],
    ...overrides,
  };
}

function graph(
  dependencies: { from: string; to: string }[],
  moduleFiles: Record<string, string[]> = {},
): ObservedDependencyGraph {
  return {
    schemaVersion: 1,
    generatedBy: 'test-fixture',
    moduleFiles,
    dependencies,
  };
}

describe('checkArchitecture', () => {
  it('accepts a strictly-downward graph', () => {
    const report = checkArchitecture(
      rules(),
      graph([
        { from: 'mod.kernel', to: 'mod.contracts' },
        { from: 'mod.app', to: 'mod.contracts' },
        { from: 'mod.app', to: 'mod.kernel' },
      ]),
    );
    expect(report.violations).toEqual([]);
    expect(report.valid).toBe(true);
    expect(report.checkedEdges).toBe(3);
    expect(report.exceptionsApplied).toEqual([]);
  });

  it('fails an upward edge (intentional forbidden fixture)', () => {
    const report = checkArchitecture(rules(), graph([{ from: 'mod.contracts', to: 'mod.app' }]));
    expect(report.valid).toBe(false);
    expect(report.violations).toContainEqual(
      expect.objectContaining({
        code: 'ARCH_FORBIDDEN_EDGE',
        from: 'mod.contracts',
        to: 'mod.app',
      }),
    );
  });

  it('fails a same-layer edge unless it is an explicit, justified exception', () => {
    const sameLayerRules = rules({
      modules: [
        ...rules().modules,
        {
          id: 'mod.kernel2',
          layerId: 'layer.kernels',
          path: 'packages/kernel2',
          purpose: 'Second kernel.',
          dimensionsOnChange: ['architecture_depth'],
          evidenceOnChange: ['test'],
        },
      ],
    });
    const edge = [{ from: 'mod.kernel2', to: 'mod.kernel' }];

    const denied = checkArchitecture(sameLayerRules, graph(edge));
    expect(denied.valid).toBe(false);
    expect(denied.violations[0]?.code).toBe('ARCH_FORBIDDEN_EDGE');

    const excepted = checkArchitecture(
      {
        ...sameLayerRules,
        allowedExceptions: [
          { from: 'mod.kernel2', to: 'mod.kernel', rationale: 'Receipts are sealed as evidence.' },
        ],
      },
      graph(edge),
    );
    expect(excepted.valid).toBe(true);
    expect(excepted.exceptionsApplied).toHaveLength(1);
  });

  it('reports a cycle even when every edge in it is individually excepted', () => {
    const cyclic = rules({
      allowedExceptions: [
        { from: 'mod.contracts', to: 'mod.kernel', rationale: 'Contrived for the fixture.' },
      ],
    });
    const report = checkArchitecture(
      cyclic,
      graph([
        { from: 'mod.kernel', to: 'mod.contracts' },
        { from: 'mod.contracts', to: 'mod.kernel' },
      ]),
    );
    expect(report.valid).toBe(false);
    expect(report.violations.some((v) => v.code === 'ARCH_CYCLE')).toBe(true);
  });

  it('reports unknown modules in edges and in scanned files', () => {
    const report = checkArchitecture(
      rules(),
      graph([{ from: 'mod.ghost', to: 'mod.contracts' }], {
        'mod.phantom': ['packages/phantom/src/index.ts'],
      }),
    );
    expect(report.valid).toBe(false);
    const codes = report.violations.map((v) => v.code);
    expect(codes.filter((c) => c === 'ARCH_UNKNOWN_MODULE')).toHaveLength(2);
  });

  it('reports a module assigned to an undeclared layer', () => {
    const broken = rules();
    broken.modules[0]!.layerId = 'layer.ghost';
    const report = checkArchitecture(broken, graph([]));
    expect(report.violations.some((v) => v.code === 'ARCH_MISSING_LAYER')).toBe(true);
    expect(report.valid).toBe(false);
  });

  it('is deterministic regardless of input edge order', () => {
    const edges = [
      { from: 'mod.contracts', to: 'mod.app' },
      { from: 'mod.contracts', to: 'mod.kernel' },
      { from: 'mod.kernel', to: 'mod.app' },
    ];
    const a = checkArchitecture(rules(), graph(edges));
    const b = checkArchitecture(rules(), graph([...edges].reverse()));
    expect(a.violations).toEqual(b.violations);
  });
});

describe('architectureFindings', () => {
  it('maps violations to schema-valid findings graded into architecture_depth', () => {
    const report = checkArchitecture(rules(), graph([{ from: 'mod.contracts', to: 'mod.app' }]));
    const findings = architectureFindings(report, rules(), 'docs/architecture/layer-rules.json');
    expect(findings).toHaveLength(1);
    const finding = SystemFinding.parse(findings[0]);
    expect(finding.code).toBe('ARCH_FORBIDDEN_EDGE');
    expect(finding.severity).toBe('critical');
    expect(finding.dimension).toBe('architecture_depth');
    expect(finding.location.path).toBe('packages/contracts');
    expect(finding.remediation.length).toBeGreaterThan(0);
  });
});
