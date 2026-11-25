import { accentTokens } from './colors';
import type { ThemeMode } from '../data/types';

/*
 * Theme + accent for the whole app (habits and tasks). Sets data-theme / data-motion on <html> and
 * the accent's CSS variables (contrast-checked, from the Habit Tracker's accent system).
 */

export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let current: { mode: ThemeMode; accent: string | null; reduceMotion: boolean } | null = null;
const listeners: ((t: 'light' | 'dark') => void)[] = [];

/** Called with the resolved theme every time it's applied (the Android status bar follows it). */
export function onThemeResolved(fn: (t: 'light' | 'dark') => void) {
  listeners.push(fn);
}

const ACCENT_KEYS = Object.keys(accentTokens('#000000', false));

export function applyTheme(mode: ThemeMode, accent: string | null, reduceMotion = false) {
  current = { mode, accent, reduceMotion };
  const root = document.documentElement;
  const resolved = resolveTheme(mode);
  const dark = resolved === 'dark';
  root.dataset.theme = resolved;
  root.dataset.motion = reduceMotion ? 'reduce' : 'full';
  for (const k of ACCENT_KEYS) root.style.removeProperty(k);
  if (accent) {
    root.dataset.accent = '';
    for (const [k, v] of Object.entries(accentTokens(accent, dark))) root.style.setProperty(k, v);
  } else {
    delete root.dataset.accent;
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#14111c' : '#fbf6ee');
  listeners.forEach((fn) => fn(resolved));
}

window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  if (current?.mode === 'system') applyTheme(current.mode, current.accent, current.reduceMotion);
});

/** Reduce motion: the app setting or the phone's own setting. */
export function prefersReducedMotion(): boolean {
  return !!current?.reduceMotion || !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
