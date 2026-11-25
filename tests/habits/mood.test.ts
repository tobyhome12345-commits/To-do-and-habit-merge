import { describe, expect, it } from 'vitest';
import { dayContext, isMilestone, tickLevel, tickMessage, tickMood, type DayContext } from '../../src/mascot/mood';
import { tickStage } from '../../src/mascot/tick';
import { days, mkHabit, mkState } from './fixtures';
import type { HabitState } from '../../src/habits/lib/types';

const today = '2026-11-24';
const ctx = (done: number, total: number, extra: Partial<DayContext> = {}): DayContext => ({
  done,
  total,
  hour: 10,
  today,
  atRisk: 0,
  atRiskName: '',
  milestone: 0,
  resting: false,
  live: total,
  ...extra,
});

function stateWith(list: Record<string, string[]>): HabitState {
  return mkState(
    Object.keys(list).map((id) => mkHabit(id)),
    Object.fromEntries(Object.entries(list).map(([id, ds]) => [id, days(...ds)])),
  );
}

describe('tickMood', () => {
  it('waves hello with no habits and celebrates a perfect day', () => {
    expect(tickMood(ctx(0, 0))).toBe('happy');
    expect(tickMood(ctx(3, 3, { hour: 23 }))).toBe('celebrate');
  });
  it('is sleepy until the first tick, then happy', () => {
    expect(tickMood(ctx(0, 3))).toBe('sleepy');
    expect(tickMood(ctx(1, 3))).toBe('happy');
  });
  it('cheers you on when a streak is at risk in the evening', () => {
    expect(tickMood(ctx(1, 3, { atRisk: 5, hour: 19 }))).toBe('encourage');
    expect(tickMood(ctx(0, 3, { atRisk: 5, hour: 20 }))).toBe('encourage');
    expect(tickMood(ctx(1, 3, { atRisk: 5, hour: 10 }))).toBe('happy'); // plenty of time left
    expect(tickMood(ctx(1, 3, { atRisk: 1, hour: 21 }))).toBe('happy'); // not much of a streak yet
  });
  it('is proud on a milestone day', () => {
    expect(tickMood(ctx(1, 3, { milestone: 7 }))).toBe('proud');
    expect(tickMood(ctx(3, 3, { milestone: 7 }))).toBe('celebrate');
  });
  it('keeps the same message all day and fills in the details', () => {
    const c = ctx(1, 4);
    expect(tickMessage(c, 'happy')).toBe(tickMessage({ ...c }, 'happy'));
    expect(tickMessage(c, 'happy')).toMatch(/3/);
    expect(tickMessage(ctx(1, 3, { milestone: 30 }), 'proud')).toMatch(/30/);
  });
});

describe('dayContext', () => {
  it('finds the streak at risk and today’s milestone', () => {
    const s = stateWith({
      a: ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23'], // 4-day streak, not done today
      b: ['2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24'], // hits 7 today
    });
    expect(dayContext(s, today, 9)).toMatchObject({ done: 1, total: 2, atRisk: 4, atRiskName: 'a', milestone: 7 });
  });
  it('counts only habits due today', () => {
    const s = mkState([mkHabit('a'), mkHabit('b', { schedule: { kind: 'weekdays', days: [3] } })], { a: days(today) });
    expect(dayContext(s, today, 9)).toMatchObject({ done: 1, total: 1, live: 2 });
  });
  it('rests in vacation mode', () => {
    const s = mkState([mkHabit('a')], {}, [{ from: today, to: null }]);
    const c = dayContext(s, today, 9);
    expect(c.resting).toBe(true);
    expect(tickMessage(c, tickMood(c))).toMatch(/streaks/i);
  });
  it('has nothing at risk when the streaks are already done today', () => {
    const s = stateWith({ a: ['2026-11-22', '2026-11-23', '2026-11-24'] });
    expect(dayContext(s, today, 20)).toMatchObject({ atRisk: 0, milestone: 3 });
  });
});

describe('levels & milestones', () => {
  it('maps streaks to levels', () => {
    expect([0, 2, 3, 6, 7, 13, 14, 29, 30, 400].map(tickStage)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 4, 4]);
  });
  it('uses the best current streak and knows the next level', () => {
    const s = stateWith({ a: ['2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24'], b: ['2026-11-24'] });
    expect(tickLevel(s, today)).toEqual({ stage: 1, best: 5, next: 7 });
  });
  it('knows milestone days', () => {
    expect([3, 7, 8, 30, 100, 101].map(isMilestone)).toEqual([true, true, false, true, true, false]);
  });
});
