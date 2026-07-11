# No AI Slop — v1 Scope

This document locks what v1 is and is not. Scope cannot expand without an
architecture decision record (`docs/adr/`). Status uses the precise vocabulary
required by the project: **Implemented**, **Verified**, **Partially implemented**,
**Blocked**, **Not tested**.

> **Honest framing.** This repository was built from an empty repository in a
> single controlled session. It delivers a **complete, verified anti-slop
> quality-gate core** (the three certification kernels + the anti-slop engine +
> a CLI + a running control-plane app). The broader enterprise platform
> (multi-tenant persistence, container-isolated agent workspaces, live Railway
> deployment, external beta) is **scaffolded in contract/interface form and
> explicitly marked Blocked / Not tested** — it is not claimed as working.

## Included in v1 (this repository)

| Capability | Status | Where |
| --- | --- | --- |
| Authoritative shared contracts (Zod + types) | Verified | `packages/contracts` |
| Content-addressing + HMAC signing + canonical JSON | Verified | `packages/crypto` |
| TC-17 evidence integrity & chain of custody | Verified | `packages/kernel-evidence` |
| TC-07 agent authorization & least privilege | Verified | `packages/kernel-authz` |
| TC-10 release-gate correctness | Verified | `packages/kernel-release` |
| Anti-Slop review engine (13 dimensions) | Verified | `packages/anti-slop` |
| `nas` CLI (evidence, anti-slop, gate, demo) | Verified | `packages/cli` |
| Design system: tokens (contrast-tested) + components | Verified | `packages/ui` |
| Control-plane web app (surfaces real kernel output) | Verified | `apps/no-ai-slop` |
| Responsive + accessibility browser scan harness | Verified | `apps/no-ai-slop/e2e` |

"Verified" here means: builds clean, typechecks clean, lints clean, and is
exercised by passing automated tests and/or a real run captured as evidence.

## Explicitly out of v1 (Blocked / Not tested — not claimed)

These are designed for but **not built or not proven** in this environment. The
architecture keeps them addable without replacing the core:

| Capability | Status | Reason |
| --- | --- | --- |
| Live Railway staging/production deploy | Blocked | No Railway CLI/credentials in this environment |
| Multi-tenant Postgres persistence + isolation tests (TC-19) | Not tested | No database provisioned; data model is contract-only |
| Container-isolated agent workspaces | Not tested | Requires an orchestrated sandbox runtime |
| Real model gateway / live agent execution | Not tested | Requires model credentials + a broker deployment |
| SSO / SCIM, org/billing administration | Not tested | Enterprise identity not provisioned |
| Controlled external beta (Step 49) | Blocked | Requires real users |
| Native iOS / Android / macOS / Windows generation | Out of scope | Non-goal for v1 by definition |

## Supported technology (for the platform itself)

- **Language / runtime:** TypeScript 5.7, Node.js 22, ESM throughout.
- **Package manager:** pnpm 10 workspaces with TypeScript project references.
- **Frameworks:** React 18, Next.js 14 (App Router) for the control-plane app.
- **Testing:** Vitest (unit/contract), Playwright-core + axe-core (browser + a11y).
- **Browsers exercised:** Chromium (desktop 1440×900, mobile 390×844; light + dark).
- **Intended deployment target:** Railway (config/model present; live deploy Blocked).

## Non-goals for v1

- No single arbitrary "slop score." The anti-slop gate reports individual failed
  dimensions and never a hidden average.
- No capability is reported as working unless it works through the real product.
- No new dependency without a recorded justification (see `docs/DEPENDENCIES.md`).
- No new service where a well-structured module suffices.
