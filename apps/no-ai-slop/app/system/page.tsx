import { Badge, Card, KeyValue, PageHeader, ReasonList } from '@nas/ui';
import type {
  AtomicLevel,
  ComponentDef,
  DesignTokenDef,
  InterfacePatternCategory,
  TokenCategory,
} from '@nas/contracts';
import { getSystemView } from '../lib/system';

const LEVEL_ORDER: AtomicLevel[] = [
  'foundation',
  'atom',
  'molecule',
  'organism',
  'template',
  'page',
];
const LEVEL_LABEL: Record<AtomicLevel, string> = {
  foundation: 'Foundations',
  atom: 'Atoms',
  molecule: 'Molecules',
  organism: 'Organisms',
  template: 'Templates',
  page: 'Pages',
};
const PATTERN_CATEGORY_LABEL: Record<InterfacePatternCategory, string> = {
  visual_details: 'Visual details',
  typography: 'Typography',
  color_contrast: 'Color and contrast',
  layout_spacing: 'Layout and spacing',
  motion: 'Motion',
  copy: 'Copy',
  imagery: 'Imagery',
  general_quality: 'General quality',
};

const CATEGORY_LABEL: Record<TokenCategory, string> = {
  color: 'Color',
  typography: 'Typography',
  spacing: 'Spacing',
  radius: 'Radius',
  border: 'Border',
  shadow: 'Shadow',
  motion: 'Motion',
  layout: 'Layout',
  breakpoint: 'Breakpoints',
  opacity: 'Opacity',
  size: 'Sizes',
};

function tokenValue(token: DesignTokenDef): string {
  if (token.valueByTheme !== undefined) {
    return `${token.valueByTheme.light} · dark ${token.valueByTheme.dark}`;
  }
  if (token.aliasOf !== undefined) return `→ ${token.aliasOf}`;
  return String(token.value);
}

function ComponentDetail({ component }: { component: ComponentDef }) {
  return (
    <details>
      <summary>
        <span className="nas-row" style={{ display: 'inline-flex', gap: 'var(--nas-space-3)' }}>
          <strong>{component.name}</strong>
          <span className="nas-muted nas-mono">{component.id}</span>
          <Badge
            tone={component.status === 'deprecated' ? 'warning' : 'neutral'}
            label={component.status}
          />
        </span>
      </summary>
      <div
        className="nas-stack"
        style={{
          gap: 'var(--nas-space-3)',
          padding: 'var(--nas-space-3) 0 var(--nas-space-3) var(--nas-space-6)',
        }}
      >
        <KeyValue
          items={[
            { label: 'Purpose', value: component.purpose },
            { label: 'Category', value: component.category.replace('_', ' ') },
            {
              label: 'Variants',
              value:
                component.variants.length > 0
                  ? component.variants.map((v) => v.name).join(', ')
                  : 'None',
            },
            {
              label: 'States',
              value:
                component.states.length > 0
                  ? component.states.map((s) => s.state).join(', ')
                  : 'None documented',
            },
            { label: 'Tokens used', value: String(component.usesTokens.length) },
            {
              label: 'Composed of',
              value:
                component.composedOf.length > 0 ? (
                  <span className="nas-mono">{component.composedOf.join(', ')}</span>
                ) : (
                  'Nothing — elemental'
                ),
            },
            { label: 'Owner', value: `${component.ownerId} · v${component.version}` },
            { label: 'Source', value: <span className="nas-mono">{component.sourcePath}</span> },
          ]}
        />
        {component.prohibitedUses.length > 0 && (
          <div className="nas-stack" style={{ gap: 'var(--nas-space-1)' }}>
            <span className="nas-muted" style={{ fontSize: 'var(--nas-text-sm)' }}>
              Prohibited uses
            </span>
            <ul className="nas-list">
              {component.prohibitedUses.map((use) => (
                <li
                  key={use}
                  className="nas-list__item"
                  style={{ padding: 'var(--nas-space-1) 0' }}
                >
                  <Badge tone="danger" symbol="✗" label="Never" />
                  <span style={{ fontSize: 'var(--nas-text-sm)' }}>{use}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

export default function SystemPage() {
  const view = getSystemView();
  const { registry, validation, rules, architecture, patternCatalog, catalogValidation } = view;
  const coherent = validation.valid && architecture.valid && catalogValidation.valid;

  const patternsByCategory = new Map<InterfacePatternCategory, typeof patternCatalog.patterns>();
  for (const pattern of patternCatalog.patterns) {
    const list = patternsByCategory.get(pattern.category) ?? [];
    list.push(pattern);
    patternsByCategory.set(pattern.category, list);
  }

  const tokensByCategory = new Map<TokenCategory, DesignTokenDef[]>();
  for (const token of registry.tokens) {
    const list = tokensByCategory.get(token.category) ?? [];
    list.push(token);
    tokensByCategory.set(token.category, list);
  }

  const layersInOrder = [...rules.layers].sort((a, b) => a.order - b.order);

  return (
    <div className="nas-stack" style={{ gap: 'var(--nas-space-8)' }}>
      <PageHeader
        eyebrow="Product system"
        title={`${registry.name} v${registry.version}`}
        description="The machine-readable product grammar: tokens, components, patterns, principles, architecture rules, and their exceptions. Everything below is the live registry and the scanned dependency graph — validated on this render, not a screenshot of intent."
        action={
          coherent ? (
            <Badge tone="success" symbol="✓" label="System coherent" />
          ) : (
            <Badge tone="danger" symbol="✗" label="System violations" />
          )
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
          title="Registry integrity"
          subtitle={`${validation.counts.tokens} tokens · ${validation.counts.components} components · ${validation.counts.patterns} patterns`}
          action={
            validation.valid ? (
              <Badge tone="success" symbol="✓" label="Valid" />
            ) : (
              <Badge tone="danger" symbol="✗" label={`${validation.problems.length} problems`} />
            )
          }
        >
          <ReasonList
            emptyLabel="Every reference resolves: tokens, principles, owners, composition levels, and deprecations are all consistent."
            items={validation.problems.map((p) => ({
              key: `${p.path}-${p.code}`,
              leading: <Badge tone="danger" symbol="✗" label={p.code} />,
              primary: p.message,
              secondary: p.path,
            }))}
          />
        </Card>

        <Card
          title="Architecture"
          subtitle={`${architecture.checkedModules} modules · ${architecture.checkedEdges} dependency edges`}
          action={
            architecture.valid ? (
              <Badge tone="success" symbol="✓" label="Direction holds" />
            ) : (
              <Badge
                tone="danger"
                symbol="✗"
                label={`${architecture.violations.length} violations`}
              />
            )
          }
        >
          <ReasonList
            emptyLabel="Every dependency points strictly downward; the only same-layer edges are the two justified kernel exceptions below."
            items={architecture.violations.map((v) => ({
              key: `${v.code}-${v.from ?? ''}-${v.to ?? ''}`,
              leading: <Badge tone="danger" symbol="✗" label={v.code} />,
              primary: v.message,
            }))}
          />
        </Card>
      </div>

      <Card title="Principles" subtitle="The values every component and screen is reviewed against">
        <ul className="nas-list">
          {registry.principles.map((principle) => (
            <li key={principle.id} className="nas-list__item">
              <div className="nas-stack" style={{ gap: 'var(--nas-space-1)' }}>
                <strong>{principle.name}</strong>
                <span className="nas-muted">{principle.statement}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Design tokens"
        subtitle="Closed scales by category — expand a category for every token and value"
      >
        <div className="nas-stack" style={{ gap: 'var(--nas-space-3)' }}>
          {[...tokensByCategory.entries()].map(([category, tokens]) => (
            <details key={category}>
              <summary>
                {CATEGORY_LABEL[category]} <span className="nas-muted">({tokens.length})</span>
              </summary>
              <ul
                className="nas-list"
                style={{ padding: 'var(--nas-space-3) 0 var(--nas-space-3) var(--nas-space-6)' }}
              >
                {tokens.map((token) => (
                  <li
                    key={token.id}
                    className="nas-list__item"
                    style={{ padding: 'var(--nas-space-1) 0' }}
                  >
                    <Badge tone="neutral" label={token.tier} />
                    <div className="nas-stack" style={{ gap: 'var(--nas-space-1)', minWidth: 0 }}>
                      <span className="nas-mono">{token.id}</span>
                      <span className="nas-muted nas-mono nas-truncate">{tokenValue(token)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </Card>

      <Card
        title="Components by atomic level"
        subtitle="Controlled composition: each level may compose only strictly lower levels"
      >
        <div className="nas-stack" style={{ gap: 'var(--nas-space-6)' }}>
          {LEVEL_ORDER.filter((level) => level !== 'foundation').map((level) => {
            const components = registry.components.filter((c) => c.atomicLevel === level);
            return (
              <div key={level} className="nas-stack" style={{ gap: 'var(--nas-space-3)' }}>
                <h3 className="nas-card__title" style={{ fontSize: 'var(--nas-text-base)' }}>
                  {LEVEL_LABEL[level]} <span className="nas-muted">({components.length})</span>
                </h3>
                {components.length === 0 ? (
                  <p className="nas-muted">No components at this level yet.</p>
                ) : (
                  components.map((component) => (
                    <ComponentDetail key={component.id} component={component} />
                  ))
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Patterns"
        subtitle="Named solutions with conditions of use — functional and perceptual"
      >
        <ul className="nas-list">
          {registry.patterns.map((pattern) => (
            <li key={pattern.id} className="nas-list__item">
              <Badge tone="info" label={pattern.kind} />
              <div className="nas-stack" style={{ gap: 'var(--nas-space-1)' }}>
                <strong>{pattern.name}</strong>
                <span className="nas-muted">{pattern.purpose}</span>
                <span className="nas-muted nas-mono" style={{ fontSize: 'var(--nas-text-sm)' }}>
                  {pattern.consistsOf.length > 0
                    ? pattern.consistsOf.join(', ')
                    : 'composition-free'}
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Interface anti-pattern catalog"
        subtitle="What a mockup or generated design is reviewed against — each hit cites a numbered pattern, its dimension, and a remediation"
        action={
          catalogValidation.valid ? (
            <Badge tone="success" symbol="✓" label={`${patternCatalog.patterns.length} patterns`} />
          ) : (
            <Badge
              tone="danger"
              symbol="✗"
              label={`${catalogValidation.problems.length} problems`}
            />
          )
        }
      >
        <div className="nas-stack" style={{ gap: 'var(--nas-space-3)' }}>
          {[...patternsByCategory.entries()].map(([category, patterns]) => (
            <details key={category}>
              <summary>
                {PATTERN_CATEGORY_LABEL[category]}{' '}
                <span className="nas-muted">({patterns.length})</span>
              </summary>
              <ul
                className="nas-list"
                style={{ padding: 'var(--nas-space-3) 0 var(--nas-space-3) var(--nas-space-6)' }}
              >
                {patterns.map((pattern) => (
                  <li
                    key={pattern.id}
                    className="nas-list__item"
                    style={{ padding: 'var(--nas-space-2) 0' }}
                  >
                    {pattern.signal === 'ai_generated_marker' ? (
                      <Badge tone="warning" symbol="!" label="AI marker" />
                    ) : (
                      <Badge tone="neutral" symbol="–" label="Quality" />
                    )}
                    <div className="nas-stack" style={{ gap: 'var(--nas-space-1)', minWidth: 0 }}>
                      <span>
                        <span className="nas-muted nas-mono">#{pattern.number}</span>{' '}
                        <strong>{pattern.name}</strong>
                      </span>
                      <span className="nas-muted" style={{ fontSize: 'var(--nas-text-sm)' }}>
                        {pattern.description}
                      </span>
                      <span
                        className="nas-muted nas-mono"
                        style={{ fontSize: 'var(--nas-text-sm)' }}
                      >
                        {pattern.id} · grades {pattern.dimension} ·{' '}
                        {pattern.detection.replace('_', ' ')}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </Card>

      <Card
        title="Architecture layers"
        subtitle="Dependencies point strictly downward; every same-layer edge is a named exception"
      >
        <div className="nas-stack" style={{ gap: 'var(--nas-space-3)' }}>
          <ul className="nas-list">
            {layersInOrder.map((layer) => (
              <li key={layer.id} className="nas-list__item">
                <Badge tone="neutral" label={`order ${layer.order}`} />
                <div className="nas-stack" style={{ gap: 'var(--nas-space-1)' }}>
                  <strong>{layer.name}</strong>
                  <span className="nas-muted">{layer.description}</span>
                  <span className="nas-muted nas-mono" style={{ fontSize: 'var(--nas-text-sm)' }}>
                    {rules.modules
                      .filter((m) => m.layerId === layer.id)
                      .map((m) => m.id)
                      .join(' · ')}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          <h3 className="nas-card__title" style={{ fontSize: 'var(--nas-text-base)' }}>
            Justified exceptions applied
          </h3>
          <ReasonList
            emptyLabel="No dependency exceptions were needed."
            items={architecture.exceptionsApplied.map((exception) => ({
              key: `${exception.from}-${exception.to}`,
              leading: <Badge tone="warning" symbol="!" label="Exception" />,
              primary: `${exception.from} → ${exception.to}`,
              secondary: exception.rationale,
            }))}
          />
        </div>
      </Card>

      <Card
        title="System exceptions"
        subtitle="Every exception is owned, scoped, expiring, and carries its remediation"
      >
        <ReasonList
          emptyLabel="No active exceptions — every governed value comes from the token scales."
          items={registry.exceptions.map((exception) => {
            const expired = Date.parse(exception.expiresAt) <= Date.now();
            return {
              key: exception.id,
              leading: expired ? (
                <Badge tone="danger" symbol="✗" label="Expired" />
              ) : (
                <Badge tone="warning" symbol="!" label="Active" />
              ),
              primary: `${exception.scope} — ${exception.rationale}`,
              secondary: `${exception.ownerId} · expires ${exception.expiresAt.slice(0, 10)} · ${exception.remediation}`,
            };
          })}
        />
      </Card>
    </div>
  );
}
