/**
 * @nas/ui — the No AI Slop design system.
 *
 * Design tokens (contrast-tested) plus a small, coherent set of components. Import
 * the stylesheets once at the app root:
 *   import '@nas/ui/tokens.css';
 *   import '@nas/ui/base.css';
 */
export * from './tokens.js';
export { contrastRatio, relativeLuminance, WCAG_AA_NORMAL, WCAG_AA_LARGE } from './contrast.js';
export { Badge, VerdictBadge, GradeBadge, type BadgeProps } from './components/status.js';
export {
  Button,
  Card,
  PageHeader,
  KeyValue,
  ReasonList,
  type ButtonProps,
  type KeyValueItem,
} from './components/primitives.js';
export { ThemeToggle } from './components/ThemeToggle.js';
export { designSystemRegistry } from './registry.js';
