import {
  validateDesignSystemRegistry,
  type DesignSystemRegistry,
  type DesignSystemScanFacts,
  type SystemFinding,
} from '@nas/contracts';

const REGISTRY_PATH = 'packages/ui/src/registry.ts';

/**
 * Design-system check: pure function over the registry, scanner facts, and an
 * injected clock (time is never read ambiently). Emits structured findings:
 *
 *  - DS_BROKEN_REFERENCE / DS_DUPLICATE_COMPONENT — registry integrity problems
 *  - DS_RAW_VALUE — a raw visual value in a governed path with no valid exception
 *  - DS_EXCEPTION_EXPIRED — an exception past its expiry (exceptions are time-bound)
 *  - DS_UNREGISTERED_COMPONENT — an exported component the registry does not know
 *  - DS_UNDOCUMENTED_STATE — an interactive component without focus/disabled states
 *
 * No aggregate score: findings carry the dimension they grade into and the gate
 * decides per dimension.
 */
export function checkDesignSystem(
  registry: DesignSystemRegistry,
  scan: DesignSystemScanFacts,
  now: string,
): SystemFinding[] {
  const findings: SystemFinding[] = [];
  const nowMs = Date.parse(now);

  const integrity = validateDesignSystemRegistry(registry);
  for (const problem of integrity.problems) {
    const duplicate = problem.code === 'REG_DUPLICATE_ID' || problem.code === 'REG_DUPLICATE_NAME';
    findings.push({
      code: duplicate ? 'DS_DUPLICATE_COMPONENT' : 'DS_BROKEN_REFERENCE',
      severity: 'serious',
      dimension: 'maintainability',
      location: { path: REGISTRY_PATH },
      rationale: `${problem.code} at ${problem.path}: ${problem.message}`,
      remediation: duplicate
        ? 'Remove or merge the duplicate entry; if both are needed, give them distinct semantic identities.'
        : 'Fix the reference so every registry pointer resolves to a real entity.',
      evidenceIds: [],
    });
  }

  const activeExceptions = registry.exceptions.filter((e) => Date.parse(e.expiresAt) > nowMs);
  for (const exception of registry.exceptions) {
    if (Date.parse(exception.expiresAt) <= nowMs) {
      findings.push({
        code: 'DS_EXCEPTION_EXPIRED',
        severity: 'moderate',
        dimension: 'maintainability',
        location: { path: REGISTRY_PATH },
        rationale: `exception "${exception.id}" (${exception.scope}) expired at ${exception.expiresAt}`,
        remediation: `Complete its remediation ("${exception.remediation}") or renew it with a new expiry through governance review.`,
        evidenceIds: [],
      });
    }
  }

  for (const occurrence of scan.rawValues) {
    const excepted = activeExceptions.some(
      (exception) =>
        exception.scope === occurrence.path ||
        exception.scope === `${occurrence.path}::${occurrence.value}`,
    );
    if (excepted) continue;
    findings.push({
      code: 'DS_RAW_VALUE',
      severity: 'serious',
      dimension: 'design_consistency',
      location: { path: occurrence.path, line: occurrence.line },
      rationale: `raw visual value "${occurrence.value}" in a governed path — closed scales are a system invariant`,
      remediation:
        'Replace the literal with a semantic token (add one through governance if no role fits), or record an owned, expiring exception.',
      evidenceIds: [],
    });
  }

  const registeredNames = new Set(registry.components.map((component) => component.name));
  for (const exported of scan.exportedComponents) {
    if (!registeredNames.has(exported)) {
      findings.push({
        code: 'DS_UNREGISTERED_COMPONENT',
        severity: 'serious',
        dimension: 'maintainability',
        location: { path: 'packages/ui/src/index.ts' },
        rationale: `exported component "${exported}" has no registry entry — it is invisible to the system`,
        remediation:
          'Add a complete registry entry (level, states, tokens, owner, prohibited uses) or stop exporting it.',
        evidenceIds: [],
      });
    }
  }

  for (const component of registry.components) {
    const interactive = component.category === 'input' || component.category === 'navigation';
    if (!interactive) continue;
    const states = new Set(component.states.map((s) => s.state));
    if (!states.has('focus_visible')) {
      findings.push({
        code: 'DS_UNDOCUMENTED_STATE',
        severity: 'moderate',
        dimension: 'interaction_quality',
        location: { path: component.sourcePath },
        rationale: `interactive component "${component.id}" does not document a focus_visible state`,
        remediation:
          'Design and document the focus state; keyboard operators must see where they are.',
        evidenceIds: [],
      });
    }
  }

  findings.sort(
    (a, b) =>
      a.location.path.localeCompare(b.location.path) ||
      (a.location.line ?? 0) - (b.location.line ?? 0) ||
      a.code.localeCompare(b.code),
  );
  return findings;
}
