import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  children: ReactNode;
}

/**
 * The one primary action per screen uses `variant="primary"`. Everything else is
 * secondary/ghost, so a screen never shows competing primary actions.
 */
export function Button({ variant = 'secondary', children, className, ...rest }: ButtonProps) {
  return (
    <button className={`nas-btn nas-btn--${variant} ${className ?? ''}`.trim()} {...rest}>
      {children}
    </button>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="nas-card nas-stack">
      {(title || action) && (
        <div className="nas-spread">
          <div>
            {title && <h2 className="nas-card__title">{title}</h2>}
            {subtitle && <p className="nas-card__subtitle">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="nas-page-header">
      <div className="nas-spread">
        <div className="nas-stack" style={{ gap: 'var(--nas-space-2)' }}>
          {eyebrow && <span className="nas-page-header__eyebrow">{eyebrow}</span>}
          <h1 className="nas-page-header__title">{title}</h1>
        </div>
        {action}
      </div>
      {description && <p className="nas-page-header__desc">{description}</p>}
    </header>
  );
}

export interface KeyValueItem {
  label: string;
  value: ReactNode;
}

export function KeyValue({ items }: { items: KeyValueItem[] }) {
  return (
    <dl className="nas-kv">
      {items.map((item) => (
        <div key={item.label} style={{ display: 'contents' }}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A list of reasons/dimensions. Renders an explicit empty state (never a blank void). */
export function ReasonList({
  items,
  emptyLabel,
}: {
  items: { key: string; leading?: ReactNode; primary: ReactNode; secondary?: ReactNode }[];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return <p className="nas-muted">{emptyLabel}</p>;
  }
  return (
    <ul className="nas-list">
      {items.map((item) => (
        <li key={item.key} className="nas-list__item">
          {item.leading}
          <div className="nas-stack" style={{ gap: 'var(--nas-space-1)' }}>
            <div>{item.primary}</div>
            {item.secondary && <div className="nas-muted nas-mono">{item.secondary}</div>}
          </div>
        </li>
      ))}
    </ul>
  );
}
