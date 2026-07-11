import { randomUUID } from 'node:crypto';
import { HmacSigner, type Signer } from '@nas/kernel-evidence';
import { agentActor, type Actor } from '@nas/contracts';

/**
 * Everything the CLI touches from the outside world is injected here so the whole
 * tool is deterministic and testable: no ambient clock, no ambient randomness, no
 * direct process.stdout. Tests pass a fake context; the real entrypoint passes the
 * process one.
 */
export interface CliContext {
  cwd: string;
  env: Record<string, string | undefined>;
  now: () => string;
  nextId: (prefix: string) => string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export function processContext(): CliContext {
  return {
    cwd: process.cwd(),
    env: process.env,
    now: () => new Date().toISOString(),
    nextId: (prefix) => `${prefix}_${randomUUID()}`,
    stdout: (line) => process.stdout.write(`${line}\n`),
    stderr: (line) => process.stderr.write(`${line}\n`),
  };
}

/** The identity the CLI records as the sealing/signing authority. */
export const CLI_AUTHORITY: Actor = agentActor('agent.nas-cli', 'nas CLI');

/**
 * Build the signing authority from a secret *reference* in the environment. We
 * never accept a key on the command line (it would land in shell history / process
 * listings) and never hard-code one. Fail-closed: no key → no signing.
 */
export function buildSigner(ctx: CliContext): Signer {
  const secret = ctx.env.NAS_SIGNING_KEY;
  if (!secret || secret.length < 16) {
    throw new CliError(
      'NAS_SIGNING_KEY is not set (or is shorter than 16 chars). Evidence and release ' +
        'decisions must be signed by a real key — export NAS_SIGNING_KEY before running this command.',
    );
  }
  const keyId = ctx.env.NAS_SIGNING_KEY_ID ?? 'key_local_1';
  return new HmacSigner({ [keyId]: secret }, keyId);
}

/** A user-facing error whose message is safe to print (no secrets, no stack noise). */
export class CliError extends Error {
  readonly exitCode: number;
  constructor(message: string, exitCode = 1) {
    super(message);
    this.name = 'CliError';
    this.exitCode = exitCode;
  }
}
