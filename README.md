# No AI Slop

**A controlled AI application development platform that makes it hard to ship
low-quality, AI-generated software.** No AI Slop replaces careless vibecoding with
disciplined product thinking, controlled agent execution, authenticated evidence,
independent verification, and defensible releases.

The mission is not to make AI-generated software *look* professional. It is to
remove AI slop from the *process* — so that every meaningful output is deliberate,
inspectable, testable, attributable, evidence-backed, and production-ready.

---

## What is actually built and verified

This repository was built from an empty repository in a single controlled session.
It delivers a **complete, verified anti-slop quality-gate core**, plus a running
control-plane app that surfaces it. Everything below is **Verified**: it builds and
typechecks clean, lints clean, and is exercised by passing tests and/or real runs.

| Package | What it is |
| --- | --- |
| `@nas/contracts` | Authoritative types + Zod schemas — the single source of truth, including the design-system, architecture, and governance contracts |
| `@nas/crypto` | Canonical JSON, sha256 content addressing, HMAC signing |
| `@nas/kernel-evidence` | **TC-17** — content-addressed, hash-chained, signed evidence |
| `@nas/kernel-authz` | **TC-07** — deny-by-default least-privilege authorization |
| `@nas/kernel-release` | **TC-10** — signed, fail-closed release-gate decisions |
| `@nas/anti-slop` | The 13-dimension anti-slop review engine + pure system checks (design system, architecture, change impact) — no hidden score |
| `@nas/ui` | Design system: contrast-tested tokens, components, and the machine-readable registry (`designSystemRegistry`) |
| `@nas/cli` (`nas`) | Seal evidence · run anti-slop · evaluate the release gate |
| `apps/no-ai-slop` | Next.js control-plane app surfacing **real** kernel output, including the live `/system` registry + architecture view |

**What is _not_ claimed:** live Railway deployment, multi-tenant persistence,
container-isolated agent workspaces, and external beta are designed for but
**Blocked / Not tested** in this environment. See [`V1_SCOPE.md`](V1_SCOPE.md) —
nothing here is reported as working unless it works through the real product.

## The lifecycle, enforced

```
authorize (TC-07)  →  seal evidence (TC-17)  →  anti-slop review  →
release gate (TC-10, signed)  →  fail-closed under tamper
```

Three invariants hold, by construction and by test:

- **No agent action bypasses TC-07** (deny-by-default; audience/resource-bound;
  replay-resistant; every decision leaves an audit receipt).
- **No material claim bypasses TC-17** (tamper, reorder, deletion, or forgery
  invalidates the whole evidence chain).
- **No deployment bypasses TC-10** (only authenticated evidence, evidence-backed
  checks, an accepted anti-slop gate, and a non-self independent review can Pass).

## Quickstart

```bash
pnpm install
pnpm build          # tsc -b across all packages (project references)
pnpm test           # 193 unit/contract/system tests (Vitest)
pnpm typecheck && pnpm lint

# The machine-readable product system, enforced:
pnpm check:design-system    # registry integrity + raw-value scan + artifact freshness
pnpm check:architecture     # layer rules + scanned dependency graph
node scripts/check-architecture.mjs --impact <changed-file...>   # deterministic impact report

# Run the whole control lifecycle end-to-end, in-memory, through the real kernels:
export NAS_SIGNING_KEY="a-local-dev-signing-key-16+chars"
node packages/cli/dist/cli.js demo

# The control-plane app:
cd apps/no-ai-slop && pnpm build && pnpm start   # http://localhost:3000
```

`nas demo` authorizes an action, denies an unauthorized one, seals an evidence
chain, runs the anti-slop review, evaluates a staging release to **PASS**, then
alters one sealed record and shows the gate flip to **BLOCKED**.

## Repository layout

```
packages/
  contracts/        types + Zod schemas (pure, no Node built-ins)
  crypto/           canonical JSON, sha256, HMAC
  kernel-evidence/  TC-17 evidence integrity & chain of custody
  kernel-authz/     TC-07 agent authorization & least privilege
  kernel-release/   TC-10 release-gate correctness
  anti-slop/        13-dimension review engine + checks/ (design system, architecture, impact)
  ui/               design tokens (contrast-tested) + components + registry.ts
  cli/              the `nas` command line + repo-system test suite
apps/
  no-ai-slop/       Next.js control-plane app + browser/a11y harness
docs/
  adr/              architecture decision records
  architecture/     layer-rules.json + generated observed-dependencies.json
  design-system/    README, governance, metrics + generated registry.json
scripts/            dod.mjs, check-architecture.mjs, check-design-system.mjs
```

## Documentation

- [`V1_SCOPE.md`](V1_SCOPE.md) — what v1/v1.1 is and is not (with honest status).
- [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md) — the machine-readable success contract.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — package graph, trust boundaries, data flow.
- [`NO_AI_SLOP_DESIGN_DOCTRINE.md`](NO_AI_SLOP_DESIGN_DOCTRINE.md) — the design standard.
- [`docs/design-system/README.md`](docs/design-system/README.md) — the machine-readable registry, checks, and limits.
- [`docs/design-system/governance.md`](docs/design-system/governance.md) — how the product language evolves.
- [`docs/design-system/metrics.md`](docs/design-system/metrics.md) — measured vs. honestly not-tested metrics.
- [`docs/adr/ADR-0001-machine-readable-product-system.md`](docs/adr/ADR-0001-machine-readable-product-system.md) — the v1.1 decision record.
- [`docs/DEPENDENCIES.md`](docs/DEPENDENCIES.md) — why each dependency exists.

## Status vocabulary

This project uses precise status terms — **Implemented, Verified, Partially
implemented, Blocked, Failed, Not tested** — and avoids "basically done", "should
work", or "production-ready based only on tests". A capability is reported as
working only when it works through the real product.
