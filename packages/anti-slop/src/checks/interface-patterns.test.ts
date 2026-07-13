import { describe, expect, it } from 'vitest';
import {
  InterfacePatternCatalog,
  SystemFinding,
  validateInterfacePatternCatalog,
} from '@nas/contracts';
import { evaluateReview } from '../engine.js';
import { agentActor } from '@nas/contracts';
import { gradesFromSystemFindings } from './grades.js';
import {
  INTERFACE_PATTERN_CATALOG,
  interfacePattern,
  interfacePatternFinding,
} from './interface-patterns.js';

describe('the interface anti-pattern catalog', () => {
  it('is schema-valid with exactly 46 contiguously numbered, unique patterns', () => {
    expect(() => InterfacePatternCatalog.parse(INTERFACE_PATTERN_CATALOG)).not.toThrow();
    expect(INTERFACE_PATTERN_CATALOG.patterns).toHaveLength(46);
    const integrity = validateInterfacePatternCatalog(INTERFACE_PATTERN_CATALOG);
    expect(integrity.problems).toEqual([]);
    expect(integrity.valid).toBe(true);
  });

  it('covers every category with the documented counts', () => {
    const counts = new Map<string, number>();
    for (const pattern of INTERFACE_PATTERN_CATALOG.patterns) {
      counts.set(pattern.category, (counts.get(pattern.category) ?? 0) + 1);
    }
    expect(Object.fromEntries(counts)).toEqual({
      visual_details: 7,
      typography: 10,
      color_contrast: 5,
      layout_spacing: 8,
      motion: 3,
      copy: 4,
      imagery: 1,
      general_quality: 8,
    });
  });

  it('distinguishes AI-generation markers from general quality failures', () => {
    const signals = new Map<string, number>();
    for (const pattern of INTERFACE_PATTERN_CATALOG.patterns) {
      signals.set(pattern.signal, (signals.get(pattern.signal) ?? 0) + 1);
    }
    // Every pattern is classified; both signals are represented.
    expect(
      (signals.get('ai_generated_marker') ?? 0) + (signals.get('general_quality_failure') ?? 0),
    ).toBe(46);
    expect(signals.get('ai_generated_marker')).toBeGreaterThan(0);
    expect(signals.get('general_quality_failure')).toBeGreaterThan(0);
  });

  it('resolves patterns by number and by id, and refuses unknown references', () => {
    expect(interfacePattern(20).id).toBe('antipattern.gradient-text');
    expect(interfacePattern('antipattern.gradient-text').number).toBe(20);
    expect(() => interfacePattern(99)).toThrow(/unknown interface anti-pattern/);
    expect(() => interfacePattern('antipattern.made-up')).toThrow(/unknown interface anti-pattern/);
  });

  it('validateInterfacePatternCatalog fails duplicates and numbering gaps', () => {
    const broken = InterfacePatternCatalog.parse(INTERFACE_PATTERN_CATALOG);
    broken.patterns = [...broken.patterns];
    broken.patterns[45] = { ...broken.patterns[0]!, number: 1 }; // duplicate id AND number, gap at 46
    const result = validateInterfacePatternCatalog(broken);
    expect(result.valid).toBe(false);
    const codes = result.problems.map((p) => p.code);
    expect(codes).toContain('CAT_DUPLICATE_ID');
    expect(codes).toContain('CAT_DUPLICATE_NUMBER');
    expect(codes).toContain('CAT_NUMBER_GAP');
  });
});

describe('interfacePatternFinding', () => {
  it('produces a schema-valid finding carrying the pattern id, dimension, and severity', () => {
    const finding = SystemFinding.parse(
      interfacePatternFinding(
        42,
        { path: 'mockup/landing.html', line: 12 },
        'body text renders #999 on #b7b7c4',
      ),
    );
    expect(finding).toMatchObject({
      code: 'DS_INTERFACE_PATTERN',
      patternId: 'antipattern.low-contrast-text',
      dimension: 'accessibility',
      severity: 'critical',
    });
    expect(finding.rationale).toContain('#42 Low-contrast text');
    expect(finding.rationale).toContain('quality failure');
  });

  it('labels AI-generation markers as such in the rationale', () => {
    const finding = interfacePatternFinding(
      'antipattern.gradient-text',
      { path: 'mockup/hero.tsx' },
      'headline uses a purple→cyan gradient fill',
    );
    expect(finding.rationale).toContain('AI-generation marker');
  });

  it('a serious catalog hit blocks the real anti-slop gate for a design change', () => {
    const findings = [
      interfacePatternFinding(
        18,
        { path: 'mockup/theme.css' },
        'violet gradient + cyan-on-dark theme',
      ),
    ];
    const result = evaluateReview({
      changeType: 'design_change',
      subject: 'Mockup review fixture',
      reviewer: agentActor('agent.mockup-review', 'Mockup Reviewer'),
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
        ['ev_mockup_1'],
      ),
      exceptions: [],
    });
    expect(result.accepted).toBe(false);
    expect(result.blocking).toEqual([
      expect.objectContaining({ dimension: 'design_originality', grade: 'fail' }),
    ]);
    expect(result.blocking[0]!.reason).toContain('DS_INTERFACE_PATTERN');
  });
});
