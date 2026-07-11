import { beforeEach, describe, expect, it } from 'vitest';
import { agentActor, type AuthorizationRequest, type GrantBody } from '@nas/contracts';
import { HmacSigner } from '@nas/kernel-evidence';
import { AuthorizationEngine, AuthzBroker, receiptToEvidenceInput } from './index.js';

const brokerKey = { key_broker_1: 'broker-signing-secret-0001' };
const signer = () => new HmacSigner(brokerKey, 'key_broker_1');
const brokerActor = agentActor('agent.broker', 'Credential Broker');

function grantBody(overrides: Partial<GrantBody> = {}): GrantBody {
  return {
    id: 'grant_fs_1',
    subjectId: 'agent.frontend',
    capabilities: [{ action: 'fs.write', resource: 'repo://acme-web/src/**' }],
    audience: 'fs-adapter',
    issuer: brokerActor,
    issuedAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2026-01-01T00:05:00.000Z',
    nonce: 'nonce-abcdef12',
    maxUses: 1,
    keyId: 'key_broker_1',
    ...overrides,
  };
}

function request(overrides: Partial<AuthorizationRequest> = {}): AuthorizationRequest {
  return {
    subjectId: 'agent.frontend',
    action: 'fs.write',
    resource: 'repo://acme-web/src/app/page.tsx',
    audience: 'fs-adapter',
    grantId: 'grant_fs_1',
    nonce: 'nonce-abcdef12',
    at: '2026-01-01T00:01:00.000Z',
    correlationId: 'corr_1',
    ...overrides,
  };
}

let broker: AuthzBroker;
let engine: AuthorizationEngine;

beforeEach(() => {
  broker = new AuthzBroker(signer());
  engine = new AuthorizationEngine(signer());
});

describe('happy path', () => {
  it('authorizes a request that matches a valid grant capability', () => {
    engine.registerGrant(broker.issue(grantBody()));
    const { decision, receipt } = engine.authorize(request());
    expect(decision.allowed).toBe(true);
    expect(decision.matchedCapability).toEqual({
      action: 'fs.write',
      resource: 'repo://acme-web/src/**',
    });
    expect(decision.denyReason).toBeUndefined();
    expect(receipt.bodyDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe('deny-by-default', () => {
  it('denies when no grant is registered', () => {
    expect(engine.authorize(request()).decision.denyReason).toBe('no_grant');
  });

  it('denies a forged grant (signature does not verify)', () => {
    const attacker = new AuthzBroker(
      new HmacSigner({ key_broker_1: 'attacker-secret-000001' }, 'key_broker_1'),
    );
    engine.registerGrant(attacker.issue(grantBody()));
    expect(engine.authorize(request()).decision.denyReason).toBe('grant_signature_invalid');
  });

  it('denies when the subject does not match the grant', () => {
    engine.registerGrant(broker.issue(grantBody()));
    expect(engine.authorize(request({ subjectId: 'agent.backend' })).decision.denyReason).toBe(
      'subject_mismatch',
    );
  });

  it('denies when the audience does not match (audience binding)', () => {
    engine.registerGrant(broker.issue(grantBody()));
    expect(engine.authorize(request({ audience: 'git-adapter' })).decision.denyReason).toBe(
      'audience_mismatch',
    );
  });

  it('denies an expired grant', () => {
    engine.registerGrant(broker.issue(grantBody()));
    expect(engine.authorize(request({ at: '2026-01-01T00:06:00.000Z' })).decision.denyReason).toBe(
      'expired',
    );
  });

  it('denies a not-yet-valid grant', () => {
    engine.registerGrant(broker.issue(grantBody({ notBefore: '2026-01-01T00:02:00.000Z' })));
    expect(engine.authorize(request({ at: '2026-01-01T00:01:00.000Z' })).decision.denyReason).toBe(
      'not_yet_valid',
    );
  });

  it('denies when the nonce does not match', () => {
    engine.registerGrant(broker.issue(grantBody()));
    expect(engine.authorize(request({ nonce: 'nonce-wrong-999' })).decision.denyReason).toBe(
      'nonce_mismatch',
    );
  });

  it('denies an action the grant does not authorize', () => {
    engine.registerGrant(broker.issue(grantBody()));
    expect(engine.authorize(request({ action: 'secret.use' })).decision.denyReason).toBe(
      'no_matching_capability',
    );
  });

  it('denies a resource outside the grant pattern', () => {
    engine.registerGrant(broker.issue(grantBody()));
    const { decision } = engine.authorize(request({ resource: 'repo://acme-web/.env' }));
    expect(decision.denyReason).toBe('no_matching_capability');
  });
});

describe('replay + use budget', () => {
  it('rejects replay of a single-use grant', () => {
    engine.registerGrant(broker.issue(grantBody()));
    expect(engine.authorize(request()).decision.allowed).toBe(true);
    const second = engine.authorize(request());
    expect(second.decision.allowed).toBe(false);
    expect(second.decision.denyReason).toBe('replayed');
  });

  it('honors a multi-use budget then reports exhaustion', () => {
    engine.registerGrant(broker.issue(grantBody({ maxUses: 2 })));
    expect(engine.authorize(request()).decision.allowed).toBe(true);
    expect(engine.authorize(request()).decision.allowed).toBe(true);
    expect(engine.authorize(request()).decision.denyReason).toBe('uses_exhausted');
    expect(engine.usesConsumed('grant_fs_1')).toBe(2);
  });

  it('does not consume budget on a denied (unauthorized) attempt', () => {
    engine.registerGrant(broker.issue(grantBody()));
    engine.authorize(request({ action: 'secret.use' })); // denied, no consume
    expect(engine.usesConsumed('grant_fs_1')).toBe(0);
    expect(engine.authorize(request()).decision.allowed).toBe(true); // still usable
  });
});

describe('receipts as evidence', () => {
  it('produces a sealed-ready evidence input reflecting the decision', () => {
    engine.registerGrant(broker.issue(grantBody()));
    const { receipt } = engine.authorize(request());
    const input = receiptToEvidenceInput(receipt, agentActor('agent.gateway', 'Tool Gateway'), {
      orgId: 'org_acme',
      projectId: 'proj_web',
      correlationId: 'corr_1',
    });
    expect(input.kind).toBe('authz_receipt');
    expect(input.contentDigest).toBe(receipt.bodyDigest);
    expect(input.summary).toContain('ALLOW');
    expect(input.metadata.allowed).toBe(true);
  });
});
