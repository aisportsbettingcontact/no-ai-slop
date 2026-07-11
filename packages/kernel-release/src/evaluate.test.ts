import { beforeEach, describe, expect, it } from 'vitest';
import {
  type AntiSlopGateResult,
  type CheckResult,
  type EvidenceInput,
  type EvidenceRecord,
  type ReleaseInputs,
  type ReleaseManifest,
  agentActor,
  userActor,
} from '@nas/contracts';
import { EvidenceLog, HmacSigner, counterIdGenerator } from '@nas/kernel-evidence';
import {
  PRODUCTION_POLICY,
  STAGING_POLICY,
  decisionAuthorizesDeploy,
  evaluateRelease,
  verifyDecisionSignature,
} from './index.js';

function seqClock(): () => string {
  let t = Date.parse('2026-05-01T00:00:00.000Z');
  return () => {
    const iso = new Date(t).toISOString();
    t += 1000;
    return iso;
  };
}

const authority = agentActor('agent.release-authority', 'Release Authority');
const evidenceAuthority = agentActor('agent.evidence-authority', 'Evidence Authority');
const producer = agentActor('agent.gateway', 'Tool Gateway');

/** A signer shared by evidence sealing, release signing, and re-verification. */
function makeSigner() {
  return new HmacSigner({ key_rel_1: 'release-and-evidence-secret-01' }, 'key_rel_1');
}

function evInput(kind: EvidenceInput['kind'], summary: string): EvidenceInput {
  return {
    kind,
    contentDigest: `sha256:${'a'.repeat(64)}`,
    summary,
    producer,
    context: { orgId: 'org_acme', projectId: 'proj_web', correlationId: 'corr_rel' },
    metadata: {},
  };
}

const manifest: ReleaseManifest = {
  buildId: 'build_42',
  orgId: 'org_acme',
  projectId: 'proj_web',
  artifactDigest: `sha256:${'c'.repeat(64)}`,
  sourceCommit: 'a'.repeat(40),
  targetEnvironment: 'production',
  createdAt: '2026-05-01T00:00:00.000Z',
  createdBy: userActor('u_dev', 'Dev Author'),
};

const acceptedAntiSlop: AntiSlopGateResult = {
  accepted: true,
  changeType: 'product_feature',
  requiredDimensions: ['product_correctness'],
  blocking: [],
  concerns: [],
  exceptionsApplied: [],
  summary: 'Accepted.',
};

let signer: HmacSigner;

/**
 * Build a fully-passing PRODUCTION release: an authenticated evidence chain with
 * one record per required check (plus the required evidence kinds), checks bound
 * to those evidence ids, an accepted anti-slop gate, and a non-self review.
 */
function passingProductionInputs(): { inputs: ReleaseInputs; records: EvidenceRecord[] } {
  const log = new EvidenceLog({
    signer,
    authority: evidenceAuthority,
    clock: seqClock(),
    idGenerator: counterIdGenerator('ev'),
  });

  const checkNames = PRODUCTION_POLICY.requiredChecks;
  const checks: CheckResult[] = checkNames.map((name) => {
    const kind =
      name === 'accessibility' ? 'accessibility_result' : name === 'security' ? 'command' : 'test';
    const rec = log.append(evInput(kind, `${name} passed`));
    return { name, status: 'pass', evidenceId: rec.id, detail: `${name} ok` };
  });
  // Required evidence kinds not already covered: build + anti_slop_review.
  log.append(evInput('build', 'production build succeeded'));
  log.append(evInput('anti_slop_review', 'anti-slop accepted'));

  const inputs: ReleaseInputs = {
    manifest,
    policy: PRODUCTION_POLICY,
    checks,
    evidence: log.toJSON(),
    antiSlop: acceptedAntiSlop,
    independentReview: {
      reviewer: userActor('u_reviewer', 'Independent Reviewer'),
      authorId: 'u_dev',
      approved: true,
      rationale: 'reviewed diff, reproduced tests',
      reviewedAt: '2026-05-01T00:02:00.000Z',
    },
    hardBlockers: [],
    riskAcceptances: [],
    evaluatedBy: agentActor('agent.release', 'Release Agent'),
  };
  return { inputs, records: log.toJSON() };
}

const deps = () => ({
  signer,
  authority,
  clock: seqClock(),
  idGenerator: counterIdGenerator('dec'),
});

beforeEach(() => {
  signer = makeSigner();
});

describe('clean pass', () => {
  it('passes a fully-satisfied production release and signs the decision', () => {
    const { inputs } = passingProductionInputs();
    const decision = evaluateRelease(inputs, deps());
    expect(decision.verdict).toBe('pass');
    expect(decision.blocking).toEqual([]);
    expect(decision.manifest.artifactDigest).toBe(manifest.artifactDigest);
    expect(verifyDecisionSignature(decision, signer)).toBe(true);
    expect(decisionAuthorizesDeploy(decision)).toBe(true);
  });

  it('binds the decision to the exact inputs via inputsDigest', () => {
    const { inputs } = passingProductionInputs();
    const a = evaluateRelease(inputs, deps());
    const b = evaluateRelease(inputs, deps());
    expect(a.inputsDigest).toBe(b.inputsDigest); // deterministic for identical inputs
  });
});

describe('structural blocks → blocked', () => {
  it('blocks when a required check is not reported', () => {
    const { inputs } = passingProductionInputs();
    inputs.checks = inputs.checks.filter((c) => c.name !== 'security');
    const d = evaluateRelease(inputs, deps());
    expect(d.verdict).toBe('blocked');
    expect(d.blocking.join(' ')).toMatch(/required check not reported: security/);
  });

  it('blocks when a required check passed without evidence', () => {
    const { inputs } = passingProductionInputs();
    inputs.checks = inputs.checks.map((c) =>
      c.name === 'unit' ? { name: 'unit', status: 'pass' } : c,
    );
    const d = evaluateRelease(inputs, deps());
    expect(d.verdict).toBe('blocked');
    expect(d.blocking.join(' ')).toMatch(/passed without evidence/);
  });

  it('blocks when a required check cites evidence absent from the chain', () => {
    const { inputs } = passingProductionInputs();
    inputs.checks = inputs.checks.map((c) =>
      c.name === 'unit' ? { ...c, evidenceId: 'ev_ghost' } : c,
    );
    const d = evaluateRelease(inputs, deps());
    expect(d.verdict).toBe('blocked');
    expect(d.blocking.join(' ')).toMatch(/absent from the authenticated chain/);
  });

  it('blocks a tampered evidence chain (unauthenticated evidence)', () => {
    const { inputs } = passingProductionInputs();
    inputs.evidence = structuredClone(inputs.evidence);
    inputs.evidence[0]!.input.summary = 'tampered';
    const d = evaluateRelease(inputs, deps());
    expect(d.verdict).toBe('blocked');
    expect(d.blocking.join(' ')).toMatch(/evidence chain invalid/);
  });

  it('blocks when a required evidence kind is missing', () => {
    const { inputs } = passingProductionInputs();
    // Drop the build evidence and rebuild the chain so it stays internally valid.
    const rebuilt = new EvidenceLog({
      signer,
      authority: evidenceAuthority,
      clock: seqClock(),
      idGenerator: counterIdGenerator('ev'),
    });
    for (const r of inputs.evidence) {
      if (r.input.kind !== 'build') rebuilt.append(r.input);
    }
    inputs.evidence = rebuilt.toJSON();
    const d = evaluateRelease(inputs, deps());
    expect(d.verdict).toBe('blocked');
    expect(d.blocking.join(' ')).toMatch(/missing required evidence kind: build/);
  });

  it('blocks a missing independent review under production policy', () => {
    const { inputs } = passingProductionInputs();
    delete inputs.independentReview;
    const d = evaluateRelease(inputs, deps());
    expect(d.verdict).toBe('blocked');
    expect(d.blocking.join(' ')).toMatch(/independent review is required/);
  });

  it('blocks a self-review', () => {
    const { inputs } = passingProductionInputs();
    inputs.independentReview = {
      reviewer: userActor('u_dev', 'Dev Author'),
      authorId: 'u_dev',
      approved: true,
      rationale: 'looks good to me',
      reviewedAt: '2026-05-01T00:02:00.000Z',
    };
    const d = evaluateRelease(inputs, deps());
    expect(d.verdict).toBe('blocked');
    expect(d.blocking.join(' ')).toMatch(/self-review/);
  });

  it('blocks on a hard blocker', () => {
    const { inputs } = passingProductionInputs();
    inputs.hardBlockers = ['open Sev1 incident on payment service'];
    const d = evaluateRelease(inputs, deps());
    expect(d.verdict).toBe('blocked');
    expect(d.blocking.join(' ')).toMatch(/hard blocker: open Sev1/);
  });
});

describe('measured failures → fail', () => {
  it('fails when a required check reported fail', () => {
    const { inputs } = passingProductionInputs();
    inputs.checks = inputs.checks.map((c) =>
      c.name === 'integration' ? { ...c, status: 'fail', detail: '2 journeys broken' } : c,
    );
    const d = evaluateRelease(inputs, deps());
    expect(d.verdict).toBe('fail');
    expect(d.blocking.join(' ')).toMatch(/required check failed: integration — 2 journeys broken/);
  });

  it('fails when the anti-slop gate did not accept', () => {
    const { inputs } = passingProductionInputs();
    inputs.antiSlop = {
      ...acceptedAntiSlop,
      accepted: false,
      blocking: [{ dimension: 'accessibility', grade: 'fail', reason: 'contrast < 4.5:1' }],
      summary: 'Blocked.',
    };
    const d = evaluateRelease(inputs, deps());
    expect(d.verdict).toBe('fail');
    expect(d.blocking.join(' ')).toMatch(/anti-slop gate not accepted.*accessibility/);
  });

  it('fails when the independent review rejected the change', () => {
    const { inputs } = passingProductionInputs();
    inputs.independentReview = {
      reviewer: userActor('u_reviewer', 'Independent Reviewer'),
      authorId: 'u_dev',
      approved: false,
      rationale: 'missing rollback plan',
      reviewedAt: '2026-05-01T00:02:00.000Z',
    };
    const d = evaluateRelease(inputs, deps());
    expect(d.verdict).toBe('fail');
    expect(d.blocking.join(' ')).toMatch(/independent review rejected: missing rollback plan/);
  });
});

describe('warnings + staging policy', () => {
  it('treats an incomplete required check as a warning under staging policy', () => {
    const log = new EvidenceLog({
      signer,
      authority: evidenceAuthority,
      clock: seqClock(),
      idGenerator: counterIdGenerator('ev'),
    });
    const tRec = log.append(evInput('test', 'unit ok'));
    log.append(evInput('build', 'built'));
    const inputs: ReleaseInputs = {
      manifest: { ...manifest, targetEnvironment: 'staging' },
      policy: STAGING_POLICY,
      checks: [
        { name: 'typecheck', status: 'pass', evidenceId: tRec.id },
        { name: 'lint', status: 'pass', evidenceId: tRec.id },
        { name: 'unit', status: 'incomplete', detail: 'flaky worker' },
      ],
      evidence: log.toJSON(),
      antiSlop: acceptedAntiSlop,
      hardBlockers: [],
      riskAcceptances: [],
      evaluatedBy: agentActor('agent.release', 'Release Agent'),
    };
    const d = evaluateRelease(inputs, deps());
    expect(d.verdict).toBe('warning');
    expect(d.warnings.join(' ')).toMatch(/required check incomplete: unit/);
    expect(decisionAuthorizesDeploy(d)).toBe(true);
  });
});

describe('decision authenticity', () => {
  it('rejects a decision whose verdict was flipped after signing', () => {
    const { inputs } = passingProductionInputs();
    inputs.hardBlockers = ['open freeze window']; // produce a genuinely blocked decision
    const blockedDecision = evaluateRelease(inputs, deps());
    expect(blockedDecision.verdict).toBe('blocked');
    // The authentic blocked decision verifies...
    expect(verifyDecisionSignature(blockedDecision, signer)).toBe(true);
    // ...but forging it into a pass breaks the signature.
    const forged = { ...blockedDecision, verdict: 'pass' as const, blocking: [] };
    expect(verifyDecisionSignature(forged, signer)).toBe(false);
  });

  it('does not authorize deploy for blocked/fail verdicts', () => {
    const { inputs } = passingProductionInputs();
    inputs.hardBlockers = ['freeze window'];
    const d = evaluateRelease(inputs, deps());
    expect(decisionAuthorizesDeploy(d)).toBe(false);
  });
});
