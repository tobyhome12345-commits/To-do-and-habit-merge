import { describe, expect, it } from 'vitest';
import { defaultData } from '../../src/data/defaults';
import { DataError, detect, migrate, normalizeAppData, upgrade } from '../../src/data/migrate';
import { DATA_VERSION } from '../../src/data/types';
import { doableBackup, habitBackupV1, habitBackupV2 } from './fixtures';

describe('Tickday document', () => {
  it('a fresh document survives save → load unchanged', () => {
    const d = defaultData(1000);
    expect(normalizeAppData(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(d.version).toBe(DATA_VERSION);
    expect(d.todo.tasks).toEqual([]); // no sample tasks: Tick's welcome card teaches the app
    expect(d.todo.lists.map((l) => l.name)).toEqual(['Inbox', 'Home', 'School', 'Personal']);
  });

  it('upgrades step by step and refuses files from a newer Tickday', () => {
    expect(upgrade({ version: 0, a: 1 })).toEqual({ version: DATA_VERSION, a: 1 });
    expect(() => upgrade({ version: DATA_VERSION + 1 })).toThrow(/newer version of Tickday/);
  });

  it('repairs bad settings and keeps the two halves separate', () => {
    const raw = JSON.parse(JSON.stringify(defaultData()));
    raw.settings = { theme: 'neon', accent: 'pink', weekStart: 5, notify: { habits: false }, defaultReminder: -4 };
    raw.todo.tasks = 'nope';
    const d = normalizeAppData(raw);
    expect(d.settings).toMatchObject({ theme: 'system', accent: null, weekStart: 1, notify: { habits: false, tasks: true }, defaultReminder: 0 });
    expect(d.todo.lists.length).toBeGreaterThan(0); // broken task half falls back to a fresh one
    expect(d.habits.habits).toEqual([]);
  });
});

describe('recognising backup files', () => {
  it('reads a Doable backup as the task half only', () => {
    const r = detect(doableBackup);
    expect(r.kind).toBe('doable');
    expect(r.habits).toBeUndefined();
    expect(r.todo!.tasks.map((t) => t.id)).toEqual(['d1', 'd2', 'd3']);
    expect(r.todo!.tasks[0].subtasks).toEqual([{ id: 's1', title: 'Buy clay', done: true }]);
    expect(r.todoSettings).toMatchObject({ allDayReminderTime: '08:00', defaultReminder: 30, showCompletedInLists: true });
    expect(r.todoSettings!.viewPrefs.today.sort).toBe('priority');
  });

  it('reads bare Doable data too', () => {
    expect(detect(doableBackup.data).kind).toBe('doable');
  });

  it('reads a Habit Tracker v2 backup as the habit half only', () => {
    const r = detect(habitBackupV2);
    expect(r.kind).toBe('habit-tracker');
    expect(r.todo).toBeUndefined();
    expect(r.habits!.habits.map((h) => h.name)).toEqual(['Drink water', 'Workout']);
    expect(r.habits!.habits[1].rules[0].schedule).toEqual({ kind: 'weekly', times: 3 });
    expect(r.habits!.completions.h1['2026-11-22']).toBe(8);
    expect(r.habits!.notes.h1['2026-11-23']).toBe('hot day');
    expect(r.habits!.vacations).toEqual([{ from: '2026-12-20', to: '2026-12-27' }]);
  });

  it('reads a Habit Tracker v1 backup, bringing its reminder back', () => {
    const r = detect(habitBackupV1);
    expect(r.kind).toBe('habit-tracker');
    expect(r.habits!.habits[0]).toMatchObject({ name: 'Read', color: '#a970f0', reminder: '20:30', rules: [{ since: '2026-11-10', target: 1, schedule: { kind: 'daily' } }] });
    expect(r.habits!.completions.old).toEqual({ '2026-11-10': 1, '2026-11-11': 1 });
  });

  it('repairs bad Doable fields instead of crashing (from Doable’s own tests)', () => {
    const r = detect({
      schemaVersion: 1,
      lists: [{ id: 'x', name: 'X', color: 'red' }],
      tasks: [
        { id: 'a', title: 'A', listId: 'missing', dueDate: '2026-02-30', priority: 9, notifId: 5 },
        { id: 'b', title: 'B', notifId: 5 },
        { id: 'a', title: 'dupe' },
        { nope: true },
      ],
    });
    expect(r.todo!.lists.map((l) => l.id)).toEqual(['inbox', 'x']);
    expect(r.todo!.lists[1].color).toBe('#6c5ce7');
    expect(r.todo!.tasks).toHaveLength(2);
    expect(r.todo!.tasks[0]).toMatchObject({ listId: 'inbox', dueDate: null, priority: 0 });
  });

  it('rejects junk with friendly messages', () => {
    expect(() => detect('hello')).toThrow(DataError);
    expect(() => detect({ hello: 1 })).toThrow(/Tickday, Habit Tracker or Doable/);
    expect(() => detect({ app: 'Doable', data: { schemaVersion: 99, tasks: [], lists: [] } })).toThrow(/newer version/);
    expect(() => detect({ app: 'Tickday', data: { version: 99, habits: {}, todo: {} } })).toThrow(/newer version of Tickday/);
  });

  it('loading old single-app data wraps it into a full document with unique notification ids', () => {
    const d = migrate(doableBackup);
    expect(d.version).toBe(DATA_VERSION);
    expect(d.todo.tasks).toHaveLength(3);
    expect(d.habits.habits).toEqual([]);
    expect(new Set(d.todo.tasks.map((t) => t.notifId)).size).toBe(3);
    expect(d.meta.nextNotifId).toBeGreaterThan(3);
  });
});
