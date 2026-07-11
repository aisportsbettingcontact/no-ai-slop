import { existsSync, readFileSync } from 'node:fs';
import { digestBytes } from '@nas/crypto';
import { EvidenceKind, type EvidenceInput } from '@nas/contracts';
import { optionalFlag, requireFlag, type ParsedArgs } from '../args.js';
import { buildSigner, CLI_AUTHORITY, CliError, type CliContext } from '../context.js';
import { EvidenceStore } from '../store.js';

/**
 * `nas evidence add` — content-address a payload (a file or inline string) and
 * seal it into the chain. `nas evidence verify` / `list` inspect the chain.
 */
export function evidenceCommand(ctx: CliContext, args: ParsedArgs): number {
  const sub = args.positionals[1];
  switch (sub) {
    case 'add':
      return evidenceAdd(ctx, args);
    case 'verify':
      return evidenceVerify(ctx);
    case 'list':
      return evidenceList(ctx);
    default:
      throw new CliError(`unknown evidence subcommand "${sub ?? ''}". Use add | verify | list.`);
  }
}

function evidenceAdd(ctx: CliContext, args: ParsedArgs): number {
  const kindRaw = requireFlag(args, 'kind');
  const kind = EvidenceKind.safeParse(kindRaw);
  if (!kind.success) {
    throw new CliError(`invalid --kind "${kindRaw}". Allowed: ${EvidenceKind.options.join(', ')}`);
  }
  const summary = requireFlag(args, 'summary');
  const file = optionalFlag(args, 'file');
  const content = optionalFlag(args, 'content');
  if (file === undefined && content === undefined) {
    throw new CliError('provide the payload with either --file <path> or --content <string>');
  }
  let bytes: string | Buffer;
  if (file !== undefined) {
    if (!existsSync(file)) throw new CliError(`--file not found: ${file}`);
    bytes = readFileSync(file);
  } else {
    bytes = content!;
  }

  const input: EvidenceInput = {
    kind: kind.data,
    contentDigest: digestBytes(bytes) as EvidenceInput['contentDigest'],
    summary,
    producer: CLI_AUTHORITY,
    context: {
      orgId: optionalFlag(args, 'org') ?? 'org_local',
      projectId: optionalFlag(args, 'project') ?? 'proj_local',
      correlationId: optionalFlag(args, 'correlation') ?? ctx.nextId('corr'),
    },
    metadata: {},
  };

  const store = EvidenceStore.open(ctx, buildSigner(ctx), CLI_AUTHORITY);
  const record = store.append(input);
  ctx.stdout(`sealed ${record.id} (${record.input.kind}) → ${record.recordDigest}`);
  return 0;
}

function evidenceVerify(ctx: CliContext): number {
  const store = EvidenceStore.open(ctx, buildSigner(ctx), CLI_AUTHORITY);
  const result = store.verify();
  if (result.valid) {
    ctx.stdout(`evidence chain VALID — ${result.checkedCount} record(s) verified`);
    return 0;
  }
  ctx.stderr(`evidence chain INVALID (${result.checkedCount} checked):`);
  for (const reason of result.reasons) ctx.stderr(`  - ${reason}`);
  return 1;
}

function evidenceList(ctx: CliContext): number {
  const store = EvidenceStore.open(ctx, buildSigner(ctx), CLI_AUTHORITY);
  if (store.records.length === 0) {
    ctx.stdout('no evidence recorded yet');
    return 0;
  }
  for (const r of store.records) {
    ctx.stdout(`#${r.sequence} ${r.id} [${r.input.kind}] ${r.input.summary}`);
  }
  return 0;
}
