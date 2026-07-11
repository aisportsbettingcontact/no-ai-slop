import { z } from 'zod';
import { Actor } from './actor.js';
import { EvidenceId, Timestamp } from './ids.js';

/**
 * Anti-Slop Review (contract layer).
 *
 * Every material change is graded across thirteen fixed dimensions. There is no
 * single aggregate "slop score" — that would hide individual weaknesses. Instead
 * the gate reports exactly which dimensions block acceptance. The engine lives in
 * @nas/anti-slop.
 */

export const AntiSlopDimension = z.enum([
  'product_correctness',
  'design_originality',
  'design_consistency',
  'interaction_quality',
  'responsive_quality',
  'accessibility',
  'code_clarity',
  'architecture_depth',
  'test_depth',
  'evidence_completeness',
  'security_impact',
  'operational_impact',
  'maintainability',
]);
export type AntiSlopDimension = z.infer<typeof AntiSlopDimension>;

export const ALL_DIMENSIONS: readonly AntiSlopDimension[] = AntiSlopDimension.options;

export const Grade = z.enum(['pass', 'pass_with_concern', 'fail', 'not_tested']);
export type Grade = z.infer<typeof Grade>;

/** The kinds of change a review can apply to. Drives which dimensions are required. */
export const ChangeType = z.enum([
  'product_feature',
  'bug_fix',
  'refactor',
  'design_change',
  'performance',
  'accessibility',
  'security',
  'test',
  'docs',
  'infra',
]);
export type ChangeType = z.infer<typeof ChangeType>;

export const DimensionGrade = z.object({
  dimension: AntiSlopDimension,
  grade: Grade,
  /** Why this grade. A `fail` or `pass_with_concern` must explain the specific defect. */
  rationale: z.string().min(1).max(1000),
  /** Evidence backing the grade. A graded-but-unevidenced dimension is itself slop. */
  evidenceIds: z.array(EvidenceId).default([]),
});
export type DimensionGrade = z.infer<typeof DimensionGrade>;

/**
 * An authorized exception permitting a specific `fail` to not block acceptance.
 * Exceptions are attributable and time-bound — never a silent override.
 */
export const AntiSlopException = z.object({
  dimension: AntiSlopDimension,
  approvedBy: Actor,
  reason: z.string().min(1).max(1000),
  expiresAt: Timestamp,
});
export type AntiSlopException = z.infer<typeof AntiSlopException>;

export const AntiSlopReview = z.object({
  changeType: ChangeType,
  /** What is being reviewed: a task id, PR ref, or change description. */
  subject: z.string().min(1).max(300),
  reviewer: Actor,
  createdAt: Timestamp,
  grades: z.array(DimensionGrade).min(1),
  exceptions: z.array(AntiSlopException).default([]),
});
export type AntiSlopReview = z.infer<typeof AntiSlopReview>;

/** Why a single dimension blocks acceptance. */
export const BlockingDimension = z.object({
  dimension: AntiSlopDimension,
  grade: Grade,
  reason: z.string().min(1),
});
export type BlockingDimension = z.infer<typeof BlockingDimension>;

/**
 * The gate outcome. `accepted` is true only when no required dimension is missing,
 * `not_tested`, or `fail` (without a valid exception). We surface every blocking
 * dimension and every documented concern separately.
 */
export const AntiSlopGateResult = z.object({
  accepted: z.boolean(),
  changeType: ChangeType,
  requiredDimensions: z.array(AntiSlopDimension),
  blocking: z.array(BlockingDimension),
  concerns: z.array(
    z.object({ dimension: AntiSlopDimension, rationale: z.string() }),
  ),
  exceptionsApplied: z.array(AntiSlopDimension),
  summary: z.string().min(1),
});
export type AntiSlopGateResult = z.infer<typeof AntiSlopGateResult>;
