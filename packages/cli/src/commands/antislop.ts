import { readFileSync } from 'node:fs';
import { AntiSlopReview } from '@nas/contracts';
import { evaluateReview } from '@nas/anti-slop';
import { type ParsedArgs } from '../args.js';
import { CliError, type CliContext } from '../context.js';

/**
 * `nas antislop <review.json>` — evaluate an Anti-Slop review and print the gate
 * result. Exit 0 when accepted, 1 when blocked. Never prints a single score; it
 * lists the exact blocking dimensions.
 */
export function antislopCommand(ctx: CliContext, args: ParsedArgs): number {
  const path = args.positionals[1];
  if (!path) throw new CliError('usage: nas antislop <review.json>');

  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  const review = AntiSlopReview.safeParse(parsed);
  if (!review.success) {
    throw new CliError(`invalid anti-slop review: ${review.error.message}`);
  }

  const result = evaluateReview(review.data);
  if (args.flags.json) {
    ctx.stdout(JSON.stringify(result, null, 2));
    return result.accepted ? 0 : 1;
  }

  ctx.stdout(`Anti-Slop review — ${review.data.changeType} — ${review.data.subject}`);
  ctx.stdout(result.accepted ? '  RESULT: ACCEPTED' : '  RESULT: BLOCKED');
  ctx.stdout(`  ${result.summary}`);
  if (result.blocking.length > 0) {
    ctx.stdout('  Blocking dimensions:');
    for (const b of result.blocking) ctx.stdout(`    ✗ ${b.dimension} [${b.grade}] — ${b.reason}`);
  }
  if (result.concerns.length > 0) {
    ctx.stdout('  Documented concerns:');
    for (const c of result.concerns) ctx.stdout(`    ! ${c.dimension} — ${c.rationale}`);
  }
  return result.accepted ? 0 : 1;
}
