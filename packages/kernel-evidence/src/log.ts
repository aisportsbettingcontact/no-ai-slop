import { digestValue } from '@nas/crypto';
import {
  type Actor,
  type EvidenceInput,
  type EvidenceRecord,
  type EvidenceVerification,
  EvidenceInput as EvidenceInputSchema,
  type Sha256Digest,
} from '@nas/contracts';
import type { Signer } from './signer.js';

/** Injected time source — never read ambiently, so the log is deterministic under test. */
export type Clock = () => string;
/** Injected id source — deterministic under test. */
export type IdGenerator = () => string;

export interface EvidenceLogOptions {
  signer: Signer;
  /** The signing authority's identity, recorded as `signedBy` on every record. */
  authority: Actor;
  clock: Clock;
  idGenerator: IdGenerator;
  /** Optional existing chain to continue (e.g. loaded from disk). Verified on load. */
  initial?: EvidenceRecord[];
}

/** The body of a record that is content-addressed. Excludes the digest + signature. */
function recordBody(
  r: Pick<EvidenceRecord, 'id' | 'sequence' | 'createdAt' | 'input' | 'prevDigest'>,
) {
  return {
    id: r.id,
    sequence: r.sequence,
    createdAt: r.createdAt,
    input: r.input,
    prevDigest: r.prevDigest,
  };
}

/**
 * An append-only, hash-chained, signed evidence log (TC-17).
 *
 * Sealing binds each record to (a) its own content via `recordDigest`, (b) the
 * previous record via `prevDigest`, and (c) the signing authority via `signature`.
 * Verification recomputes all three and is fail-closed: any tamper, reorder,
 * deletion, or forged signature makes the whole chain invalid.
 */
export class EvidenceLog {
  readonly #signer: Signer;
  readonly #authority: Actor;
  readonly #clock: Clock;
  readonly #ids: IdGenerator;
  #records: EvidenceRecord[] = [];

  constructor(opts: EvidenceLogOptions) {
    this.#signer = opts.signer;
    this.#authority = opts.authority;
    this.#clock = opts.clock;
    this.#ids = opts.idGenerator;
    if (opts.initial && opts.initial.length > 0) {
      const check = EvidenceLog.verifyChain(opts.initial, opts.signer);
      if (!check.valid) {
        throw new Error(
          `EvidenceLog: refusing to load an invalid chain: ${check.reasons.join('; ')}`,
        );
      }
      this.#records = [...opts.initial];
    }
  }

  get records(): readonly EvidenceRecord[] {
    return this.#records;
  }

  /** Content address of the last record, or null for an empty log. */
  get head(): Sha256Digest | null {
    const last = this.#records.at(-1);
    return last ? last.recordDigest : null;
  }

  /** Seal an input into a new record and append it. Validates the input first. */
  append(rawInput: EvidenceInput): EvidenceRecord {
    // Re-validate at the boundary: never seal unvalidated external data.
    const input = EvidenceInputSchema.parse(rawInput);
    const sequence = this.#records.length;
    const prevDigest = this.head;
    const body = recordBody({
      id: this.#ids(),
      sequence,
      createdAt: this.#clock(),
      input,
      prevDigest,
    });
    const recordDigest = digestValue(body) as Sha256Digest;
    const signature = this.#signer.sign(recordDigest);
    const record: EvidenceRecord = {
      ...body,
      recordDigest,
      signedBy: this.#authority,
      signature: { keyId: signature.keyId, algorithm: 'hmac-sha256', value: signature.value },
    };
    this.#records.push(record);
    return record;
  }

  /** Verify this log's current chain. */
  verify(): EvidenceVerification {
    return EvidenceLog.verifyChain(this.#records, this.#signer);
  }

  /** Serialize the sealed chain (records are tamper-evident, safe to persist as-is). */
  toJSON(): EvidenceRecord[] {
    return [...this.#records];
  }

  /**
   * Stateless verification of a chain. Checks, in order, for every record:
   *  - content integrity (recomputed digest matches recordDigest),
   *  - authentic signature over that digest (known key),
   *  - correct sequence index,
   *  - correct linkage (prevDigest equals the previous record's digest; genesis is null).
   * Returns all failure reasons rather than short-circuiting, so callers see the full picture.
   */
  static verifyChain(records: readonly EvidenceRecord[], signer: Signer): EvidenceVerification {
    const reasons: string[] = [];
    let prev: Sha256Digest | null = null;

    records.forEach((r, i) => {
      const expectedDigest = digestValue(recordBody(r)) as Sha256Digest;
      if (expectedDigest !== r.recordDigest) {
        reasons.push(
          `record ${i} (${r.id}): content digest mismatch — record was altered after sealing`,
        );
      } else if (!signer.verify(r.recordDigest, r.signature)) {
        // Only meaningful to check the signature when the digest itself is intact.
        reasons.push(
          `record ${i} (${r.id}): signature invalid — not sealed by a trusted authority`,
        );
      }

      if (r.sequence !== i) {
        reasons.push(`record ${i} (${r.id}): sequence ${r.sequence} does not match position ${i}`);
      }
      if (r.prevDigest !== prev) {
        reasons.push(
          `record ${i} (${r.id}): broken chain link — prevDigest does not match the previous record`,
        );
      }
      prev = r.recordDigest;
    });

    return { valid: reasons.length === 0, reasons, checkedCount: records.length };
  }
}
