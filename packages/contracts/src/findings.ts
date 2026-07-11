import { z } from 'zod';
import { Actor } from './actor.js';
import { AntiSlopDimension } from './anti-slop.js';
import { EvidenceId, Timestamp } from './ids.js';

/**
 * A finding (contract layer). A finding is a defect that a reviewer must be able
 * to reproduce from its evidence. Findings are independently verified — the
 * verifier must differ from the reporter (no self-review).
 */

export const Severity = z.enum(['critical', 'serious', 'moderate', 'minor', 'info']);
export type Severity = z.infer<typeof Severity>;

export const Confidence = z.enum(['confirmed', 'high', 'medium', 'low']);
export type Confidence = z.infer<typeof Confidence>;

export const ReproductionStatus = z.enum([
  'reproduced',
  'not_reproduced',
  'intermittent',
  'not_attempted',
]);
export type ReproductionStatus = z.infer<typeof ReproductionStatus>;

export const SourceLocation = z.object({
  path: z.string().min(1),
  line: z.number().int().positive().optional(),
  column: z.number().int().positive().optional(),
});
export type SourceLocation = z.infer<typeof SourceLocation>;

export const VerificationStatus = z.enum(['unverified', 'verified', 'rejected']);
export type VerificationStatus = z.infer<typeof VerificationStatus>;

export const Finding = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(300),
  expectedBehavior: z.string().min(1),
  observedBehavior: z.string().min(1),
  severity: Severity,
  confidence: Confidence,
  reproduction: ReproductionStatus,
  affectedEnvironment: z.string().min(1),
  affectedUsers: z.string().min(1),
  /** Time-synchronized evidence (screenshot, video, trace, console, network). */
  evidenceIds: z.array(EvidenceId).default([]),
  source: SourceLocation.optional(),
  rootCauseHypothesis: z.string().optional(),
  recommendation: z.string().min(1),
  duplicateOf: z.string().optional(),
  antiSlopCategory: AntiSlopDimension.optional(),
  reportedBy: Actor,
  reportedAt: Timestamp,
});
export type Finding = z.infer<typeof Finding>;

/**
 * Independent verification of a finding. Fail-closed rule: `verifiedBy` must be a
 * different actor than the finding's `reportedBy`. The kernel/engine enforces this.
 */
export const FindingVerification = z.object({
  findingId: z.string().min(1),
  status: VerificationStatus,
  verifiedBy: Actor,
  verifiedAt: Timestamp,
  rationale: z.string().min(1),
});
export type FindingVerification = z.infer<typeof FindingVerification>;
