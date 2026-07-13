import { z } from 'zod';
import { AntiSlopDimension } from './anti-slop.js';
import { EvidenceKind } from './evidence.js';

/**
 * Architecture contracts: layers, permitted dependency direction, the observed
 * dependency graph, and deterministic change impact.
 *
 * The rule is controlled composition, translated from UI to software: modules
 * sit in ordered layers and may depend only on strictly lower layers. Any
 * same-or-upward edge must be an explicit, justified exception — never a habit.
 * Rules are data (docs/architecture/layer-rules.json); the observed graph is
 * scanned deterministically from the repository; the checker in @nas/anti-slop
 * is a pure function over both.
 */

export const LayerId = z.string().regex(/^layer\.[a-z0-9-]+$/, 'expected a layer.<name> id');
export type LayerId = z.infer<typeof LayerId>;

/** A module id: a workspace package name (`@nas/ui`) or an app id (`app.no-ai-slop`). */
export const ModuleId = z.string().min(1).max(200);
export type ModuleId = z.infer<typeof ModuleId>;

export const ArchitectureLayer = z.object({
  id: LayerId,
  name: z.string().min(1).max(100),
  description: z.string().min(1).max(500),
  /** Lower order = more foundational. Dependencies must point strictly downward. */
  order: z.number().int().nonnegative(),
});
export type ArchitectureLayer = z.infer<typeof ArchitectureLayer>;

export const ArchitectureModule = z.object({
  id: ModuleId,
  layerId: LayerId,
  /** Repo-relative root of the module's source. */
  path: z.string().min(1).max(300),
  purpose: z.string().min(1).max(300),
  /** Anti-slop dimensions a change to this module must (re)grade. */
  dimensionsOnChange: z.array(AntiSlopDimension).min(1),
  /** Evidence kinds a change to this module must produce. */
  evidenceOnChange: z.array(EvidenceKind).min(1),
});
export type ArchitectureModule = z.infer<typeof ArchitectureModule>;

/** An explicitly permitted edge that the strict downward rule would forbid. */
export const DependencyException = z.object({
  from: ModuleId,
  to: ModuleId,
  rationale: z.string().min(1).max(500),
});
export type DependencyException = z.infer<typeof DependencyException>;

export const ArchitectureRules = z.object({
  schemaVersion: z.literal(1),
  layers: z.array(ArchitectureLayer).min(1),
  modules: z.array(ArchitectureModule).min(1),
  allowedExceptions: z.array(DependencyException).default([]),
});
export type ArchitectureRules = z.infer<typeof ArchitectureRules>;

/* ── The observed graph (scanned, never hand-authored) ──────────────────────── */

export const ObservedDependency = z.object({
  from: ModuleId,
  to: ModuleId,
});
export type ObservedDependency = z.infer<typeof ObservedDependency>;

export const ObservedDependencyGraph = z.object({
  schemaVersion: z.literal(1),
  /** The scanner that produced this artifact, for attribution. */
  generatedBy: z.string().min(1).max(200),
  /** moduleId → sorted repo-relative source files, for file→module impact. */
  moduleFiles: z.record(z.string(), z.array(z.string().min(1))),
  /** Sorted, deduplicated module-level edges observed in manifests + imports. */
  dependencies: z.array(ObservedDependency),
});
export type ObservedDependencyGraph = z.infer<typeof ObservedDependencyGraph>;

/* ── Check results ──────────────────────────────────────────────────────────── */

export const ArchitectureViolationCode = z.enum([
  'ARCH_UNKNOWN_MODULE',
  'ARCH_MISSING_LAYER',
  'ARCH_FORBIDDEN_EDGE',
  'ARCH_CYCLE',
]);
export type ArchitectureViolationCode = z.infer<typeof ArchitectureViolationCode>;

export const ArchitectureViolation = z.object({
  code: ArchitectureViolationCode,
  message: z.string().min(1),
  from: ModuleId.optional(),
  to: ModuleId.optional(),
});
export type ArchitectureViolation = z.infer<typeof ArchitectureViolation>;

export const ArchitectureReport = z.object({
  valid: z.boolean(),
  checkedModules: z.number().int().nonnegative(),
  checkedEdges: z.number().int().nonnegative(),
  violations: z.array(ArchitectureViolation),
  /** Exceptions that were actually used to admit an edge — visible, not silent. */
  exceptionsApplied: z.array(DependencyException),
});
export type ArchitectureReport = z.infer<typeof ArchitectureReport>;

/* ── Change impact ──────────────────────────────────────────────────────────── */

/**
 * Deterministic impact of a set of changed files: the modules they belong to,
 * every module that transitively depends on those, and the anti-slop dimensions
 * and evidence kinds the change therefore must satisfy. Computed by a pure
 * function in @nas/anti-slop — no hidden state, same input → same report.
 */
export const ImpactReport = z.object({
  schemaVersion: z.literal(1),
  changedFiles: z.array(z.string().min(1)),
  /** Files that could not be mapped to any module (still listed, never dropped). */
  unmappedFiles: z.array(z.string().min(1)),
  changedModules: z.array(ModuleId),
  /** Modules transitively depending on a changed module (excluding changed ones). */
  impactedModules: z.array(ModuleId),
  impactedDimensions: z.array(AntiSlopDimension),
  requiredEvidence: z.array(EvidenceKind),
});
export type ImpactReport = z.infer<typeof ImpactReport>;
