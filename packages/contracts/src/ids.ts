import { z } from 'zod';

/**
 * Identifier conventions for No AI Slop.
 *
 * Every identifier is a namespaced, human-legible string so that any record can
 * be attributed to a concrete actor / task / run / build without a lookup table.
 * We deliberately avoid opaque UUIDs in the public contract: attribution is a
 * first-class anti-slop requirement ("keep every change attributable").
 */

/** A content digest, always `sha256:<64 lowercase hex chars>`. */
export const Sha256Digest = z
  .string()
  .regex(/^sha256:[0-9a-f]{64}$/, 'expected a sha256:<hex> digest');
export type Sha256Digest = z.infer<typeof Sha256Digest>;

/** A non-empty, trimmed identifier token. */
const token = (label: string) =>
  z
    .string()
    .min(1, `${label} must not be empty`)
    .max(200, `${label} is too long`)
    .regex(/^[A-Za-z0-9][A-Za-z0-9._:@/-]*$/, `${label} has invalid characters`);

export const OrgId = token('orgId');
export const UserId = token('userId');
export const ProjectId = token('projectId');
export const RunId = token('runId');
export const TaskId = token('taskId');
export const BuildId = token('buildId');
export const AgentId = token('agentId');
export const EvidenceId = token('evidenceId');
export const GrantId = token('grantId');
export const DecisionId = token('decisionId');
export const KeyId = token('keyId');
export const CorrelationId = token('correlationId');

export type OrgId = z.infer<typeof OrgId>;
export type UserId = z.infer<typeof UserId>;
export type ProjectId = z.infer<typeof ProjectId>;
export type RunId = z.infer<typeof RunId>;
export type TaskId = z.infer<typeof TaskId>;
export type BuildId = z.infer<typeof BuildId>;
export type AgentId = z.infer<typeof AgentId>;
export type EvidenceId = z.infer<typeof EvidenceId>;
export type GrantId = z.infer<typeof GrantId>;
export type DecisionId = z.infer<typeof DecisionId>;
export type KeyId = z.infer<typeof KeyId>;
export type CorrelationId = z.infer<typeof CorrelationId>;

/** ISO-8601 UTC timestamp. Time is always injected, never read ambiently. */
export const Timestamp = z.string().datetime({ offset: true });
export type Timestamp = z.infer<typeof Timestamp>;
