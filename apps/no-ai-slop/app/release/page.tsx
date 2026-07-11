import { Badge, Card, GradeBadge, KeyValue, PageHeader, ReasonList, VerdictBadge } from '@nas/ui';
import type { CheckResult, ReleaseDecision } from '@nas/contracts';
import { getLifecycle } from '../lib/lifecycle';

const GRADE_LABEL: Record<string, string> = {
  pass: 'pass',
  pass_with_concern: 'pass_with_concern',
  fail: 'fail',
  not_tested: 'not_tested',
};

function DecisionSection({
  decision,
  signatureValid,
  environment,
  checks,
}: {
  decision: ReleaseDecision;
  signatureValid: boolean;
  environment: string;
  checks: CheckResult[];
}) {
  return (
    <Card
      title={`${environment[0]!.toUpperCase()}${environment.slice(1)} gate`}
      subtitle={`Decision ${decision.id}`}
      action={<VerdictBadge verdict={decision.verdict} />}
    >
      <KeyValue
        items={[
          { label: 'Artifact', value: <span className="nas-mono">{decision.manifest.artifactDigest}</span> },
          { label: 'Source commit', value: <span className="nas-mono">{decision.manifest.sourceCommit}</span> },
          {
            label: 'Signature',
            value: (
              <span className="nas-row" style={{ gap: 'var(--nas-space-3)' }}>
                <span className="nas-mono">
                  {decision.signature.keyId} · {decision.signature.algorithm}
                </span>
                {signatureValid ? (
                  <Badge tone="info" symbol="✓" label="Verified" />
                ) : (
                  <Badge tone="danger" symbol="✗" label="Invalid" />
                )}
              </span>
            ),
          },
          { label: 'Evaluated', value: decision.evaluatedAt },
        ]}
      />

      <div className="nas-stack" style={{ gap: 'var(--nas-space-3)' }}>
        <h3 className="nas-card__title" style={{ fontSize: 'var(--nas-text-base)' }}>
          Blocking reasons
        </h3>
        <ReasonList
          emptyLabel="No blocking reasons — every mandatory condition is met."
          items={decision.blocking.map((reason, i) => ({
            key: `b${i}`,
            leading: <Badge tone="danger" symbol="✗" label="Blocked" />,
            primary: reason,
          }))}
        />
      </div>

      {decision.warnings.length > 0 && (
        <div className="nas-stack" style={{ gap: 'var(--nas-space-3)' }}>
          <h3 className="nas-card__title" style={{ fontSize: 'var(--nas-text-base)' }}>
            Warnings
          </h3>
          <ReasonList
            emptyLabel="No warnings."
            items={decision.warnings.map((w, i) => ({
              key: `w${i}`,
              leading: <Badge tone="warning" symbol="!" label="Warning" />,
              primary: w,
            }))}
          />
        </div>
      )}

      <div className="nas-stack" style={{ gap: 'var(--nas-space-3)' }}>
        <h3 className="nas-card__title" style={{ fontSize: 'var(--nas-text-base)' }}>
          Checks
        </h3>
        <ReasonList
          emptyLabel="No checks reported."
          items={checks.map((c) => ({
            key: c.name,
            leading:
              c.status === 'pass' ? (
                <Badge tone="success" symbol="✓" label="Pass" />
              ) : (
                <Badge tone="danger" symbol="✗" label={c.status} />
              ),
            primary: c.name,
            secondary: c.detail ?? undefined,
          }))}
        />
      </div>
    </Card>
  );
}

export default function ReleasePage() {
  const lc = getLifecycle();
  return (
    <div className="nas-stack" style={{ gap: 'var(--nas-space-8)' }}>
      <PageHeader
        eyebrow="Release decision"
        title="Signed release gate (TC-10)"
        description="The gate consumes only authenticated evidence and issues a signed decision for the exact build. The same build clears staging but is blocked from production until an independent review exists — the gate never certifies an incomplete release."
      />

      <DecisionSection
        decision={lc.stagingDecision}
        signatureValid={lc.stagingSignatureValid}
        environment="staging"
        checks={lc.checks}
      />

      <DecisionSection
        decision={lc.productionDecision}
        signatureValid={lc.productionSignatureValid}
        environment="production"
        checks={lc.checks}
      />

      <Card
        title="Anti-Slop review"
        subtitle="Every dimension is shown — there is no single score that could hide a weakness"
        action={
          lc.antiSlop.accepted ? (
            <Badge tone="success" symbol="✓" label="Accepted" />
          ) : (
            <Badge tone="danger" symbol="✗" label="Blocked" />
          )
        }
      >
        <ul className="nas-list">
          {lc.antiSlopGrades.map((g) => (
            <li key={g.dimension} className="nas-list__item">
              <GradeBadge grade={(GRADE_LABEL[g.grade] ?? 'not_tested') as 'pass'} />
              <div className="nas-stack" style={{ gap: 'var(--nas-space-1)' }}>
                <div>{g.dimension.replace(/_/g, ' ')}</div>
                <div className="nas-muted" style={{ fontSize: 'var(--nas-text-sm)' }}>
                  {g.rationale}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
