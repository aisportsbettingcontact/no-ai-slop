import { z } from 'zod';
import { Actor } from './actor.js';
import { OwnerId } from './design-system.js';
import { Timestamp } from './ids.js';

/**
 * Governance contracts: how the product system is allowed to evolve.
 *
 * Neither a human nor an agent may add product language (tokens, components,
 * patterns, principles, rules) without a contribution record that names the
 * need, proves an existing-capability search, and moves through an explicit
 * state machine. Reusable system needs and one-off product exceptions
 * ("snowflakes") are distinguished at triage. High-impact changes cannot be
 * published by the person who requested them — non-self review is enforced in
 * the transition function, not in prose.
 */

export const ContributionId = z
  .string()
  .regex(/^contrib\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'expected a contrib.<name> id');
export type ContributionId = z.infer<typeof ContributionId>;

export const ContributionKind = z.enum([
  'token',
  'component',
  'pattern',
  'principle',
  'accessibility_rule',
  'architecture_rule',
  'anti_slop_dimension',
]);
export type ContributionKind = z.infer<typeof ContributionKind>;

export const ContributionState = z.enum([
  'proposed',
  'triaged',
  'product_specific_exception',
  'design_review',
  'implementation',
  'verification',
  'published',
  'deprecated',
  'rejected',
]);
export type ContributionState = z.infer<typeof ContributionState>;

export const ContributionRequest = z.object({
  id: ContributionId,
  kind: ContributionKind,
  title: z.string().min(1).max(200),
  /** The user problem, not the solution. */
  need: z.string().min(1).max(1000),
  /** What was searched for reuse, and exactly why the existing capability is insufficient. */
  existingCapabilitySearch: z.string().min(1).max(1000),
  proposedScope: z.string().min(1).max(1000),
  accessibilityImpact: z.string().min(1).max(1000),
  securityImpact: z.string().min(1).max(1000),
  evidencePlan: z.string().min(1).max(1000),
  migrationPlan: z.string().min(1).max(1000).optional(),
  /** Required when the request is routed as a product-specific exception. */
  expiresAt: Timestamp.optional(),
  ownerId: OwnerId,
  requestedBy: Actor,
  createdAt: Timestamp,
  /**
   * True when the change touches shared tokens, contracts, kernels, or public
   * component APIs. High-impact contributions require a non-self publisher.
   */
  highImpact: z.boolean(),
});
export type ContributionRequest = z.infer<typeof ContributionRequest>;

export const ContributionTransition = z.object({
  from: ContributionState,
  to: ContributionState,
  actor: Actor,
  at: Timestamp,
  rationale: z.string().min(1).max(1000),
});
export type ContributionTransition = z.infer<typeof ContributionTransition>;

export const ContributionRecord = z.object({
  request: ContributionRequest,
  state: ContributionState,
  history: z.array(ContributionTransition).default([]),
});
export type ContributionRecord = z.infer<typeof ContributionRecord>;

/**
 * The complete transition map. Anything not listed is forbidden. `verification`
 * may fall back to `implementation` (a failed check is a loop, not a dead end);
 * `published` can only move to `deprecated`; terminal states have no exits.
 */
export const ALLOWED_CONTRIBUTION_TRANSITIONS: Record<
  ContributionState,
  readonly ContributionState[]
> = {
  proposed: ['triaged', 'rejected'],
  triaged: ['design_review', 'product_specific_exception', 'rejected'],
  product_specific_exception: ['implementation', 'rejected'],
  design_review: ['implementation', 'rejected'],
  implementation: ['verification'],
  verification: ['published', 'implementation', 'rejected'],
  published: ['deprecated'],
  deprecated: [],
  rejected: [],
};

export const TransitionProblemCode = z.enum([
  'GOV_STATE_MISMATCH',
  'GOV_FORBIDDEN_TRANSITION',
  'GOV_TERMINAL_STATE',
  'GOV_SELF_PUBLISH',
  'GOV_EXCEPTION_NEEDS_EXPIRY',
]);
export type TransitionProblemCode = z.infer<typeof TransitionProblemCode>;

export type TransitionResult =
  | { ok: true; record: ContributionRecord }
  | { ok: false; code: TransitionProblemCode; reason: string };

/**
 * Apply a transition to a contribution record, fail-closed. Returns a new
 * record (never mutates). Refuses: transitions from a state the record is not
 * in, transitions the map does not allow, publishing a high-impact request by
 * its own requester (non-self review), and routing to a product-specific
 * exception without an expiry.
 */
export function applyContributionTransition(
  record: ContributionRecord,
  transition: ContributionTransition,
): TransitionResult {
  if (transition.from !== record.state) {
    return {
      ok: false,
      code: 'GOV_STATE_MISMATCH',
      reason: `record is in "${record.state}" but the transition starts from "${transition.from}"`,
    };
  }
  const allowed = ALLOWED_CONTRIBUTION_TRANSITIONS[record.state];
  if (allowed.length === 0) {
    return {
      ok: false,
      code: 'GOV_TERMINAL_STATE',
      reason: `"${record.state}" is terminal; no further transitions are allowed`,
    };
  }
  if (!allowed.includes(transition.to)) {
    return {
      ok: false,
      code: 'GOV_FORBIDDEN_TRANSITION',
      reason: `"${record.state}" → "${transition.to}" is not allowed (allowed: ${allowed.join(', ')})`,
    };
  }
  if (
    transition.to === 'published' &&
    record.request.highImpact &&
    transition.actor.id === record.request.requestedBy.id
  ) {
    return {
      ok: false,
      code: 'GOV_SELF_PUBLISH',
      reason: `high-impact contribution "${record.request.id}" cannot be published by its requester "${transition.actor.id}" — an independent reviewer must publish`,
    };
  }
  if (transition.to === 'product_specific_exception' && record.request.expiresAt === undefined) {
    return {
      ok: false,
      code: 'GOV_EXCEPTION_NEEDS_EXPIRY',
      reason: `contribution "${record.request.id}" cannot become a product-specific exception without an expiresAt — exceptions are time-bound, never permanent`,
    };
  }
  return {
    ok: true,
    record: {
      request: record.request,
      state: transition.to,
      history: [...record.history, transition],
    },
  };
}
