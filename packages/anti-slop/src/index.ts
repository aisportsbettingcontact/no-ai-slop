/**
 * @nas/anti-slop — the Anti-Slop review engine.
 *
 * Grades a change across thirteen fixed dimensions and reports exactly which ones
 * block acceptance. There is deliberately no single "slop score": hiding an
 * individual weakness behind an average is itself the failure this engine exists
 * to prevent.
 */
export { evaluateReview } from './engine.js';
export { REQUIRED_DIMENSIONS, requiredDimensionsFor } from './policy.js';
export { checkArchitecture, architectureFindings } from './checks/architecture.js';
export { checkDesignSystem } from './checks/design-system.js';
export { computeImpact } from './checks/impact.js';
export { gradesFromSystemFindings } from './checks/grades.js';
export {
  INTERFACE_PATTERN_CATALOG,
  interfacePattern,
  interfacePatternFinding,
} from './checks/interface-patterns.js';
