/**
 * @nas/kernel-release — TC-10: Release-Gate Correctness.
 *
 * Issues a signed, fail-closed release decision for the exact build under review.
 * It consumes only authenticated evidence (re-verified in-kernel), a machine
 * checkable policy, evidence-backed check results, the anti-slop gate result, and
 * an independent (non-self) review. Missing / incomplete / unauthenticated inputs
 * never yield a Pass.
 */
export { evaluateRelease, type EvaluateReleaseDeps } from './evaluate.js';
export { verifyDecisionSignature, decisionAuthorizesDeploy } from './verify.js';
export { STAGING_POLICY, PRODUCTION_POLICY, policyFor } from './policy.js';
