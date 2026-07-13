import { describe, expect, it } from 'vitest';
import { agentActor, type AntiSlopReview, type SystemFinding } from '@nas/contracts';
import { evaluateReview } from '../engine.js';
import { gradesFromSystemFindings } from './grades.js';

const rawValueFinding: SystemFinding = {
  code: 'DS_RAW_VALUE',
  severity: 'serious',
  dimension: 'design_consistency',
  location: { path: 'packages/ui/src/base.css', line: 12 },
  rationale: 'raw visual value "#ff0000" in a governed path',
  remediation: 'Replace with a semantic token.',
  evidenceIds: [],
};

const expiredExceptionFinding: SystemFinding = {
  code: 'DS_EXCEPTION_EXPIRED',
  severity: 'moderate',
  dimension: 'maintainability',
  location: { path: 'packages/ui/src/registry.ts' },
  rationale: 'exception "exception.stale" expired',
  remediation: 'Renew or remediate.',
  evidenceIds: [],
};

describe('gradesFromSystemFindings', () => {
  it('fails a dimension with a serious finding, names the code and location', () => {
    const [grade] = gradesFromSystemFindings(['design_consistency'], [rawValueFinding], ['ev_1']);
    expect(grade).toMatchObject({ dimension: 'design_consistency', grade: 'fail' });
    expect(grade!.rationale).toContain('DS_RAW_VALUE @ packages/ui/src/base.css:12');
    expect(grade!.evidenceIds).toEqual(['ev_1']);
  });

  it('passes-with-concern on only-moderate findings and passes clean dimensions', () => {
    const grades = gradesFromSystemFindings(
      ['maintainability', 'accessibility'],
      [expiredExceptionFinding],
      ['ev_1'],
    );
    expect(grades[0]).toMatchObject({ dimension: 'maintainability', grade: 'pass_with_concern' });
    expect(grades[1]).toMatchObject({ dimension: 'accessibility', grade: 'pass' });
  });

  it('never collapses findings into an aggregate: one bad dimension cannot dilute another', () => {
    const grades = gradesFromSystemFindings(
      ['design_consistency', 'maintainability'],
      [rawValueFinding],
      [],
    );
    expect(grades.map((g) => g.grade)).toEqual(['fail', 'pass']);
  });
});

describe('system findings block the real anti-slop gate (integration)', () => {
  function review(findings: SystemFinding[]): AntiSlopReview {
    return {
      changeType: 'design_change',
      subject: 'System check integration fixture',
      reviewer: agentActor('agent.system-check', 'System Checker'),
      createdAt: '2026-07-13T12:00:00.000Z',
      grades: gradesFromSystemFindings(
        [
          'design_originality',
          'design_consistency',
          'interaction_quality',
          'responsive_quality',
          'accessibility',
          'evidence_completeness',
        ],
        findings,
        ['ev_scan_1'],
      ),
      exceptions: [],
    };
  }

  it('a serious raw-value finding blocks a design_change review', () => {
    const result = evaluateReview(review([rawValueFinding]));
    expect(result.accepted).toBe(false);
    expect(result.blocking).toEqual([
      expect.objectContaining({ dimension: 'design_consistency', grade: 'fail' }),
    ]);
    expect(result.blocking[0]!.reason).toContain('DS_RAW_VALUE');
  });

  it('zero findings yield an accepted review with no hidden score anywhere', () => {
    const result = evaluateReview(review([]));
    expect(result.accepted).toBe(true);
    expect(result).not.toHaveProperty('score');
    expect(result.blocking).toEqual([]);
  });
});
