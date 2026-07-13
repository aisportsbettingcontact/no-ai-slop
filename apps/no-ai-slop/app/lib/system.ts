import 'server-only';
import {
  ArchitectureRules,
  ObservedDependencyGraph,
  validateDesignSystemRegistry,
  type ArchitectureReport,
  type DesignSystemRegistry,
  type RegistryValidation,
} from '@nas/contracts';
import { checkArchitecture } from '@nas/anti-slop';
import { designSystemRegistry } from '@nas/ui';
import layerRulesJson from '../../../../docs/architecture/layer-rules.json';
import observedDependenciesJson from '../../../../docs/architecture/observed-dependencies.json';

/**
 * The System view's data path is REAL: the registry ships inside @nas/ui, the
 * architecture rules and the scanned dependency graph are the committed,
 * freshness-tested artifacts, and both validations run live on every render —
 * if the registry breaks referential integrity or an illegal dependency edge
 * lands, this page shows the failure instead of a success badge.
 */
export interface SystemView {
  registry: DesignSystemRegistry;
  validation: RegistryValidation;
  rules: ArchitectureRules;
  architecture: ArchitectureReport;
}

let cached: SystemView | null = null;

export function getSystemView(): SystemView {
  if (cached) return cached;
  const rules = ArchitectureRules.parse(layerRulesJson);
  const graph = ObservedDependencyGraph.parse(observedDependenciesJson);
  cached = {
    registry: designSystemRegistry,
    validation: validateDesignSystemRegistry(designSystemRegistry),
    rules,
    architecture: checkArchitecture(rules, graph),
  };
  return cached;
}
