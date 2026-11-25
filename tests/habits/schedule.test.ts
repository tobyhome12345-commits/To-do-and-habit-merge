import { describe, expect, it } from 'vitest';
import { goalLabel, isScheduled, ruleOn, scheduleLabel, todayInfo } from '../../src/habits/lib/schedule';
import { TODAY, days, mkHabit, mkState } from './fixtures';

describe('isScheduled', () => {
  it('handles each schedule type', () => {
    const mwf = mkHabit('a', { schedule: { kind: 'weekdays', days: [1, 3, 5] } });
    expect(['2026-11-23', '2026-11-24', '2026-11-25'].map((d) => isScheduled(mwf, d))).toEqual([true, false, true]);
    const every3 = mkHabit('b', { createdAt: '2026-11-20', schedule: { kind: 'interval', every: 3 } });
    expect(['2026-11-17', '2026-11-20', '2026-11-22', '2026-11-23'].map((d) => isScheduled(every3, d))).toEqual([true, true, false, true]);
    expect(isScheduled(mkHabit('c', { schedule: { kind: 'weekly', times: 2 } }), TODAY)).toBe(true);
  });
  it('uses the rule that applied on each day', () => {
    const h = mkHabit('v', {
      rules: [
        { since: '2026-11-01', target: 1, schedule: { kind: 'daily' } },
        { since: '2026-11-20', target: 5, schedule: { kind: 'weekdays', days: [3] } },
      ],
    });
    expect(ruleOn(h, '2026-10-20').target).toBe(1); // back-filled days use the first rule
    expect([isScheduled(h, '2026-11-17'), isScheduled(h, '2026-11-24'), isScheduled(h, '2026-11-25')]).toEqual([true, false, true]);
  });
});

describe('todayInfo', () => {
  it('sorts habits into due, done and not today', () => {
    const daily = mkHabit('d');
    const water = mkHabit('w', { target: 8 });
    const mwf = mkHabit('m', { schedule: { kind: 'weekdays', days: [1, 3, 5] } });
    const s = mkState([daily, water, mwf], { d: days(TODAY), w: days(`${TODAY}:3`) });
    expect(todayInfo(daily, s, TODAY)).toMatchObject({ kind: 'done' });
    expect(todayInfo(water, s, TODAY)).toMatchObject({ kind: 'due', count: 3, target: 8 });
    expect(todayInfo(mwf, s, TODAY)).toMatchObject({ kind: 'notToday', reason: expect.stringMatching(/^Next: /) });
  });
  it('moves a weekly habit out of the way once the week is done', () => {
    const gym = mkHabit('g', { schedule: { kind: 'weekly', times: 2 } });
    const s = mkState([gym], { g: days('2026-11-23') });
    expect(todayInfo(gym, s, TODAY)).toMatchObject({ kind: 'due', week: { done: 1, times: 2 } });
    const s2 = mkState([gym], { g: days('2026-11-23', '2026-11-21', '2026-11-22') });
    expect(todayInfo(gym, mkState([gym], { g: days('2026-11-23', '2026-11-23') }), TODAY).kind).toBe('due');
    expect(todayInfo(gym, s2, TODAY).kind).toBe('due'); // last week's check-ins don't count
    const s3 = mkState([gym], { g: { '2026-11-23': 1, '2026-11-24': 1 } });
    expect(todayInfo(gym, s3, TODAY).kind).toBe('done');
    const s4 = mkState([{ ...gym, rules: [{ since: '2026-11-01', target: 1, schedule: { kind: 'weekly', times: 1 } }] }], { g: days('2026-11-23') });
    expect(todayInfo(s4.habits[0], s4, TODAY)).toMatchObject({ kind: 'notToday', reason: '1/1 this week ✓' });
  });
  it('shows pauses and vacations', () => {
    const h = mkHabit('p', { pauses: [{ from: '2026-11-20', to: '2026-11-30' }] });
    expect(todayInfo(h, mkState([h]), TODAY)).toMatchObject({ kind: 'paused', reason: expect.stringMatching(/^Paused until/) });
    const v = mkHabit('v');
    expect(todayInfo(v, mkState([v], {}, [{ from: '2026-11-24', to: null }]), TODAY)).toMatchObject({ kind: 'paused', reason: 'Vacation mode' });
  });
});

describe('labels', () => {
  it('describes schedules and goals', () => {
    expect(scheduleLabel({ kind: 'daily' })).toBe('Every day');
    expect(scheduleLabel({ kind: 'weekdays', days: [1, 2, 3, 4, 5] })).toBe('Weekdays');
    expect(scheduleLabel({ kind: 'weekdays', days: [0, 6] })).toBe('Weekends');
    expect(scheduleLabel({ kind: 'interval', every: 2 })).toBe('Every other day');
    expect(scheduleLabel({ kind: 'interval', every: 3 })).toBe('Every 3 days');
    expect(scheduleLabel({ kind: 'weekly', times: 3 })).toBe('3× a week');
    expect(goalLabel(1, '')).toBe('Once');
    expect(goalLabel(8, 'glasses')).toBe('8 glasses');
    expect(goalLabel(3, '')).toBe('3 times');
  });
});
