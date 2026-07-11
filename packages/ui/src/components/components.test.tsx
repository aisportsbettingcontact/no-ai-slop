import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Badge, GradeBadge, KeyValue, PageHeader, ReasonList, VerdictBadge } from '../index.js';

describe('status components', () => {
  it('renders a verdict badge with a visible text label (not color-only)', () => {
    const html = renderToStaticMarkup(<VerdictBadge verdict="blocked" />);
    expect(html).toContain('Blocked');
    expect(html).toContain('nas-badge--danger');
    expect(html).toContain('aria-hidden="true"'); // symbol is decorative; label carries meaning
  });

  it('maps every grade to a labelled badge', () => {
    for (const [grade, label] of [
      ['pass', 'Pass'],
      ['pass_with_concern', 'Pass with concern'],
      ['fail', 'Fail'],
      ['not_tested', 'Not tested'],
    ] as const) {
      expect(renderToStaticMarkup(<GradeBadge grade={grade} />)).toContain(label);
    }
  });

  it('badge label is always present even when children differ', () => {
    expect(renderToStaticMarkup(<Badge tone="info" label="Verified" symbol="✓" />)).toContain(
      'Verified',
    );
  });
});

describe('layout components', () => {
  it('PageHeader renders a single h1 title', () => {
    const html = renderToStaticMarkup(
      <PageHeader eyebrow="Release" title="Release readiness" description="One build under review." />,
    );
    expect(html).toContain('<h1');
    expect(html).toContain('Release readiness');
    expect((html.match(/<h1/g) ?? []).length).toBe(1);
  });

  it('KeyValue renders a definition list', () => {
    const html = renderToStaticMarkup(
      <KeyValue items={[{ label: 'Artifact', value: 'sha256:abc' }]} />,
    );
    expect(html).toContain('<dt');
    expect(html).toContain('Artifact');
    expect(html).toContain('sha256:abc');
  });

  it('ReasonList renders an explicit empty state rather than a blank void', () => {
    const html = renderToStaticMarkup(<ReasonList items={[]} emptyLabel="No blocking reasons." />);
    expect(html).toContain('No blocking reasons.');
  });
});
