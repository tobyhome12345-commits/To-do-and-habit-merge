export const HABIT_COLORS = [
  { name: 'Coral', value: '#ff6b5b' },
  { name: 'Tangerine', value: '#ff8f3f' },
  { name: 'Sunflower', value: '#f5b52e' },
  { name: 'Moss', value: '#8cbf3f' },
  { name: 'Leaf', value: '#3dbe7e' },
  { name: 'Lagoon', value: '#22b8b0' },
  { name: 'Sky', value: '#3aa5f2' },
  { name: 'Iris', value: '#6f7cf7' },
  { name: 'Plum', value: '#a970f0' },
  { name: 'Rose', value: '#f25c9a' },
] as const;

export const DEFAULT_HABIT_COLOR = '#3dbe7e';

/** v1.0.x palette → "garden" palette, so habits made before the redesign restyle automatically. */
export const LEGACY_COLOR_MAP: Record<string, string> = {
  '#8b5cf6': '#a970f0',
  '#3b82f6': '#6f7cf7',
  '#0ea5e9': '#3aa5f2',
  '#14b8a6': '#22b8b0',
  '#22c55e': '#3dbe7e',
  '#84cc16': '#8cbf3f',
  '#f59e0b': '#f5b52e',
  '#f97316': '#ff8f3f',
  '#f43f5e': '#ff6b5b',
  '#ec4899': '#f25c9a',
};

/** Hex colour → rgba() with the given alpha. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

/** Readable text colour (near-black or white) to put on top of a solid habit colour. */
export function onColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  // White when it reaches 3:1 (WCAG level for bold text and icons), otherwise near-black.
  return 1.05 / (L + 0.05) >= 3 ? '#ffffff' : '#16141f';
}

// ---------- Accent colour helpers ----------

/** UI accent presets (null = the classic ink / sunflower look). */
export const ACCENT_PRESETS = [
  { name: 'Sunflower', value: '#ffc845' },
  { name: 'Tangerine', value: '#ff8f3f' },
  { name: 'Coral', value: '#ff6b5b' },
  { name: 'Rose', value: '#f25c9a' },
  { name: 'Plum', value: '#a970f0' },
  { name: 'Iris', value: '#6f7cf7' },
  { name: 'Sky', value: '#3aa5f2' },
  { name: 'Lagoon', value: '#22b8b0' },
  { name: 'Leaf', value: '#3dbe7e' },
] as const;

const toRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

export function luminance(hex: string): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = toRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio between two colours (1–21). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Blend `hex` towards `to` by t (0–1). */
export function mix(hex: string, to: string, t: number): string {
  const a = toRgb(hex);
  const b = toRgb(to);
  return toHex(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
}

/**
 * Nudge a colour darker (on light backgrounds) or lighter (on dark ones) until it
 * reaches `min` contrast with `bg`, keeping its hue. Used so any accent stays readable.
 */
export function ensureContrast(hex: string, bg: string, min: number): string {
  if (contrast(hex, bg) >= min) return hex;
  const towards = luminance(bg) > 0.4 ? '#000000' : '#ffffff';
  for (let t = 0.05; t <= 1; t += 0.05) {
    const c = mix(hex, towards, t);
    if (contrast(c, bg) >= min) return c;
  }
  return towards;
}

export function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return 255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return toHex(f(0), f(8), f(4));
}

export function hexToHsl(hex: string): [number, number, number] {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
}

const THEME = {
  light: { bg: '#fbf6ee', surface: '#ffffff', ink: '#221c2e' },
  dark: { bg: '#14111c', surface: '#1e1a28', ink: '#352f44' },
};

/** CSS variables that re-colour the whole UI for an accent, readable in light or dark mode. */
export function accentTokens(accent: string, dark: boolean): Record<string, string> {
  const t = dark ? THEME.dark : THEME.light;
  // Button / tab-pill fill: only nudged when it would vanish into the background
  let fill = ensureContrast(accent, t.bg, dark ? 2.2 : 1.6);
  // Button text: whichever of white / near-black reads better, at least 4.5:1
  const text = contrast(fill, '#ffffff') >= contrast(fill, '#16141f') ? '#ffffff' : '#16141f';
  if (contrast(fill, text) < 4.5) fill = ensureContrast(fill, text, 4.5);
  // Rings, bars, borders, text highlights: at least 3:1 on cards
  const strong = ensureContrast(accent, t.surface, 3);
  return {
    '--primary': fill,
    '--on-primary': text,
    '--primary-soft': alpha(fill, dark ? 0.18 : 0.14),
    '--accent': strong,
    '--accent-soft': alpha(accent, dark ? 0.2 : 0.16),
    '--leaf': strong,
    '--leaf-soft': alpha(strong, dark ? 0.18 : 0.14),
    '--sun-soft': alpha(accent, dark ? 0.16 : 0.24),
    '--bg-glow': alpha(accent, dark ? 0.08 : 0.2),
    '--snack-accent': ensureContrast(accent, t.ink, 4.5),
    '--tick-shoe': accent,
    '--tick-glow': mix(accent, '#ffffff', 0.25),
  };
}
