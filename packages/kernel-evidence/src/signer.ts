import { hmacSha256Hex, timingSafeEqualHex } from '@nas/crypto';
import type { KeyId } from '@nas/contracts';

/**
 * The signing authority for evidence and release decisions.
 *
 * Keys are held here, independently of the actors that *produce* evidence, so a
 * producer cannot forge chain-of-custody. In v1 this is an in-process HMAC keyring;
 * the interface is what the kernels depend on, so a KMS/HSM-backed signer can be
 * dropped in later without touching the kernels.
 */
export interface Signer {
  readonly defaultKeyId: KeyId;
  /** Returns whether a key id is known to this signer. */
  hasKey(keyId: string): boolean;
  /** Sign a message; defaults to `defaultKeyId`. Throws for an unknown key id. */
  sign(message: string, keyId?: KeyId): { keyId: KeyId; value: string };
  /** Verify a signature. Fail-closed: unknown key id → false, never throws. */
  verify(message: string, signature: { keyId: string; value: string }): boolean;
}

export class HmacSigner implements Signer {
  readonly defaultKeyId: KeyId;
  readonly #keys: Map<string, string>;

  constructor(keys: Record<string, string>, defaultKeyId: KeyId) {
    const entries = Object.entries(keys);
    if (entries.length === 0) {
      throw new Error('HmacSigner requires at least one key');
    }
    for (const [id, secret] of entries) {
      if (secret.length < 16) {
        throw new Error(`HmacSigner key "${id}" is too short (min 16 chars)`);
      }
    }
    if (!(defaultKeyId in keys)) {
      throw new Error(`HmacSigner defaultKeyId "${defaultKeyId}" is not in the keyring`);
    }
    this.#keys = new Map(entries);
    this.defaultKeyId = defaultKeyId;
  }

  hasKey(keyId: string): boolean {
    return this.#keys.has(keyId);
  }

  sign(message: string, keyId: KeyId = this.defaultKeyId): { keyId: KeyId; value: string } {
    const secret = this.#keys.get(keyId);
    if (secret === undefined) {
      throw new Error(`HmacSigner: unknown key id "${keyId}"`);
    }
    return { keyId, value: hmacSha256Hex(secret, message) };
  }

  verify(message: string, signature: { keyId: string; value: string }): boolean {
    const secret = this.#keys.get(signature.keyId);
    if (secret === undefined) return false; // fail closed on unknown key
    const expected = hmacSha256Hex(secret, message);
    return timingSafeEqualHex(expected, signature.value);
  }
}
