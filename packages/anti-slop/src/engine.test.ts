import { describe, expect, it } from 'vitest';
import {
  type AntiSlopReview,
  type ChangeType,
  type DimensionGrade,
  type Grade,
  agentActor,
  userActor,
} from '@nas/contracts';
import { evaluateReview, requiredDimensionsFor } from './index.js';

const reviewer = agentActor('agent.anti-slop', 'Anti-Slop Reviewer');
const AT = '2026-03-01T12:00:00.000Z';

function grade(dimension: DimensionGrade['dimension'], g: Grade, rationale = 'ok'): DimensionGrade {
  return { dimension, grade: g, rationale, evidenceIds: [] };
}

/** Build a review that grades every required dimension `pass` by default. */
function review(changeType: ChangeType, overrides: Partial<AntiSlopReview> = {}): AntiSlopReview {
  const grades = overrides.grades ?? requiredDimensionsFor(changeType).map((d) => grade(d, 'pass'));
  return {
    changeType,
    subject: 'task_123',
    reviewer,
    createdAt: AT,
    grades,
    exceptions: [],
    ...overrides,
  };
}

describe('acceptance', () => {
  it('accepts when every required dimension passes', () => {
    const result = evaluateReview(review('bug_fix'));
    expect(result.accepted).toBe(true);
    expect(result.blocking).toEqual([]);
    expect(result.summary).toMatch(/Accepted/);
  });

  it('surfaces pass_with_concern without blocking', () => {
    const grades = requiredDimensionsFor('bug_fix').map((d, i) =>
      grade(d, i === 0 ? 'pass_with_concern' : 'pass', i === 0 ? 'minor naming nit' : 'ok'),
    );
    const result = evaluateReview(review('bug_fix', { grades }));
    expect(result.accepted).toBe(true);
    expect(result.concerns).toHaveLength(1);
    expect(result.concerns[0]!.rationale).toMatch(/naming nit/);
  });
});

describe('required coverage blocks (fail-closed)', () => {
  it('blocks when a required dimension is missing entirely', () => {
    const grades = requiredDimensionsFor('bug_fix')
      .filter((d) => d !== 'test_depth')
      .map((d) => grade(d, 'pass'));
    const result = evaluateReview(review('bug_fix', { grades }));
    expect(result.accepted).toBe(false);
    expect(
      result.blocking.some((b) => b.dimension === 'test_depth' && b.grade === 'not_tested'),
    ).toBe(true);
  });

  it('blocks when a required dimension is explicitly Not tested', () => {
    const grades = requiredDimensionsFor('bug_fix').map((d) =>
      grade(d, d === 'evidence_completeness' ? 'not_tested' : 'pass'),
    );
    const result = evaluateReview(review('bug_fix', { grades }));
    expect(result.accepted).toBe(false);
    expect(result.blocking.map((b) => b.dimension)).toContain('evidence_completeness');
  });
});

describe('failures block unless excepted', () => {
  it('blocks on any fail', () => {
    const grades = requiredDimensionsFor('security').map((d) =>
      grade(
        d,
        d === 'security_impact' ? 'fail' : 'pass',
        d === 'security_impact' ? 'leaks a token' : 'ok',
      ),
    );
    const result = evaluateReview(review('security', { grades }));
    expect(result.accepted).toBe(false);
    const sec = result.blocking.find((b) => b.dimension === 'security_impact');
    expect(sec?.reason).toMatch(/leaks a token/);
  });

  it('accepts a fail covered by a valid authorized exception, recording it as a concern', () => {
    const grades = requiredDimensionsFor('security').map((d) =>
      grade(d, d === 'test_depth' ? 'fail' : 'pass'),
    );
    const result = evaluateReview(
      review('security', {
        grades,
        exceptions: [
          {
            dimension: 'test_depth',
            approvedBy: userActor('u_lead', 'Release Approver'),
            reason: 'legacy suite migration tracked in TICKET-42',
            expiresAt: '2026-04-01T00:00:00.000Z',
          },
        ],
      }),
    );
    expect(result.accepted).toBe(true);
    expect(result.exceptionsApplied).toContain('test_depth');
    expect(result.concerns.some((c) => c.dimension === 'test_depth')).toBe(true);
  });

  it('does NOT accept a fail covered by an EXPIRED exception', () => {
    const grades = requiredDimensionsFor('security').map((d) =>
      grade(d, d === 'test_depth' ? 'fail' : 'pass'),
    );
    const result = evaluateReview(
      review('security', {
        grades,
        exceptions: [
          {
            dimension: 'test_depth',
            approvedBy: userActor('u_lead', 'Release Approver'),
            reason: 'stale exception',
            expiresAt: '2026-02-01T00:00:00.000Z', // before AT
          },
        ],
      }),
    );
    expect(result.accepted).toBe(false);
    expect(result.blocking.map((b) => b.dimension)).toContain('test_depth');
  });
});

describe('integrity', () => {
  it('throws on a review that grades a dimension twice', () => {
    const grades = [grade('test_depth', 'pass'), grade('test_depth', 'fail')];
    expect(() => evaluateReview(review('test', { grades }))).toThrow(/more than once/);
  });

  it('never exposes a single aggregate score — only explicit dimensions', () => {
    const result = evaluateReview(review('bug_fix'));
    expect(result).not.toHaveProperty('score');
    expect(Array.isArray(result.blocking)).toBe(true);
    expect(Array.isArray(result.requiredDimensions)).toBe(true);
  });
});
