import type { LocalTime } from '../core/dates';
import type { Completions, DateRange, Habit, Notes } from '../habits/lib/types';
import type { List, Task, ViewPrefs } from '../todo/model/types';

/*
 * Tickday's ONE saved document. Habits and tasks live side by side but separately;
 * settings are shared. `version` is bumped whenever the shape changes, and data/migrate.ts
 * upgrades older documents step by step (and also reads the two old apps' backups).
 */

export const DATA_VERSION = 1 as const;

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  /* ---- shared ---- */
  theme: ThemeMode;
  /** UI accent colour (hex), or null for the Classic garden look. */
  accent: string | null;
  /** 0 = Sunday, 1 = Monday */
  weekStart: 0 | 1;
  haptics: boolean;
  reduceMotion: boolean;
  /** Master switches for each kind of reminder. */
  notify: { habits: boolean; tasks: boolean };
  /* ---- tasks ---- */
  /** reminder time used for all-day tasks */
  allDayReminderTime: LocalTime;
  /** applied to new tasks that get a due date; null = off */
  defaultReminder: number | null;
  showCompletedInLists: boolean;
  viewPrefs: Record<string, ViewPrefs>;
}

/** The habit half (from the Habit Tracker). */
export interface HabitData {
  /** Includes archived habits. Array order = display order. */
  habits: Habit[];
  completions: Completions;
  notes: Notes;
  /** "Vacation mode": every habit is paused during these ranges. */
  vacations: DateRange[];
}

/** The to-do half (from Doable). */
export interface TodoData {
  lists: List[];
  tasks: Task[];
}

export interface Meta {
  createdAt: number;
  /** Next free number for notifications (tasks AND habits share it, so they never collide). */
  nextNotifId: number;
  /** The first-run welcome card was dismissed. */
  welcomeDone: boolean;
}

export interface AppData {
  version: typeof DATA_VERSION;
  settings: Settings;
  habits: HabitData;
  todo: TodoData;
  meta: Meta;
}
