import type {
  ArchitectureReport,
  ArchitectureRules,
  ArchitectureViolation,
  DependencyException,
  ObservedDependencyGraph,
  SystemFinding,
} from '@nas/contracts';

/**
 * Architecture check: pure function over declared rules and the observed
 * dependency graph. No filesystem access here — the scanner
 * (scripts/check-architecture.mjs) collects facts; this decides.
 *
 * The rule: an edge from → to is legal only when to's layer order is strictly
 * lower than from's, or the exact edge is an explicit, justified exception.
 * Cycles are always violations. Unknown modules are violations, not warnings —
 * an unmapped module is an ungoverned module.
 */
export function checkArchitecture(
  rules: ArchitectureRules,
  graph: ObservedDependencyGraph,
): ArchitectureReport {
  const violations: ArchitectureViolation[] = [];
  const exceptionsApplied: DependencyException[] = [];

  const layerOrder = new Map(rules.layers.map((layer) => [layer.id, layer.order]));
  const moduleLayer = new Map(rules.modules.map((module) => [module.id, module.layerId]));

  for (const module of rules.modules) {
    if (!layerOrder.has(module.layerId)) {
      violations.push({
        code: 'ARCH_MISSING_LAYER',
        message: `module "${module.id}" is assigned to undeclared layer "${module.layerId}"`,
        from: module.id,
      });
    }
  }

  for (const scanned of Object.keys(graph.moduleFiles)) {
    if (!moduleLayer.has(scanned)) {
      violations.push({
        code: 'ARCH_UNKNOWN_MODULE',
        message: `scanned module "${scanned}" is not declared in the architecture rules`,
        from: scanned,
      });
    }
  }

  const exceptionKey = (from: string, to: string) => `${from} -> ${to}`;
  const exceptions = new Map(
    rules.allowedExceptions.map((exception) => [
      exceptionKey(exception.from, exception.to),
      exception,
    ]),
  );

  for (const edge of graph.dependencies) {
    const fromLayer = moduleLayer.get(edge.from);
    const toLayer = moduleLayer.get(edge.to);
    if (fromLayer === undefined || toLayer === undefined) {
      for (const [moduleId, layer] of [
        [edge.from, fromLayer],
        [edge.to, toLayer],
      ] as const) {
        if (layer === undefined) {
          violations.push({
            code: 'ARCH_UNKNOWN_MODULE',
            message: `dependency edge references undeclared module "${moduleId}" (${edge.from} → ${edge.to})`,
            from: edge.from,
            to: edge.to,
          });
        }
      }
      continue;
    }
    const fromOrder = layerOrder.get(fromLayer);
    const toOrder = layerOrder.get(toLayer);
    if (fromOrder === undefined || toOrder === undefined) continue; // ARCH_MISSING_LAYER already recorded
    if (toOrder < fromOrder) continue; // strictly downward: legal
    const exception = exceptions.get(exceptionKey(edge.from, edge.to));
    if (exception) {
      exceptionsApplied.push(exception);
    } else {
      violations.push({
        code: 'ARCH_FORBIDDEN_EDGE',
        message:
          `"${edge.from}" (${fromLayer}, order ${fromOrder}) must not depend on ` +
          `"${edge.to}" (${toLayer}, order ${toOrder}) — dependencies point strictly downward`,
        from: edge.from,
        to: edge.to,
      });
    }
  }

  for (const cycle of findCycles(graph.dependencies)) {
    violations.push({
      code: 'ARCH_CYCLE',
      message: `dependency cycle: ${cycle.join(' → ')}`,
      from: cycle[0]!,
      to: cycle[cycle.length - 2] ?? cycle[0]!,
    });
  }

  violations.sort(
    (a, b) =>
      a.code.localeCompare(b.code) ||
      (a.from ?? '').localeCompare(b.from ?? '') ||
      (a.to ?? '').localeCompare(b.to ?? ''),
  );
  exceptionsApplied.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

  return {
    valid: violations.length === 0,
    checkedModules: rules.modules.length,
    checkedEdges: graph.dependencies.length,
    violations,
    exceptionsApplied,
  };
}

/** Deterministic cycle detection (DFS from lexicographically sorted nodes). */
function findCycles(edges: readonly { from: string; to: string }[]): string[][] {
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const targets = adjacency.get(edge.from) ?? [];
    targets.push(edge.to);
    adjacency.set(edge.from, targets);
  }
  for (const targets of adjacency.values()) targets.sort();

  const cycles: string[][] = [];
  const done = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  const visit = (node: string): void => {
    if (done.has(node)) return;
    stack.push(node);
    onStack.add(node);
    for (const next of adjacency.get(node) ?? []) {
      if (onStack.has(next)) {
        cycles.push([...stack.slice(stack.indexOf(next)), next]);
      } else if (!done.has(next)) {
        visit(next);
      }
    }
    stack.pop();
    onStack.delete(node);
    done.add(node);
  };

  for (const node of [...adjacency.keys()].sort()) visit(node);
  return cycles;
}

/** Translate architecture violations into structured system findings. */
export function architectureFindings(
  report: ArchitectureReport,
  rules: ArchitectureRules,
  rulesPath: string,
): SystemFinding[] {
  const modulePath = new Map(rules.modules.map((module) => [module.id, module.path]));
  return report.violations.map((violation) => ({
    code: violation.code,
    severity: violation.code === 'ARCH_UNKNOWN_MODULE' ? 'serious' : 'critical',
    dimension: 'architecture_depth',
    location: {
      path:
        (violation.from !== undefined ? modulePath.get(violation.from) : undefined) ?? rulesPath,
    },
    rationale: violation.message,
    remediation:
      violation.code === 'ARCH_FORBIDDEN_EDGE'
        ? 'Invert the dependency (move the shared contract downward) or record a justified exception in the layer rules through governance review.'
        : violation.code === 'ARCH_CYCLE'
          ? 'Break the cycle by extracting the shared capability into a lower layer.'
          : 'Declare the module and its layer in docs/architecture/layer-rules.json.',
    evidenceIds: [],
  }));
}
