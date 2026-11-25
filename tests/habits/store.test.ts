import { describe, expect, it } from 'vitest';
import { reducer, type HabitInput } from '../../src/habits/lib/reducer';
import { defaultState, legacySettings, normalizeState } from '../../src/habits/lib/normalize';
import { ruleOn } from '../../src/habits/lib/schedule';
import { TODAY } from './fixtures';

const input: HabitInput = { name: 'Water', emoji: '💧', color: '#3aa5f2', unit: 'glasses', timeOfDay: 'morning', target: 8, schedule: { kind: 'daily' } };
const withHabit = () => reducer(defaultState(), { type: 'addHabit', habit: input, today: '2026-11-20', id: 'w' });

describe('reducer', () => {
  it('adds a habit with its first rule', () => {
    const h = withHabit().habits[0];
    expect(h).toMatchObject({ id: 'w', unit: 'glasses', timeOfDay: 'morning', createdAt: '2026-11-20', archivedAt: null, pauses: [] });
    expect(h.rules).toEqual([{ since: '2026-11-20', target: 8, schedule: { kind: 'daily' } }]);
  });
  it('taps up and down, never below zero', () => {
    let s = withHabit();
    s = reducer(s, { type: 'tap', id: 'w', date: TODAY, delta: 1 });
    s = reducer(s, { type: 'tap', id: 'w', date: TODAY, delta: 1 });
    expect(s.completions.w[TODAY]).toBe(2);
    s = reducer(s, { type: 'tap', id: 'w', date: TODAY, delta: -1 });
    s = reducer(s, { type: 'tap', id: 'w', date: TODAY, delta: -1 });
    s = reducer(s, { type: 'tap', id: 'w', date: TODAY, delta: -1 });
    expect(s.completions.w[TODAY]).toBeUndefined();
    s = reducer(s, { type: 'setCount', id: 'w', date: TODAY, count: 8 });
    expect(s.completions.w[TODAY]).toBe(8);
  });
  it('saves, trims and clears notes', () => {
    let s = reducer(withHabit(), { type: 'setNote', id: 'w', date: TODAY, text: '  felt great  ' });
    expect(s.notes.w[TODAY]).toBe('felt great');
    s = reducer(s, { type: 'setNote', id: 'w', date: TODAY, text: ' ' });
    expect(s.notes.w[TODAY]).toBeUndefined();
  });
  it('versions goal/schedule changes instead of rewriting history', () => {
    let s = reducer(withHabit(), { type: 'updateHabit', id: 'w', patch: { name: 'H2O' }, today: TODAY });
    expect(s.habits[0].rules).toHaveLength(1); // a rename doesn't touch rules
    s = reducer(s, { type: 'updateHabit', id: 'w', patch: { target: 6, schedule: { kind: 'weekdays', days: [1, 3] } }, today: TODAY });
    expect(s.habits[0].rules.map((r) => [r.since, r.target])).toEqual([['2026-11-20', 8], [TODAY, 6]]);
    s = reducer(s, { type: 'updateHabit', id: 'w', patch: { target: 5 }, today: TODAY }); // same day: replace
    expect(s.habits[0].rules).toHaveLength(2);
    expect(ruleOn(s.habits[0], TODAY)).toEqual({ since: TODAY, target: 5, schedule: { kind: 'weekdays', days: [1, 3] } });
    expect(ruleOn(s.habits[0], '2026-11-21').target).toBe(8);
  });
  it('archives and restores without breaking the streak', () => {
    let s = reducer(withHabit(), { type: 'archive', id: 'w', today: '2026-11-21' });
    expect(s.habits[0].archivedAt).toBe('2026-11-21');
    s = reducer(s, { type: 'restore', id: 'w', today: TODAY });
    expect(s.habits[0]).toMatchObject({ archivedAt: null, pauses: [{ from: '2026-11-21', to: '2026-11-23' }] });
  });
  it('pauses and resumes one habit or everything', () => {
    let s = reducer(withHabit(), { type: 'pause', id: 'w', from: '2026-11-22', to: null });
    s = reducer(s, { type: 'pause', id: 'all', from: TODAY, to: '2026-11-30' });
    expect(s.settings.vacations).toEqual([{ from: TODAY, to: '2026-11-30' }]);
    s = reducer(s, { type: 'resume', id: 'w', today: TODAY });
    expect(s.habits[0].pauses).toEqual([{ from: '2026-11-22', to: '2026-11-23' }]);
    s = reducer(s, { type: 'resume', id: 'all', today: TODAY });
    expect(s.settings.vacations).toEqual([]); // started today, so it's simply removed
  });
  it('reorders and deletes (with notes)', () => {
    let s = withHabit();
    s = reducer(s, { type: 'addHabit', habit: { ...input, name: 'Read' }, id: 'r' });
    s = reducer(s, { type: 'addHabit', habit: { ...input, name: 'Run' }, id: 'x' });
    s = reducer(s, { type: 'reorder', id: 'x', overId: 'w' });
    expect(s.habits.map((h) => h.id)).toEqual(['x', 'w', 'r']);
    s = reducer(s, { type: 'setNote', id: 'w', date: TODAY, text: 'hi' });
    s = reducer(s, { type: 'deleteHabit', id: 'w' });
    expect(s.habits.map((h) => h.id)).toEqual(['x', 'r']);
    expect(s.notes.w).toBeUndefined();
  });
});

describe('normalizeState', () => {
  it('migrates v1 data: true → 1 and a daily rule from creation', () => {
    const s = normalizeState({
      version: 1,
      habits: [{ id: 'a', name: 'Read', emoji: '📚', color: '#8B5CF6', createdAt: '2026-01-05', reminder: { enabled: true, time: '20:00' } }],
      completions: { a: { '2026-01-05': true, '2026-01-06': true } },
      settings: { theme: 'dark', weekStart: 0 },
    });
    expect(s.habits[0]).toEqual({
      id: 'a',
      name: 'Read',
      emoji: '📚',
      color: '#a970f0',
      createdAt: '2026-01-05',
      unit: '',
      timeOfDay: 'anytime',
      rules: [{ since: '2026-01-05', target: 1, schedule: { kind: 'daily' } }],
      pauses: [],
      archivedAt: null,
      // v1's reminder (removed in Habit Tracker v1.0.5) comes back in Doable
      reminder: '20:00',
      notifId: 0,
      snoozedUntil: null,
    });
    expect(s.completions).toEqual({ a: { '2026-01-05': 1, '2026-01-06': 1 } });
    expect(s.notes).toEqual({});
    // Theme and accent are app-wide settings now; the habit half keeps weekStart + vacations.
    expect(s.settings).toEqual({ weekStart: 0, vacations: [] });
    expect(legacySettings({ settings: { theme: 'dark', weekStart: 0 } })).toEqual({ theme: 'dark', weekStart: 0, accent: null });
  });

  it('round-trips everything new through a backup', () => {
    let s = reducer(defaultState(), { type: 'addHabit', habit: { ...input, schedule: { kind: 'weekly', times: 3 } }, today: '2026-11-01', id: 'w' });
    s = reducer(s, { type: 'tap', id: 'w', date: TODAY, delta: 1 });
    s = reducer(s, { type: 'setNote', id: 'w', date: TODAY, text: 'note' });
    s = reducer(s, { type: 'pause', id: 'w', from: '2026-11-05', to: '2026-11-06' });
    s = reducer(s, { type: 'pause', id: 'all', from: '2026-12-20', to: null });
    s = reducer(s, { type: 'updateHabit', id: 'w', patch: { schedule: { kind: 'interval', every: 3 } }, today: TODAY });
    s = reducer(s, { type: 'settings', patch: { weekStart: 0 } });
    s = reducer(s, { type: 'addHabit', habit: { ...input, name: 'Old' }, id: 'o', today: '2026-11-01' });
    s = reducer(s, { type: 'archive', id: 'o', today: '2026-11-10' });
    expect(normalizeState(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  it('rejects junk and repairs bad values', () => {
    expect(() => normalizeState({ foo: 1 })).toThrow();
    expect(() => normalizeState('hello')).toThrow();
    const s = normalizeState({
      habits: [
        { id: 'x', name: 'Run', color: 'nope', createdAt: '2026-01-01', rules: [{ since: '2026-01-01', target: 500, schedule: { kind: 'weekdays', days: [9] } }], timeOfDay: 'noon' },
        { id: 'x', name: 'Duplicate' },
      ],
      completions: { x: { '2026-01-02': true, '2026-01-03': 4, bad: true, '2026-01-04': -2 }, ghost: { '2026-01-02': true } },
      settings: { theme: 'dark', weekStart: 0, accent: 'purple', vacations: [{ from: 'x' }] },
    });
    expect(s.habits).toHaveLength(1);
    expect(s.habits[0]).toMatchObject({ color: '#3dbe7e', emoji: '⭐', timeOfDay: 'anytime', rules: [{ since: '2026-01-01', target: 99, schedule: { kind: 'daily' } }] });
    expect(s.completions).toEqual({ x: { '2026-01-02': 1, '2026-01-03': 4 } });
    expect(s.settings).toEqual({ weekStart: 0, vacations: [] });
  });
});
