import { z } from 'zod';
import { EvidenceKind } from './evidence.js';
import { Timestamp } from './ids.js';

/**
 * Design-system contracts: the machine-readable product grammar.
 *
 * A design system here is not a component gallery — it is a governed product
 * language: principles, tokens (tiered primitive → semantic → component),
 * components (classified by atomic level), patterns (functional + perceptual),
 * accessibility rules, ownership, versioning, and explicit exceptions. The
 * registry instance that describes @nas/ui lives WITH the code it describes
 * (packages/ui/src/registry.ts) and is validated against these schemas, so an
 * agent or a check can query the system instead of inferring it from prose.
 */

/** Dot-namespaced lowercase id, e.g. `color.surface-2`, `space.4`, `type.size.base`. */
const namespacedId = (label: string, prefix?: string) =>
  z
    .string()
    .min(1, `${label} must not be empty`)
    .max(200, `${label} is too long`)
    .regex(
      prefix
        ? new RegExp(`^${prefix}\\.[a-z0-9]+(?:[.-][a-z0-9]+)*$`)
        : /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/,
      `${label} must be a lowercase dot-namespaced id${prefix ? ` starting with "${prefix}."` : ''}`,
    );

export const DesignTokenId = namespacedId('designTokenId');
export type DesignTokenId = z.infer<typeof DesignTokenId>;
export const ComponentId = namespacedId('componentId', 'component');
export type ComponentId = z.infer<typeof ComponentId>;
export const PatternId = namespacedId('patternId', 'pattern');
export type PatternId = z.infer<typeof PatternId>;
export const PrincipleId = namespacedId('principleId', 'principle');
export type PrincipleId = z.infer<typeof PrincipleId>;
export const OwnerId = namespacedId('ownerId', 'owner');
export type OwnerId = z.infer<typeof OwnerId>;
export const AccessibilityRuleId = namespacedId('accessibilityRuleId', 'rule');
export type AccessibilityRuleId = z.infer<typeof AccessibilityRuleId>;
export const SystemExceptionId = namespacedId('systemExceptionId', 'exception');
export type SystemExceptionId = z.infer<typeof SystemExceptionId>;

export const SemanticVersion = z
  .string()
  .regex(/^\d+\.\d+\.\d+$/, 'expected a MAJOR.MINOR.PATCH version');
export type SemanticVersion = z.infer<typeof SemanticVersion>;

/* ── Tokens ─────────────────────────────────────────────────────────────────── */

/**
 * Token tiers (primitive → semantic → component). Product code should consume
 * semantic tokens; primitives are raw scale values; component tokens are narrow
 * aliases and exist only when a component needs a stable semantic contract that
 * general semantic tokens cannot express.
 */
export const TokenTier = z.enum(['primitive', 'semantic', 'component']);
export type TokenTier = z.infer<typeof TokenTier>;

export const TOKEN_TIER_ORDER: Record<TokenTier, number> = {
  primitive: 0,
  semantic: 1,
  component: 2,
};

export const TokenCategory = z.enum([
  'color',
  'typography',
  'spacing',
  'radius',
  'border',
  'shadow',
  'motion',
  'layout',
  'breakpoint',
  'opacity',
  'size',
]);
export type TokenCategory = z.infer<typeof TokenCategory>;

export const ThemeName = z.enum(['light', 'dark']);
export type ThemeName = z.infer<typeof ThemeName>;

export const TokenValue = z.union([z.string().min(1).max(300), z.number()]);
export type TokenValue = z.infer<typeof TokenValue>;

/**
 * A design token. Exactly one of `value` (theme-independent), `valueByTheme`
 * (themed, e.g. colors), or `aliasOf` (a reference to a lower-tier token) must
 * be present — enforced by the schema, not by convention.
 */
export const DesignTokenDef = z
  .object({
    id: DesignTokenId,
    tier: TokenTier,
    category: TokenCategory,
    description: z.string().min(1).max(500),
    value: TokenValue.optional(),
    valueByTheme: z.object({ light: TokenValue, dark: TokenValue }).optional(),
    aliasOf: DesignTokenId.optional(),
    /** The CSS custom property that exposes this token, when one exists. */
    cssVariable: z
      .string()
      .regex(/^--nas-[a-z0-9-]+$/, 'expected a --nas-* custom property')
      .optional(),
  })
  .superRefine((tokenDef, ctx) => {
    const sources = [tokenDef.value, tokenDef.valueByTheme, tokenDef.aliasOf].filter(
      (s) => s !== undefined,
    ).length;
    if (sources !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `token "${tokenDef.id}" must define exactly one of value | valueByTheme | aliasOf (found ${sources})`,
      });
    }
    if (tokenDef.aliasOf !== undefined && tokenDef.tier === 'primitive') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `primitive token "${tokenDef.id}" cannot alias another token`,
      });
    }
  });
export type DesignTokenDef = z.infer<typeof DesignTokenDef>;

/* ── Components ─────────────────────────────────────────────────────────────── */

/** Atomic-design levels, ordered. Composition may only reference lower levels. */
export const AtomicLevel = z.enum([
  'foundation',
  'atom',
  'molecule',
  'organism',
  'template',
  'page',
]);
export type AtomicLevel = z.infer<typeof AtomicLevel>;

export const ATOMIC_LEVEL_ORDER: Record<AtomicLevel, number> = {
  foundation: 0,
  atom: 1,
  molecule: 2,
  organism: 3,
  template: 4,
  page: 5,
};

export const ComponentCategory = z.enum([
  'layout',
  'navigation',
  'input',
  'data_display',
  'feedback',
]);
export type ComponentCategory = z.infer<typeof ComponentCategory>;

/** Interaction/data states a component designs for — explicitly, never implied. */
export const InteractionState = z.enum([
  'default',
  'hover',
  'focus_visible',
  'active',
  'disabled',
  'loading',
  'empty',
  'error',
  'success',
]);
export type InteractionState = z.infer<typeof InteractionState>;

export const ComponentStateDef = z.object({
  state: InteractionState,
  /** What the component does in this state — observable behavior, not intention. */
  behavior: z.string().min(1).max(500),
});
export type ComponentStateDef = z.infer<typeof ComponentStateDef>;

export const ComponentVariant = z.object({
  name: z.string().min(1).max(100),
  purpose: z.string().min(1).max(300),
});
export type ComponentVariant = z.infer<typeof ComponentVariant>;

export const ComponentProp = z.object({
  name: z.string().min(1).max(100),
  type: z.string().min(1).max(200),
  required: z.boolean(),
  description: z.string().min(1).max(500),
});
export type ComponentProp = z.infer<typeof ComponentProp>;

export const SystemEntityStatus = z.enum(['proposed', 'experimental', 'stable', 'deprecated']);
export type SystemEntityStatus = z.infer<typeof SystemEntityStatus>;

/** A deprecation is a record, never a silent removal. */
export const Deprecation = z.object({
  reason: z.string().min(1).max(500),
  since: SemanticVersion,
  replacedBy: ComponentId.optional(),
  migration: z.string().min(1).max(1000),
});
export type Deprecation = z.infer<typeof Deprecation>;

export const ComponentDef = z.object({
  id: ComponentId,
  /** The exported symbol (or route for page-level entries). */
  name: z.string().min(1).max(100),
  atomicLevel: AtomicLevel,
  category: ComponentCategory,
  purpose: z.string().min(1).max(500),
  /** Repo-relative path of the implementing source file. */
  sourcePath: z.string().min(1).max(300),
  composedOf: z.array(ComponentId).default([]),
  variants: z.array(ComponentVariant).default([]),
  props: z.array(ComponentProp).default([]),
  states: z.array(ComponentStateDef).default([]),
  usesTokens: z.array(DesignTokenId).default([]),
  followsPrinciples: z.array(PrincipleId).min(1),
  accessibility: z.array(AccessibilityRuleId).default([]),
  responsiveBehavior: z.string().min(1).max(500),
  prohibitedUses: z.array(z.string().min(1).max(300)).default([]),
  /** Evidence kinds a change to this component must produce before release. */
  requiredEvidence: z.array(EvidenceKind).default([]),
  ownerId: OwnerId,
  version: SemanticVersion,
  status: SystemEntityStatus,
  deprecation: Deprecation.optional(),
  /** Repo-relative test paths that exercise this component. */
  tests: z.array(z.string().min(1).max(300)).default([]),
});
export type ComponentDef = z.infer<typeof ComponentDef>;

/* ── Patterns, principles, rules, ownership, exceptions ─────────────────────── */

/** Functional patterns define how interfaces behave; perceptual, how they look. */
export const PatternKind = z.enum(['functional', 'perceptual']);
export type PatternKind = z.infer<typeof PatternKind>;

export const PatternDef = z.object({
  id: PatternId,
  name: z.string().min(1).max(100),
  kind: PatternKind,
  purpose: z.string().min(1).max(500),
  consistsOf: z.array(ComponentId).default([]),
  usesTokens: z.array(DesignTokenId).default([]),
  conditionsOfUse: z.string().min(1).max(1000),
});
export type PatternDef = z.infer<typeof PatternDef>;

export const DesignPrinciple = z.object({
  id: PrincipleId,
  name: z.string().min(1).max(100),
  /** Actionable statement — something a review can check a screen against. */
  statement: z.string().min(1).max(500),
  rationale: z.string().min(1).max(1000),
});
export type DesignPrinciple = z.infer<typeof DesignPrinciple>;

export const AccessibilityRule = z.object({
  id: AccessibilityRuleId,
  requirement: z.string().min(1).max(500),
  /** WCAG success criterion, e.g. "1.4.3", when one applies directly. */
  wcagCriterion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/)
    .optional(),
  /** How the rule is verified (test path, harness, manual procedure). */
  verification: z.string().min(1).max(500),
});
export type AccessibilityRule = z.infer<typeof AccessibilityRule>;

export const SystemOwner = z.object({
  id: OwnerId,
  name: z.string().min(1).max(200),
  responsibility: z.string().min(1).max(500),
});
export type SystemOwner = z.infer<typeof SystemOwner>;

/**
 * An explicit, attributable, expiring exception to a system rule (e.g. a raw
 * value the platform cannot express as a token yet). Silent exceptions are an
 * anti-pattern; unowned or expired exceptions are findings.
 */
export const SystemException = z.object({
  id: SystemExceptionId,
  /** What is excepted: `<repo-relative-path>` or `<path>::<exact value>`. */
  scope: z.string().min(1).max(300),
  rationale: z.string().min(1).max(1000),
  ownerId: OwnerId,
  expiresAt: Timestamp,
  remediation: z.string().min(1).max(1000),
});
export type SystemException = z.infer<typeof SystemException>;

/* ── The registry ───────────────────────────────────────────────────────────── */

export const DesignSystemRegistry = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1).max(100),
  version: SemanticVersion,
  principles: z.array(DesignPrinciple).min(1),
  owners: z.array(SystemOwner).min(1),
  tokens: z.array(DesignTokenDef).min(1),
  components: z.array(ComponentDef).min(1),
  patterns: z.array(PatternDef).default([]),
  accessibilityRules: z.array(AccessibilityRule).default([]),
  exceptions: z.array(SystemException).default([]),
});
export type DesignSystemRegistry = z.infer<typeof DesignSystemRegistry>;

/* ── Referential integrity ──────────────────────────────────────────────────── */

export const RegistryProblemCode = z.enum([
  'REG_DUPLICATE_ID',
  'REG_DUPLICATE_NAME',
  'REG_DUPLICATE_CSS_VARIABLE',
  'REG_MISSING_TOKEN',
  'REG_MISSING_COMPONENT',
  'REG_MISSING_PRINCIPLE',
  'REG_MISSING_OWNER',
  'REG_MISSING_RULE',
  'REG_ALIAS_MISSING',
  'REG_ALIAS_TIER',
  'REG_COMPOSITION_LEVEL',
  'REG_ATOM_COMPOSED',
  'REG_DEPRECATION_MISMATCH',
]);
export type RegistryProblemCode = z.infer<typeof RegistryProblemCode>;

export const RegistryProblem = z.object({
  code: RegistryProblemCode,
  /** Where in the registry the problem sits, e.g. `components/component.button`. */
  path: z.string().min(1),
  message: z.string().min(1),
});
export type RegistryProblem = z.infer<typeof RegistryProblem>;

export const RegistryValidation = z.object({
  valid: z.boolean(),
  problems: z.array(RegistryProblem),
  counts: z.object({
    principles: z.number().int().nonnegative(),
    owners: z.number().int().nonnegative(),
    tokens: z.number().int().nonnegative(),
    components: z.number().int().nonnegative(),
    patterns: z.number().int().nonnegative(),
    accessibilityRules: z.number().int().nonnegative(),
    exceptions: z.number().int().nonnegative(),
  }),
});
export type RegistryValidation = z.infer<typeof RegistryValidation>;

/**
 * Referential-integrity validation over an already schema-valid registry. Every
 * reference (token, component, principle, owner, rule, alias, composition) must
 * resolve; aliases must point to a strictly lower tier; composition must point
 * to strictly lower atomic levels (and atoms/foundations compose nothing);
 * deprecation records and `deprecated` status must agree. Deterministic:
 * problems are sorted by path, then code.
 */
export function validateDesignSystemRegistry(registry: DesignSystemRegistry): RegistryValidation {
  const problems: RegistryProblem[] = [];
  const add = (code: RegistryProblemCode, path: string, message: string) =>
    problems.push({ code, path, message });

  const tokensById = uniqueById(registry.tokens, 'tokens', add);
  const componentsById = uniqueById(registry.components, 'components', add);
  const principleIds = new Set(uniqueById(registry.principles, 'principles', add).keys());
  const ownerIds = new Set(uniqueById(registry.owners, 'owners', add).keys());
  const ruleIds = new Set(
    uniqueById(registry.accessibilityRules, 'accessibilityRules', add).keys(),
  );
  uniqueById(registry.patterns, 'patterns', add);
  uniqueById(registry.exceptions, 'exceptions', add);

  const seenCssVars = new Map<string, string>();
  for (const tokenDef of registry.tokens) {
    const path = `tokens/${tokenDef.id}`;
    if (tokenDef.cssVariable !== undefined) {
      const holder = seenCssVars.get(tokenDef.cssVariable);
      if (holder !== undefined) {
        add(
          'REG_DUPLICATE_CSS_VARIABLE',
          path,
          `cssVariable "${tokenDef.cssVariable}" is already exposed by "${holder}"`,
        );
      } else {
        seenCssVars.set(tokenDef.cssVariable, tokenDef.id);
      }
    }
    if (tokenDef.aliasOf !== undefined) {
      const target = tokensById.get(tokenDef.aliasOf);
      if (!target) {
        add('REG_ALIAS_MISSING', path, `aliasOf "${tokenDef.aliasOf}" does not exist`);
      } else if (TOKEN_TIER_ORDER[target.tier] >= TOKEN_TIER_ORDER[tokenDef.tier]) {
        add(
          'REG_ALIAS_TIER',
          path,
          `${tokenDef.tier} token may only alias a lower tier; "${tokenDef.aliasOf}" is ${target.tier}`,
        );
      }
    }
  }

  const seenNames = new Map<string, string>();
  for (const component of registry.components) {
    const path = `components/${component.id}`;
    const nameKey = `${component.sourcePath}#${component.name}`;
    const holder = seenNames.get(nameKey);
    if (holder !== undefined) {
      add(
        'REG_DUPLICATE_NAME',
        path,
        `name "${component.name}" in ${component.sourcePath} is already registered by "${holder}"`,
      );
    } else {
      seenNames.set(nameKey, component.id);
    }

    for (const tokenId of component.usesTokens) {
      if (!tokensById.has(tokenId)) {
        add('REG_MISSING_TOKEN', path, `usesTokens references missing token "${tokenId}"`);
      }
    }
    for (const principleId of component.followsPrinciples) {
      if (!principleIds.has(principleId)) {
        add(
          'REG_MISSING_PRINCIPLE',
          path,
          `followsPrinciples references missing principle "${principleId}"`,
        );
      }
    }
    for (const ruleId of component.accessibility) {
      if (!ruleIds.has(ruleId)) {
        add('REG_MISSING_RULE', path, `accessibility references missing rule "${ruleId}"`);
      }
    }
    if (!ownerIds.has(component.ownerId)) {
      add('REG_MISSING_OWNER', path, `ownerId references missing owner "${component.ownerId}"`);
    }

    const ownOrder = ATOMIC_LEVEL_ORDER[component.atomicLevel];
    if (component.composedOf.length > 0 && ownOrder <= ATOMIC_LEVEL_ORDER.atom) {
      add(
        'REG_ATOM_COMPOSED',
        path,
        `${component.atomicLevel} "${component.id}" must not compose other components`,
      );
    }
    for (const childId of component.composedOf) {
      const child = componentsById.get(childId);
      if (!child) {
        add('REG_MISSING_COMPONENT', path, `composedOf references missing component "${childId}"`);
      } else if (ATOMIC_LEVEL_ORDER[child.atomicLevel] >= ownOrder) {
        add(
          'REG_COMPOSITION_LEVEL',
          path,
          `${component.atomicLevel} may only compose strictly lower levels; "${childId}" is ${child.atomicLevel}`,
        );
      }
    }

    if (component.status === 'deprecated' && component.deprecation === undefined) {
      add(
        'REG_DEPRECATION_MISMATCH',
        path,
        'status is deprecated but no deprecation record exists',
      );
    }
    if (component.status !== 'deprecated' && component.deprecation !== undefined) {
      add(
        'REG_DEPRECATION_MISMATCH',
        path,
        `a deprecation record exists but status is "${component.status}"`,
      );
    }
    if (component.deprecation?.replacedBy !== undefined) {
      if (!componentsById.has(component.deprecation.replacedBy)) {
        add(
          'REG_MISSING_COMPONENT',
          path,
          `deprecation.replacedBy references missing component "${component.deprecation.replacedBy}"`,
        );
      }
    }
  }

  for (const pattern of registry.patterns) {
    const path = `patterns/${pattern.id}`;
    for (const componentId of pattern.consistsOf) {
      if (!componentsById.has(componentId)) {
        add(
          'REG_MISSING_COMPONENT',
          path,
          `consistsOf references missing component "${componentId}"`,
        );
      }
    }
    for (const tokenId of pattern.usesTokens) {
      if (!tokensById.has(tokenId)) {
        add('REG_MISSING_TOKEN', path, `usesTokens references missing token "${tokenId}"`);
      }
    }
  }

  for (const exception of registry.exceptions) {
    if (!ownerIds.has(exception.ownerId)) {
      add(
        'REG_MISSING_OWNER',
        `exceptions/${exception.id}`,
        `ownerId references missing owner "${exception.ownerId}"`,
      );
    }
  }

  problems.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code));
  return {
    valid: problems.length === 0,
    problems,
    counts: {
      principles: registry.principles.length,
      owners: registry.owners.length,
      tokens: registry.tokens.length,
      components: registry.components.length,
      patterns: registry.patterns.length,
      accessibilityRules: registry.accessibilityRules.length,
      exceptions: registry.exceptions.length,
    },
  };
}

function uniqueById<T extends { id: string }>(
  entries: readonly T[],
  section: string,
  add: (code: RegistryProblemCode, path: string, message: string) => void,
): Map<string, T> {
  const map = new Map<string, T>();
  for (const entry of entries) {
    if (map.has(entry.id)) {
      add('REG_DUPLICATE_ID', `${section}/${entry.id}`, `duplicate id "${entry.id}"`);
    } else {
      map.set(entry.id, entry);
    }
  }
  return map;
}
