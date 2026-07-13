import Link from 'next/link';
import { Badge, Card, KeyValue, PageHeader, VerdictBadge } from '@nas/ui';
import { getLifecycle } from './lib/lifecycle';

function short(digest: string): string {
  const hex = digest.replace(/^sha256:/, '');
  return `sha256:${hex.slice(0, 12)}…`;
}

export default function OverviewPage() {
  const lc = getLifecycle();
  const passCount = lc.checks.filter((c) => c.status === 'pass').length;

  return (
    <div className="nas-stack" style={{ gap: 'var(--nas-space-8)' }}>
      <PageHeader
        eyebrow="Release readiness"
        title={`Build ${lc.build.buildId}`}
        description="One build under review. Every claim below is backed by an authenticated evidence record and can be reconstructed — nothing here was accepted merely because it rendered."
        action={
          <Link className="nas-btn nas-btn--primary" href="/release">
            View release decision
          </Link>
        }
      />

      <div
        style={{
          display: 'grid',
          gap: 'var(--nas-space-6)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(var(--nas-size-card-min), 1fr))',
        }}
      >
        <Card
          title="Staging gate"
          subtitle="TC-10 signed decision"
          action={<VerdictBadge verdict={lc.stagingDecision.verdict} />}
        >
          <p className="nas-muted">{describeVerdict(lc.stagingDecision.verdict)}</p>
        </Card>

        <Card
          title="Production gate"
          subtitle="Same build, stricter policy"
          action={<VerdictBadge verdict={lc.productionDecision.verdict} />}
        >
          <p className="nas-muted">{describeVerdict(lc.productionDecision.verdict)}</p>
        </Card>

        <Card
          title="Anti-Slop review"
          subtitle="13 dimensions, no hidden score"
          action={
            lc.antiSlop.accepted ? (
              <Badge tone="success" symbol="✓" label="Accepted" />
            ) : (
              <Badge tone="danger" symbol="✗" label="Blocked" />
            )
          }
        >
          <p className="nas-muted">{lc.antiSlop.summary}</p>
        </Card>

        <Card
          title="Evidence chain"
          subtitle="TC-17 chain of custody"
          action={
            lc.evidenceValid ? (
              <Badge tone="success" symbol="✓" label="Valid" />
            ) : (
              <Badge tone="danger" symbol="✗" label="Invalid" />
            )
          }
        >
          <p className="nas-muted">{lc.evidenceCount} sealed records, hash-chained and signed.</p>
        </Card>
      </div>

      <Card title="Build under review">
        <KeyValue
          items={[
            { label: 'Project', value: lc.build.project },
            { label: 'Build', value: <span className="nas-mono">{lc.build.buildId}</span> },
            {
              label: 'Artifact',
              value: <span className="nas-mono">{short(lc.build.artifactDigest)}</span>,
            },
            {
              label: 'Source',
              value: <span className="nas-mono">{lc.build.sourceCommit.slice(0, 12)}…</span>,
            },
            { label: 'Checks passing', value: `${passCount} of ${lc.checks.length}` },
          ]}
        />
      </Card>
    </div>
  );
}

function describeVerdict(verdict: string): string {
  switch (verdict) {
    case 'pass':
      return 'Every mandatory condition is met and evidence-backed. Deploy is authorized.';
    case 'warning':
      return 'Authorized to deploy, with documented non-blocking concerns to review.';
    case 'fail':
      return 'A measured quality bar was not met. Deploy is refused until repaired.';
    case 'blocked':
      return 'A mandatory input is missing, incomplete, or unauthenticated. The gate cannot certify this build.';
    default:
      return '';
  }
}
