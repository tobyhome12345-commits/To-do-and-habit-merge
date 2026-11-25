import { describe, expect, it } from 'vitest';
import { bestStreak, currentStreak, streakDays, totalDone } from '../../src/habits/lib/streaks';
import { TODAY, days, mkHabit, mkState } from './fixtures';

const streakOf = (h: ReturnType<typeof mkHabit>, c: Record<string, number>, vacations = []) =>
  currentStreak(h, mkState([h], { [h.id]: c }, vacations), TODAY);

describe('daily streaks', () => {
  const h = mkHabit('a');
  it('is 0 with no data', () => {
    expect(streakOf(h, {}).count).toBe(0);
    expect(bestStreak(h, mkState([h]), TODAY)).toBe(0);
  });
  it('counts back from today when today is done', () => {
    expect(streakOf(h, days('2026-11-22', '2026-11-23', '2026-11-24'))).toEqual({ count: 3, unit: 'day', since: '2026-11-22' });
  });
  it('keeps the streak alive while today is still open', () => {
    expect(streakOf(h, days('2026-11-22', '2026-11-23')).count).toBe(2);
  });
  it('breaks after a fully missed day', () => {
    expect(streakOf(h, days('2026-11-21', '2026-11-22')).count).toBe(0);
  });
  it('works across a month boundary', () => {
    const m = mkHabit('m', { createdAt: '2026-10-01' });
    expect(currentStreak(m, mkState([m], { m: days('2026-10-30', '2026-10-31', '2026-11-01') }), '2026-11-01').count).toBe(3);
  });
  it('finds the best streak and ignores future days', () => {
    const c = days('2026-11-02', '2026-11-03', '2026-11-04', '2026-11-06', '2026-11-07', '2026-11-25', '2026-11-26');
    expect(bestStreak(h, mkState([h], { a: c }), TODAY)).toBe(3);
    expect(totalDone(h, mkState([h], { a: days('2026-11-24', '2026-11-25') }), TODAY)).toBe(1);
  });
});

describe('schedules never break streaks on skipped days', () => {
  it('Mon/Wed/Fri: Tue, Thu and weekends are skipped', () => {
    const h = mkHabit('mwf', { schedule: { kind: 'weekdays', days: [1, 3, 5] } });
    // Mon 16, Wed 18, Fri 20, Mon 23 — today (Tue) isn't scheduled
    expect(streakOf(h, days('2026-11-16', '2026-11-18', '2026-11-20', '2026-11-23'))).toMatchObject({ count: 4, unit: 'time' });
    // Missing Fri 20 breaks it
    expect(streakOf(h, days('2026-11-16', '2026-11-18', '2026-11-23')).count).toBe(1);
  });
  it('every 3 days runs on a fixed rhythm from when it was set', () => {
    const h = mkHabit('i3', { createdAt: '2026-11-12', schedule: { kind: 'interval', every: 3 } });
    // Due 12, 15, 18, 21, 24 (today, still open)
    expect(streakOf(h, days('2026-11-15', '2026-11-18', '2026-11-21')).count).toBe(3);
    // Doing it a day late (19 instead of 18) is a bonus day, not the scheduled one
    expect(streakOf(h, days('2026-11-15', '2026-11-19', '2026-11-21')).count).toBe(1);
  });
  it('paused days and vacations are skipped', () => {
    const c = days('2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-22', '2026-11-23');
    const paused = mkHabit('p', { pauses: [{ from: '2026-11-19', to: '2026-11-21' }] });
    expect(streakOf(paused, c).count).toBe(6);
    expect(streakOf(mkHabit('v'), c, [{ from: '2026-11-19', to: '2026-11-21' }] as never).count).toBe(6);
    expect(streakOf(mkHabit('n'), c).count).toBe(2); // without the pause it broke
  });
});

describe('counted habits', () => {
  const h = mkHabit('water', { target: 8 });
  it('only counts days that reached the target', () => {
    expect(streakOf(h, days('2026-11-22:8', '2026-11-23:9')).count).toBe(2);
    expect(streakOf(h, days('2026-11-22:8', '2026-11-23:5')).count).toBe(0);
  });
  it('raising the target keeps old days judged by the old target', () => {
    const v = mkHabit('v', { rules: [{ since: '2026-11-01', target: 1, schedule: { kind: 'daily' } }, { since: '2026-11-24', target: 8, schedule: { kind: 'daily' } }] });
    const s = mkState([v], { v: days('2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24:3') });
    expect(currentStreak(v, s, TODAY).count).toBe(3); // today 3/8 is still open
    expect(totalDone(v, s, TODAY)).toBe(3);
  });
});

describe('N times a week', () => {
  const h = mkHabit('gym', { createdAt: '2026-11-05', schedule: { kind: 'weekly', times: 3 } });
  it('counts met weeks; the current week never breaks it', () => {
    // First week (Thu 5 → Sun 8) only needs 2; then 3 + 3; this week 1 so far
    const c = days('2026-11-06', '2026-11-08', '2026-11-09', '2026-11-11', '2026-11-13', '2026-11-16', '2026-11-17', '2026-11-20', '2026-11-23');
    const s = currentStreak(h, mkState([h], { gym: c }), TODAY);
    expect(s).toEqual({ count: 3, unit: 'week', since: '2026-11-05' });
    expect(streakDays(s, TODAY)).toBe(20);
  });
  it('breaks on a missed week, but a fully paused week is skipped', () => {
    const c = days('2026-11-09', '2026-11-11', '2026-11-13', '2026-11-23', '2026-11-24', '2026-11-25');
    expect(streakOf(h, c).count).toBe(0);
    const paused = { ...h, pauses: [{ from: '2026-11-16', to: '2026-11-22' }] };
    // weeks: 5–8 (missed, needs 2) · 9–15 ✓ · 16–22 paused · 23– (3 incl. a future day → only 2 by today)
    expect(streakOf(paused, c).count).toBe(1);
  });
});
