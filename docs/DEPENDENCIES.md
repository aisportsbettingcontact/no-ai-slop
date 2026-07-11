# Dependency justification log

Anti-slop rule: no dependency is added without a recorded reason. This is the
record. The runtime footprint is deliberately tiny — the kernels depend on exactly
one third-party runtime package (`zod`); everything else is Node built-ins.

## Runtime

| Dependency | Used by | Why it is necessary |
| --- | --- | --- |
| `zod` | `@nas/contracts` | Runtime validation of all external data at boundaries, with types inferred from the same schema so validation and typing cannot drift. A named anti-slop failure is "unvalidated external data / broad untyped objects"; zod prevents it. |
| `react`, `react-dom` | `@nas/ui`, `apps/no-ai-slop` | The control-plane UI. React is the framework the design system components target. |
| `next` | `apps/no-ai-slop` | App Router server components let the app render real kernel output server-side without a separate API tier for v1. |
| `server-only` | `apps/no-ai-slop` | Marks the kernel-computing module as server-only so it can never be bundled into client code. |

No other runtime dependencies. Content addressing, HMAC signing, and canonical
serialization are implemented on Node's built-in `crypto` rather than pulling a
crypto library — fewer moving parts to audit.

## Development / testing

| Dependency | Why |
| --- | --- |
| `typescript`, `typescript-eslint`, `eslint`, `prettier` | Typecheck, lint (no `any`, no silent catches), format. |
| `vitest`, `@vitest/coverage-v8` | Unit and contract tests. |
| `playwright-core` | Drive the real app in Chromium for responsive + browser testing (browser binaries are pre-provisioned; no download). |
| `axe-core` | Automated accessibility scanning of the running app. |

## Explicitly not added

Kept out on purpose to avoid unnecessary dependency accumulation: a CLI arg-parsing
library (the `nas` parser is ~30 lines), a state-management library, a component
library, a CSS framework, and any crypto/JWT library (Node built-ins suffice).
