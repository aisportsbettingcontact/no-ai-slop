# No AI Slop — Design Doctrine

The interface must read as though designed by an exceptional product team at its
most disciplined: radical clarity, ruthless prioritization, deliberate
simplicity. It must never look like a template assembled from generic AI
components. This doctrine is enforced in code (`packages/ui`) and by test where
possible (contrast, structure), not left to taste.

## Personality

Calm, precise, and confident under complexity. The product handles authorization,
evidence, and release decisions — heavy machinery — and its job is to make those
feel legible and safe, never busy or alarming.

## The rules we hold

**One dominant task per screen.** Overview answers "is this build ready?".
Release answers "why did the gate decide this?". Evidence answers "can I trust the
record?". Each screen has exactly one primary action.

**Hierarchy through type and space, not decoration.** A closed type scale and a
closed spacing scale (`tokens.ts`) — no arbitrary values. Titles use the
`type.tracking.tight` token; secondary text steps down in weight and color,
never just size. Since v1.1 the closed scales are machine-enforced: the
design-system registry (`packages/ui/src/registry.ts`) names every token,
component, pattern, and exception, and `pnpm check:design-system` fails on any
raw visual value in a governed path that lacks an owned, expiring exception.

**Restrained color.** Neutral surfaces, ONE mint accent reserved for the single
primary action, and semantic status colors (success/warning/danger/info/neutral).

**Status is never color alone.** Every badge pairs a text label (and a symbol)
with its color, so meaning survives color-blindness and grayscale.

**Complete edge states.** Loading, empty, error, blocked, and recovery states are
designed, not left blank. `ReasonList` renders an explicit empty label rather than
a void; the app shows Blocked with the exact reason, not a silent gap.

**Progressive disclosure.** Overview summarizes; Release and Evidence expand. Raw
model prompts, chain-of-thought, and infrastructure logs never appear in primary
workflows.

**Responsive by adaptation, not compression.** Desktop/tablet use a persistent
left navigation; below 1024px it becomes a clean stacked top bar. The desktop
layout is never just squeezed onto mobile.

**Accessibility is a gate, not a nicety.** WCAG 2.2 AA. Contrast is unit-tested for
every token pair in both themes; keyboard focus is always visible; reduced motion
is honored; the interface passes axe-core with zero serious/critical violations.

## What the interface must never contain

Generic AI gradients, decorative glass/glow, floating translucent cards, animated
agent networks, decorative agent avatars, sparkle icons without meaning, arbitrary
charts, metric walls, excessive pills/rounded rectangles, multiple competing
primary actions, unexplained status colors, raw prompts or logs, internal service
names in user copy, or placeholder copy presented as final.

## What the user must always understand

Where they are · what they are working on · what the system is doing and why · what
changed and who/what changed it · what was tested · what failed · what is verified ·
what is uncertain · what requires approval · what is blocked · what is safe next.

## Evidence, approval, and agent activity

- **Evidence** is presented as an ordered, attributable chain with a valid/invalid
  verdict — never as an unexplained blob.
- **Approval** controls state the decision, its signer, and its verification status.
- **Agent activity** is shown as outcomes and evidence, never as raw reasoning.
