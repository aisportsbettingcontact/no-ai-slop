import { z } from 'zod';
import { AntiSlopDimension } from './anti-slop.js';
import { Severity, SourceLocation } from './findings.js';
import { EvidenceId } from './ids.js';
import { InterfacePatternId } from './interface-patterns.js';

/**
 * System findings: structured violations of the machine-readable product system
 * (design-system registry rules, raw-value discipline, architecture rules).
 *
 * Every finding has a stable code, a severity, an exact location, a rationale,
 * a remediation, and the anti-slop dimension it grades into. There is no
 * aggregate score — findings feed dimension-level grades and the existing gate.
 */

export const SystemFindingCode = z.enum([
  // Design-system findings
  'DS_RAW_VALUE',
  'DS_BROKEN_REFERENCE',
  'DS_DUPLICATE_COMPONENT',
  'DS_UNREGISTERED_COMPONENT',
  'DS_UNDOCUMENTED_STATE',
  'DS_EXCEPTION_EXPIRED',
  'DS_STALE_ARTIFACT',
  // A hit on the interface anti-pattern catalog (carries patternId).
  'DS_INTERFACE_PATTERN',
  // Architecture findings
  'ARCH_FORBIDDEN_EDGE',
  'ARCH_CYCLE',
  'ARCH_UNKNOWN_MODULE',
  'ARCH_MISSING_LAYER',
]);
export type SystemFindingCode = z.infer<typeof SystemFindingCode>;

export const SystemFinding = z.object({
  code: SystemFindingCode,
  severity: Severity,
  /** The anti-slop dimension this finding grades into. */
  dimension: AntiSlopDimension,
  location: SourceLocation,
  rationale: z.string().min(1).max(1000),
  remediation: z.string().min(1).max(1000),
  /** Set when code is DS_INTERFACE_PATTERN: the catalog pattern that was hit. */
  patternId: InterfacePatternId.optional(),
  evidenceIds: z.array(EvidenceId).default([]),
});
export type SystemFinding = z.infer<typeof SystemFinding>;

/** One raw visual value found in a governed source path by the scanner. */
export const RawValueOccurrence = z.object({
  path: z.string().min(1).max(300),
  line: z.number().int().positive(),
  /** The literal offending value, e.g. `#ff0000`, `17px`, `rgba(0,0,0,.5)`. */
  value: z.string().min(1).max(300),
});
export type RawValueOccurrence = z.infer<typeof RawValueOccurrence>;

/** A registry-declared file path that does not exist on disk. */
export const MissingRegistryPath = z.object({
  componentId: z.string().min(1),
  path: z.string().min(1).max(300),
});
export type MissingRegistryPath = z.infer<typeof MissingRegistryPath>;

/**
 * Facts collected by the design-system scanner (scripts/check-design-system.mjs).
 * The checker in @nas/anti-slop is pure: facts in, findings out — so the same
 * check runs identically in scripts, tests, and the control plane.
 */
export const DesignSystemScanFacts = z.object({
  rawValues: z.array(RawValueOccurrence),
  /** Component names exported by @nas/ui (each must have a registry entry). */
  exportedComponents: z.array(z.string().min(1)),
  /** Registry sourcePath/tests entries that resolve to no real file. */
  missingRegistryPaths: z.array(MissingRegistryPath).default([]),
});
export type DesignSystemScanFacts = z.infer<typeof DesignSystemScanFacts>;
