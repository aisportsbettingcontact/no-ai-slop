import { describe, expect, it } from 'vitest';
import { agentActor, type EvidenceInput, type EvidenceRecord } from '@nas/contracts';
import { EvidenceLog, HmacSigner, counterIdGenerator } from './index.js';

/** Deterministic clock: fixed epoch, +1s per call. */
function seqClock(): () => string {
  let t = Date.parse('2026-01-01T00:00:00.000Z');
  return () => {
    const iso = new Date(t).toISOString();
    t += 1000;
    return iso;
  };
}

const authority = agentActor('agent.evidence-authority', 'Evidence Authority');
const producer = agentActor('agent.test', 'Test Agent');

function makeLog() {
  const signer = new HmacSigner({ key_ev_1: 'evidence-signing-secret-01' }, 'key_ev_1');
  const log = new EvidenceLog({
    signer,
    authority,
    clock: seqClock(),
    idGenerator: counterIdGenerator('ev'),
  });
  return { signer, log };
}

function input(summary: string, digestChar = 'a'): EvidenceInput {
  return {
    kind: 'test',
    contentDigest: `sha256:${digestChar.repeat(64)}`,
    summary,
    producer,
    context: { orgId: 'org_acme', projectId: 'proj_web', correlationId: 'corr_1' },
    metadata: {},
  };
}

describe('EvidenceLog sealing', () => {
  it('seals records into a verifiable, linked chain', () => {
    const { log } = makeLog();
    log.append(input('one', 'a'));
    log.append(input('two', 'b'));
    log.append(input('three', 'c'));

    const v = log.verify();
    expect(v.valid).toBe(true);
    expect(v.reasons).toEqual([]);
    expect(v.checkedCount).toBe(3);

    const records = log.records;
    expect(records[0]!.prevDigest).toBeNull();
    expect(records[1]!.prevDigest).toBe(records[0]!.recordDigest);
    expect(records[2]!.prevDigest).toBe(records[1]!.recordDigest);
    expect(records.map((r) => r.sequence)).toEqual([0, 1, 2]);
  });

  it('produces a signed record with a hmac-sha256 signature and named authority', () => {
    const { log } = makeLog();
    const rec = log.append(input('one'));
    expect(rec.signature.algorithm).toBe('hmac-sha256');
    expect(rec.signature.value).toMatch(/^[0-9a-f]{64}$/);
    expect(rec.signedBy.id).toBe('agent.evidence-authority');
    expect(rec.recordDigest).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it('an empty chain verifies vacuously (nothing to check)', () => {
    const { log } = makeLog();
    expect(log.verify()).toEqual({ valid: true, reasons: [], checkedCount: 0 });
  });
});

describe('EvidenceLog tamper detection (fail-closed)', () => {
  it('detects mutation of a sealed record body', () => {
    const { log, signer } = makeLog();
    log.append(input('one'));
    log.append(input('two'));
    const tampered = structuredClone(log.toJSON());
    tampered[1]!.input.summary = 'two (tampered)';

    const v = EvidenceLog.verifyChain(tampered, signer);
    expect(v.valid).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/content digest mismatch/);
  });

  it('detects a forged signature (wrong signing key)', () => {
    const { log } = makeLog();
    log.append(input('one'));
    const foreignSigner = new HmacSigner({ key_ev_1: 'a-different-attacker-secret' }, 'key_ev_1');
    // The chain is intact, but our real signer must reject a signature it did not make.
    const forged = structuredClone(log.toJSON());
    forged[0]!.signature = foreignSigner.sign(
      forged[0]!.recordDigest,
    ) as EvidenceRecord['signature'] & {
      algorithm: 'hmac-sha256';
    };
    const realSigner = new HmacSigner({ key_ev_1: 'evidence-signing-secret-01' }, 'key_ev_1');
    const v = EvidenceLog.verifyChain(forged, realSigner);
    expect(v.valid).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/signature invalid/);
  });

  it('detects a record signed by an unknown key', () => {
    const { log } = makeLog();
    log.append(input('one'));
    const rec = structuredClone(log.toJSON());
    rec[0]!.signature.keyId = 'key_unknown';
    const signer = new HmacSigner({ key_ev_1: 'evidence-signing-secret-01' }, 'key_ev_1');
    expect(EvidenceLog.verifyChain(rec, signer).valid).toBe(false);
  });

  it('detects deletion of a middle record (broken linkage)', () => {
    const { log, signer } = makeLog();
    log.append(input('one'));
    log.append(input('two'));
    log.append(input('three'));
    const withGap = log.toJSON().filter((_, i) => i !== 1);
    const v = EvidenceLog.verifyChain(withGap, signer);
    expect(v.valid).toBe(false);
    expect(v.reasons.join(' ')).toMatch(/broken chain link|sequence/);
  });

  it('detects reordering of records', () => {
    const { log, signer } = makeLog();
    log.append(input('one'));
    log.append(input('two'));
    const reversed = [...log.toJSON()].reverse();
    expect(EvidenceLog.verifyChain(reversed, signer).valid).toBe(false);
  });
});

describe('EvidenceLog load-time verification', () => {
  it('refuses to continue from an invalid chain', () => {
    const { log } = makeLog();
    log.append(input('one'));
    const tampered = structuredClone(log.toJSON());
    tampered[0]!.input.summary = 'mutated';
    const signer = new HmacSigner({ key_ev_1: 'evidence-signing-secret-01' }, 'key_ev_1');
    expect(
      () =>
        new EvidenceLog({
          signer,
          authority,
          clock: seqClock(),
          idGenerator: counterIdGenerator('ev'),
          initial: tampered,
        }),
    ).toThrow(/invalid chain/);
  });

  it('continues a valid chain and keeps it linked', () => {
    const { log, signer } = makeLog();
    log.append(input('one'));
    log.append(input('two'));
    const resumed = new EvidenceLog({
      signer,
      authority,
      clock: seqClock(),
      idGenerator: counterIdGenerator('ev', 2),
      initial: log.toJSON(),
    });
    const appended = resumed.append(input('three'));
    expect(appended.prevDigest).toBe(log.records[1]!.recordDigest);
    expect(resumed.verify().valid).toBe(true);
  });
});
