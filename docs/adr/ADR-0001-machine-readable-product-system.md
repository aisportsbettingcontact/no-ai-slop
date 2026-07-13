# ADR-0001 — Machine-readable product system (registry, architecture rules, impact)

- **Status:** Accepted
- **Date:** 2026-07-13
- **Iteration:** v1.1 — "Machine-Readable System Registry and Change Impact Review"
- **Deciders:** design-systems iteration (this change); independent adversarial review
  required before release (see Verification).

## Context

v1 delivered a verified anti-slop quality-gate core: contracts, crypto, the TC-07 /
TC-17 / TC-10 kernels, the 13-dimension anti-slop engine, a restrained design
system (`@nas/ui`), the `nas` CLI, and a control-plane app rendering real kernel
output. The baseline at commit `2cdb72c` is fully green (build, typecheck, lint,
format, 104 tests, DoD summary, CLI demo, app build, 12 browser/a11y scans).

What v1 does **not** have is a machine-readable product grammar. The design system
exists as code and prose doctrine, but nothing an agent (or a check) can *query*:
which tokens exist and at what tier, which components exist at which atomic level,
what states and prohibited uses they have, which dependency directions are legal,
and what a changed file impacts. Without that, controlled composition is a
convention, not an enforced property — exactly the gap both governing theses
(Kholmatova's design-systems framework, Frost's atomic design) identify as the
thing AI-speed generation makes dangerous.

## Decision

Implement the smallest vertical slice that makes the product system
machine-readable, validated, and surfaced through the real product:

1. **Contracts, not prose.** Extend `@nas/contracts` with three new schema
   modules — `design-system.ts`, `architecture.ts`, `governance.ts` — using the
   same conventions as the existing modules (Zod schemas, inferred types, stable
   ids, exact status enums). Referential-integrity validation
   (`validateDesignSystemRegistry`) lives beside the schemas as pure logic.
2. **The registry lives with the code it describes.** `packages/ui/src/registry.ts`
   is the typed, authoritative inventory of the *existing* system (tokens,
   components, patterns, principles, owners, exceptions) — classified by token
   tier (primitive / semantic / component) and atomic level (foundation / atom /
   molecule / organism / template / page). A canonical JSON artifact
   (`docs/design-system/registry.json`, with content digest) is generated from it
   and freshness-checked by test, so external tools and agents can consume the
   registry without executing TypeScript.
3. **Architecture rules are data; checkers are pure; I/O stays at the edges.**
   Layer definitions and permitted dependency directions live in
   `docs/architecture/layer-rules.json` (validated by the contracts schema).
   `scripts/check-architecture.mjs` deterministically scans workspace manifests
   and source imports into `docs/architecture/observed-dependencies.json`
   (freshness-checked by test). Pure checkers in
   `packages/anti-slop/src/checks/` take facts in and return structured findings
   out — no filesystem access inside the package.
4. **Findings map into the existing 13 dimensions.** No dimension is added or
   removed. A new `SystemFinding` contract carries a stable code (e.g.
   `DS_RAW_VALUE`, `ARCH_FORBIDDEN_EDGE`), severity, exact location, rationale,
   remediation, and evidence references, plus the anti-slop dimension it grades
   into. There is still no aggregate score.
5. **Impact analysis is a deterministic pure function.** `computeImpact(graph,
   changedFiles)` maps changed files → owning modules → transitive dependents →
   affected routes, checks, and anti-slop dimensions. It begins and ends with
   local data structures; no graph database.
6. **One new control-plane route.** `/system` renders the *real* registry, the
   *real* registry validation result, and the *real* architecture check result
   (from the validated rule + scan artifacts) with progressive disclosure. No
   "Change Review" route in this slice: there is no real change-request data yet,
   and rendering fabricated review data would violate the no-placeholder rule.
7. **Governance is a typed state machine.** Contribution requests, the
   proposed → … → published/rejected lifecycle, snowflake (product-specific
   exception) handling, and non-self review enforcement for high-impact changes
   are contracts with tests, documented in `docs/design-system/governance.md`.
8. **Raw visual values in governed paths are replaced by semantic tokens.** The
   irreducible cases (CSS media-query breakpoints cannot read custom properties)
   get explicit exception records with owner, scope, expiry, and remediation —
   never silent.

## Alternatives considered and rejected

- **A new `@nas/design-system` / `@nas/system` package for the schemas.**
  Rejected: contracts are the declared single source of truth; splitting them
  fragments the layer without adding an independent domain responsibility,
  test surface, or dependency-direction need.
- **Hand-maintained `registry.json` as the source of truth.** Rejected: JSON
  detached from the component code drifts silently. The TS registry is typed
  against the contracts, sits next to the components it describes, and the JSON
  is generated + freshness-tested instead.
- **A knowledge-graph / database service (Neo4j, triplestore).** Rejected as
  premature infrastructure: deterministic local data structures satisfy every
  current query; the spec's own anti-pattern list names this.
- **An ESLint plugin for architecture rules.** Rejected: coupling the rules to
  lint infrastructure makes them harder to test as data and unusable by the app;
  a pure checker over scanned facts serves lint, CLI, tests, and UI equally.
- **Storybook (or similar) as a component-state harness.** Rejected for this
  slice: it adds a large dependency surface (webpack/vite toolchain) for a need
  the existing Playwright browser harness plus registry state declarations
  already cover. Re-evaluate through a future ADR if a real workflow needs it.
- **Adding new anti-slop dimensions (e.g. `system_adherence`).** Rejected: the
  13 dimensions already cover the semantics (design_consistency,
  architecture_depth, maintainability…); changing the dimension set requires a
  migration plan and breaks the existing policy contract for no expressive gain.
- **A GitHub issue/PR template for contributions.** Rejected for this slice:
  templates not wired to a real validated workflow are documentation theater.

## Consequences

- `@nas/contracts` grows three modules; all additions are backwards-compatible
  (no existing schema is modified).
- `@nas/ui` gains a `registry` export and loses its raw visual values (replaced
  by tokens); public component APIs are unchanged.
- `@nas/anti-slop` gains a `checks/` subtree of pure functions; the engine and
  policy are untouched (characterization: existing engine tests must keep
  passing unmodified).
- Two generated, committed artifacts (`docs/design-system/registry.json`,
  `docs/architecture/observed-dependencies.json`) are freshness-checked by test;
  drift fails `pnpm test`, which forces regeneration in the same change.
- The app gains one route; the browser/a11y harness matrix grows to 16 scans.

## Risks

- **Generated-artifact drift** if a contributor edits JSON by hand → mitigated by
  freshness tests and digests.
- **Registry-to-code divergence** (a component is added without a registry
  entry) → mitigated by a completeness check that compares `@nas/ui` exports to
  registry entries in test.
- **Scan false negatives:** the import scanner reads static `import`/`from`
  declarations and workspace manifests; dynamic `import()` with computed paths
  would be missed. Documented as a known limit in
  `docs/design-system/README.md`; acceptable at current codebase size.

## Rollback

The slice is additive: new files plus small token/CSS substitutions in `@nas/ui`
and the app. Rollback is `git revert` of this iteration's commits; no data or
schema migration exists; no existing public API changes shape. The baseline
commands above re-verify the reverted state.

## Verification contract for this ADR

Definition of Done for the slice: all pre-existing tests pass unmodified; new
schema/registry/architecture/governance/impact tests pass, including
intentionally-invalid fixtures that must fail closed; format/lint/typecheck
clean; app builds; browser/a11y harness passes on all routes including
`/system`; evidence for these claims is sealed through `nas evidence add`; an
anti-slop review and a signed release decision bind to the exact implementation
commit; an independent (non-author) adversarial review is recorded.
