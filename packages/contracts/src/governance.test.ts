import { describe, expect, it } from 'vitest';
import {
  ALLOWED_CONTRIBUTION_TRANSITIONS,
  ContributionRecord,
  ContributionRequest,
  applyContributionTransition,
  userActor,
  type Actor,
  type ContributionState,
  type ContributionTransition,
} from './index.js';

const requester: Actor = userActor('u_designer', 'Dana Designer');
const reviewer: Actor = userActor('u_reviewer', 'Rae Reviewer');

function request(overrides: Partial<ContributionRequest> = {}): ContributionRequest {
  return ContributionRequest.parse({
    id: 'contrib.density-token',
    kind: 'token',
    title: 'Compact density spacing token',
    need: 'Data tables in the audit view are unreadable at the default density.',
    existingCapabilitySearch:
      'Searched the spacing scale and layout tokens; no compact step exists between space.3 and space.4.',
    proposedScope: 'One semantic token space.table-row aliasing space.3.',
    accessibilityImpact: 'Touch targets stay >= 40px; only intra-row padding changes.',
    securityImpact: 'None — visual token only.',
    evidencePlan: 'Contrast + registry tests, responsive screenshots of the audit table.',
    ownerId: 'owner.design-systems',
    requestedBy: requester,
    createdAt: '2026-07-13T09:00:00.000Z',
    highImpact: true,
    ...overrides,
  });
}

function record(state: ContributionState, overrides: Partial<ContributionRequest> = {}) {
  return ContributionRecord.parse({ request: request(overrides), state, history: [] });
}

function transition(
  from: ContributionState,
  to: ContributionState,
  actor: Actor = reviewer,
): ContributionTransition {
  return {
    from,
    to,
    actor,
    at: '2026-07-13T10:00:00.000Z',
    rationale: 'Test transition.',
  };
}

describe('contribution state machine', () => {
  it('walks the full happy path to published', () => {
    let current = record('proposed');
    const path: [ContributionState, ContributionState][] = [
      ['proposed', 'triaged'],
      ['triaged', 'design_review'],
      ['design_review', 'implementation'],
      ['implementation', 'verification'],
      ['verification', 'published'],
    ];
    for (const [from, to] of path) {
      const result = applyContributionTransition(current, transition(from, to));
      expect(result.ok).toBe(true);
      if (result.ok) current = result.record;
    }
    expect(current.state).toBe('published');
    expect(current.history).toHaveLength(5);
  });

  it('lets verification fall back to implementation (failed checks loop, not die)', () => {
    const result = applyContributionTransition(
      record('verification'),
      transition('verification', 'implementation'),
    );
    expect(result.ok).toBe(true);
  });

  it('refuses a transition whose from-state does not match the record', () => {
    const result = applyContributionTransition(
      record('proposed'),
      transition('triaged', 'design_review'),
    );
    expect(result).toMatchObject({ ok: false, code: 'GOV_STATE_MISMATCH' });
  });

  it('refuses transitions the map does not allow', () => {
    const result = applyContributionTransition(
      record('proposed'),
      transition('proposed', 'published'),
    );
    expect(result).toMatchObject({ ok: false, code: 'GOV_FORBIDDEN_TRANSITION' });
  });

  it('refuses to leave terminal states', () => {
    for (const state of ['rejected', 'deprecated'] as const) {
      const result = applyContributionTransition(record(state), transition(state, 'proposed'));
      expect(result).toMatchObject({ ok: false, code: 'GOV_TERMINAL_STATE' });
    }
  });

  it('blocks self-publication of a high-impact contribution (non-self review)', () => {
    const result = applyContributionTransition(
      record('verification'),
      transition('verification', 'published', requester),
    );
    expect(result).toMatchObject({ ok: false, code: 'GOV_SELF_PUBLISH' });
  });

  it('allows self-publication only for non-high-impact contributions', () => {
    const result = applyContributionTransition(
      record('verification', { highImpact: false }),
      transition('verification', 'published', requester),
    );
    expect(result.ok).toBe(true);
  });

  it('requires an expiry to route a contribution as a product-specific exception', () => {
    const noExpiry = applyContributionTransition(
      record('triaged'),
      transition('triaged', 'product_specific_exception'),
    );
    expect(noExpiry).toMatchObject({ ok: false, code: 'GOV_EXCEPTION_NEEDS_EXPIRY' });

    const withExpiry = applyContributionTransition(
      record('triaged', { expiresAt: '2026-12-31T00:00:00.000Z' }),
      transition('triaged', 'product_specific_exception'),
    );
    expect(withExpiry.ok).toBe(true);
  });

  it('refuses an exception whose expiry is already in the past at transition time', () => {
    // Transition time is 2026-07-13; this expiry is long dead.
    const dead = applyContributionTransition(
      record('triaged', { expiresAt: '2020-06-01T00:00:00.000Z' }),
      transition('triaged', 'product_specific_exception'),
    );
    expect(dead).toMatchObject({ ok: false, code: 'GOV_EXCEPTION_ALREADY_EXPIRED' });

    // Boundary: expiry exactly equal to the transition time is also refused.
    const boundary = applyContributionTransition(
      record('triaged', { expiresAt: '2026-07-13T10:00:00.000Z' }),
      transition('triaged', 'product_specific_exception'),
    );
    expect(boundary).toMatchObject({ ok: false, code: 'GOV_EXCEPTION_ALREADY_EXPIRED' });
  });

  it('never mutates the input record', () => {
    const before = record('proposed');
    const snapshot = JSON.parse(JSON.stringify(before)) as unknown;
    applyContributionTransition(before, transition('proposed', 'triaged'));
    expect(before).toEqual(snapshot);
  });

  it('covers every state in the transition map (no unreachable or missing states)', () => {
    const states = Object.keys(ALLOWED_CONTRIBUTION_TRANSITIONS) as ContributionState[];
    expect(states.sort()).toEqual(
      [
        'proposed',
        'triaged',
        'product_specific_exception',
        'design_review',
        'implementation',
        'verification',
        'published',
        'deprecated',
        'rejected',
      ].sort(),
    );
    // Every target of every transition is itself a defined state.
    for (const targets of Object.values(ALLOWED_CONTRIBUTION_TRANSITIONS)) {
      for (const target of targets) expect(states).toContain(target);
    }
  });
});
