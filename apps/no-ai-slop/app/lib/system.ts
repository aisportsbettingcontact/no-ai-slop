import 'server-only';
import {
  ArchitectureRules,
  ObservedDependencyGraph,
  validateDesignSystemRegistry,
  validateInterfacePatternCatalog,
  type ArchitectureReport,
  type CatalogProblem,
  type DesignSystemRegistry,
  type InterfacePatternCatalog,
  type RegistryValidation,
} from '@nas/contracts';
import { checkArchitecture, INTERFACE_PATTERN_CATALOG } from '@nas/anti-slop';
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
  patternCatalog: InterfacePatternCatalog;
  catalogValidation: { valid: boolean; problems: CatalogProblem[] };
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
    patternCatalog: INTERFACE_PATTERN_CATALOG,
    catalogValidation: validateInterfacePatternCatalog(INTERFACE_PATTERN_CATALOG),
  };
  return cached;
}
