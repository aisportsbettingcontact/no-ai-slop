import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Deterministic, tamper-evident primitives shared by the TC-07/TC-10/TC-17 kernels.
 *
 * The one rule that makes content addressing meaningful: identical logical values
 * MUST serialize to identical bytes. `canonicalJson` guarantees that by sorting
 * object keys and rejecting non-deterministic values.
 */

/** A JSON value that can be canonicalized. `undefined` and functions are rejected. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Serialize a value to canonical JSON: object keys sorted lexicographically,
 * no insignificant whitespace, arrays kept in order. Throws on values that cannot
 * be deterministically serialized (undefined, functions, NaN, Infinity), because a
 * silent lossy encoding would undermine content addressing.
 */
export function canonicalJson(value: unknown): string {
  return serialize(value);
}

function serialize(value: unknown): string {
  if (value === null) return 'null';

  const t = typeof value;

  if (t === 'string') return JSON.stringify(value);
  if (t === 'boolean') return value ? 'true' : 'false';
  if (t === 'number') {
    if (!Number.isFinite(value as number)) {
      throw new Error('canonicalJson: non-finite numbers cannot be canonicalized');
    }
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((v) => serialize(v)).join(',')}]`;
  }

  if (t === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj)
      .filter((k) => obj[k] !== undefined)
      .sort();
    const body = keys.map((k) => `${JSON.stringify(k)}:${serialize(obj[k])}`).join(',');
    return `{${body}}`;
  }

  throw new Error(`canonicalJson: unsupported value of type ${t}`);
}

/** Lowercase hex sha256 of the given bytes/string, WITHOUT the `sha256:` prefix. */
export function sha256Hex(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Content address of arbitrary bytes: `sha256:<hex>`. */
export function digestBytes(data: string | Uint8Array): string {
  return `sha256:${sha256Hex(data)}`;
}

/** Content address of a value via its canonical JSON: `sha256:<hex>`. */
export function digestValue(value: unknown): string {
  return digestBytes(canonicalJson(value));
}

/** Hex HMAC-SHA256 of `message` under `key`. */
export function hmacSha256Hex(key: string, message: string): string {
  return createHmac('sha256', key).update(message).digest('hex');
}

/**
 * Constant-time comparison of two hex strings of equal length. Returns false for
 * mismatched lengths (rather than throwing) so callers stay fail-closed.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let bufA: Buffer;
  let bufB: Buffer;
  try {
    bufA = Buffer.from(a, 'hex');
    bufB = Buffer.from(b, 'hex');
  } catch {
    return false;
  }
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}
