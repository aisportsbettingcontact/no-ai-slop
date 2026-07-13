import {
  ALL_DIMENSIONS,
  EvidenceKind,
  type AntiSlopDimension,
  type ArchitectureRules,
  type ImpactReport,
  type ObservedDependencyGraph,
} from '@nas/contracts';

/**
 * Deterministic change impact: changed files → owning modules → every module
 * that transitively depends on them → the anti-slop dimensions and evidence
 * kinds the change must therefore satisfy (declared per module in the layer
 * rules). Same inputs always produce the identical report — outputs are sorted,
 * unmapped files are surfaced rather than dropped, and nothing reads ambient
 * state.
 */
export function computeImpact(
  rules: ArchitectureRules,
  graph: ObservedDependencyGraph,
  changedFiles: readonly string[],
): ImpactReport {
  const fileToModule = new Map<string, string>();
  for (const [moduleId, files] of Object.entries(graph.moduleFiles)) {
    for (const file of files) fileToModule.set(file, moduleId);
  }
  // Fallback: longest declared module path prefix (new files not yet in the scan).
  const byPathLength = [...rules.modules].sort((a, b) => b.path.length - a.path.length);
  const moduleForFile = (file: string): string | undefined =>
    fileToModule.get(file) ?? byPathLength.find((m) => file.startsWith(`${m.path}/`))?.id;

  const changedModules = new Set<string>();
  const unmappedFiles: string[] = [];
  for (const file of changedFiles) {
    const moduleId = moduleForFile(file);
    if (moduleId === undefined) {
      unmappedFiles.push(file);
    } else {
      changedModules.add(moduleId);
    }
  }

  // dependents[X] = modules that depend on X (reverse edges).
  const dependents = new Map<string, string[]>();
  for (const edge of graph.dependencies) {
    const list = dependents.get(edge.to) ?? [];
    list.push(edge.from);
    dependents.set(edge.to, list);
  }

  const impacted = new Set<string>();
  const queue = [...changedModules];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dependent of dependents.get(current) ?? []) {
      if (!changedModules.has(dependent) && !impacted.has(dependent)) {
        impacted.add(dependent);
        queue.push(dependent);
      }
    }
  }

  const moduleById = new Map(rules.modules.map((module) => [module.id, module]));
  const dimensions = new Set<AntiSlopDimension>();
  const evidence = new Set<EvidenceKind>();
  for (const moduleId of [...changedModules, ...impacted]) {
    const module = moduleById.get(moduleId);
    if (!module) continue; // unknown module: the architecture check reports it
    for (const dimension of module.dimensionsOnChange) dimensions.add(dimension);
    for (const kind of module.evidenceOnChange) evidence.add(kind);
  }

  return {
    schemaVersion: 1,
    changedFiles: [...changedFiles].sort(),
    unmappedFiles: unmappedFiles.sort(),
    changedModules: [...changedModules].sort(),
    impactedModules: [...impacted].sort(),
    impactedDimensions: ALL_DIMENSIONS.filter((d) => dimensions.has(d)),
    requiredEvidence: EvidenceKind.options.filter((k) => evidence.has(k)),
  };
}
