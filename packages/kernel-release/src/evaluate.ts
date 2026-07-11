import { digestValue } from '@nas/crypto';
import { EvidenceLog, type Signer } from '@nas/kernel-evidence';
import {
  type Actor,
  type ReleaseDecision,
  type ReleaseDecisionBody,
  ReleaseInputs as ReleaseInputsSchema,
  type ReleaseInputs,
  type ReleaseVerdict,
  type Sha256Digest,
} from '@nas/contracts';

export interface EvaluateReleaseDeps {
  /** Signs the decision AND re-verifies the evidence chain. Held by the release authority. */
  signer: Signer;
  /** The authority identity recorded as `signedBy`. */
  authority: Actor;
  clock: () => string;
  idGenerator: () => string;
}

/**
 * TC-10: evaluate a release against its policy and issue a signed decision.
 *
 * The gate is fail-closed and never trusts a caller-supplied "everything passed"
 * flag. It independently re-verifies the evidence chain, confirms required
 * evidence kinds are present, confirms every required check passed AND is backed
 * by evidence in that authenticated chain, confirms the anti-slop gate accepted,
 * and confirms a valid independent (non-self) review. Anything missing,
 * incomplete, unauthenticated, or unmet prevents a Pass.
 *
 * Verdicts:
 *  - `blocked`  — structural: unauthenticated/missing evidence, missing/incomplete
 *                 required checks, missing or self-review, hard blockers.
 *  - `fail`     — measured: a required check reported fail, or anti-slop not accepted.
 *  - `warning`  — clean but with non-blocking concerns.
 *  - `pass`     — every mandatory condition met with no concerns.
 */
export function evaluateRelease(
  rawInputs: ReleaseInputs,
  deps: EvaluateReleaseDeps,
): ReleaseDecision {
  const inputs = ReleaseInputsSchema.parse(rawInputs);
  const { policy } = inputs;

  const blocked: string[] = []; // structural → verdict "blocked"
  const failed: string[] = []; // measured failure → verdict "fail"
  const warnings: string[] = [];

  // 1. Evidence authenticity — re-verified here, not trusted.
  const chain = EvidenceLog.verifyChain(inputs.evidence, deps.signer);
  if (!chain.valid) {
    for (const reason of chain.reasons) blocked.push(`evidence chain invalid: ${reason}`);
  }
  const evidenceIds = new Set(inputs.evidence.map((e) => e.id));
  const evidenceKinds = new Set(inputs.evidence.map((e) => e.input.kind));

  // 2. Required evidence kinds present.
  for (const kind of policy.requiredEvidenceKinds) {
    if (!evidenceKinds.has(kind)) blocked.push(`missing required evidence kind: ${kind}`);
  }

  // 3. Required checks: reported, passing, and evidence-backed by the authenticated chain.
  // Duplicate check names are rejected: otherwise a later `pass` could shadow an
  // earlier `fail` for the same check (Map-keeps-last), sneaking a failure through.
  const seenCheckNames = new Set<string>();
  for (const check of inputs.checks) {
    if (seenCheckNames.has(check.name)) {
      blocked.push(`duplicate check name reported: ${check.name}`);
    }
    seenCheckNames.add(check.name);
  }
  const checkByName = new Map(inputs.checks.map((c) => [c.name, c]));
  for (const name of policy.requiredChecks) {
    const check = checkByName.get(name);
    if (!check) {
      blocked.push(`required check not reported: ${name}`);
      continue;
    }
    switch (check.status) {
      case 'pass':
        if (!check.evidenceId) {
          blocked.push(`required check "${name}" passed without evidence`);
        } else if (!evidenceIds.has(check.evidenceId)) {
          blocked.push(
            `required check "${name}" cites evidence "${check.evidenceId}" absent from the authenticated chain`,
          );
        }
        break;
      case 'fail':
        failed.push(`required check failed: ${name}${check.detail ? ` — ${check.detail}` : ''}`);
        break;
      case 'incomplete':
        if (policy.allowIncompleteAsWarning) warnings.push(`required check incomplete: ${name}`);
        else blocked.push(`required check incomplete: ${name}`);
        break;
      case 'skipped':
        blocked.push(`required check skipped: ${name}`);
        break;
    }
  }

  // 4. Anti-slop gate. We do not simply trust the `accepted` flag: a
  // self-contradictory result (accepted with a non-empty blocking list) is
  // rejected, so a malformed/forged gate result cannot pass.
  if (policy.requireAntiSlopAccepted) {
    const dims = inputs.antiSlop.blocking.map((b) => `${b.dimension}(${b.grade})`).join(', ');
    if (!inputs.antiSlop.accepted) {
      failed.push(`anti-slop gate not accepted — blocking dimensions: ${dims || 'unspecified'}`);
    } else if (inputs.antiSlop.blocking.length > 0) {
      failed.push(`anti-slop gate result is inconsistent (accepted but has blocking: ${dims})`);
    }
  }

  // 5. Independent review (no self-review). We bind "author" to the attributable
  // build author (manifest.createdBy) as well as the caller-supplied authorId, so
  // an author cannot self-approve by misreporting who authored the change.
  if (policy.requireIndependentReview) {
    const review = inputs.independentReview;
    const buildAuthorId = inputs.manifest.createdBy.id;
    if (!review) {
      blocked.push('independent review is required but was not provided');
    } else if (review.reviewer.id === review.authorId || review.reviewer.id === buildAuthorId) {
      blocked.push('independent review invalid: reviewer is the author (self-review)');
    } else if (!review.approved) {
      failed.push(`independent review rejected: ${review.rationale}`);
    }
  }

  // 6. Hard blockers.
  for (const hb of inputs.hardBlockers) blocked.push(`hard blocker: ${hb}`);

  // 7. Risk acceptances — recorded; an expired one is a warning, never a silent pass.
  const refTime = Date.parse(inputs.manifest.createdAt);
  for (const ra of inputs.riskAcceptances) {
    if (Date.parse(ra.expiresAt) <= refTime) warnings.push(`risk acceptance "${ra.id}" is expired`);
  }

  const verdict: ReleaseVerdict =
    blocked.length > 0
      ? 'blocked'
      : failed.length > 0
        ? 'fail'
        : warnings.length > 0
          ? 'warning'
          : 'pass';

  const body: ReleaseDecisionBody = {
    id: deps.idGenerator(),
    verdict,
    manifest: inputs.manifest,
    blocking: [...blocked, ...failed],
    warnings,
    inputsDigest: digestValue(inputs) as Sha256Digest,
    evaluatedAt: deps.clock(),
    evaluatedBy: inputs.evaluatedBy,
  };

  const bodyDigest = digestValue(body);
  const signature = deps.signer.sign(bodyDigest);
  return {
    ...body,
    signedBy: deps.authority,
    signature: { keyId: signature.keyId, algorithm: 'hmac-sha256', value: signature.value },
  };
}
