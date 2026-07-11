/**
 * @nas/kernel-evidence — TC-17: Evidence Integrity and Chain of Custody.
 *
 * Fail-closed by construction: evidence is content-addressed, hash-chained, and
 * signed by an authority whose keys are held independently of producers. Any
 * tamper, reorder, deletion, or forgery invalidates the chain.
 */
export { HmacSigner, type Signer } from './signer.js';
export { EvidenceLog, type Clock, type IdGenerator, type EvidenceLogOptions } from './log.js';
export { digestBytes as contentDigestOf, digestValue } from '@nas/crypto';

/**
 * Real-time clock for production use (ISO-8601 UTC). Tests inject a deterministic
 * clock instead; production code passes this.
 */
export const isoClock = (): string => new Date().toISOString();

/** A prefixed, monotonically increasing id generator. Stable and attributable. */
export function counterIdGenerator(prefix: string, start = 0): () => string {
  let n = start;
  return () => `${prefix}_${(n++).toString(36).padStart(6, '0')}`;
}
