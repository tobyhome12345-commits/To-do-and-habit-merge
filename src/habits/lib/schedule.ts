/**
 * The schedule engine: the only place that knows how goals, schedules, pauses
 * and archiving decide whether a day "counts". Today, streaks, Calendar, Stats
 * and Tick all ask these functions, so they always agree.
 */
import { addDays, diffDays, eachDay, formatDate, maxKey, minKey, startOfWeek, weekday } from '../../core/dates';
import type { HabitState, Completions, DateKey, DateRange, Habit, HabitRule, Schedule, Settings, TimeOfDay } from './types';

export const DAILY: Schedule = { kind: 'daily' };

/** The rule in force on day `d` (days before the first rule use the first rule). */
export function ruleOn(h: Habit, d: DateKey): HabitRule {
  let r = h.rules[0];
  for (const x of h.rules) {
    if (x.since <= d) r = x;
    else break;
  }
  return r;
}

export function countOn(c: Completions, id: string, d: DateKey): number {
  return c[id]?.[d] ?? 0;
}

/** Done for the day: taps reached that day's target. */
export function isMet(h: Habit, c: Completions, d: DateKey): boolean {
  const n = countOn(c, h.id, d);
  return n > 0 && n >= ruleOn(h, d).target;
}

const inRange = (r: DateRange, d: DateKey) => d >= r.from && (r.to === null || d <= r.to);

/** The pause or vacation covering day `d`, if any. */
export function pauseOn(h: Habit, s: Settings, d: DateKey): { range: DateRange; vacation: boolean } | null {
  const v = s.vacations.find((r) => inRange(r, d));
  if (v) return { range: v, vacation: true };
  const p = h.pauses.find((r) => inRange(r, d));
  return p ? { range: p, vacation: false } : null;
}

/** Paused, on vacation or archived: the day never counts for or against the habit. */
export function isOff(h: Habit, s: Settings, d: DateKey): boolean {
  if (h.archivedAt && d >= h.archivedAt) return true;
  return pauseOn(h, s, d) !== null;
}

/** First day the habit counts from: when it was created, or earlier if days were back-filled. */
export function habitStart(h: Habit, c: Completions): DateKey {
  let start = h.createdAt;
  for (const d of Object.keys(c[h.id] ?? {})) if (d < start) start = d;
  return start;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

/** Whether the schedule asks for the habit on day `d` (weekly habits: every day is allowed). */
export function isScheduled(h: Habit, d: DateKey): boolean {
  const r = ruleOn(h, d);
  const s = r.schedule;
  switch (s.kind) {
    case 'daily':
    case 'weekly':
      return true;
    case 'weekdays':
      return s.days.includes(weekday(d));
    case 'interval':
      return mod(diffDays(r.since, d), s.every) === 0;
  }
}

export const isWeeklyOn = (h: Habit, d: DateKey) => ruleOn(h, d).schedule.kind === 'weekly';

/** `n` times a week, pro-rated for a week with only `eligible` usable days. */
export function quotaFor(times: number, eligible: number): number {
  if (eligible <= 0) return 0;
  return Math.min(times, eligible, Math.ceil((times * eligible) / 7));
}

export interface WeekCounts {
  /** Days in the segment that were met (up to today). */
  met: number;
  /** Usable days in the segment (started, not paused, weekly rule), including future ones. */
  eligible: number;
  /** Usable days already behind us (plus today if it's already done). */
  elapsed: number;
  times: number;
}

/** Weekly-quota bookkeeping for days `lo`..`hi` (inside one week). */
export function weekCounts(h: Habit, state: HabitState, lo: DateKey, hi: DateKey, today: DateKey): WeekCounts {
  const start = habitStart(h, state.completions);
  let met = 0;
  let eligible = 0;
  let elapsed = 0;
  let times = 0;
  for (const d of eachDay(maxKey(lo, start), hi)) {
    const r = ruleOn(h, d);
    if (r.schedule.kind !== 'weekly' || isOff(h, state.settings, d)) continue;
    times = r.schedule.times;
    eligible++;
    const done = d <= today && isMet(h, state.completions, d);
    if (done) met++;
    if (d < today || (d === today && done)) elapsed++;
  }
  return { met, eligible, elapsed, times };
}

export function weekOf(d: DateKey, weekStart: 0 | 1): { start: DateKey; end: DateKey } {
  const start = startOfWeek(d, weekStart);
  return { start, end: addDays(start, 6) };
}

/** This week's progress for a weekly habit: check-ins so far and how many are needed. */
export function weekProgress(h: Habit, state: HabitState, today: DateKey): { done: number; times: number } {
  const w = weekOf(today, state.settings.weekStart);
  const wc = weekCounts(h, state, w.start, w.end, today);
  return { done: wc.met, times: quotaFor(wc.times, wc.eligible) };
}

/** A unit of a streak: one scheduled day, or one week for "N times a week" habits. */
export interface Slot {
  from: DateKey;
  to: DateKey;
  met: boolean;
  /** Still in progress (today / this week) and not met yet: neither counts nor breaks. */
  pending: boolean;
}

/** Every streak slot from the habit's start to today, oldest first. */
export function slots(h: Habit, state: HabitState, today: DateKey): Slot[] {
  const out: Slot[] = [];
  const start = habitStart(h, state.completions);
  const { weekStart } = state.settings;
  let d = start;
  while (d <= today) {
    if (isWeeklyOn(h, d)) {
      const w = weekOf(d, weekStart);
      const wc = weekCounts(h, state, d, w.end, today);
      const required = quotaFor(wc.times, wc.eligible);
      if (required > 0) {
        const met = wc.met >= required;
        out.push({ from: d, to: w.end, met, pending: !met && w.end >= today });
      }
      d = addDays(w.end, 1);
      continue;
    }
    if (!isOff(h, state.settings, d) && isScheduled(h, d)) {
      const met = isMet(h, state.completions, d);
      out.push({ from: d, to: d, met, pending: !met && d === today });
    }
    d = addDays(d, 1);
  }
  return out;
}

/** Ignore check-ins outside schedules: a helper for "is there anything to show yet". */
export function hasHistory(h: Habit, c: Completions): boolean {
  return Object.keys(c[h.id] ?? {}).length > 0;
}

/** Next day (after `from`) the habit is due, within ~2 months. */
export function nextDue(h: Habit, s: Settings, from: DateKey): DateKey | null {
  for (let i = 1; i <= 62; i++) {
    const d = addDays(from, i);
    if (!isOff(h, s, d) && isScheduled(h, d)) return d;
  }
  return null;
}

export type TodayKind = 'due' | 'done' | 'notToday' | 'paused';

export interface TodayInfo {
  kind: TodayKind;
  count: number;
  target: number;
  /** Shown under the name on "Not today" cards. */
  reason: string;
  /** Weekly habits: this week's progress. */
  week: { done: number; times: number } | null;
}

function nextLabel(next: DateKey | null, today: DateKey): string {
  if (!next) return 'Not scheduled';
  const n = diffDays(today, next);
  if (n === 1) return 'Next: tomorrow';
  if (n <= 6) return `Next: ${formatDate(next, { weekday: 'short' })}`;
  return `Next: ${formatDate(next, { month: 'short', day: 'numeric' })}`;
}

/** Where a habit belongs on the Today screen and why. */
export function todayInfo(h: Habit, state: HabitState, today: DateKey): TodayInfo {
  const rule = ruleOn(h, today);
  const count = countOn(state.completions, h.id, today);
  const target = rule.target;
  const met = count >= target && count > 0;
  const base = { count, target, week: null, reason: '' };

  const pause = pauseOn(h, state.settings, today);
  if (pause) {
    const until = pause.range.to ? ` until ${formatDate(pause.range.to, { month: 'short', day: 'numeric' })}` : '';
    return { ...base, kind: 'paused', reason: pause.vacation ? `Vacation mode${until}` : `Paused${until}` };
  }
  if (rule.schedule.kind === 'weekly') {
    const week = weekProgress(h, state, today);
    if (met) return { ...base, week, kind: 'done' };
    if (week.done >= week.times) return { ...base, week, kind: 'notToday', reason: `${week.done}/${rule.schedule.times} this week ✓` };
    return { ...base, week, kind: 'due' };
  }
  if (isScheduled(h, today)) return { ...base, kind: met ? 'done' : 'due' };
  return { ...base, kind: 'notToday', reason: met ? 'Bonus day ✓' : nextLabel(nextDue(h, state.settings, today), today) };
}

/** Habits that aren't archived (archived ones stay in the data for history). */
export function liveHabits(state: HabitState, today: DateKey): Habit[] {
  return state.habits.filter((h) => !h.archivedAt || h.archivedAt > today);
}

// ---------- Labels ----------

export const TIME_OPTIONS: { value: TimeOfDay; label: string; icon: string }[] = [
  { value: 'morning', label: 'Morning', icon: '🌅' },
  { value: 'afternoon', label: 'Afternoon', icon: '☀️' },
  { value: 'evening', label: 'Evening', icon: '🌙' },
  { value: 'anytime', label: 'Anytime', icon: '✨' },
];

const DAY_NAMES = (weekStart: 0 | 1) => Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);

export function scheduleLabel(s: Schedule, weekStart: 0 | 1 = 1): string {
  switch (s.kind) {
    case 'daily':
      return 'Every day';
    case 'weekdays': {
      if (s.days.length === 7) return 'Every day';
      const set = new Set(s.days);
      if (set.size === 5 && ![0, 6].some((d) => set.has(d))) return 'Weekdays';
      if (set.size === 2 && set.has(0) && set.has(6)) return 'Weekends';
      return DAY_NAMES(weekStart)
        .filter((d) => set.has(d))
        .map((d) => formatDate(addDays('2023-01-01', d), { weekday: 'short' }))
        .join(' · ');
    }
    case 'interval':
      return s.every === 2 ? 'Every other day' : `Every ${s.every} days`;
    case 'weekly':
      return s.times === 1 ? 'Once a week' : `${s.times}× a week`;
  }
}

export function goalLabel(target: number, unit: string): string {
  if (target <= 1 && !unit) return 'Once';
  return `${target} ${unit || (target === 1 ? 'time' : 'times')}`;
}

export function sameSchedule(a: Schedule, b: Schedule): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'weekdays' && b.kind === 'weekdays') return a.days.join() === b.days.join();
  if (a.kind === 'interval' && b.kind === 'interval') return a.every === b.every;
  if (a.kind === 'weekly' && b.kind === 'weekly') return a.times === b.times;
  return true;
}

/** Days `from`..`to` clipped to the habit's lifetime. */
export function clip(h: Habit, c: Completions, from: DateKey, to: DateKey): [DateKey, DateKey] {
  return [maxKey(from, habitStart(h, c)), minKey(to, h.archivedAt ? addDays(h.archivedAt, -1) : to)];
}
