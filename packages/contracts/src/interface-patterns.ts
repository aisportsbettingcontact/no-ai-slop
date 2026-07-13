import { z } from 'zod';
import { AntiSlopDimension } from './anti-slop.js';
import { SemanticVersion } from './design-system.js';
import { Severity } from './findings.js';

/**
 * Interface anti-pattern contracts: the review vocabulary for analyzing a
 * product mockup, generated site, or design.
 *
 * A catalog names recurring interface failures with stable identifiers.
 * Each pattern declares whether it is a specific AI-generation marker or a
 * general quality failure, how it can be detected, which anti-slop dimension
 * it grades into, and its default severity — so a reviewer (human or agent)
 * cites `antipattern.gradient-text`, not a vibe. The authoritative catalog
 * instance lives in @nas/anti-slop.
 */

export const InterfacePatternId = z
  .string()
  .regex(/^antipattern\.[a-z0-9]+(?:[.-][a-z0-9]+)*$/, 'expected an antipattern.<name> id');
export type InterfacePatternId = z.infer<typeof InterfacePatternId>;

export const InterfacePatternCategory = z.enum([
  'visual_details',
  'typography',
  'color_contrast',
  'layout_spacing',
  'motion',
  'copy',
  'imagery',
  'general_quality',
]);
export type InterfacePatternCategory = z.infer<typeof InterfacePatternCategory>;

/** Some patterns specifically indicate AI-generated design; others are general failures. */
export const InterfacePatternSignal = z.enum(['ai_generated_marker', 'general_quality_failure']);
export type InterfacePatternSignal = z.infer<typeof InterfacePatternSignal>;

/** How the pattern can be observed. Honest about what is automatable today. */
export const InterfacePatternDetection = z.enum([
  'static_analysis',
  'rendered_page',
  'manual_review',
]);
export type InterfacePatternDetection = z.infer<typeof InterfacePatternDetection>;

export const InterfacePattern = z.object({
  id: InterfacePatternId,
  /** Stable catalog number (1..N), used in review shorthand ("#20 gradient text"). */
  number: z.number().int().positive(),
  name: z.string().min(1).max(120),
  category: InterfacePatternCategory,
  signal: InterfacePatternSignal,
  detection: InterfacePatternDetection,
  description: z.string().min(1).max(500),
  /** The anti-slop dimension a hit on this pattern grades into. */
  dimension: AntiSlopDimension,
  defaultSeverity: Severity,
  remediation: z.string().min(1).max(500),
});
export type InterfacePattern = z.infer<typeof InterfacePattern>;

export const InterfacePatternCatalog = z.object({
  schemaVersion: z.literal(1),
  version: SemanticVersion,
  patterns: z.array(InterfacePattern).min(1),
});
export type InterfacePatternCatalog = z.infer<typeof InterfacePatternCatalog>;

export const CatalogProblem = z.object({
  code: z.enum(['CAT_DUPLICATE_ID', 'CAT_DUPLICATE_NUMBER', 'CAT_NUMBER_GAP']),
  path: z.string().min(1),
  message: z.string().min(1),
});
export type CatalogProblem = z.infer<typeof CatalogProblem>;

/**
 * Catalog integrity: ids unique, numbers unique and contiguous from 1 — a gap
 * would silently orphan a review shorthand. Deterministic problem ordering.
 */
export function validateInterfacePatternCatalog(catalog: InterfacePatternCatalog): {
  valid: boolean;
  problems: CatalogProblem[];
} {
  const problems: CatalogProblem[] = [];
  const seenIds = new Set<string>();
  const seenNumbers = new Set<number>();
  for (const pattern of catalog.patterns) {
    if (seenIds.has(pattern.id)) {
      problems.push({
        code: 'CAT_DUPLICATE_ID',
        path: `patterns/${pattern.id}`,
        message: `duplicate pattern id "${pattern.id}"`,
      });
    }
    seenIds.add(pattern.id);
    if (seenNumbers.has(pattern.number)) {
      problems.push({
        code: 'CAT_DUPLICATE_NUMBER',
        path: `patterns/${pattern.id}`,
        message: `duplicate pattern number ${pattern.number}`,
      });
    }
    seenNumbers.add(pattern.number);
  }
  for (let n = 1; n <= catalog.patterns.length; n += 1) {
    if (!seenNumbers.has(n)) {
      problems.push({
        code: 'CAT_NUMBER_GAP',
        path: `patterns/#${n}`,
        message: `pattern numbering has a gap at ${n}`,
      });
    }
  }
  problems.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code));
  return { valid: problems.length === 0, problems };
}
