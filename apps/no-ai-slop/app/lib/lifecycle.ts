import 'server-only';
import {
  agentActor,
  userActor,
  type AntiSlopGateResult,
  type AntiSlopReview,
  type CheckResult,
  type EvidenceInput,
  type EvidenceRecord,
  type ReleaseDecision,
  type ReleaseInputs,
} from '@nas/contracts';
import { EvidenceLog, HmacSigner } from '@nas/kernel-evidence';
import { evaluateReview, requiredDimensionsFor } from '@nas/anti-slop';
import {
  PRODUCTION_POLICY,
  STAGING_POLICY,
  evaluateRelease,
  verifyDecisionSignature,
} from '@nas/kernel-release';

/**
 * The app surfaces REAL kernel output, not hand-authored mock JSON. This module
 * runs a fixed, clearly-labelled sample scenario through the actual TC-17 / TC-10
 * / anti-slop kernels and returns their genuine results for the pages to render.
 *
 * It is deterministic (fixed clock, sequential ids, a fixed sample key) so every
 * request renders the identical, reproducible decision. The key here signs only
 * this illustrative in-memory data.
 */
const SAMPLE_KEY = 'nas-app-sample-signing-key-01';

function fixedClock(): () => string {
  let t = Date.parse('2026-07-01T09:00:00.000Z');
  return () => {
    const iso = new Date(t).toISOString();
    t += 1000;
    return iso;
  };
}

function counter(prefix: string): () => string {
  let n = 0;
  return () => `${prefix}_${(n++).toString(36).padStart(4, '0')}`;
}

export interface RenderableRecord {
  id: string;
  sequence: number;
  kind: EvidenceRecord['input']['kind'];
  summary: string;
  recordDigest: string;
  createdAt: string;
}

export interface Lifecycle {
  build: {
    buildId: string;
    artifactDigest: string;
    sourceCommit: string;
    project: string;
  };
  evidence: RenderableRecord[];
  evidenceValid: boolean;
  evidenceCount: number;
  antiSlop: AntiSlopGateResult;
  antiSlopGrades: { dimension: string; grade: string; rationale: string }[];
  checks: CheckResult[];
  stagingDecision: ReleaseDecision;
  stagingSignatureValid: boolean;
  productionDecision: ReleaseDecision;
  productionSignatureValid: boolean;
}

let cached: Lifecycle | null = null;

export function getLifecycle(): Lifecycle {
  if (cached) return cached;
  const signer = new HmacSigner({ key_sample_1: SAMPLE_KEY }, 'key_sample_1');
  const evidenceAuthority = agentActor('agent.evidence-authority', 'Evidence Authority');
  const gateway = agentActor('agent.gateway', 'Tool Gateway');
  const clock = fixedClock();
  const log = new EvidenceLog({
    signer,
    authority: evidenceAuthority,
    clock,
    idGenerator: counter('ev'),
  });

  const seal = (kind: EvidenceInput['kind'], summary: string): EvidenceRecord =>
    log.append({
      kind,
      contentDigest: `sha256:${'a'.repeat(64)}`,
      summary,
      producer: gateway,
      context: { orgId: 'org_acme', projectId: 'proj_web', correlationId: 'corr_sample' },
      metadata: {},
    });

  const typecheck = seal('test', 'typecheck — 0 errors across 8 packages');
  const lint = seal('test', 'lint — 0 problems');
  const unit = seal('test', 'unit — 97 passed');
  const integration = seal('test', 'integration — 12 journeys passed');
  const a11y = seal('accessibility_result', 'axe — 0 serious/critical on primary workflows');
  const security = seal('command', 'dependency + secret scan — 0 critical');
  seal('build', 'production build — succeeded, artifact digested');
  seal('anti_slop_review', 'anti-slop review — accepted (13 dimensions)');

  const evidenceVerification = log.verify();

  // Anti-slop review (a product feature; every required dimension passes).
  const review: AntiSlopReview = {
    changeType: 'product_feature',
    subject: 'Release readiness dashboard',
    reviewer: agentActor('agent.anti-slop', 'Anti-Slop Reviewer'),
    createdAt: clock(),
    grades: requiredDimensionsFor('product_feature').map((dimension) => ({
      dimension,
      grade: 'pass' as const,
      rationale: 'Verified against evidence in this run.',
      evidenceIds: [],
    })),
    exceptions: [],
  };
  const antiSlop = evaluateReview(review);

  const checks: CheckResult[] = [
    { name: 'typecheck', status: 'pass', evidenceId: typecheck.id, detail: '0 errors' },
    { name: 'lint', status: 'pass', evidenceId: lint.id, detail: '0 problems' },
    { name: 'unit', status: 'pass', evidenceId: unit.id, detail: '97 passed' },
    { name: 'integration', status: 'pass', evidenceId: integration.id, detail: '12 journeys' },
    { name: 'accessibility', status: 'pass', evidenceId: a11y.id, detail: '0 serious' },
    { name: 'security', status: 'pass', evidenceId: security.id, detail: '0 critical' },
  ];

  const manifestBase = {
    buildId: 'build_2026_07_01_a',
    orgId: 'org_acme',
    projectId: 'proj_web',
    artifactDigest: `sha256:${'b'.repeat(64)}`,
    sourceCommit: '4f2a1c9e8b7d6a5f4e3c2b1a0f9e8d7c6b5a4f3e',
    createdAt: clock(),
    createdBy: userActor('u_dev', 'Dev Author'),
  };

  const deps = {
    signer,
    authority: agentActor('agent.release-authority', 'Release Authority'),
    clock,
    idGenerator: counter('dec'),
  };

  // Staging: satisfied → PASS.
  const stagingInputs: ReleaseInputs = {
    manifest: { ...manifestBase, targetEnvironment: 'staging' },
    policy: STAGING_POLICY,
    checks,
    evidence: log.toJSON(),
    antiSlop,
    hardBlockers: [],
    riskAcceptances: [],
    evaluatedBy: agentActor('agent.release', 'Release Agent'),
  };
  const stagingDecision = evaluateRelease(stagingInputs, deps);

  // Production: same build, but no independent review provided yet → BLOCKED.
  // Demonstrates the gate refusing to certify an incomplete production release.
  const productionInputs: ReleaseInputs = {
    manifest: { ...manifestBase, targetEnvironment: 'production' },
    policy: PRODUCTION_POLICY,
    checks,
    evidence: log.toJSON(),
    antiSlop,
    hardBlockers: [],
    riskAcceptances: [],
    evaluatedBy: agentActor('agent.release', 'Release Agent'),
  };
  const productionDecision = evaluateRelease(productionInputs, deps);

  cached = {
    build: {
      buildId: manifestBase.buildId,
      artifactDigest: manifestBase.artifactDigest,
      sourceCommit: manifestBase.sourceCommit,
      project: 'acme-web',
    },
    evidence: log.records.map((r) => ({
      id: r.id,
      sequence: r.sequence,
      kind: r.input.kind,
      summary: r.input.summary,
      recordDigest: r.recordDigest,
      createdAt: r.createdAt,
    })),
    evidenceValid: evidenceVerification.valid,
    evidenceCount: evidenceVerification.checkedCount,
    antiSlop,
    antiSlopGrades: review.grades.map((g) => ({
      dimension: g.dimension,
      grade: g.grade,
      rationale: g.rationale,
    })),
    checks,
    stagingDecision,
    stagingSignatureValid: verifyDecisionSignature(stagingDecision, signer),
    productionDecision,
    productionSignatureValid: verifyDecisionSignature(productionDecision, signer),
  };
  return cached;
}
