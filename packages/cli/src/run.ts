import { parseArgs } from './args.js';
import { CliError, type CliContext } from './context.js';
import { evidenceCommand } from './commands/evidence.js';
import { antislopCommand } from './commands/antislop.js';
import { gateCommand } from './commands/gate.js';
import { demoCommand } from './commands/demo.js';

const HELP = `nas — No AI Slop control CLI

Usage:
  nas demo                         Run the control lifecycle end-to-end (in-memory)
  nas evidence add --kind K --summary S (--file P | --content C)
                                   Seal a payload into the TC-17 evidence chain
  nas evidence verify              Verify the sealed evidence chain
  nas evidence list                List sealed evidence records
  nas antislop <review.json>       Evaluate an Anti-Slop review (exit 1 if blocked)
  nas gate <inputs.json>           Evaluate a release; exit 0 pass/warning, 2 fail/blocked
  nas version                      Print the version

Environment:
  NAS_SIGNING_KEY                  Secret used to sign/verify evidence + decisions (required)
  NAS_SIGNING_KEY_ID               Key id label (default: key_local_1)

Flags:
  --json                           Machine-readable output where supported
  --out <path>                     (gate) also write the signed decision to a file`;

/**
 * The whole CLI as a pure function of (argv, context). Returns an exit code and
 * never calls process.exit itself, so it can be driven directly from tests.
 */
export function runCli(argv: string[], ctx: CliContext): number {
  const args = parseArgs(argv);
  const command = args.positionals[0];
  try {
    switch (command) {
      case undefined:
        ctx.stderr(HELP);
        return 1;
      case 'help':
        ctx.stdout(HELP);
        return 0;
      case 'version':
        ctx.stdout('nas 0.1.0');
        return 0;
      case 'evidence':
        return evidenceCommand(ctx, args);
      case 'antislop':
        return antislopCommand(ctx, args);
      case 'gate':
        return gateCommand(ctx, args);
      case 'demo':
        return demoCommand(ctx, args);
      default:
        ctx.stderr(`error: unknown command "${command}"`);
        ctx.stderr(HELP);
        return 1;
    }
  } catch (err) {
    if (err instanceof CliError) {
      ctx.stderr(`error: ${err.message}`);
      return err.exitCode;
    }
    ctx.stderr(`error: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
}
