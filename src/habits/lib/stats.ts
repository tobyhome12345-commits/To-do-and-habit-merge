import { addDays, addMonths, eachDay, endOfMonth, maxKey, minKey, startOfMonth, startOfWeek } from '../../core/dates';
import { habitStart, isMet, isOff, isScheduled, isWeeklyOn, quotaFor, weekCounts } from './schedule';
import type { HabitState, DateKey, Habit } from './types';

export { habitStart } from './schedule';

export type PeriodKind = 'week' | 'month';

export interface Period {
  start: DateKey;
  end: DateKey;
}

export function periodFor(kind: PeriodKind, anchor: DateKey, weekStart: 0 | 1): Period {
  if (kind === 'week') {
    const start = startOfWeek(anchor, weekStart);
    return { start, end: addDays(start, 6) };
  }
  return { start: startOfMonth(anchor), end: endOfMonth(anchor) };
}

export function shiftPeriod(kind: PeriodKind, p: Period, n: number, weekStart: 0 | 1): Period {
  if (kind === 'week') return periodFor('week', addDays(p.start, 7 * n), weekStart);
  return periodFor('month', addMonths(p.start, n), weekStart);
}

/** Habits that count in stats (archived ones are left out; their history is kept). */
export const statHabits = (state: HabitState) => state.habits.filter((h) => !h.archivedAt);

export interface HabitPeriodStats {
  /** Scheduled days met (or weekly check-ins, up to the quota). */
  done: number;
  possible: number;
  /** 0..1, or null when nothing was due yet in this period. */
  rate: number | null;
  /** True for "N times a week" habits (numbers are check-ins, not days). */
  weekly: boolean;
}

/**
 * Only scheduled, unpaused days count. Today (and this week, for weekly habits)
 * never counts against you until it's over: it only adds what's already done.
 */
export function habitPeriodStats(h: Habit, state: HabitState, p: Period, today: DateKey): HabitPeriodStats {
  const from = maxKey(p.start, habitStart(h, state.completions));
  const to = minKey(p.end, today);
  let done = 0;
  let possible = 0;
  let weekly = false;
  if (from <= to) {
    // Day-by-day schedules
    for (const d of eachDay(from, to)) {
      if (isWeeklyOn(h, d)) {
        weekly = true;
        continue;
      }
      if (isOff(h, state.settings, d) || !isScheduled(h, d)) continue;
      const met = isMet(h, state.completions, d);
      if (d < today || met) {
        possible++;
        if (met) done++;
      }
    }
    // "N times a week": each week (clipped to the period) is pro-rated for pauses and partial weeks
    if (weekly) {
      for (let ws = startOfWeek(from, state.settings.weekStart); ws <= to; ws = addDays(ws, 7)) {
        const wc = weekCounts(h, state, maxKey(ws, from), minKey(addDays(ws, 6), p.end), today);
        if (!wc.times) continue;
        const got = Math.min(wc.met, wc.times);
        done += got;
        possible += Math.max(quotaFor(wc.times, wc.elapsed), got);
      }
    }
  }
  return { done, possible, rate: possible ? done / possible : null, weekly };
}

export interface DayStat {
  date: DateKey;
  done: number;
  possible: number;
  future: boolean;
}

/**
 * Per-day totals for charts and heatmaps: only habits scheduled that day count.
 * A weekly habit only shows up on days it was done, so it never makes a day look worse.
 */
export function dailySeries(habits: Habit[], state: HabitState, p: Period, today: DateKey): DayStat[] {
  const starts = habits.map((h) => habitStart(h, state.completions));
  return eachDay(p.start, p.end).map((date) => {
    let done = 0;
    let possible = 0;
    habits.forEach((h, i) => {
      if (date < starts[i] || date > today || isOff(h, state.settings, date)) return;
      const met = isMet(h, state.completions, date);
      if (isWeeklyOn(h, date)) {
        if (met) {
          done++;
          possible++;
        }
        return;
      }
      if (!isScheduled(h, date)) return;
      possible++;
      if (met) done++;
    });
    return { date, done, possible, future: date > today };
  });
}

export interface OverallStats {
  done: number;
  possible: number;
  rate: number | null;
  perfectDays: number;
}

export function overallStats(habits: Habit[], state: HabitState, p: Period, today: DateKey, series: DayStat[]): OverallStats {
  let done = 0;
  let possible = 0;
  for (const h of habits) {
    const s = habitPeriodStats(h, state, p, today);
    done += s.done;
    possible += s.possible;
  }
  const perfectDays = series.filter((d) => !d.future && d.possible > 0 && d.done === d.possible).length;
  return { done, possible, rate: possible ? done / possible : null, perfectDays };
}
