import { describe, expect, it } from 'vitest';
import { contrastRatio, WCAG_AA_LARGE, WCAG_AA_NORMAL } from './contrast.js';
import {
  darkStatus,
  darkTheme,
  lightStatus,
  lightTheme,
  type ColorTheme,
  type StatusPalette,
} from './tokens.js';

function checkTheme(name: string, theme: ColorTheme, status: StatusPalette) {
  describe(`${name} theme contrast (WCAG 2.2 AA)`, () => {
    it('primary and secondary text meet 4.5:1 on the app background', () => {
      expect(contrastRatio(theme.text, theme.bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      expect(contrastRatio(theme.textSecondary, theme.bg)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('primary text meets 4.5:1 on surfaces', () => {
      expect(contrastRatio(theme.text, theme.surface)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      expect(contrastRatio(theme.text, theme.surface2)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('the accent label (on-accent) meets 4.5:1 on the accent fill', () => {
      expect(contrastRatio(theme.onAccent, theme.accent)).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
    });

    it('the accent fill is distinguishable (3:1) from the background', () => {
      expect(contrastRatio(theme.accent, theme.bg)).toBeGreaterThanOrEqual(WCAG_AA_LARGE);
    });

    it('every status foreground meets 4.5:1 on its own tinted background', () => {
      for (const tone of ['success', 'warning', 'danger', 'info', 'neutral'] as const) {
        const { fg, bg } = status[tone];
        expect(contrastRatio(fg, bg), `${name}/${tone}`).toBeGreaterThanOrEqual(WCAG_AA_NORMAL);
      }
    });
  });
}

checkTheme('light', lightTheme, lightStatus);
checkTheme('dark', darkTheme, darkStatus);
