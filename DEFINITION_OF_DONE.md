# No AI Slop — Definition of Done (v1.1)

The success contract is machine-readable in [`docs/definition-of-done.json`](docs/definition-of-done.json).
Each item carries a `status` and the `evidence` that establishes it. Items marked
`automatable` are checked by the referenced test or command, which CI runs on
every push; the rest require infrastructure that is not present in this
environment and are honestly marked `blocked` / `not_tested`.

Run the summary locally:

```bash
node scripts/dod.mjs
```

## Verified (evaluated by automated tests / real runs)

- Evidence is sealed, hash-chained, and signed; any tamper invalidates the chain.
- Authorization is deny-by-default, audience/resource-bound, and replay-resistant.
- Anti-slop grades 13 dimensions; required Fail/Not-tested blocks; no hidden score.
- The release gate consumes only authenticated evidence and issues a signed
  decision; incomplete/unauthenticated inputs never Pass; self-review is blocked.
- The CLI gate exits fail-closed (0 pass/warning, 2 fail/blocked).
- The app surfaces real kernel output and passes 16 accessibility scans
  (4 routes × desktop/mobile × light/dark).
- Every design token pair meets WCAG 2.2 AA contrast in both themes.
- The full lifecycle runs end-to-end and blocks under tamper (`nas demo`).
- The design system is a machine-readable, referentially-valid registry that
  cannot drift from `tokens.css` or the exported components
  (`pnpm check:design-system`).
- Governed UI paths hold zero raw visual values outside owned, expiring,
  mirror-tested exceptions.
- Dependency direction is machine-checked (strictly downward layers, justified
  exceptions, cycle detection); change impact is a deterministic report
  (`pnpm check:architecture`, `--impact`).
- The control plane renders the live registry + architecture check on
  `/system`; governance transitions are a typed, non-self-publish state machine.

## Blocked / Not tested (require infrastructure not available here)

- GitHub repository import + indexing.
- Container-isolated development workspaces.
- Live Railway staging → production → rollback.
- Multi-tenant persistence and cross-tenant isolation (TC-19).

These are **not reported as working**. The architecture is designed so they can
be added without replacing the verified core.

## Measurable targets (v1 intent)

| Target | Goal | Current |
| --- | --- | --- |
| Anti-slop compliance on merged code | 100% required dimensions graded | Enforced by engine + gate |
| Accessibility (primary workflows) | 0 serious/critical | 0 (16 axe scans) |
| Release gate correctness | Never Pass on incomplete input | Enforced + tested (16 cases) |
| Evidence reconstructability | Every claim reconstructable | Enforced by TC-17 |
| Raw visual values in governed paths | 0 unexcepted | 0 (1 owned exception, mirror-tested) |
| Forbidden dependency edges | 0 | 0 (2 justified same-layer exceptions) |
| Registry references (tokens/components/owners) | 0 broken | 0 (`validateDesignSystemRegistry`) |
| Build reproducibility | Deterministic content-addressed builds | Content addressing in place; live deploy Blocked |
