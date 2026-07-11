import type { AntiSlopDimension, ChangeType } from '@nas/contracts';

/**
 * Which dimensions are REQUIRED for each change type.
 *
 * "Required" means: the dimension must be graded, and a `not_tested` or `fail`
 * there blocks acceptance (a fail can be overridden only by an authorized
 * exception). Dimensions not listed for a change type may still be graded and a
 * `fail` on ANY dimension still blocks — but their *absence* does not block.
 *
 * These sets are deliberately conservative: a change that touches the interface
 * must prove design, responsiveness, and accessibility; a change that touches
 * code must prove tests and evidence. This is the whole point of the product.
 */
export const REQUIRED_DIMENSIONS: Record<ChangeType, readonly AntiSlopDimension[]> = {
  product_feature: [
    'product_correctness',
    'design_consistency',
    'interaction_quality',
    'responsive_quality',
    'accessibility',
    'code_clarity',
    'test_depth',
    'evidence_completeness',
    'security_impact',
    'maintainability',
  ],
  bug_fix: [
    'product_correctness',
    'code_clarity',
    'test_depth',
    'evidence_completeness',
    'maintainability',
  ],
  refactor: [
    'code_clarity',
    'architecture_depth',
    'test_depth',
    'evidence_completeness',
    'maintainability',
  ],
  design_change: [
    'design_originality',
    'design_consistency',
    'interaction_quality',
    'responsive_quality',
    'accessibility',
    'evidence_completeness',
  ],
  performance: [
    'product_correctness',
    'code_clarity',
    'test_depth',
    'evidence_completeness',
    'operational_impact',
  ],
  accessibility: [
    'accessibility',
    'responsive_quality',
    'interaction_quality',
    'evidence_completeness',
  ],
  security: ['security_impact', 'code_clarity', 'test_depth', 'evidence_completeness'],
  test: ['test_depth', 'evidence_completeness'],
  docs: ['evidence_completeness', 'maintainability'],
  infra: ['operational_impact', 'security_impact', 'code_clarity', 'evidence_completeness'],
};

export function requiredDimensionsFor(changeType: ChangeType): readonly AntiSlopDimension[] {
  return REQUIRED_DIMENSIONS[changeType];
}
