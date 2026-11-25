/** A local calendar day formatted as 'YYYY-MM-DD'. */
export type { DateKey } from '../../core/dates';
import type { DateKey } from '../../core/dates';

/** When a habit is due. */
export type Schedule =
  | { kind: 'daily' }
  /** Specific weekdays: 0 = Sunday … 6 = Saturday (at least one). */
  | { kind: 'weekdays'; days: number[] }
  /** Every N days on a fixed rhythm, counted from the rule's `since` day. */
  | { kind: 'interval'; every: number }
  /** N times per week, on any days. */
  | { kind: 'weekly'; times: number };

/**
 * Goal + schedule from `since` onwards. Changing either adds a new rule, so old
 * days are always judged by the rule that applied back then.
 */
export interface HabitRule {
  since: DateKey;
  /** Taps needed for the day to count as done (1 = a simple check). */
  target: number;
  schedule: Schedule;
}

/** Inclusive range of days; `to: null` means "until resumed". */
export interface DateRange {
  from: DateKey;
  to: DateKey | null;
}

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'anytime';

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: DateKey;
  /** Optional label for counted habits ("glasses", "pages"…). */
  unit: string;
  timeOfDay: TimeOfDay;
  /** Sorted by `since`, never empty. */
  rules: HabitRule[];
  pauses: DateRange[];
  /** Hidden from Today/Calendar/Stats from this day on (history is kept). */
  archivedAt: DateKey | null;
  /** Daily reminder time 'HH:mm' on days the habit is due, or null for none. */
  reminder: string | null;
  /** Stable number for this habit's OS notifications (shared allocator with tasks, see data/notifIds.ts). */
  notifId: number;
  /** epoch ms: today's reminder was snoozed until then (from the notification's Snooze button). */
  snoozedUntil: number | null;
}

/**
 * The habit code's view of settings. In Tickday, weekStart is shared with tasks (data.settings)
 * and vacations live in the habits slice; data/habitView.ts joins them for the habit code.
 */
export interface Settings {
  /** 0 = Sunday, 1 = Monday */
  weekStart: 0 | 1;
  /** "Vacation mode": every habit is paused during these ranges. */
  vacations: DateRange[];
}

/** completions[habitId][dateKey] = taps that day (only days with > 0 are stored). */
export type Completions = Record<string, Record<DateKey, number>>;

/** notes[habitId][dateKey] = a short note for that day. */
export type Notes = Record<string, Record<DateKey, string>>;

/** Everything the habit code works on (schedule, streaks, stats, mood, the reducer). */
export interface HabitState {
  /** Includes archived habits. Array order = display order. */
  habits: Habit[];
  completions: Completions;
  notes: Notes;
  settings: Settings;
}
