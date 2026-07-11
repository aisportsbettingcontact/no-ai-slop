import { Badge, Card, PageHeader } from '@nas/ui';
import { getLifecycle } from '../lib/lifecycle';

const KIND_LABEL: Record<string, string> = {
  test: 'Test',
  build: 'Build',
  accessibility_result: 'Accessibility',
  command: 'Command',
  anti_slop_review: 'Anti-Slop review',
  authz_receipt: 'Authorization',
};

export default function EvidencePage() {
  const lc = getLifecycle();
  return (
    <div className="nas-stack" style={{ gap: 'var(--nas-space-8)' }}>
      <PageHeader
        eyebrow="Evidence chain"
        title="Chain of custody (TC-17)"
        description="Every record is content-addressed, linked to the previous record, and signed by an authority whose key is held independently of the producer. Altering, reordering, or deleting any record invalidates the whole chain."
        action={
          lc.evidenceValid ? (
            <Badge tone="success" symbol="✓" label={`Chain valid · ${lc.evidenceCount} records`} />
          ) : (
            <Badge tone="danger" symbol="✗" label="Chain invalid" />
          )
        }
      />

      <Card title="Sealed records" subtitle="In chain order">
        <ul className="nas-list">
          {lc.evidence.map((r) => (
            <li key={r.id} className="nas-list__item">
              <Badge tone="info" label={KIND_LABEL[r.kind] ?? r.kind} />
              <div className="nas-stack" style={{ gap: 'var(--nas-space-1)', minWidth: 0 }}>
                <div>
                  <span
                    className="nas-muted nas-mono"
                    style={{ marginRight: 'var(--nas-space-3)' }}
                  >
                    #{r.sequence}
                  </span>
                  {r.summary}
                </div>
                <div
                  className="nas-muted nas-mono nas-truncate"
                  style={{ fontSize: 'var(--nas-text-xs)' }}
                >
                  {r.recordDigest}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
