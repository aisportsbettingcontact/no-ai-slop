import {
  type AntiSlopDimension,
  type AntiSlopException,
  type AntiSlopGateResult,
  type AntiSlopReview,
  AntiSlopReview as AntiSlopReviewSchema,
  type BlockingDimension,
  type DimensionGrade,
} from '@nas/contracts';
import { requiredDimensionsFor } from './policy.js';

/**
 * Evaluate an Anti-Slop review into a gate result.
 *
 * Rules (fail-closed, no hidden aggregate score):
 *  1. A required dimension that is missing or `not_tested` BLOCKS.
 *  2. ANY dimension graded `fail` BLOCKS, unless a valid (unexpired, matching)
 *     authorized exception covers it — then it is surfaced as a concern instead.
 *  3. `pass_with_concern` never blocks but is always surfaced.
 * The result names every blocking dimension explicitly; it never collapses them
 * into a single number that could hide an individual failure.
 *
 * Throws if the review grades the same dimension more than once — an internally
 * inconsistent review is itself slop and must be fixed, not silently resolved.
 */
export function evaluateReview(rawReview: AntiSlopReview): AntiSlopGateResult {
  const review = AntiSlopReviewSchema.parse(rawReview);
  const byDimension = indexGradesUnique(review.grades);
  const required = requiredDimensionsFor(review.changeType);
  const referenceTime = Date.parse(review.createdAt);

  const blocking: BlockingDimension[] = [];
  const concerns: { dimension: AntiSlopDimension; rationale: string }[] = [];
  const exceptionsApplied: AntiSlopDimension[] = [];

  // Rule 1: required coverage.
  for (const dimension of required) {
    const graded = byDimension.get(dimension);
    if (!graded) {
      blocking.push({
        dimension,
        grade: 'not_tested',
        reason: `required dimension "${dimension}" was not graded for a ${review.changeType} change`,
      });
    } else if (graded.grade === 'not_tested') {
      blocking.push({
        dimension,
        grade: 'not_tested',
        reason: `required dimension "${dimension}" is Not tested: ${graded.rationale}`,
      });
    }
  }

  // Rules 2 + 3: evaluate every graded dimension.
  for (const graded of byDimension.values()) {
    if (graded.grade === 'fail') {
      const exception = findValidException(review.exceptions, graded.dimension, referenceTime);
      if (exception) {
        exceptionsApplied.push(graded.dimension);
        concerns.push({
          dimension: graded.dimension,
          rationale: `FAIL accepted under exception by ${exception.approvedBy.displayName}: ${exception.reason}`,
        });
      } else {
        blocking.push({
          dimension: graded.dimension,
          grade: 'fail',
          reason: `dimension "${graded.dimension}" failed: ${graded.rationale}`,
        });
      }
    } else if (graded.grade === 'pass_with_concern') {
      concerns.push({ dimension: graded.dimension, rationale: graded.rationale });
    }
  }

  const accepted = blocking.length === 0;
  return {
    accepted,
    changeType: review.changeType,
    requiredDimensions: [...required],
    blocking,
    concerns,
    exceptionsApplied,
    summary: summarize(accepted, blocking, concerns, exceptionsApplied),
  };
}

function indexGradesUnique(grades: DimensionGrade[]): Map<AntiSlopDimension, DimensionGrade> {
  const map = new Map<AntiSlopDimension, DimensionGrade>();
  for (const g of grades) {
    if (map.has(g.dimension)) {
      throw new Error(
        `anti-slop review grades dimension "${g.dimension}" more than once — resolve the inconsistency`,
      );
    }
    map.set(g.dimension, g);
  }
  return map;
}

function findValidException(
  exceptions: AntiSlopException[],
  dimension: AntiSlopDimension,
  referenceTime: number,
): AntiSlopException | undefined {
  return exceptions.find(
    (e) => e.dimension === dimension && Date.parse(e.expiresAt) > referenceTime,
  );
}

function summarize(
  accepted: boolean,
  blocking: BlockingDimension[],
  concerns: { dimension: AntiSlopDimension }[],
  exceptionsApplied: AntiSlopDimension[],
): string {
  if (accepted) {
    const extras: string[] = [];
    if (concerns.length > 0) extras.push(`${concerns.length} documented concern(s)`);
    if (exceptionsApplied.length > 0)
      extras.push(`${exceptionsApplied.length} exception(s) applied`);
    return extras.length > 0
      ? `Accepted with ${extras.join(' and ')}.`
      : 'Accepted: all required dimensions pass, no failures.';
  }
  const dims = blocking.map((b) => `${b.dimension} (${b.grade})`).join(', ');
  return `Blocked by ${blocking.length} dimension(s): ${dims}.`;
}
