import { digestValue } from '@nas/crypto';
import type { Signer } from '@nas/kernel-evidence';
import {
  type AuthorizationDecision,
  type AuthorizationReceipt,
  type AuthorizationRequest,
  AuthorizationRequest as AuthorizationRequestSchema,
  type Capability,
  type DenyReason,
  type Grant,
  Grant as GrantSchema,
  type Sha256Digest,
} from '@nas/contracts';
import { verifyGrantSignature } from './broker.js';
import { resourceMatches } from './resource.js';

export interface AuthorizeResult {
  decision: AuthorizationDecision;
  /** Durable audit receipt; seal into the TC-17 evidence chain to make it immutable. */
  receipt: AuthorizationReceipt;
}

/**
 * The authorization enforcement point (TC-07).
 *
 * Deny-by-default: an agent is authorized only when it presents a registered,
 * authentically-signed, unexpired, audience-bound, resource-bound, non-replayed
 * grant that carries a capability matching the exact (action, resource). Every
 * call — allow or deny — returns an explained decision and an audit receipt.
 *
 * The engine is deterministic: it reads time only from the request, never
 * ambiently, so decisions are reproducible from their inputs.
 */
export class AuthorizationEngine {
  readonly #grantVerifier: Signer;
  readonly #grants = new Map<string, Grant>();
  readonly #usesConsumed = new Map<string, number>();

  constructor(grantVerifier: Signer) {
    this.#grantVerifier = grantVerifier;
  }

  /** Register a grant so it can be presented. Validates shape at the boundary. */
  registerGrant(grant: Grant): void {
    const parsed = GrantSchema.parse(grant);
    this.#grants.set(parsed.id, parsed);
  }

  /** How many times a grant has been successfully consumed (for tests + telemetry). */
  usesConsumed(grantId: string): number {
    return this.#usesConsumed.get(grantId) ?? 0;
  }

  authorize(request: AuthorizationRequest): AuthorizeResult {
    const parsed = AuthorizationRequestSchema.safeParse(request);
    if (!parsed.success) {
      return this.#deny(request, 'malformed_request', 'request failed schema validation');
    }
    const req = parsed.data;

    const grant = this.#grants.get(req.grantId);
    if (!grant) {
      return this.#deny(req, 'no_grant', `no grant is registered for id "${req.grantId}"`);
    }
    if (!verifyGrantSignature(this.#grantVerifier, grant)) {
      return this.#deny(req, 'grant_signature_invalid', 'the grant signature does not verify');
    }
    if (grant.subjectId !== req.subjectId) {
      return this.#deny(
        req,
        'subject_mismatch',
        `grant authorizes "${grant.subjectId}", not "${req.subjectId}"`,
      );
    }
    if (grant.audience !== req.audience) {
      return this.#deny(
        req,
        'audience_mismatch',
        `grant is bound to audience "${grant.audience}", not "${req.audience}"`,
      );
    }

    const at = Date.parse(req.at);
    const notBefore = Date.parse(grant.notBefore ?? grant.issuedAt);
    const expiresAt = Date.parse(grant.expiresAt);
    if (Number.isNaN(at)) {
      return this.#deny(req, 'malformed_request', 'request timestamp is not a valid date');
    }
    if (at < notBefore) {
      return this.#deny(
        req,
        'not_yet_valid',
        `grant is not valid until ${grant.notBefore ?? grant.issuedAt}`,
      );
    }
    if (at > expiresAt) {
      return this.#deny(req, 'expired', `grant expired at ${grant.expiresAt}`);
    }
    if (grant.nonce !== req.nonce) {
      return this.#deny(req, 'nonce_mismatch', 'presented nonce does not match the grant');
    }

    const consumed = this.#usesConsumed.get(grant.id) ?? 0;
    if (grant.maxUses === 1 && consumed >= 1) {
      return this.#deny(req, 'replayed', 'single-use grant has already been consumed');
    }
    if (consumed >= grant.maxUses) {
      return this.#deny(req, 'uses_exhausted', `grant use budget of ${grant.maxUses} is exhausted`);
    }

    const capability = grant.capabilities.find(
      (c) => c.action === req.action && resourceMatches(c.resource, req.resource),
    );
    if (!capability) {
      // Deny WITHOUT consuming a use: an unauthorized attempt must not burn budget.
      return this.#deny(
        req,
        'no_matching_capability',
        `grant carries no capability for ${req.action} on ${req.resource}`,
      );
    }

    // Authorized: consume exactly one use.
    this.#usesConsumed.set(grant.id, consumed + 1);
    return this.#allow(req, capability);
  }

  #allow(req: AuthorizationRequest, capability: Capability): AuthorizeResult {
    const decision: AuthorizationDecision = {
      allowed: true,
      matchedCapability: capability,
      explanation: `authorized ${req.action} on ${req.resource} via grant ${req.grantId}`,
      grantId: req.grantId,
      subjectId: req.subjectId,
      at: req.at,
    };
    return { decision, receipt: this.#receipt(req, decision) };
  }

  #deny(req: AuthorizationRequest, denyReason: DenyReason, explanation: string): AuthorizeResult {
    const decision: AuthorizationDecision = {
      allowed: false,
      denyReason,
      explanation,
      grantId: req.grantId,
      subjectId: req.subjectId,
      at: req.at,
    };
    return { decision, receipt: this.#receipt(req, decision) };
  }

  #receipt(request: AuthorizationRequest, decision: AuthorizationDecision): AuthorizationReceipt {
    const bodyDigest = digestValue({ request, decision }) as Sha256Digest;
    return { request, decision, bodyDigest };
  }
}
