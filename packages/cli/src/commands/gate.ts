import { readFileSync, writeFileSync } from 'node:fs';
import { ReleaseInputs } from '@nas/contracts';
import { evaluateRelease } from '@nas/kernel-release';
import { optionalFlag, type ParsedArgs } from '../args.js';
import { buildSigner, CLI_AUTHORITY, CliError, type CliContext } from '../context.js';

/**
 * `nas gate <inputs.json>` — evaluate a release against its policy and emit a
 * signed decision. Exit codes are the whole point: 0 authorizes deploy
 * (pass/warning), 2 refuses (fail/blocked). A CI job can gate on this directly.
 */
export function gateCommand(ctx: CliContext, args: ParsedArgs): number {
  const path = args.positionals[1];
  if (!path) throw new CliError('usage: nas gate <inputs.json> [--out decision.json] [--json]');

  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const inputs = ReleaseInputs.safeParse(parsed);
  if (!inputs.success) {
    throw new CliError(`invalid release inputs: ${inputs.error.message}`);
  }

  const signer = buildSigner(ctx);
  const decision = evaluateRelease(inputs.data, {
    signer,
    authority: CLI_AUTHORITY,
    clock: ctx.now,
    idGenerator: () => ctx.nextId('dec'),
  });

  const out = optionalFlag(args, 'out');
  if (out) writeFileSync(out, `${JSON.stringify(decision, null, 2)}\n`, 'utf8');

  if (args.flags.json) {
    ctx.stdout(JSON.stringify(decision, null, 2));
  } else {
    ctx.stdout(`Release ${decision.manifest.buildId} → ${decision.manifest.targetEnvironment}`);
    ctx.stdout(`  VERDICT: ${decision.verdict.toUpperCase()}`);
    ctx.stdout(`  artifact: ${decision.manifest.artifactDigest}`);
    ctx.stdout(`  source:   ${decision.manifest.sourceCommit}`);
    ctx.stdout(`  signed:   ${decision.signature.keyId} (${decision.signature.algorithm})`);
    if (decision.blocking.length > 0) {
      ctx.stdout('  Blocking:');
      for (const b of decision.blocking) ctx.stdout(`    ✗ ${b}`);
    }
    if (decision.warnings.length > 0) {
      ctx.stdout('  Warnings:');
      for (const w of decision.warnings) ctx.stdout(`    ! ${w}`);
    }
  }

  // Fail-closed exit codes: only pass/warning authorize a deploy.
  return decision.verdict === 'pass' || decision.verdict === 'warning' ? 0 : 2;
}
