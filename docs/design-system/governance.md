# Design-system governance

Neither a human nor an agent may add product language — tokens, components,
patterns, principles, rules — without a contribution record. The workflow is a
**typed state machine** (`packages/contracts/src/governance.ts`), not prose:
`applyContributionTransition` refuses illegal transitions in code, and
`packages/contracts/src/governance.test.ts` proves each refusal.

## The contribution record

A `ContributionRequest` must name, before any work starts:

- **need** — the user problem (not the solution),
- **existingCapabilitySearch** — what was searched for reuse and exactly why the
  existing capability is insufficient (reuse-first is enforced as data),
- **proposedScope**, **accessibilityImpact**, **securityImpact**,
- **evidencePlan** — what will prove the change, and **migrationPlan** when a
  public API or token changes,
- **ownerId** — every contribution has an owner,
- **highImpact** — true when it touches shared tokens, contracts, kernels, or
  public component APIs,
- **expiresAt** — required if the request is routed as a product-specific
  exception.

## States and transitions

```
proposed → triaged → design_review → implementation → verification → published → deprecated
                ↘ product_specific_exception ↗            ↺ (verification may fall back
                ↘ rejected (from any pre-published state)     to implementation)
```

The complete map is `ALLOWED_CONTRIBUTION_TRANSITIONS`; anything not listed is
forbidden. Enforced fail-closed rules:

| Rule | Code |
| --- | --- |
| A transition must start from the record's actual state | `GOV_STATE_MISMATCH` |
| Only mapped transitions are allowed | `GOV_FORBIDDEN_TRANSITION` |
| `rejected` and `deprecated` are terminal | `GOV_TERMINAL_STATE` |
| A **high-impact** contribution cannot be published by its own requester | `GOV_SELF_PUBLISH` |
| A product-specific exception (snowflake) requires an expiry | `GOV_EXCEPTION_NEEDS_EXPIRY` |

## Reusable need vs. snowflake

Triage decides whether a request is a **reusable system need** (→
`design_review`) or a **product-specific exception** (→
`product_specific_exception`). Snowflakes are legitimate — a specialized surface
may need behavior that does not belong in a shared primitive — but they are
time-bound, owned, and carry a remediation. Shipped exceptions live in the
registry's `exceptions` list; an expired exception is a `DS_EXCEPTION_EXPIRED`
finding that blocks the design-system gate until remediated or renewed.

## Naming, versioning, deprecation

- **Names are semantic, never appearance-based**: `status.danger.fg`, not
  `color.red`; `size.control`, not `height.40`.
- Ids are lowercase dot-namespaced (`component.button`, `pattern.card-grid`,
  `exception.breakpoint-media-query`) and stable across versions.
- Components carry `version` (semver) and `status`
  (`proposed | experimental | stable | deprecated`).
- A deprecation is a **record** (`reason`, `since`, `migration`, optional
  `replacedBy`), never a silent removal; a `deprecated` status without a record
  — or a record without the status — fails referential integrity
  (`REG_DEPRECATION_MISMATCH`).

## Worked examples (from the test fixtures)

- **Accepted**: `contrib.density-token` walks proposed → triaged →
  design_review → implementation → verification → published, published by a
  reviewer who is not the requester (`governance.test.ts`, happy path).
- **Rejected**: the same request denied at triage moves to `rejected`, which is
  terminal.
- **Exception**: routed to `product_specific_exception` only once `expiresAt`
  is set; without it the transition returns `GOV_EXCEPTION_NEEDS_EXPIRY`.
- **Self-publish blocked**: the requester attempting to publish their own
  high-impact contribution gets `GOV_SELF_PUBLISH` — an independent reviewer
  must perform the publish transition.

## What is deliberately not built yet

GitHub issue/PR templates for contributions are **not** provided: templates that
are not wired into a real validated workflow are documentation theater. When the
platform gains real change-request storage, the same contracts drive it.
