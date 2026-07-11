/**
 * The authoritative design tokens for No AI Slop.
 *
 * This TypeScript module is the SOURCE OF TRUTH for color values. `tokens.css`
 * mirrors these exact hex values as CSS custom properties for use in stylesheets.
 * The contrast test in `tokens.test.ts` asserts the pairs below meet WCAG 2.2 AA,
 * so an inaccessible color can never merge silently.
 *
 * Design intent (the doctrine, encoded): restrained neutral surfaces, ONE calm
 * mint accent reserved for the single primary action, and semantic status colors
 * that are always paired with a label or icon — never color alone.
 */

export interface ColorTheme {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentHover: string;
  onAccent: string;
  focus: string;
}

export interface StatusColors {
  fg: string;
  bg: string;
}

export interface StatusPalette {
  success: StatusColors;
  warning: StatusColors;
  danger: StatusColors;
  info: StatusColors;
  neutral: StatusColors;
}

export const lightTheme: ColorTheme = {
  bg: '#fbfbfd',
  surface: '#ffffff',
  surface2: '#f4f4f6',
  border: '#d9d9de',
  text: '#1d1d1f',
  textSecondary: '#54545a',
  textTertiary: '#6e6e73',
  accent: '#0a7c6d',
  accentHover: '#086253',
  onAccent: '#ffffff',
  focus: '#0a7c6d',
};

export const darkTheme: ColorTheme = {
  bg: '#0b0b0c',
  surface: '#161618',
  surface2: '#1f1f22',
  border: '#38383c',
  text: '#f5f5f7',
  textSecondary: '#b0b0b6',
  textTertiary: '#98989f',
  accent: '#2dd4bf',
  accentHover: '#4ee0cd',
  onAccent: '#04241f',
  focus: '#2dd4bf',
};

export const lightStatus: StatusPalette = {
  success: { fg: '#0f7a37', bg: '#e6f4ea' },
  warning: { fg: '#8a6100', bg: '#fbefd6' },
  danger: { fg: '#b3261e', bg: '#fce8e6' },
  info: { fg: '#1b56b3', bg: '#e7effb' },
  neutral: { fg: '#4b4b50', bg: '#eeeef0' },
};

export const darkStatus: StatusPalette = {
  success: { fg: '#6ee7a0', bg: '#10331d' },
  warning: { fg: '#f0c651', bg: '#332808' },
  danger: { fg: '#f6a49c', bg: '#3a1614' },
  info: { fg: '#9dbef5', bg: '#12233f' },
  neutral: { fg: '#b0b0b6', bg: '#242427' },
};

/** Device breakpoints (min-width), in pixels. Mobile-first. */
export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1440,
} as const;

/** The spacing scale (px). A closed set prevents arbitrary spacing (a slop tell). */
export const spacing = [0, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80] as const;

export type ReleaseVerdict = 'pass' | 'warning' | 'fail' | 'blocked';
export type StatusTone = keyof StatusPalette;

/** Map a release verdict to a status tone + label. Status is never color-only. */
export const verdictMeta: Record<ReleaseVerdict, { tone: StatusTone; label: string; symbol: string }> = {
  pass: { tone: 'success', label: 'Pass', symbol: '✓' },
  warning: { tone: 'warning', label: 'Warning', symbol: '!' },
  fail: { tone: 'danger', label: 'Fail', symbol: '✗' },
  blocked: { tone: 'danger', label: 'Blocked', symbol: '⦸' },
};

export type Grade = 'pass' | 'pass_with_concern' | 'fail' | 'not_tested';

/** Map an anti-slop grade to a tone + label. */
export const gradeMeta: Record<Grade, { tone: StatusTone; label: string; symbol: string }> = {
  pass: { tone: 'success', label: 'Pass', symbol: '✓' },
  pass_with_concern: { tone: 'warning', label: 'Pass with concern', symbol: '!' },
  fail: { tone: 'danger', label: 'Fail', symbol: '✗' },
  not_tested: { tone: 'neutral', label: 'Not tested', symbol: '–' },
};
