import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { EvidenceLog, type Signer } from '@nas/kernel-evidence';
import { type Actor, type EvidenceInput, EvidenceRecord } from '@nas/contracts';
import { CliError, type CliContext } from './context.js';

/**
 * A filesystem-backed evidence store. The sealed chain is written to
 * `.nas/evidence/chain.json`; records are tamper-evident, so persisting them as
 * plain JSON is safe. Loading always re-verifies the chain (fail-closed).
 */
export class EvidenceStore {
  readonly #path: string;
  readonly #log: EvidenceLog;

  private constructor(path: string, log: EvidenceLog) {
    this.#path = path;
    this.#log = log;
  }

  static chainPath(ctx: CliContext): string {
    return join(ctx.cwd, '.nas', 'evidence', 'chain.json');
  }

  static open(ctx: CliContext, signer: Signer, authority: Actor): EvidenceStore {
    const path = EvidenceStore.chainPath(ctx);
    let initial: EvidenceRecord[] = [];
    if (existsSync(path)) {
      const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
      const result = EvidenceRecord.array().safeParse(parsed);
      if (!result.success) {
        throw new CliError(`evidence chain at ${path} is malformed: ${result.error.message}`);
      }
      initial = result.data;
    }
    const log = new EvidenceLog({
      signer,
      authority,
      clock: ctx.now,
      idGenerator: () => ctx.nextId('ev'),
      initial,
    });
    return new EvidenceStore(path, log);
  }

  append(input: EvidenceInput): EvidenceRecord {
    const record = this.#log.append(input);
    this.#persist();
    return record;
  }

  get records(): readonly EvidenceRecord[] {
    return this.#log.records;
  }

  verify() {
    return this.#log.verify();
  }

  #persist(): void {
    mkdirSync(dirname(this.#path), { recursive: true });
    writeFileSync(this.#path, `${JSON.stringify(this.#log.toJSON(), null, 2)}\n`, 'utf8');
  }
}
