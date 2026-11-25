import type { Schedule, TimeOfDay } from './types';

export const EMOJIS = [
  '💧', '🏃', '📚', '🧘', '💪', '🥗', '😴', '🦷',
  '✍️', '🎸', '🎨', '💻', '🧹', '🌱', '🚶', '🚴',
  '🏊', '⚽', '🏀', '🎮', '📵', '☀️', '🍎', '🥦',
  '💊', '🧠', '🙏', '❤️', '😊', '📝', '🎯', '⭐',
  '🐶', '🌳', '🛏️', '🚿', '🧴', '🎧', '📖', '🇪🇸',
];

export const QUICK_PICKS: {
  name: string;
  emoji: string;
  color: string;
  target: number;
  unit: string;
  schedule: Schedule;
  timeOfDay: TimeOfDay;
}[] = [
  { name: 'Drink water', emoji: '💧', color: '#3aa5f2', target: 8, unit: 'glasses', schedule: { kind: 'daily' }, timeOfDay: 'anytime' },
  { name: 'Read', emoji: '📚', color: '#f5b52e', target: 10, unit: 'pages', schedule: { kind: 'daily' }, timeOfDay: 'evening' },
  { name: 'Workout', emoji: '🏋️', color: '#3dbe7e', target: 1, unit: '', schedule: { kind: 'weekly', times: 3 }, timeOfDay: 'anytime' },
  { name: 'Meditate', emoji: '🧘', color: '#a970f0', target: 1, unit: '', schedule: { kind: 'daily' }, timeOfDay: 'morning' },
  { name: 'Practice guitar', emoji: '🎸', color: '#ff6b5b', target: 1, unit: '', schedule: { kind: 'weekdays', days: [1, 3, 5] }, timeOfDay: 'afternoon' },
  { name: 'Sleep by 10pm', emoji: '😴', color: '#6f7cf7', target: 1, unit: '', schedule: { kind: 'daily' }, timeOfDay: 'evening' },
];

/** First user-perceived character of a string (handles multi-codepoint emoji). */
export function firstGrapheme(s: string): string {
  const t = s.trim();
  if (!t) return '';
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    for (const { segment } of seg.segment(t)) return segment;
  }
  return Array.from(t)[0];
}
