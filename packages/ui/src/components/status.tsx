import type { ReactNode } from 'react';
import {
  gradeMeta,
  verdictMeta,
  type Grade,
  type ReleaseVerdict,
  type StatusTone,
} from '../tokens.js';

export interface BadgeProps {
  tone: StatusTone;
  label: string;
  /** A short symbol shown before the label so status never relies on color alone. */
  symbol?: string;
  children?: ReactNode;
}

/** A status pill. Always renders a text label; color is reinforcement, not the signal. */
export function Badge({ tone, label, symbol, children }: BadgeProps) {
  return (
    <span className={`nas-badge nas-badge--${tone}`}>
      {symbol ? (
        <span className="nas-badge__symbol" aria-hidden="true">
          {symbol}
        </span>
      ) : null}
      <span>{children ?? label}</span>
    </span>
  );
}

export function VerdictBadge({ verdict }: { verdict: ReleaseVerdict }) {
  const meta = verdictMeta[verdict];
  return <Badge tone={meta.tone} symbol={meta.symbol} label={meta.label} />;
}

export function GradeBadge({ grade }: { grade: Grade }) {
  const meta = gradeMeta[grade];
  return <Badge tone={meta.tone} symbol={meta.symbol} label={meta.label} />;
}
