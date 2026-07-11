import { digestValue } from '@nas/crypto';
import type { Signer } from '@nas/kernel-evidence';
import type { ReleaseDecision, ReleaseDecisionBody } from '@nas/contracts';

/**
 * Verify that a release decision was authentically signed by a trusted authority
 * and has not been altered. Recomputes the body digest and checks the signature.
 * Fail-closed: any mismatch or unknown key → false.
 */
export function verifyDecisionSignature(decision: ReleaseDecision, signer: Signer): boolean {
  const body: ReleaseDecisionBody = {
    id: decision.id,
    verdict: decision.verdict,
    manifest: decision.manifest,
    blocking: decision.blocking,
    warnings: decision.warnings,
    inputsDigest: decision.inputsDigest,
    evaluatedAt: decision.evaluatedAt,
    evaluatedBy: decision.evaluatedBy,
  };
  const bodyDigest = digestValue(body);
  return signer.verify(bodyDigest, decision.signature);
}

/** True iff a decision authorizes deployment (a Pass or a Warning that policy tolerates). */
export function decisionAuthorizesDeploy(decision: ReleaseDecision): boolean {
  return decision.verdict === 'pass' || decision.verdict === 'warning';
}
