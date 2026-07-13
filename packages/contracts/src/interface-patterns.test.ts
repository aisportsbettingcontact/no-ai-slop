import { describe, expect, it } from 'vitest';
import {
  InterfacePattern,
  InterfacePatternCatalog,
  validateInterfacePatternCatalog,
} from './index.js';

const pattern = (number: number, slug: string): InterfacePattern =>
  InterfacePattern.parse({
    id: `antipattern.${slug}`,
    number,
    name: `Pattern ${number}`,
    category: 'typography',
    signal: 'general_quality_failure',
    detection: 'static_analysis',
    description: 'Fixture pattern.',
    dimension: 'accessibility',
    defaultSeverity: 'moderate',
    remediation: 'Fix it.',
  });

describe('InterfacePattern schema', () => {
  it('accepts a well-formed pattern and rejects malformed ids/enums', () => {
    expect(InterfacePattern.safeParse(pattern(1, 'flat-type')).success).toBe(true);
    expect(
      InterfacePattern.safeParse({ ...pattern(1, 'flat-type'), id: 'pattern.flat-type' }).success,
    ).toBe(false);
    expect(
      InterfacePattern.safeParse({ ...pattern(1, 'flat-type'), signal: 'vibes' }).success,
    ).toBe(false);
    expect(InterfacePattern.safeParse({ ...pattern(1, 'flat-type'), number: 0 }).success).toBe(
      false,
    );
  });
});

describe('validateInterfacePatternCatalog', () => {
  const catalog = (patterns: InterfacePattern[]): InterfacePatternCatalog =>
    InterfacePatternCatalog.parse({ schemaVersion: 1, version: '1.0.0', patterns });

  it('accepts contiguous unique numbering', () => {
    const result = validateInterfacePatternCatalog(
      catalog([pattern(1, 'one'), pattern(2, 'two'), pattern(3, 'three')]),
    );
    expect(result.problems).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('flags duplicate ids, duplicate numbers, and numbering gaps', () => {
    const dupId = validateInterfacePatternCatalog(
      catalog([pattern(1, 'same'), pattern(2, 'same')]),
    );
    expect(dupId.problems.map((p) => p.code)).toContain('CAT_DUPLICATE_ID');

    const dupNumber = validateInterfacePatternCatalog(
      catalog([pattern(1, 'one'), pattern(1, 'other')]),
    );
    expect(dupNumber.problems.map((p) => p.code)).toContain('CAT_DUPLICATE_NUMBER');
    expect(dupNumber.problems.map((p) => p.code)).toContain('CAT_NUMBER_GAP');

    const gap = validateInterfacePatternCatalog(catalog([pattern(1, 'one'), pattern(3, 'three')]));
    expect(gap.problems).toContainEqual(
      expect.objectContaining({ code: 'CAT_NUMBER_GAP', path: 'patterns/#2' }),
    );
  });
});
