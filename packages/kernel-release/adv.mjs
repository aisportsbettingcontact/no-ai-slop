import { EvidenceLog, HmacSigner, counterIdGenerator } from '@nas/kernel-evidence';
import { agentActor, userActor } from '@nas/contracts';
import {
  PRODUCTION_POLICY,
  evaluateRelease,
  verifyDecisionSignature,
  decisionAuthorizesDeploy,
} from './dist/index.js';

function seqClock() {
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
function makeSigner() {
  return new HmacSigner({ key_rel_1: 'release-and-evidence-secret-01' }, 'key_rel_1');
}
function evInput(kind, summary) {
  return {
    kind,
    contentDigest: `sha256:${'a'.repeat(64)}`,
    summary,
    producer,
    context: { orgId: 'org_acme', projectId: 'proj_web', correlationId: 'corr_rel' },
    metadata: {},
  };
}
const manifest = {
  buildId: 'build_42',
  orgId: 'org_acme',
  projectId: 'proj_web',
  artifactDigest: `sha256:${'c'.repeat(64)}`,
  sourceCommit: 'a'.repeat(40),
  targetEnvironment: 'production',
  createdAt: '2026-05-01T00:00:00.000Z',
  createdBy: userActor('u_dev', 'Dev Author'),
};
const acceptedAntiSlop = {
  accepted: true,
  changeType: 'product_feature',
  requiredDimensions: ['product_correctness'],
  blocking: [],
  concerns: [],
  exceptionsApplied: [],
  summary: 'Accepted.',
};
let signer = makeSigner();

function passingProductionInputs() {
  const log = new EvidenceLog({
    signer,
    authority: evidenceAuthority,
    clock: seqClock(),
    idGenerator: counterIdGenerator('ev'),
  });
  const checks = PRODUCTION_POLICY.requiredChecks.map((name) => {
    const kind =
      name === 'accessibility' ? 'accessibility_result' : name === 'security' ? 'command' : 'test';
    const rec = log.append(evInput(kind, `${name} passed`));
    return { name, status: 'pass', evidenceId: rec.id, detail: `${name} ok` };
  });
  log.append(evInput('build', 'production build succeeded'));
  log.append(evInput('anti_slop_review', 'anti-slop accepted'));
  const inputs = {
    manifest,
    policy: PRODUCTION_POLICY,
    checks,
    evidence: log.toJSON(),
    antiSlop: acceptedAntiSlop,
    independentReview: {
      reviewer: userActor('u_reviewer', 'Independent Reviewer'),
      authorId: 'u_dev',
      approved: true,
      rationale: 'ok',
      reviewedAt: '2026-05-01T00:02:00.000Z',
    },
    hardBlockers: [],
    riskAcceptances: [],
    evaluatedBy: agentActor('agent.release', 'Release Agent'),
  };
  return inputs;
}
const deps = () => ({
  signer,
  authority,
  clock: seqClock(),
  idGenerator: counterIdGenerator('dec'),
});

function run(label, mutate) {
  signer = makeSigner();
  const inputs = passingProductionInputs();
  mutate(inputs);
  let d;
  try {
    d = evaluateRelease(inputs, deps());
  } catch (e) {
    console.log(`${label}: THREW ${e.message}`);
    return;
  }
  const authz = decisionAuthorizesDeploy(d);
  console.log(
    `${label}: verdict=${d.verdict} authorizesDeploy=${authz} blocking=${JSON.stringify(d.blocking)}`,
  );
}

// Baseline
run('BASELINE (should pass)', () => {});

// ATTACK 1: anti-slop accepted=true but blocking full of fails (self-contradictory)
run('A1 antiSlop accepted:true w/ blocking fails', (i) => {
  i.antiSlop = {
    ...acceptedAntiSlop,
    accepted: true,
    blocking: [{ dimension: 'security_impact', grade: 'fail', reason: 'RCE' }],
    summary: 'contradiction',
  };
});

// ATTACK 2: self-review disguised by lying about authorId
run('A2 author self-approves via fake authorId', (i) => {
  i.independentReview = {
    reviewer: userActor('u_dev', 'Dev Author'),
    authorId: 'u_not_the_author',
    approved: true,
    rationale: 'lgtm',
    reviewedAt: '2026-05-01T00:02:00.000Z',
  };
});

// ATTACK 3: required check cites evidence of a legit record but for a totally unrelated kind (kind bypass)
// security check cites the 'build' evidence id
run('A3 security check cites build evidence', (i) => {
  const buildRec = i.evidence.find((e) => e.input.kind === 'build');
  i.checks = i.checks.map((c) => (c.name === 'security' ? { ...c, evidenceId: buildRec.id } : c));
});

// ATTACK 4: tamper signedBy on an evidence record (unsigned field) — does chain still verify?
run('A4 tamper evidence signedBy actor', (i) => {
  i.evidence = structuredClone(i.evidence);
  i.evidence[0].signedBy = agentActor('agent.attacker', 'Attacker');
});

// ATTACK 5: truncate chain suffix (drop trailing evidence)
run('A5 truncate last evidence record', (i) => {
  i.evidence = i.evidence.slice(0, -1);
});

// ATTACK 6: duplicate check name, failing then passing (shadowing)
run('A6 duplicate integration check fail then pass', (i) => {
  const good = i.checks.find((c) => c.name === 'integration');
  i.checks = [...i.checks, { name: 'integration', status: 'fail', detail: 'broken' }];
  // note fail added AFTER pass -> Map keeps last = fail. Now put pass last:
  i.checks = i.checks.filter((c) => !(c.name === 'integration' && c.status === 'fail'));
  i.checks.push({ name: 'integration', status: 'fail', detail: 'broken' });
  i.checks.push({ name: 'integration', status: 'pass', evidenceId: good.evidenceId });
});

// ATTACK 7: verdict flip after signing
signer = makeSigner();
{
  const inputs = passingProductionInputs();
  inputs.hardBlockers = ['freeze'];
  const blockedDecision = evaluateRelease(inputs, deps());
  const forged = { ...blockedDecision, verdict: 'pass', blocking: [] };
  console.log(
    `A7 verdict flip: original=${blockedDecision.verdict} origVerifies=${verifyDecisionSignature(blockedDecision, signer)} forgedVerifies=${verifyDecisionSignature(forged, signer)} forgedAuthorizes=${decisionAuthorizesDeploy(forged)}`,
  );
}
