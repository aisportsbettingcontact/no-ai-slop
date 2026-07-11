import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  agentActor,
  userActor,
  type AntiSlopReview,
  type CheckResult,
  type EvidenceInput,
  type ReleaseInputs,
} from '@nas/contracts';
import { EvidenceLog, HmacSigner, counterIdGenerator } from '@nas/kernel-evidence';
import { requiredDimensionsFor, evaluateReview } from '@nas/anti-slop';
import { STAGING_POLICY } from '@nas/kernel-release';
import { runCli, type CliContext } from './index.js';

const SECRET = 'cli-test-signing-secret-01';

interface Captured {
  ctx: CliContext;
  out: string[];
  err: string[];
  dir: string;
}

const dirs: string[] = [];

function makeCtx(env: Record<string, string | undefined> = {}): Captured {
  const dir = mkdtempSync(join(tmpdir(), 'nas-cli-'));
  dirs.push(dir);
  const out: string[] = [];
  const err: string[] = [];
  let clockT = Date.parse('2026-06-01T00:00:00.000Z');
  const nextId = counterIdGenerator('id');
  const ctx: CliContext = {
    cwd: dir,
    env: { NAS_SIGNING_KEY: SECRET, ...env },
    now: () => {
      const iso = new Date(clockT).toISOString();
      clockT += 1000;
      return iso;
    },
    nextId: (prefix) => `${prefix}_${nextId()}`,
    stdout: (l) => out.push(l),
    stderr: (l) => err.push(l),
  };
  return { ctx, out, err, dir };
}

afterEach(() => {
  // temp dirs are under the OS tmp; left for the OS to reclaim.
  dirs.length = 0;
});

describe('nas demo', () => {
  it('runs the full lifecycle and reports OK', () => {
    const { ctx, out } = makeCtx();
    const code = runCli(['demo', '--json'], ctx);
    expect(code).toBe(0);
    const json = JSON.parse(out.at(-1)!);
    expect(json).toMatchObject({
      authorized: true,
      denied: 'no_matching_capability',
      evidenceValid: true,
      antiSlopAccepted: true,
      verdict: 'pass',
      tamperedVerdict: 'blocked',
      decisionSignatureValid: true,
      ok: true,
    });
  });
});

describe('nas evidence', () => {
  it('seals and verifies a chain, and fails closed without a key', () => {
    const { ctx, out } = makeCtx();
    expect(
      runCli(['evidence', 'add', '--kind', 'test', '--summary', 'unit ok', '--content', 'hi'], ctx),
    ).toBe(0);
    expect(
      runCli(
        ['evidence', 'add', '--kind', 'build', '--summary', 'built', '--content', 'artifact'],
        ctx,
      ),
    ).toBe(0);
    expect(runCli(['evidence', 'verify'], ctx)).toBe(0);
    expect(out.join('\n')).toMatch(/chain VALID — 2 record/);

    const { ctx: noKey, err } = makeCtx({ NAS_SIGNING_KEY: undefined });
    expect(runCli(['evidence', 'verify'], noKey)).toBe(1);
    expect(err.join('\n')).toMatch(/NAS_SIGNING_KEY is not set/);
  });

  it('detects a tampered chain file on disk', () => {
    const { ctx, dir } = makeCtx();
    runCli(['evidence', 'add', '--kind', 'test', '--summary', 'ok', '--content', 'x'], ctx);
    const chainPath = join(dir, '.nas', 'evidence', 'chain.json');
    const chain = JSON.parse(readFileSync(chainPath, 'utf8'));
    chain[0].input.summary = 'tampered on disk';
    writeFileSync(chainPath, JSON.stringify(chain));
    // Reopening a tampered chain must fail closed.
    const { ctx: reopened } = { ctx };
    reopened.cwd = dir;
    expect(runCli(['evidence', 'verify'], reopened)).toBe(1);
  });
});

describe('nas antislop', () => {
  function writeReview(dir: string, accepted: boolean): string {
    const grades = requiredDimensionsFor('bug_fix').map((dimension) => ({
      dimension,
      grade: (accepted ? 'pass' : dimension === 'test_depth' ? 'fail' : 'pass') as 'pass' | 'fail',
      rationale: 'r',
      evidenceIds: [],
    }));
    const review: AntiSlopReview = {
      changeType: 'bug_fix',
      subject: 'fix off-by-one',
      reviewer: agentActor('agent.anti-slop', 'Anti-Slop Reviewer'),
      createdAt: '2026-06-01T00:00:00.000Z',
      grades,
      exceptions: [],
    };
    const p = join(dir, 'review.json');
    writeFileSync(p, JSON.stringify(review));
    return p;
  }

  it('exits 0 when accepted and 1 when blocked', () => {
    const { ctx, dir } = makeCtx();
    expect(runCli(['antislop', writeReview(dir, true)], ctx)).toBe(0);
    expect(runCli(['antislop', writeReview(dir, false)], ctx)).toBe(1);
  });
});

describe('nas gate', () => {
  function writeInputs(dir: string, opts: { hardBlock?: boolean } = {}): string {
    const signer = new HmacSigner({ key_local_1: SECRET }, 'key_local_1');
    const log = new EvidenceLog({
      signer,
      authority: agentActor('agent.evidence-authority', 'Evidence Authority'),
      clock: (() => {
        let t = Date.parse('2026-06-01T00:00:00.000Z');
        return () => {
          const iso = new Date(t).toISOString();
          t += 1000;
          return iso;
        };
      })(),
      idGenerator: counterIdGenerator('ev'),
    });
    const ev = (kind: EvidenceInput['kind'], summary: string) =>
      log.append({
        kind,
        contentDigest: `sha256:${'a'.repeat(64)}`,
        summary,
        producer: agentActor('agent.gateway', 'Tool Gateway'),
        context: { orgId: 'o', projectId: 'p', correlationId: 'c' },
        metadata: {},
      });
    const t = ev('test', 'unit ok');
    ev('build', 'built');
    const checks: CheckResult[] = [
      { name: 'typecheck', status: 'pass', evidenceId: t.id },
      { name: 'lint', status: 'pass', evidenceId: t.id },
      { name: 'unit', status: 'pass', evidenceId: t.id },
    ];
    const antiSlop = evaluateReview({
      changeType: 'bug_fix',
      subject: 's',
      reviewer: agentActor('agent.anti-slop', 'Anti-Slop'),
      createdAt: '2026-06-01T00:00:00.000Z',
      grades: requiredDimensionsFor('bug_fix').map((dimension) => ({
        dimension,
        grade: 'pass' as const,
        rationale: 'r',
        evidenceIds: [],
      })),
      exceptions: [],
    });
    const inputs: ReleaseInputs = {
      manifest: {
        buildId: 'b1',
        orgId: 'o',
        projectId: 'p',
        artifactDigest: `sha256:${'c'.repeat(64)}`,
        sourceCommit: 'a'.repeat(40),
        targetEnvironment: 'staging',
        createdAt: '2026-06-01T00:00:00.000Z',
        createdBy: userActor('u_dev', 'Dev'),
      },
      policy: STAGING_POLICY,
      checks,
      evidence: log.toJSON(),
      antiSlop,
      hardBlockers: opts.hardBlock ? ['freeze window'] : [],
      riskAcceptances: [],
      evaluatedBy: agentActor('agent.release', 'Release'),
    };
    const p = join(dir, 'inputs.json');
    writeFileSync(p, JSON.stringify(inputs));
    return p;
  }

  it('exits 0 and authorizes deploy for a clean staging release', () => {
    const { ctx, out, dir } = makeCtx();
    const code = runCli(['gate', writeInputs(dir), '--json'], ctx);
    expect(code).toBe(0);
    expect(JSON.parse(out.at(-1)!).verdict).toBe('pass');
  });

  it('exits 2 (refuses deploy) when a hard blocker is present', () => {
    const { ctx, dir } = makeCtx();
    expect(runCli(['gate', writeInputs(dir, { hardBlock: true })], ctx)).toBe(2);
  });
});

describe('help / unknown', () => {
  it('prints help and returns non-zero with no command', () => {
    const { ctx, err } = makeCtx();
    expect(runCli([], ctx)).toBe(1);
    expect(err.join('\n')).toMatch(/No AI Slop control CLI/);
  });
});
