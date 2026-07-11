import { describe, expect, it } from 'vitest';
import {
  canonicalJson,
  digestBytes,
  digestValue,
  hmacSha256Hex,
  sha256Hex,
  timingSafeEqualHex,
} from './index.js';

describe('canonicalJson', () => {
  it('sorts object keys so logically equal values serialize identically', () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalJson({ a: 2, b: 1 })).toBe(canonicalJson({ b: 1, a: 2 }));
  });

  it('sorts keys recursively but preserves array order', () => {
    expect(canonicalJson({ z: [{ y: 1, x: 2 }], a: 'k' })).toBe('{"a":"k","z":[{"x":2,"y":1}]}');
    expect(canonicalJson([3, 1, 2])).toBe('[3,1,2]');
  });

  it('omits undefined object properties but keeps null', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}');
  });

  it('rejects non-finite numbers rather than encoding them lossily', () => {
    expect(() => canonicalJson({ a: NaN })).toThrow(/non-finite/);
    expect(() => canonicalJson(Infinity)).toThrow(/non-finite/);
  });

  it('rejects unsupported values', () => {
    expect(() => canonicalJson(() => 1)).toThrow(/unsupported/);
  });
});

describe('digests', () => {
  it('produces a prefixed sha256 content address', () => {
    expect(digestBytes('hello')).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(sha256Hex('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('is stable across key ordering via canonicalization', () => {
    expect(digestValue({ a: 1, b: 2 })).toBe(digestValue({ b: 2, a: 1 }));
  });

  it('changes when content changes', () => {
    expect(digestValue({ a: 1 })).not.toBe(digestValue({ a: 2 }));
  });
});

describe('hmac + constant-time compare', () => {
  it('is deterministic for the same key and message', () => {
    expect(hmacSha256Hex('k', 'm')).toBe(hmacSha256Hex('k', 'm'));
  });

  it('differs for different keys', () => {
    expect(hmacSha256Hex('k1', 'm')).not.toBe(hmacSha256Hex('k2', 'm'));
  });

  it('matches equal hex and rejects unequal / malformed', () => {
    const sig = hmacSha256Hex('k', 'm');
    expect(timingSafeEqualHex(sig, sig)).toBe(true);
    expect(timingSafeEqualHex(sig, hmacSha256Hex('k', 'n'))).toBe(false);
    expect(timingSafeEqualHex('', '')).toBe(false);
    expect(timingSafeEqualHex('zz', 'zz')).toBe(false); // not valid hex
    expect(timingSafeEqualHex('aa', 'aabb')).toBe(false); // length mismatch
  });
});
