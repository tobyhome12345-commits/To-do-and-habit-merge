import { describe, expect, it } from 'vitest';
import { dailySeries, habitPeriodStats, overallStats, periodFor, shiftPeriod } from '../../src/habits/lib/stats';
import { TODAY, days, mkHabit, mkState } from './fixtures';

const month = periodFor('month', TODAY, 1);
const week = periodFor('week', TODAY, 1);

describe('periods', () => {
  it('builds week and month periods', () => {
    expect(week).toEqual({ start: '2026-11-23', end: '2026-11-29' });
    expect(month).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(shiftPeriod('month', month, -1, 1)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(shiftPeriod('week', week, 1, 1)).toEqual({ start: '2026-11-30', end: '2026-12-06' });
  });
});

describe('habitPeriodStats', () => {
  it('daily: counts days since creation; today only once it’s done', () => {
    const h = mkHabit('a', { createdAt: '2026-11-20' });
    expect(habitPeriodStats(h, mkState([h], { a: days('2026-11-20', '2026-11-22', '2026-11-24') }), month, TODAY)).toMatchObject({ done: 3, possible: 5 });
    expect(habitPeriodStats(h, mkState([h], { a: days('2026-11-20', '2026-11-22') }), month, TODAY)).toMatchObject({ done: 2, possible: 4 });
  });
  it('counts back-filled days before creation and returns null before the habit existed', () => {
    const h = mkHabit('a', { createdAt: '2026-11-24' });
    expect(habitPeriodStats(h, mkState([h], { a: days('2026-11-22', '2026-11-24') }), month, TODAY)).toMatchObject({ done: 2, possible: 3 });
    expect(habitPeriodStats(h, mkState([h]), periodFor('month', '2026-10-05', 1), TODAY).rate).toBeNull();
  });
  it('specific weekdays: only scheduled days count', () => {
    const h = mkHabit('mwf', { createdAt: '2026-11-02', schedule: { kind: 'weekdays', days: [1, 3, 5] } });
    const all = ['02', '04', '06', '09', '11', '13', '16', '18', '20', '23'].map((d) => `2026-11-${d}`);
    const c = days(...all.filter((d) => d !== '2026-11-11'), '2026-11-07'); // a Saturday bonus doesn't count
    expect(habitPeriodStats(h, mkState([h], { mwf: c }), month, TODAY)).toMatchObject({ done: 9, possible: 10 });
  });
  it('counted habits need the target', () => {
    const h = mkHabit('w', { createdAt: '2026-11-21', target: 8 });
    expect(habitPeriodStats(h, mkState([h], { w: days('2026-11-21:8', '2026-11-22:3', '2026-11-23:12') }), month, TODAY)).toMatchObject({ done: 2, possible: 3 });
  });
  it('paused days are left out', () => {
    const h = mkHabit('p', { createdAt: '2026-11-20', pauses: [{ from: '2026-11-21', to: '2026-11-22' }] });
    expect(habitPeriodStats(h, mkState([h], { p: days('2026-11-20', '2026-11-23') }), month, TODAY)).toMatchObject({ done: 2, possible: 2 });
  });
  it('weekly: full past weeks need the quota, this week only counts its pace', () => {
    const h = mkHabit('g', { createdAt: '2026-11-16', schedule: { kind: 'weekly', times: 3 } });
    const s = mkState([h], { g: days('2026-11-16', '2026-11-18', '2026-11-23') });
    expect(habitPeriodStats(h, s, periodFor('week', '2026-11-16', 1), TODAY)).toMatchObject({ done: 2, possible: 3, weekly: true });
    // This week: Monday done; by Tuesday the pace asks for 1
    expect(habitPeriodStats(h, s, week, TODAY)).toMatchObject({ done: 1, possible: 1 });
  });
});

describe('daily series & overall', () => {
  it('only counts habits scheduled that day; weekly habits only on days they were done', () => {
    const daily = mkHabit('a', { createdAt: '2026-11-01' });
    const mwf = mkHabit('b', { createdAt: '2026-11-01', schedule: { kind: 'weekdays', days: [1, 3, 5] } });
    const gym = mkHabit('c', { createdAt: '2026-11-01', schedule: { kind: 'weekly', times: 2 } });
    const s = mkState([daily, mwf, gym], { a: days('2026-11-23', '2026-11-24'), b: days('2026-11-23'), c: days('2026-11-24') });
    const series = dailySeries(s.habits, s, week, TODAY);
    expect(series.slice(0, 3).map((d) => [d.done, d.possible, d.future])).toEqual([
      [2, 2, false], // Mon: daily + MWF
      [2, 2, false], // Tue: daily + gym (done)
      [0, 0, true],
    ]);
    expect(overallStats(s.habits, s, week, TODAY, series)).toMatchObject({ perfectDays: 2 });
  });
});
