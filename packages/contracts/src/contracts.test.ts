import { describe, expect, it } from 'vitest';
import {
  Action,
  ALL_DIMENSIONS,
  Actor,
  EvidenceInput,
  Grant,
  ReleaseManifest,
  Sha256Digest,
  agentActor,
  userActor,
} from './index.js';

describe('id + digest contracts', () => {
  it('accepts a well-formed sha256 digest and rejects malformed', () => {
    expect(Sha256Digest.safeParse('sha256:' + 'a'.repeat(64)).success).toBe(true);
    expect(Sha256Digest.safeParse('sha256:abc').success).toBe(false);
    expect(Sha256Digest.safeParse('a'.repeat(64)).success).toBe(false);
  });
});

describe('actor helpers', () => {
  it('builds user and agent actors with the right kind', () => {
    expect(userActor('u_1', 'Ada').kind).toBe('user');
    expect(agentActor('agent.frontend', 'Frontend Agent').kind).toBe('agent');
  });

  it('validates against the Actor schema', () => {
    expect(Actor.safeParse(userActor('u_1', 'Ada', 'org_acme')).success).toBe(true);
  });
});

describe('anti-slop dimensions', () => {
  it('exposes exactly the thirteen fixed dimensions', () => {
    expect(ALL_DIMENSIONS).toHaveLength(13);
    expect(new Set(ALL_DIMENSIONS).size).toBe(13);
  });
});

describe('authz contract', () => {
  it('rejects a grant with no capabilities (least privilege needs at least one)', () => {
    const bad = {
      id: 'grant_1',
      subjectId: 'agent.frontend',
      capabilities: [],
      audience: 'fs-adapter',
      issuer: agentActor('agent.broker', 'Broker'),
      issuedAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-01T00:05:00.000Z',
      nonce: 'nonce-abcdef12',
      maxUses: 1,
      keyId: 'key_broker_1',
      signature: 'a'.repeat(64),
    };
    expect(Grant.safeParse(bad).success).toBe(false);
  });

  it('enumerates privileged actions (closed set)', () => {
    expect(Action.safeParse('fs.write').success).toBe(true);
    expect(Action.safeParse('fs.delete').success).toBe(false);
  });
});

describe('evidence + release contracts', () => {
  it('defaults evidence metadata to an empty object', () => {
    const parsed = EvidenceInput.parse({
      kind: 'test',
      contentDigest: 'sha256:' + 'b'.repeat(64),
      summary: 'unit suite green',
      producer: agentActor('agent.test', 'Test Agent'),
      context: {
        orgId: 'org_acme',
        projectId: 'proj_web',
        correlationId: 'corr_1',
      },
    });
    expect(parsed.metadata).toEqual({});
  });

  it('requires a 40-char commit sha on the release manifest', () => {
    const base = {
      buildId: 'build_1',
      orgId: 'org_acme',
      projectId: 'proj_web',
      artifactDigest: 'sha256:' + 'c'.repeat(64),
      targetEnvironment: 'staging',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdBy: userActor('u_1', 'Ada'),
    };
    expect(ReleaseManifest.safeParse({ ...base, sourceCommit: 'f'.repeat(40) }).success).toBe(true);
    expect(ReleaseManifest.safeParse({ ...base, sourceCommit: 'abc' }).success).toBe(false);
  });
});
