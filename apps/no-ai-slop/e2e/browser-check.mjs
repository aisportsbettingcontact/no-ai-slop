/**
 * Real browser smoke + accessibility scan for the No AI Slop control app.
 *
 * Drives the running app in Chromium at desktop and mobile viewports, runs
 * axe-core on each primary screen, and fails (exit 1) on any serious/critical
 * accessibility violation. Screenshots are written to the output directory as
 * evidence. This is deliberately NOT a "did it render" check — it exercises the
 * real interface across device classes and asserts an accessibility bar.
 *
 * Usage: node e2e/browser-check.mjs [baseUrl] [outDir]
 */
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const require = createRequire(import.meta.url);
const BASE = process.argv[2] ?? 'http://localhost:3000';
const OUT = process.argv[3] ?? './e2e/screenshots';
const CHROME =
  process.env.NAS_CHROME_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const axePath = require.resolve('axe-core/axe.min.js');
const { readFileSync } = await import('node:fs');
const axeSource = readFileSync(axePath, 'utf8');

const ROUTES = [
  { path: '/', name: 'overview' },
  { path: '/release', name: 'release' },
  { path: '/evidence', name: 'evidence' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, headless: true });
let failures = 0;
let checks = 0;

try {
  for (const theme of ['light', 'dark']) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme === 'dark' ? 'dark' : 'light',
      });
      const page = await context.newPage();
      for (const route of ROUTES) {
        const url = `${BASE}${route.path}`;
        const response = await page.goto(url, { waitUntil: 'networkidle' });
        const status = response?.status() ?? 0;
        if (status !== 200) {
          console.error(`✗ ${route.path} [${viewport.name}/${theme}] HTTP ${status}`);
          failures += 1;
          continue;
        }

        // Assert the shell + a single h1 are present (structure, not just "it rendered").
        const h1Count = await page.locator('h1').count();
        const brand = await page.locator('.nas-brand').first().textContent();
        if (h1Count !== 1 || brand?.trim() !== 'No AI Slop') {
          console.error(
            `✗ ${route.path} [${viewport.name}/${theme}] structure: h1=${h1Count} brand=${brand}`,
          );
          failures += 1;
        }

        // Screenshot (light desktop + one mobile as evidence; skip duplicates to save space).
        if (theme === 'light') {
          await page.screenshot({
            path: `${OUT}/${route.name}-${viewport.name}.png`,
            fullPage: true,
          });
        }

        // Accessibility scan with axe-core (WCAG 2a/2aa rules).
        await page.addScriptTag({ content: axeSource });
        const results = await page.evaluate(async () => {
          // @ts-ignore - axe is injected above
          return await window.axe.run(document, {
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
          });
        });
        checks += 1;
        const serious = results.violations.filter(
          (v) => v.impact === 'serious' || v.impact === 'critical',
        );
        if (serious.length > 0) {
          failures += 1;
          console.error(`✗ ${route.path} [${viewport.name}/${theme}] a11y:`);
          for (const v of serious) {
            console.error(`    [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
          }
        } else {
          console.log(
            `✓ ${route.path} [${viewport.name}/${theme}] 200, structure ok, 0 serious/critical a11y`,
          );
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}

console.log(`\n${checks} page scans, ${failures} failure(s). Screenshots in ${OUT}`);
process.exit(failures === 0 ? 0 : 1);
