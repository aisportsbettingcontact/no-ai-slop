import type { DeployEnvironment, ReleasePolicy } from '@nas/contracts';

/**
 * Reference policies. Staging is a gate, not a rubber stamp; production is
 * strict: it demands independent review, accessibility + security evidence, and a
 * clean anti-slop gate, with no incomplete checks tolerated.
 */
export const STAGING_POLICY: ReleasePolicy = {
  requiredChecks: ['typecheck', 'lint', 'unit'],
  requiredEvidenceKinds: ['build', 'test'],
  requireAntiSlopAccepted: true,
  requireIndependentReview: false,
  allowIncompleteAsWarning: true,
};

export const PRODUCTION_POLICY: ReleasePolicy = {
  requiredChecks: ['typecheck', 'lint', 'unit', 'integration', 'accessibility', 'security'],
  requiredEvidenceKinds: ['build', 'test', 'accessibility_result', 'anti_slop_review'],
  requireAntiSlopAccepted: true,
  requireIndependentReview: true,
  allowIncompleteAsWarning: false,
};

export function policyFor(environment: DeployEnvironment): ReleasePolicy {
  return environment === 'production' ? PRODUCTION_POLICY : STAGING_POLICY;
}
