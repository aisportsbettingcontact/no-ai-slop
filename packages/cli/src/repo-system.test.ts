import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  ArchitectureRules,
  DesignSystemRegistry,
  DesignSystemScanFacts,
  ObservedDependencyGraph,
} from '@nas/contracts';
import { canonicalJson, digestBytes } from '@nas/crypto';
import { checkArchitecture, checkDesignSystem, computeImpact } from '@nas/anti-slop';
import * as UI from '@nas/ui';
import { designSystemRegistry } from '@nas/ui';
// The scanners are plain fs modules, importable without built packages.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs script without type declarations; outputs are schema-validated below.
import { loadRules, scanGraph } from '../../../scripts/check-architecture.mjs';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — .mjs script without type declarations; outputs are schema-validated below.
import { exportedComponentNames, scanRawValues } from '../../../scripts/check-design-system.mjs';

/**
 * The system holds on the REAL repository. These tests scan the actual
 * workspace (no fixtures) and fail when: an architecture rule is violated, a
 * committed artifact goes stale, a governed path grows a raw visual value, or
 * the registry drifts from the code it describes.
 *
 * This suite lives in @nas/cli — the top of the package graph — so every
 * import here points strictly downward. (Its first home in @nas/anti-slop was
 * itself an ARCH_FORBIDDEN_EDGE, caught by this very check.)
 */

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
const rules = ArchitectureRules.parse(loadRules(repoRoot));
const graph = ObservedDependencyGraph.parse(scanGraph(repoRoot));

describe('architecture of this repository', () => {
  it('every observed dependency respects the layer rules', () => {
    const report = checkArchitecture(rules, graph);
    expect(report.violations).toEqual([]);
    expect(report.valid).toBe(true);
    expect(report.checkedModules).toBeGreaterThanOrEqual(9);
    expect(report.checkedEdges).toBeGreaterThan(0);
  });

  it('the two kernel same-layer edges are the only exceptions applied', () => {
    const report = checkArchitecture(rules, graph);
    expect(report.exceptionsApplied.map((e) => `${e.from} -> ${e.to}`)).toEqual([
      '@nas/kernel-authz -> @nas/kernel-evidence',
      '@nas/kernel-release -> @nas/kernel-evidence',
    ]);
  });

  it('docs/architecture/observed-dependencies.json is fresh (scan == committed)', () => {
    const committed: unknown = JSON.parse(
      readFileSync(`${repoRoot}docs/architecture/observed-dependencies.json`, 'utf8'),
    );
    expect(committed).toEqual(graph);
  });
});

describe('design system of this repository', () => {
  const scan = DesignSystemScanFacts.parse({
    rawValues: scanRawValues(repoRoot),
    exportedComponents: exportedComponentNames(UI),
  });

  it('has zero unexcepted raw values and zero system findings in governed paths', () => {
    const findings = checkDesignSystem(designSystemRegistry, scan, new Date().toISOString());
    expect(findings).toEqual([]);
  });

  it('docs/design-system/registry.json is fresh (digest matches the live registry)', () => {
    const committed = JSON.parse(
      readFileSync(`${repoRoot}docs/design-system/registry.json`, 'utf8'),
    ) as { digest: string; registry: unknown };
    const live = DesignSystemRegistry.parse(designSystemRegistry);
    expect(committed.digest).toBe(digestBytes(canonicalJson(live)));
    expect(committed.registry).toEqual(JSON.parse(JSON.stringify(live)));
  });
});

describe('impact analysis over the real graph', () => {
  it('a contracts change impacts every other module', () => {
    const report = computeImpact(rules, graph, ['packages/contracts/src/index.ts']);
    expect(report.changedModules).toEqual(['@nas/contracts']);
    expect(report.impactedModules).toEqual([
      '@nas/anti-slop',
      '@nas/app',
      '@nas/cli',
      '@nas/kernel-authz',
      '@nas/kernel-evidence',
      '@nas/kernel-release',
      '@nas/ui',
    ]);
  });

  it('an app-only change stays in the app', () => {
    const report = computeImpact(rules, graph, ['apps/no-ai-slop/app/page.tsx']);
    expect(report.changedModules).toEqual(['@nas/app']);
    expect(report.impactedModules).toEqual([]);
    expect(report.requiredEvidence).toEqual([
      'build',
      'browser_run',
      'screenshot',
      'accessibility_result',
    ]);
  });
});
