import { describe, expect, it } from 'vitest';
import { ACCENT_PRESETS, accentTokens, contrast, ensureContrast, hexToHsl, hslToHex } from '../../src/core/colors';

const EXTREMES = ['#ffffff', '#000000', '#ffff00', '#101040', '#808080', '#00ff00'];
const ALL = [...ACCENT_PRESETS.map((p) => p.value), ...EXTREMES];

describe('accent colours', () => {
  it('ensureContrast keeps good colours and fixes weak ones', () => {
    expect(ensureContrast('#221c2e', '#ffffff', 3)).toBe('#221c2e');
    const fixed = ensureContrast('#ffff00', '#ffffff', 3);
    expect(contrast(fixed, '#ffffff')).toBeGreaterThanOrEqual(3);
    expect(contrast(ensureContrast('#101040', '#1e1a28', 3), '#1e1a28')).toBeGreaterThanOrEqual(3);
  });

  it('round-trips HSL', () => {
    for (const hex of ['#3aa5f2', '#e0457b', '#22b8b0']) expect(hslToHex(...hexToHsl(hex))).toMatch(/^#[0-9a-f]{6}$/);
    expect(hexToHsl('#ff0000')).toEqual([0, 100, 50]);
  });

  it.each(ALL)('%s stays readable in light and dark mode', (hex) => {
    for (const dark of [false, true]) {
      const t = accentTokens(hex, dark);
      const surface = dark ? '#1e1a28' : '#ffffff';
      // Text on buttons / the tab pill
      expect(contrast(t['--primary'], t['--on-primary'])).toBeGreaterThanOrEqual(4.5);
      // Rings, bars, borders and highlights on cards
      expect(contrast(t['--accent'], surface)).toBeGreaterThanOrEqual(3);
      expect(t['--leaf']).toBe(t['--accent']);
    }
  });
});
