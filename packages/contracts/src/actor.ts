import { z } from 'zod';
import { AgentId, OrgId, UserId } from './ids.js';

/**
 * An actor is anything that can cause a material change. Every audit receipt,
 * evidence record, and release decision names its actor so that no action is
 * anonymous ("who or what changed it").
 */
export const ActorKind = z.enum(['user', 'agent', 'service']);
export type ActorKind = z.infer<typeof ActorKind>;

export const Actor = z.object({
  kind: ActorKind,
  /** Stable id: a UserId for humans, an AgentId for agents, a service name otherwise. */
  id: z.string().min(1),
  /** Display name for interfaces. Never used for authorization decisions. */
  displayName: z.string().min(1).max(200),
  /** Owning organization, when the actor is tenant-scoped. */
  orgId: OrgId.optional(),
});
export type Actor = z.infer<typeof Actor>;

export const userActor = (id: UserId, displayName: string, orgId?: OrgId): Actor => ({
  kind: 'user',
  id,
  displayName,
  ...(orgId ? { orgId } : {}),
});

export const agentActor = (id: AgentId, displayName: string, orgId?: OrgId): Actor => ({
  kind: 'agent',
  id,
  displayName,
  ...(orgId ? { orgId } : {}),
});
