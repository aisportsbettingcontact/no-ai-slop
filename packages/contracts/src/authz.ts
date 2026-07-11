import { z } from 'zod';
import { Actor } from './actor.js';
import {
  AgentId,
  CorrelationId,
  GrantId,
  KeyId,
  Sha256Digest,
  Timestamp,
} from './ids.js';

/**
 * TC-07: Agent Authorization and Least Privilege (contract layer).
 *
 * Authorization is deny-by-default. An agent may only act when it presents an
 * unexpired, audience-bound, resource-bound, single-use grant that authentically
 * authorizes the exact (action, resource) pair. The kernel that decides lives in
 * @nas/kernel-authz. Every decision produces an audit receipt (sealed as evidence).
 */

/** The closed set of privileged actions an agent can request. Least privilege = enumerated. */
export const Action = z.enum([
  'fs.read',
  'fs.write',
  'cmd.exec',
  'pkg.install',
  'net.egress',
  'git.read',
  'git.push',
  'secret.use',
  'db.read',
  'db.write',
  'storage.read',
  'storage.write',
  'evidence.read',
  'evidence.write',
  'release.decide',
  'deploy.execute',
]);
export type Action = z.infer<typeof Action>;

/**
 * A capability binds one action to one resource pattern.
 * Resource patterns are URI-shaped, e.g. `repo://acme-web/src/**`, `net://api.github.com`,
 * `secret://GITHUB_TOKEN`. A single trailing `**` matches any suffix; `*` matches one segment.
 */
export const Capability = z.object({
  action: Action,
  resource: z.string().min(1).max(500),
});
export type Capability = z.infer<typeof Capability>;

/**
 * A signed, short-lived grant. Issued by a control-plane broker (never by the
 * agent itself). The signature makes it tamper-evident; audience + nonce + expiry
 * make it least-privilege and replay-resistant.
 */
export const Grant = z.object({
  id: GrantId,
  /** The agent this grant authorizes. Authorization checks match on this id. */
  subjectId: AgentId,
  capabilities: z.array(Capability).min(1),
  /** Audience binding: only this tool/adapter may present the grant. */
  audience: z.string().min(1).max(200),
  issuer: Actor,
  issuedAt: Timestamp,
  notBefore: Timestamp.optional(),
  expiresAt: Timestamp,
  /** Single-use nonce for replay protection. */
  nonce: z.string().min(8).max(200),
  /** Maximum number of times this grant may be consumed. Defaults to 1 (single-use). */
  maxUses: z.number().int().positive().max(1000).default(1),
  /** HMAC signature over the canonical grant body (broker key). */
  keyId: KeyId,
  signature: z.string().regex(/^[0-9a-f]{64}$/, 'expected a 64-char hex signature'),
});
export type Grant = z.infer<typeof Grant>;

/** The unsigned grant body a broker signs. */
export const GrantBody = Grant.omit({ signature: true });
export type GrantBody = z.infer<typeof GrantBody>;

export const AuthorizationRequest = z.object({
  subjectId: AgentId,
  action: Action,
  resource: z.string().min(1).max(500),
  /** The tool/adapter presenting the request; must equal the grant audience. */
  audience: z.string().min(1).max(200),
  grantId: GrantId,
  /** Nonce presented by the caller; must match the grant and not be replayed. */
  nonce: z.string().min(8).max(200),
  at: Timestamp,
  correlationId: CorrelationId,
});
export type AuthorizationRequest = z.infer<typeof AuthorizationRequest>;

/** Machine-readable deny reasons. Every denial is explained, never silent. */
export const DenyReason = z.enum([
  'no_grant',
  'grant_signature_invalid',
  'subject_mismatch',
  'audience_mismatch',
  'expired',
  'not_yet_valid',
  'nonce_mismatch',
  'replayed',
  'uses_exhausted',
  'no_matching_capability',
  'malformed_request',
]);
export type DenyReason = z.infer<typeof DenyReason>;

export const AuthorizationDecision = z.object({
  allowed: z.boolean(),
  /** Present iff allowed. */
  matchedCapability: Capability.optional(),
  /** Present iff denied. */
  denyReason: DenyReason.optional(),
  /** Human-legible explanation, always present. */
  explanation: z.string().min(1),
  grantId: GrantId,
  subjectId: AgentId,
  at: Timestamp,
});
export type AuthorizationDecision = z.infer<typeof AuthorizationDecision>;

/**
 * The durable audit receipt for a decision. Its `bodyDigest` is content-addressed
 * so the receipt can be sealed into the TC-17 evidence chain and later reconstructed.
 */
export const AuthorizationReceipt = z.object({
  request: AuthorizationRequest,
  decision: AuthorizationDecision,
  bodyDigest: Sha256Digest,
});
export type AuthorizationReceipt = z.infer<typeof AuthorizationReceipt>;
