import type { AntiSlopDimension, DimensionGrade, SystemFinding } from '@nas/contracts';

/**
 * Fold system findings into per-dimension grades for an anti-slop review.
 * Fail-closed mapping, never an average:
 *
 *  - any critical/serious finding in a dimension → `fail`
 *  - only moderate/minor/info findings         → `pass_with_concern`
 *  - no findings                                → `pass`
 *
 * The rationale names the exact finding codes and locations so the gate output
 * stays reconstructable. Evidence ids attach to every grade — a graded but
 * unevidenced dimension is itself slop.
 */
export function gradesFromSystemFindings(
  dimensions: readonly AntiSlopDimension[],
  findings: readonly SystemFinding[],
  evidenceIds: readonly string[],
): DimensionGrade[] {
  return dimensions.map((dimension) => {
    const relevant = findings.filter((finding) => finding.dimension === dimension);
    const blocking = relevant.filter(
      (finding) => finding.severity === 'critical' || finding.severity === 'serious',
    );
    const describe = (list: readonly SystemFinding[]) =>
      list
        .map((f) => `${f.code} @ ${f.location.path}${f.location.line ? `:${f.location.line}` : ''}`)
        .join('; ');

    if (blocking.length > 0) {
      return {
        dimension,
        grade: 'fail' as const,
        rationale: `${blocking.length} blocking system finding(s): ${describe(blocking)}`,
        evidenceIds: [...evidenceIds],
      };
    }
    if (relevant.length > 0) {
      return {
        dimension,
        grade: 'pass_with_concern' as const,
        rationale: `${relevant.length} non-blocking system finding(s): ${describe(relevant)}`,
        evidenceIds: [...evidenceIds],
      };
    }
    return {
      dimension,
      grade: 'pass' as const,
      rationale: 'No system findings in this dimension for the checked scope.',
      evidenceIds: [...evidenceIds],
    };
  });
}
