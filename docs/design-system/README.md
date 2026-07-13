# Design system — machine-readable registry

The design system is not a component gallery. It is a governed product language:
principles, tiered tokens, components classified by atomic level, functional and
perceptual patterns, accessibility rules, ownership, versions, and explicit,
expiring exceptions. Since v1.1 that language is **machine-readable** and
**enforced**:

| Artifact | What it is |
| --- | --- |
| `packages/contracts/src/design-system.ts` | The schemas: `DesignSystemRegistry`, `DesignTokenDef` (primitive → semantic → component tiers), `ComponentDef` (foundation → page atomic levels), `PatternDef`, `SystemException`, plus `validateDesignSystemRegistry` (referential integrity) |
| `packages/ui/src/registry.ts` | The registry **instance** describing the actual system, kept next to the code it describes; color values are imported from `tokens.ts`, never re-typed |
| `docs/design-system/registry.json` | Generated canonical JSON (with content digest) for tools and agents that cannot execute TypeScript — regenerate with `pnpm check:design-system --write` |
| `packages/anti-slop/src/checks/design-system.ts` | The pure checker: registry + scan facts in → structured `SystemFinding`s out |
| `scripts/check-design-system.mjs` | The scanner + gate: collects facts from governed paths and fails closed on findings or a stale artifact |
| `apps/no-ai-slop/app/system/page.tsx` | The System view: renders the live registry and validation on every build |

## Commands

```bash
pnpm check:design-system            # verify: registry integrity + raw-value scan + artifact freshness
pnpm check:design-system --write    # regenerate docs/design-system/registry.json
pnpm check:architecture             # verify: layer rules + scanned dependency graph + artifact freshness
pnpm check:architecture --write     # regenerate docs/architecture/observed-dependencies.json
node scripts/check-architecture.mjs --impact <file...>   # machine-readable ImpactReport for changed files
```

Both checks also run inside `pnpm test` against the real repository
(`packages/cli/src/repo-system.test.ts`), so drift fails CI, not just a manual
script run.

## What the checks enforce

- **Referential integrity** — every token, principle, owner, rule, composition,
  and deprecation reference resolves; duplicate ids/names/CSS variables fail.
- **Tier discipline** — a token aliases only a strictly lower tier
  (component → semantic → primitive).
- **Controlled composition** — a component composes only strictly lower atomic
  levels; atoms and foundations compose nothing.
- **Closed scales** — no raw hex/px/rgba values in governed paths
  (`packages/ui/src/**.tsx`, `apps/no-ai-slop/app/**.tsx`,
  `packages/ui/src/base.css`) unless covered by an **owned, expiring exception**
  in the registry. `tokens.css` is the token definition source and is exempt by
  construction.
- **Registry ↔ CSS sync** — every registry `cssVariable` must exist in
  `tokens.css` with the exact value (both themes), and every `--nas-*` custom
  property must be claimed by exactly one token (`packages/ui/src/registry.test.ts`).
- **Registry ↔ exports completeness** — every component exported from `@nas/ui`
  must have a registry entry.
- **Finding discipline** — every violation is a `SystemFinding` with a stable
  code (`DS_RAW_VALUE`, `DS_BROKEN_REFERENCE`, `ARCH_FORBIDDEN_EDGE`, …),
  severity, exact location, rationale, remediation, and the anti-slop dimension
  it grades into. There is no aggregate score.

## Known limits (honestly disclosed)

- The raw-value scanner is line-based and static: values assembled at runtime
  and trailing same-line `//` comments are scanned as code; dynamic `import()`
  with computed specifiers is invisible to the dependency scanner.
- The color system has no primitive palette layer yet — the semantic color
  tokens are the roots (that is what the code does; the registry does not invent
  a palette that doesn't exist). Introducing one is a governance-tracked change.
- `usesTokens` accuracy per component is registry-authored and reviewed, not yet
  derived from the CSS automatically.

See [`governance.md`](governance.md) for how the system evolves and
[`metrics.md`](metrics.md) for how its health is measured.
