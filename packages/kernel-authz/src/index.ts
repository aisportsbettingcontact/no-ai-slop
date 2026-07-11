/**
 * @nas/kernel-authz — TC-07: Agent Authorization and Least Privilege.
 *
 * Deny-by-default enforcement with a signing broker, audience/resource binding,
 * short-lived grants, and replay protection. Decisions are deterministic and
 * always produce an audit receipt that can be sealed as TC-17 evidence.
 */
import type { Actor, AuthorizationReceipt, EvidenceContext, EvidenceInput } from '@nas/contracts';

export { AuthzBroker, verifyGrantSignature } from './broker.js';
export { AuthorizationEngine, type AuthorizeResult } from './engine.js';
export { resourceMatches, compileResourcePattern } from './resource.js';

/**
 * Turn an authorization receipt into an evidence input so it can be sealed into
 * the TC-17 chain. The receipt's `bodyDigest` IS the content address, so the
 * decision can be reconstructed and audited later.
 */
export function receiptToEvidenceInput(
  receipt: AuthorizationReceipt,
  producer: Actor,
  context: EvidenceContext,
): EvidenceInput {
  const { decision } = receipt;
  return {
    kind: 'authz_receipt',
    contentDigest: receipt.bodyDigest,
    summary: decision.allowed
      ? `ALLOW ${decision.subjectId}: ${receipt.request.action} on ${receipt.request.resource}`
      : `DENY ${decision.subjectId}: ${decision.denyReason ?? 'denied'} — ${receipt.request.action} on ${receipt.request.resource}`,
    producer,
    context,
    metadata: {
      allowed: decision.allowed,
      action: receipt.request.action,
      resource: receipt.request.resource,
      grantId: decision.grantId,
      denyReason: decision.denyReason ?? null,
    },
  };
}
