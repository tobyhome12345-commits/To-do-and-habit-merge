import { diffDays } from '../../core/dates';
import { ruleOn, slots, type Slot } from './schedule';
import type { HabitState, DateKey, Habit } from './types';

/** What one streak step means for this habit's current schedule. */
export type StreakUnit = 'day' | 'time' | 'week';

export interface Streak {
  count: number;
  unit: StreakUnit;
  /** First day of the run (null when there's no streak). */
  since: DateKey | null;
}

export function streakUnit(h: Habit, today: DateKey): StreakUnit {
  const k = ruleOn(h, today).schedule.kind;
  return k === 'daily' ? 'day' : k === 'weekly' ? 'week' : 'time';
}

/**
 * Current streak: consecutive met slots (scheduled days, or weeks for "N times a
 * week" habits), counting back from today. Unscheduled and paused days aren't
 * slots, so they never break a streak, and today/this week only breaks it once
 * it's over.
 */
export function currentStreak(h: Habit, state: HabitState, today: DateKey, list: Slot[] = slots(h, state, today)): Streak {
  let count = 0;
  let since: DateKey | null = null;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    if (s.pending) continue;
    if (!s.met) break;
    count++;
    since = s.from;
  }
  return { count, unit: streakUnit(h, today), since };
}

/** Longest run of met slots ever. */
export function bestStreak(h: Habit, state: HabitState, today: DateKey, list: Slot[] = slots(h, state, today)): number {
  let best = 0;
  let run = 0;
  for (const s of list) {
    if (s.pending) continue;
    run = s.met ? run + 1 : 0;
    if (run > best) best = run;
  }
  return best;
}

/** How long a streak has been going in calendar days (levels Tick up fairly for every schedule). */
export function streakDays(s: Streak, today: DateKey): number {
  if (!s.count || !s.since) return 0;
  if (s.unit === 'day') return s.count;
  return diffDays(s.since, today) + 1;
}

/** Days with the habit done (target reached), up to today. */
export function totalDone(h: Habit, state: HabitState, today: DateKey): number {
  const days = state.completions[h.id] ?? {};
  let n = 0;
  for (const d of Object.keys(days)) {
    if (d > today) continue;
    if (days[d] >= ruleOn(h, d).target) n++;
  }
  return n;
}

export function streakLabel(n: number, unit: StreakUnit): string {
  if (unit === 'day') return `${n} day${n === 1 ? '' : 's'}`;
  if (unit === 'week') return `${n} week${n === 1 ? '' : 's'}`;
  return `${n} in a row`;
}
