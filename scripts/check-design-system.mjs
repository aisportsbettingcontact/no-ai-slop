/**
 * Design-system scanner + gate.
 *
 * Collects facts about governed UI paths (raw visual values, exported
 * components), runs the pure checker from @nas/anti-slop over the registry in
 * @nas/ui, and keeps the canonical JSON artifact fresh:
 *
 *   node scripts/check-design-system.mjs           verify: registry + scan + committed artifact
 *   node scripts/check-design-system.mjs --write   regenerate docs/design-system/registry.json
 *   node scripts/check-design-system.mjs --json    print findings as JSON
 *
 * Exit codes: 0 clean · 1 findings or stale artifact.
 *
 * Governed paths: *.tsx under packages/ui/src and apps/no-ai-slop/app, plus
 * packages/ui/src/base.css. tokens.css is the token definition source and is
 * exempt by construction.
 *
 * Known limits (documented, verified by adversarial review): the scan is
 * line-based and static. It covers hex/rgb()/rgba(), px/em/rem/ch literals,
 * unitless numerics on visual CSS properties, bare numeric style props in TSX,
 * and the demonstrated computed-value idioms (template-interpolation + unit,
 * quoted-unit concatenation). Values assembled by arbitrary runtime code beyond
 * those idioms are NOT statically observable — they are covered by rendered-page
 * review and the registry sync tests, not by this scanner.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const ARTIFACT_PATH = 'docs/design-system/registry.json';
const GOVERNED_TSX_ROOTS = ['packages/ui/src', 'apps/no-ai-slop/app'];
const GOVERNED_CSS_FILES = ['packages/ui/src/base.css'];
const EXCLUDED_DIRS = new Set(['node_modules', 'dist', '.next']);

// Patterns applied to every governed file (CSS + TSX).
const SHARED_PATTERNS = [
  // Hex colors, and full rgb()/rgba() calls — the WHOLE call is the occurrence
  // value, so an exception can only ever suppress one exact color, never every
  // rgba() in a file.
  /#[0-9a-fA-F]{3,8}\b/g,
  /\brgba?\([^)]*\)/g,
  // Pixel and typographic-unit literals (var(--nas-*) indirections carry none).
  /\b\d+(?:\.\d+)?px\b/g,
  /-?\d*\.?\d+(?:em|rem|ch)\b/g,
  // Computed-value idioms demonstrated by adversarial review: a template
  // interpolation immediately followed by a unit (`${8}px`), and a bare unit
  // string literal used in concatenation ('8' + 'px').
  /\$\{[^}]*\}\s*(?:px|em|rem|ch|vh|vw)\b/g,
  /['"](?:px|em|rem|ch)['"]/g,
];
// CSS-only: numeric literals on visual properties that carry no unit — these
// must come from tokens (opacity: var(--nas-opacity-disabled)), never inline.
const CSS_PATTERNS = [
  /\b(?:opacity|line-height|letter-spacing|z-index|font-weight)\s*:\s*[0-9.]+/g,
];
// TSX-only: bare numeric style props in inline styles (e.g. minHeight: 36).
const TSX_PATTERNS = [
  /\b(?:width|height|minWidth|minHeight|maxWidth|maxHeight|gap|padding|margin|fontSize|borderRadius|top|left|right|bottom)\s*:\s*[1-9]\d*\b/g,
  /\b(?:opacity|lineHeight|letterSpacing|zIndex|fontWeight)\s*:\s*['"]?[0-9.]+/g,
];

/**
 * Blank out comment content so prose mentioning "1024px" is not a finding.
 * Handles block comments across lines and whole-line // comments. Known limit
 * (documented): a trailing same-line // comment is scanned as code.
 */
export function stripComments(lines) {
  let inBlock = false;
  return lines.map((line) => {
    let out = '';
    let i = 0;
    while (i < line.length) {
      if (inBlock) {
        const end = line.indexOf('*/', i);
        if (end === -1) return out; // whole remainder is comment
        inBlock = false;
        i = end + 2;
      } else {
        const start = line.indexOf('/*', i);
        if (start === -1) {
          out += line.slice(i);
          break;
        }
        out += line.slice(i, start);
        inBlock = true;
        i = start + 2;
      }
    }
    return out.trim().startsWith('//') ? '' : out;
  });
}

function walk(dir, out) {
  for (const entry of readdirSync(dir).sort()) {
    if (EXCLUDED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

/** Scan governed paths for raw visual values. Deterministic, line-based. */
export function scanRawValues(root = repoRoot) {
  const files = [
    ...GOVERNED_TSX_ROOTS.flatMap((dir) => walk(join(root, dir), [])).map((f) =>
      relative(root, f).split('\\').join('/'),
    ),
    ...GOVERNED_CSS_FILES,
  ].sort();

  const occurrences = [];
  for (const file of files) {
    const patterns = file.endsWith('.tsx')
      ? [...SHARED_PATTERNS, ...TSX_PATTERNS]
      : [...SHARED_PATTERNS, ...CSS_PATTERNS];
    const lines = stripComments(readFileSync(join(root, file), 'utf8').split('\n'));
    lines.forEach((line, index) => {
      for (const pattern of patterns) {
        for (const match of line.matchAll(pattern)) {
          occurrences.push({ path: file, line: index + 1, value: match[0].trim() });
        }
      }
    });
  }
  return occurrences;
}

/** Component names exported by a loaded @nas/ui module. */
export function exportedComponentNames(uiModule) {
  return Object.entries(uiModule)
    .filter(([name, value]) => typeof value === 'function' && /^[A-Z]/.test(name))
    .map(([name]) => name)
    .sort();
}

/** Registry sourcePath/tests entries that resolve to no real file. */
export function missingRegistryPaths(registry, root = repoRoot) {
  const missing = [];
  for (const component of registry.components) {
    for (const path of [component.sourcePath, ...component.tests]) {
      if (!existsSync(join(root, path))) {
        missing.push({ componentId: component.id, path });
      }
    }
  }
  return missing.sort(
    (a, b) => a.componentId.localeCompare(b.componentId) || a.path.localeCompare(b.path),
  );
}

async function main() {
  const args = process.argv.slice(2);
  const { DesignSystemRegistry, DesignSystemScanFacts, validateDesignSystemRegistry } =
    await import(new URL('../packages/contracts/dist/index.js', import.meta.url).href);
  const { checkDesignSystem } = await import(
    new URL('../packages/anti-slop/dist/index.js', import.meta.url).href
  );
  const { canonicalJson, digestBytes } = await import(
    new URL('../packages/crypto/dist/index.js', import.meta.url).href
  );
  const ui = await import(new URL('../packages/ui/dist/index.js', import.meta.url).href);

  const registry = DesignSystemRegistry.parse(ui.designSystemRegistry);
  const scan = DesignSystemScanFacts.parse({
    rawValues: scanRawValues(),
    exportedComponents: exportedComponentNames(ui),
    missingRegistryPaths: missingRegistryPaths(registry),
  });

  const canonical = canonicalJson(registry);
  const artifact = `${JSON.stringify(
    {
      $comment:
        'GENERATED from packages/ui/src/registry.ts by scripts/check-design-system.mjs --write. Do not edit by hand; the freshness check fails on drift.',
      digest: digestBytes(canonical),
      registry,
    },
    null,
    2,
  )}\n`;

  if (args.includes('--write')) {
    mkdirSync(dirname(join(repoRoot, ARTIFACT_PATH)), { recursive: true });
    writeFileSync(join(repoRoot, ARTIFACT_PATH), artifact, 'utf8');
    console.log(`wrote ${ARTIFACT_PATH} (digest ${digestBytes(canonical).slice(0, 19)}…)`);
  } else {
    let committed = null;
    try {
      committed = readFileSync(join(repoRoot, ARTIFACT_PATH), 'utf8');
    } catch {
      console.error(`✗ ${ARTIFACT_PATH} is missing — run with --write and commit it`);
      return 1;
    }
    if (committed !== artifact) {
      console.error(`✗ ${ARTIFACT_PATH} is stale — run with --write and commit the diff`);
      return 1;
    }
  }

  const integrity = validateDesignSystemRegistry(registry);
  const findings = checkDesignSystem(registry, scan, new Date().toISOString());

  if (args.includes('--json')) {
    console.log(JSON.stringify({ integrity, findings }, null, 2));
  } else {
    console.log(
      `design system: ${integrity.counts.tokens} tokens, ${integrity.counts.components} components, ` +
        `${integrity.counts.patterns} patterns, ${integrity.counts.exceptions} exception(s); ` +
        `scan: ${scan.rawValues.length} raw-value occurrence(s) across governed paths`,
    );
    for (const finding of findings) {
      const where = `${finding.location.path}${finding.location.line ? `:${finding.location.line}` : ''}`;
      console.error(`  ✗ [${finding.code}] ${where} — ${finding.rationale}`);
    }
    console.log(
      findings.length === 0
        ? '✓ registry coherent; no unexcepted raw values in governed paths'
        : `✗ ${findings.length} design-system finding(s)`,
    );
  }
  return findings.length === 0 ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(await main());
}
