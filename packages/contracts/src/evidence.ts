import { z } from 'zod';
import { Actor } from './actor.js';
import {
  BuildId,
  CorrelationId,
  EvidenceId,
  KeyId,
  OrgId,
  ProjectId,
  RunId,
  Sha256Digest,
  TaskId,
  Timestamp,
} from './ids.js';

/**
 * TC-17: Evidence Integrity and Chain of Custody (contract layer).
 *
 * Evidence is authenticated, content-addressed, and hash-chained. Every material
 * product / test / review / release claim must be reconstructable from evidence.
 * The kernel that seals and verifies these records lives in @nas/kernel-evidence.
 */

export const EvidenceKind = z.enum([
  'file_modification',
  'command',
  'build',
  'test',
  'browser_run',
  'screenshot',
  'video',
  'trace',
  'console_log',
  'network_log',
  'accessibility_result',
  'performance_result',
  'anti_slop_review',
  'authz_receipt',
  'deployment_event',
  'human_review',
]);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

/** Where a record sits in the world, so it can be attributed and queried. */
export const EvidenceContext = z.object({
  orgId: OrgId,
  projectId: ProjectId,
  runId: RunId.optional(),
  taskId: TaskId.optional(),
  buildId: BuildId.optional(),
  correlationId: CorrelationId,
});
export type EvidenceContext = z.infer<typeof EvidenceContext>;

/**
 * Redacted, scalar-only metadata. Objects/arrays are rejected to keep evidence
 * flat and to make secret-scanning tractable. Never place secrets here.
 */
export const EvidenceMetadata = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null()]),
);
export type EvidenceMetadata = z.infer<typeof EvidenceMetadata>;

/** What a producer submits before the record is sealed. */
export const EvidenceInput = z.object({
  kind: EvidenceKind,
  /** Digest of the actual payload bytes (screenshot, log file, JSON result...). */
  contentDigest: Sha256Digest,
  /** Short, human-legible summary of what this evidence shows. */
  summary: z.string().min(1).max(500),
  producer: Actor,
  context: EvidenceContext,
  metadata: EvidenceMetadata.default({}),
});
export type EvidenceInput = z.infer<typeof EvidenceInput>;

export const SignatureAlgorithm = z.enum(['hmac-sha256']);
export type SignatureAlgorithm = z.infer<typeof SignatureAlgorithm>;

export const Signature = z.object({
  keyId: KeyId,
  algorithm: SignatureAlgorithm,
  /** Hex-encoded signature over the canonical record body. */
  value: z.string().regex(/^[0-9a-f]{64}$/, 'expected a 64-char hex signature'),
});
export type Signature = z.infer<typeof Signature>;

/**
 * A sealed, tamper-evident evidence record.
 *
 * Ordering matters for the hash chain: `prevDigest` links to the previous
 * record's `recordDigest`. The genesis record has `prevDigest: null`.
 * `recordDigest` is the content address of the record *body* (everything except
 * the signature). `signature` is produced by an authority whose key is held
 * independently of the producer, so a producer cannot forge custody.
 */
export const EvidenceRecord = z.object({
  id: EvidenceId,
  sequence: z.number().int().nonnegative(),
  createdAt: Timestamp,
  input: EvidenceInput,
  prevDigest: Sha256Digest.nullable(),
  recordDigest: Sha256Digest,
  signedBy: Actor,
  signature: Signature,
});
export type EvidenceRecord = z.infer<typeof EvidenceRecord>;

/** Result of verifying a single record or a whole chain. Fail-closed by default. */
export const EvidenceVerification = z.object({
  valid: z.boolean(),
  /** Empty when `valid` is true. Each string is a concrete, actionable reason. */
  reasons: z.array(z.string()),
  checkedCount: z.number().int().nonnegative(),
});
export type EvidenceVerification = z.infer<typeof EvidenceVerification>;
