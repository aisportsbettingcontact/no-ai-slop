import { z } from 'zod';
import { Actor } from './actor.js';
import { AntiSlopGateResult } from './anti-slop.js';
import { EvidenceKind, EvidenceRecord, Signature } from './evidence.js';
import {
  BuildId,
  DecisionId,
  OrgId,
  ProjectId,
  Sha256Digest,
  Timestamp,
} from './ids.js';

/**
 * TC-10: Release-Gate Correctness (contract layer).
 *
 * A release decision is issued against the *exact* build being deployed. It
 * consumes only authenticated evidence, a machine-checkable policy, mandatory
 * check results, an independent review, and the anti-slop gate result. It is
 * fail-closed: missing / incomplete / unauthenticated inputs never yield a Pass.
 * The kernel lives in @nas/kernel-release.
 */

export const DeployEnvironment = z.enum(['staging', 'production']);
export type DeployEnvironment = z.infer<typeof DeployEnvironment>;

/**
 * The immutable identity of what will be deployed. `artifactDigest` is the content
 * address of the built artifact; `sourceCommit` ties it to attributable source.
 * These make "deploy the tested build, not a different build" checkable.
 */
export const ReleaseManifest = z.object({
  buildId: BuildId,
  orgId: OrgId,
  projectId: ProjectId,
  /** Content digest of the build artifact. Immutable build identity. */
  artifactDigest: Sha256Digest,
  /** Full git commit SHA the artifact was built from. */
  sourceCommit: z.string().regex(/^[0-9a-f]{40}$/, 'expected a 40-char git commit sha'),
  targetEnvironment: DeployEnvironment,
  createdAt: Timestamp,
  createdBy: Actor,
});
export type ReleaseManifest = z.infer<typeof ReleaseManifest>;

export const CheckStatus = z.enum(['pass', 'fail', 'incomplete', 'skipped']);
export type CheckStatus = z.infer<typeof CheckStatus>;

/** A named mandatory check (typecheck, lint, unit, integration, a11y, security...). */
export const CheckResult = z.object({
  name: z.string().min(1),
  status: CheckStatus,
  /** Evidence backing the result. A check without evidence cannot satisfy the gate. */
  evidenceId: z.string().optional(),
  detail: z.string().optional(),
});
export type CheckResult = z.infer<typeof CheckResult>;

export const RiskAcceptance = z.object({
  id: z.string().min(1),
  reason: z.string().min(1),
  acceptedBy: Actor,
  acceptedAt: Timestamp,
  expiresAt: Timestamp,
});
export type RiskAcceptance = z.infer<typeof RiskAcceptance>;

/**
 * Independent review of the release. Fail-closed: `reviewer` must differ from
 * `authorId` (the change author) — a release cannot be self-approved.
 */
export const IndependentReview = z.object({
  reviewer: Actor,
  /** The actor who authored the change under review. */
  authorId: z.string().min(1),
  approved: z.boolean(),
  rationale: z.string().min(1),
  reviewedAt: Timestamp,
});
export type IndependentReview = z.infer<typeof IndependentReview>;

/** The machine-checkable policy the gate enforces. */
export const ReleasePolicy = z.object({
  /** Check names that must be present and `pass`. */
  requiredChecks: z.array(z.string().min(1)),
  /** Evidence kinds that must each appear at least once in the authenticated chain. */
  requiredEvidenceKinds: z.array(EvidenceKind),
  requireAntiSlopAccepted: z.boolean(),
  requireIndependentReview: z.boolean(),
  /** When false, any check `incomplete` is a hard block rather than a warning. */
  allowIncompleteAsWarning: z.boolean().default(false),
});
export type ReleasePolicy = z.infer<typeof ReleasePolicy>;

/** Everything the gate evaluates. Evidence is the sealed TC-17 chain, re-verified here. */
export const ReleaseInputs = z.object({
  manifest: ReleaseManifest,
  policy: ReleasePolicy,
  checks: z.array(CheckResult),
  evidence: z.array(EvidenceRecord),
  antiSlop: AntiSlopGateResult,
  independentReview: IndependentReview.optional(),
  /** Any present hard blocker forces `blocked`. */
  hardBlockers: z.array(z.string().min(1)).default([]),
  riskAcceptances: z.array(RiskAcceptance).default([]),
  evaluatedBy: Actor,
});
export type ReleaseInputs = z.infer<typeof ReleaseInputs>;

export const ReleaseVerdict = z.enum(['pass', 'warning', 'fail', 'blocked']);
export type ReleaseVerdict = z.infer<typeof ReleaseVerdict>;

/**
 * The signed decision. `inputsDigest` content-addresses the exact inputs so the
 * decision can be reconstructed and cannot be silently re-pointed at a different build.
 */
export const ReleaseDecision = z.object({
  id: DecisionId,
  verdict: ReleaseVerdict,
  manifest: ReleaseManifest,
  /** Hard reasons that forced fail/blocked. Empty on a clean pass. */
  blocking: z.array(z.string()),
  /** Non-blocking concerns surfaced to the approver. */
  warnings: z.array(z.string()),
  inputsDigest: Sha256Digest,
  evaluatedAt: Timestamp,
  evaluatedBy: Actor,
  signedBy: Actor,
  signature: Signature,
});
export type ReleaseDecision = z.infer<typeof ReleaseDecision>;

/** The unsigned decision body that gets content-addressed and signed. */
export const ReleaseDecisionBody = ReleaseDecision.omit({ signature: true, signedBy: true });
export type ReleaseDecisionBody = z.infer<typeof ReleaseDecisionBody>;
