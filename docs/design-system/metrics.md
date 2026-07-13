# Design-system metrics

Rules: a metric exists only if it changes a decision; every metric keeps its
dimension-level identity (no composite "system health score"); a metric that
needs unavailable infrastructure is **Not tested**, never estimated. Version:
v1.1.

## Measured now (deterministic, local, reproducible)

| Metric | Numerator / denominator | Source & method | Threshold (gate) | Owner |
| --- | --- | --- | --- | --- |
| Raw-value violations | unexcepted raw hex/px/rgba occurrences / — | `pnpm check:design-system` (scanner + `checkDesignSystem`) | **0** — any finding fails the check and grades `design_consistency` fail | owner.design-systems |
| Registry integrity problems | `validateDesignSystemRegistry().problems` / — | same command; also live on `/system` | **0** | owner.design-systems |
| Registry ↔ CSS sync | registry `cssVariable`s missing/mismatched in `tokens.css` + unclaimed `--nas-*` vars / — | `packages/ui/src/registry.test.ts` | **0** | owner.design-systems |
| Registry coverage of exports | exported `@nas/ui` components with a registry entry / all exported components | `registry.test.ts` + `DS_UNREGISTERED_COMPONENT` | **100%** | owner.design-systems |
| Interactive state coverage | interactive components documenting `focus_visible` / interactive components | `DS_UNDOCUMENTED_STATE` | **100%** | owner.design-systems |
| Architecture violations | forbidden edges + cycles + unknown modules / — | `pnpm check:architecture` | **0** | owner.control-plane |
| Dependency exceptions | same-layer edges admitted / — | `check-architecture` report (`exceptionsApplied`) | each named + justified; currently **2** (kernel→evidence) | owner.control-plane |
| Exception age | exceptions past `expiresAt` / all exceptions | `DS_EXCEPTION_EXPIRED` | **0 expired** | exception owner |
| Token contrast | token pairs meeting WCAG 2.2 AA in both themes / all governed pairs | `packages/ui/src/tokens.test.ts` | **100%** | owner.design-systems |
| Accessibility violations | serious/critical axe violations across routes × viewports × themes / — | `apps/no-ai-slop/e2e/browser-check.mjs` (16 scans) | **0** | owner.control-plane |
| Artifact freshness | stale generated artifacts (`registry.json`, `observed-dependencies.json`) / 2 | freshness compare in both check scripts + `repo-system.test.ts` | **0 stale** | owner.design-systems |

Limitations, per metric: the scanner is static and line-based (see
`docs/design-system/README.md`); state coverage checks documentation presence,
not rendered behavior (rendered behavior is covered by the browser harness);
`usesTokens` accuracy is review-enforced, not derived.

## Not tested (require infrastructure or history that does not exist here)

| Metric | Why not tested |
| --- | --- |
| Adoption rate across products | one product exists; a rate over n=1 is theater |
| Duplicate-implementation rate across teams | requires multiple consuming codebases |
| Component reuse trend | requires real historical samples; no synthetic trends |
| Documentation freshness over time | same — needs history, not a snapshot |

These appear here so nobody mistakes their absence for their achievement.
