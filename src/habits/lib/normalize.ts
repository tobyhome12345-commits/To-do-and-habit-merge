import { isValidTime, todayKey } from '../../core/dates';
import { DEFAULT_HABIT_COLOR, LEGACY_COLOR_MAP } from '../../core/colors';
import type { HabitState, DateKey, DateRange, Habit, HabitRule, Schedule, TimeOfDay } from './types';

/*
 * Validates and repairs habit data from storage or a backup file. This is the Habit Tracker's
 * own migration code (v1 → v2), reused by Tickday as the "habits slice" cleaner.
 */

export function defaultState(): HabitState {
  return {
    habits: [],
    completions: {},
    notes: {},
    settings: { weekStart: 1, vacations: [] },
  };
}

/** Old Habit Tracker settings that Tickday keeps in its shared settings instead. */
export interface LegacyHabitSettings {
  theme: 'system' | 'light' | 'dark';
  weekStart: 0 | 1;
  accent: string | null;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isDay = (v: unknown): v is DateKey => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
const int = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function migrateColor(c: unknown): string {
  const hex = String(c).toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(hex)) return DEFAULT_HABIT_COLOR;
  return LEGACY_COLOR_MAP[hex] ?? hex;
}

export function normalizeAccent(c: unknown): string | null {
  const hex = String(c ?? '').toLowerCase();
  return /^#[0-9a-f]{6}$/.test(hex) ? hex : null;
}

function normalizeSchedule(raw: unknown): Schedule {
  if (!isObj(raw)) return { kind: 'daily' };
  switch (raw.kind) {
    case 'weekdays': {
      const days = Array.isArray(raw.days) ? [...new Set(raw.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : [];
      return days.length === 0 || days.length === 7 ? { kind: 'daily' } : { kind: 'weekdays', days };
    }
    case 'interval': {
      const every = int(raw.every, 1, 30, 1);
      return every <= 1 ? { kind: 'daily' } : { kind: 'interval', every };
    }
    case 'weekly': {
      const times = int(raw.times, 1, 7, 7);
      return times >= 7 ? { kind: 'daily' } : { kind: 'weekly', times };
    }
    default:
      return { kind: 'daily' };
  }
}

function normalizeRanges(raw: unknown): DateRange[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(isObj)
    .filter((r) => isDay(r.from) && (r.to === null || r.to === undefined || isDay(r.to)))
    .map((r) => ({ from: r.from as DateKey, to: isDay(r.to) ? (r.to < (r.from as DateKey) ? (r.from as DateKey) : r.to) : null }))
    .sort((a, b) => (a.from < b.from ? -1 : 1));
}

const TIMES: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'anytime'];

function normalizeHabit(h: Record<string, unknown>): Habit {
  const createdAt = isDay(h.createdAt) ? h.createdAt : todayKey();
  // v1 habits had no rules: a simple daily check since the day they were made.
  let rules: HabitRule[] = Array.isArray(h.rules)
    ? h.rules
        .filter(isObj)
        .map((r) => ({ since: isDay(r.since) ? r.since : createdAt, target: int(r.target, 1, 99, 1), schedule: normalizeSchedule(r.schedule) }))
        .sort((a, b) => (a.since < b.since ? -1 : 1))
    : [];
  // One rule per day (the last one wins)
  rules = rules.filter((r, i) => i === rules.length - 1 || rules[i + 1].since !== r.since);
  if (rules.length === 0) rules = [{ since: createdAt, target: 1, schedule: { kind: 'daily' } }];
  return {
    id: String(h.id ?? crypto.randomUUID()),
    name: String(h.name ?? 'Habit').slice(0, 60),
    emoji: String(h.emoji ?? '⭐'),
    color: migrateColor(h.color),
    createdAt,
    unit: typeof h.unit === 'string' ? h.unit.trim().slice(0, 16) : '',
    timeOfDay: TIMES.includes(h.timeOfDay as TimeOfDay) ? (h.timeOfDay as TimeOfDay) : 'anytime',
    rules,
    pauses: normalizeRanges(h.pauses),
    archivedAt: isDay(h.archivedAt) ? h.archivedAt : null,
    reminder: normalizeReminder(h.reminder),
    notifId: Number.isInteger(h.notifId) && (h.notifId as number) > 0 && (h.notifId as number) < 1e9 ? (h.notifId as number) : 0,
    snoozedUntil: typeof h.snoozedUntil === 'number' && Number.isFinite(h.snoozedUntil) ? h.snoozedUntil : null,
  };
}

/** 'HH:mm', or Habit Tracker v1's `{ enabled, time }` (reminders were removed in v1.0.5, then fixed in Tickday). */
function normalizeReminder(r: unknown): string | null {
  if (isValidTime(r)) return r;
  if (isObj(r) && r.enabled === true && isValidTime(r.time)) return r.time;
  return null;
}

/**
 * Validates and repairs anything loaded from storage or a backup file, and
 * migrates older versions (v1: `true` per done day, no schedules). Throws if it
 * isn't our data at all.
 */
export function normalizeState(raw: unknown): HabitState {
  if (!isObj(raw) || !Array.isArray(raw.habits)) throw new Error('Not a Habit Tracker backup');
  const habits = raw.habits.filter(isObj).map(normalizeHabit);
  // Duplicate ids would confuse everything else: keep the first.
  const seen = new Set<string>();
  const unique = habits.filter((h) => !seen.has(h.id) && seen.add(h.id));

  const completions: HabitState['completions'] = {};
  const notes: HabitState['notes'] = {};
  for (const h of unique) {
    const days = isObj(raw.completions) ? raw.completions[h.id] : undefined;
    if (isObj(days)) {
      const out: Record<DateKey, number> = {};
      for (const d of Object.keys(days)) {
        if (!isDay(d)) continue;
        const v = days[d];
        const n = v === true ? 1 : int(v, 0, 999, 0); // v1 stored `true`
        if (n > 0) out[d] = n;
      }
      completions[h.id] = out;
    }
    const n = isObj(raw.notes) ? raw.notes[h.id] : undefined;
    if (isObj(n)) {
      const out: Record<DateKey, string> = {};
      for (const d of Object.keys(n)) {
        const text = typeof n[d] === 'string' ? (n[d] as string).trim().slice(0, 280) : '';
        if (isDay(d) && text) out[d] = text;
      }
      if (Object.keys(out).length) notes[h.id] = out;
    }
  }

  const s = isObj(raw.settings) ? raw.settings : {};
  return {
    habits: unique,
    completions,
    notes,
    settings: {
      weekStart: s.weekStart === 0 ? 0 : 1,
      vacations: normalizeRanges(isObj(raw.settings) ? s.vacations : raw.vacations),
    },
  };
}

/** Theme / week start / accent from an old Habit Tracker save (informational: imports never change Tickday's look). */
export function legacySettings(raw: unknown): LegacyHabitSettings {
  const s = isObj(raw) && isObj(raw.settings) ? raw.settings : {};
  return {
    theme: s.theme === 'light' || s.theme === 'dark' ? s.theme : 'system',
    weekStart: s.weekStart === 0 ? 0 : 1,
    accent: normalizeAccent(s.accent),
  };
}
