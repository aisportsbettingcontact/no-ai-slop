import { HmacSigner, EvidenceLog } from '@nas/kernel-evidence';
import { AuthzBroker, AuthorizationEngine, receiptToEvidenceInput } from '@nas/kernel-authz';
import { evaluateReview, requiredDimensionsFor } from '@nas/anti-slop';
import { evaluateRelease, verifyDecisionSignature, STAGING_POLICY } from '@nas/kernel-release';
import {
  agentActor,
  userActor,
  type AntiSlopReview,
  type AuthorizationRequest,
  type CheckResult,
  type EvidenceInput,
  type EvidenceRecord,
  type GrantBody,
  type ReleaseInputs,
} from '@nas/contracts';
import { type ParsedArgs } from '../args.js';
import { CLI_AUTHORITY, type CliContext } from '../context.js';

/**
 * `nas demo` — run the No AI Slop control lifecycle end-to-end through the REAL
 * kernels, in-memory, and narrate each stage:
 *   authorize (TC-07) → seal evidence (TC-17) → anti-slop review → release gate
 *   (TC-10) → prove fail-closed under tamper.
 *
 * It signs with an ephemeral demo key so it can never write into a real chain.
 */
export function demoCommand(ctx: CliContext, args: ParsedArgs): number {
  const json = args.flags.json === true;
  const out = (line: string) => {
    if (!json) ctx.stdout(line);
  };

  // Ephemeral, clearly-labelled demo key — never the real NAS_SIGNING_KEY.
  const signer = new HmacSigner({ key_demo: `demo-ephemeral-${ctx.nextId('key')}` }, 'key_demo');
  const evidenceAuthority = agentActor('agent.evidence-authority', 'Evidence Authority');
  const gateway = agentActor('agent.gateway', 'Tool Gateway');
  const dev = userActor('u_dev', 'Dev Author');
  const context = { orgId: 'org_demo', projectId: 'proj_demo', correlationId: 'corr_demo' };

  const log = new EvidenceLog({
    signer,
    authority: evidenceAuthority,
    clock: ctx.now,
    idGenerator: () => ctx.nextId('ev'),
  });

  out('No AI Slop — control lifecycle demonstration');
  out('════════════════════════════════════════════');

  // ── Stage 1: Authorization (TC-07) ────────────────────────────────────────
  out('\n1. AUTHORIZE (TC-07 least privilege, deny-by-default)');
  const broker = new AuthzBroker(signer);
  const engine = new AuthorizationEngine(signer);
  const grantBody: GrantBody = {
    id: 'grant_demo_1',
    subjectId: 'agent.frontend',
    capabilities: [{ action: 'fs.write', resource: 'repo://demo-app/src/**' }],
    audience: 'fs-adapter',
    issuer: agentActor('agent.broker', 'Credential Broker'),
    issuedAt: ctx.now(),
    expiresAt: '2999-01-01T00:00:00.000Z',
    nonce: 'nonce-demo-0001',
    maxUses: 1,
    keyId: 'key_demo',
  };
  engine.registerGrant(broker.issue(grantBody));

  const allowReq: AuthorizationRequest = {
    subjectId: 'agent.frontend',
    action: 'fs.write',
    resource: 'repo://demo-app/src/app/page.tsx',
    audience: 'fs-adapter',
    grantId: 'grant_demo_1',
    nonce: 'nonce-demo-0001',
    at: ctx.now(),
    correlationId: 'corr_demo',
  };

  // Evaluate the UNAUTHORIZED attempt first: it is denied and consumes no budget,
  // so the single-use grant is still available for the authorized action.
  const denyReq: AuthorizationRequest = {
    ...allowReq,
    action: 'secret.use',
    resource: 'secret://GITHUB_TOKEN',
  };
  const deny = engine.authorize(denyReq);
  const allow = engine.authorize(allowReq);
  out(`   ALLOW  fs.write repo://demo-app/src/app/page.tsx → ${allow.decision.allowed}`);
  out(`   DENY   secret.use secret://GITHUB_TOKEN → ${deny.decision.denyReason}`);

  // Seal both receipts as evidence.
  log.append(receiptToEvidenceInput(deny.receipt, gateway, context));
  log.append(receiptToEvidenceInput(allow.receipt, gateway, context));

  // ── Stage 2: Evidence (TC-17) ─────────────────────────────────────────────
  out('\n2. SEAL EVIDENCE (TC-17 content-addressed, hash-chained, signed)');
  const evi = (kind: EvidenceInput['kind'], summary: string): EvidenceRecord =>
    log.append({
      kind,
      contentDigest: `sha256:${'d'.repeat(64)}`,
      summary,
      producer: gateway,
      context,
      metadata: {},
    });
  const typecheckEv = evi('test', 'typecheck: 0 errors');
  const lintEv = evi('test', 'lint: 0 problems');
  const unitEv = evi('test', 'unit: 74 passed');
  evi('build', 'production build succeeded');
  evi('accessibility_result', 'axe: 0 serious/critical');
  evi('anti_slop_review', 'anti-slop accepted');
  const chain = log.verify();
  out(`   chain: ${chain.valid ? 'VALID' : 'INVALID'} — ${chain.checkedCount} records`);

  // ── Stage 3: Anti-Slop review ─────────────────────────────────────────────
  out('\n3. ANTI-SLOP REVIEW (13 dimensions, no hidden score)');
  const review: AntiSlopReview = {
    changeType: 'product_feature',
    subject: 'demo: add release dashboard',
    reviewer: agentActor('agent.anti-slop', 'Anti-Slop Reviewer'),
    createdAt: ctx.now(),
    grades: requiredDimensionsFor('product_feature').map((dimension) => ({
      dimension,
      grade: 'pass' as const,
      rationale: 'verified',
      evidenceIds: [],
    })),
    exceptions: [],
  };
  const antiSlop = evaluateReview(review);
  out(`   result: ${antiSlop.accepted ? 'ACCEPTED' : 'BLOCKED'} — ${antiSlop.summary}`);

  // ── Stage 4: Release gate (TC-10) ─────────────────────────────────────────
  out('\n4. RELEASE GATE (TC-10 fail-closed, signed decision)');
  const checks: CheckResult[] = [
    { name: 'typecheck', status: 'pass', evidenceId: typecheckEv.id },
    { name: 'lint', status: 'pass', evidenceId: lintEv.id },
    { name: 'unit', status: 'pass', evidenceId: unitEv.id },
  ];
  const inputs: ReleaseInputs = {
    manifest: {
      buildId: 'build_demo_1',
      orgId: 'org_demo',
      projectId: 'proj_demo',
      artifactDigest: `sha256:${'e'.repeat(64)}`,
      sourceCommit: 'a'.repeat(40),
      targetEnvironment: 'staging',
      createdAt: ctx.now(),
      createdBy: dev,
    },
    policy: STAGING_POLICY,
    checks,
    evidence: log.toJSON(),
    antiSlop,
    hardBlockers: [],
    riskAcceptances: [],
    evaluatedBy: agentActor('agent.release', 'Release Agent'),
  };
  const releaseDeps = {
    signer,
    authority: CLI_AUTHORITY,
    clock: ctx.now,
    idGenerator: () => ctx.nextId('dec'),
  };
  const decision = evaluateRelease(inputs, releaseDeps);
  out(`   verdict: ${decision.verdict.toUpperCase()} (staging)`);
  out(`   signature verifies: ${verifyDecisionSignature(decision, signer)}`);

  // ── Stage 5: Prove fail-closed under tamper ───────────────────────────────
  out('\n5. TAMPER CHECK (fail-closed)');
  const tampered: ReleaseInputs = {
    ...inputs,
    evidence: inputs.evidence.map((r, i) =>
      i === 0 ? { ...r, input: { ...r.input, summary: 'silently altered' } } : r,
    ),
  };
  const tamperedDecision = evaluateRelease(tampered, releaseDeps);
  out(`   after altering one sealed record → verdict: ${tamperedDecision.verdict.toUpperCase()}`);

  const ok =
    allow.decision.allowed &&
    deny.decision.denyReason === 'no_matching_capability' &&
    chain.valid &&
    antiSlop.accepted &&
    decision.verdict === 'pass' &&
    tamperedDecision.verdict === 'blocked';

  out('\n════════════════════════════════════════════');
  out(
    ok
      ? 'Lifecycle OK: authorized → evidenced → reviewed → released; tamper blocked.'
      : 'Lifecycle FAILED — see stages above.',
  );

  if (json) {
    ctx.stdout(
      JSON.stringify(
        {
          authorized: allow.decision.allowed,
          denied: deny.decision.denyReason,
          evidenceValid: chain.valid,
          antiSlopAccepted: antiSlop.accepted,
          verdict: decision.verdict,
          tamperedVerdict: tamperedDecision.verdict,
          decisionSignatureValid: verifyDecisionSignature(decision, signer),
          ok,
        },
        null,
        2,
      ),
    );
  }
  return ok ? 0 : 1;
}
