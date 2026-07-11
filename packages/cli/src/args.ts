import { CliError } from './context.js';

/** Minimal, dependency-free flag parser: `--key value` and `--flag` (boolean). */
export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, string | true>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i += 1;
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

/** Read a required string flag or fail with a clear message. */
export function requireFlag(args: ParsedArgs, name: string): string {
  const value = args.flags[name];
  if (typeof value !== 'string' || value.length === 0) {
    throw new CliError(`missing required flag --${name}`);
  }
  return value;
}

export function optionalFlag(args: ParsedArgs, name: string): string | undefined {
  const value = args.flags[name];
  return typeof value === 'string' ? value : undefined;
}
