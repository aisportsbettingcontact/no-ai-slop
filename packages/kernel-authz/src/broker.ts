import { canonicalJson } from '@nas/crypto';
import type { Signer } from '@nas/kernel-evidence';
import { type Grant, type GrantBody, Grant as GrantSchema } from '@nas/contracts';

/**
 * The credential broker (TC-07). It is the ONLY component that mints grants, and
 * it signs each grant body so the enforcement point can verify authenticity. An
 * agent never issues its own grant.
 */
export class AuthzBroker {
  readonly #signer: Signer;

  constructor(signer: Signer) {
    this.#signer = signer;
  }

  /** Sign a grant body, producing a complete, verifiable Grant. Validates the result. */
  issue(body: GrantBody): Grant {
    const signature = this.#signer.sign(canonicalJson(body), body.keyId);
    const grant: Grant = { ...body, signature: signature.value };
    // Never emit a grant that would not validate against the contract.
    return GrantSchema.parse(grant);
  }
}

/** Verify a grant's signature against the body it claims to sign. Fail-closed. */
export function verifyGrantSignature(signer: Signer, grant: Grant): boolean {
  const { signature, ...body } = grant;
  return signer.verify(canonicalJson(body), { keyId: grant.keyId, value: signature });
}
