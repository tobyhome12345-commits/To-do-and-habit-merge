import { describe, expect, it } from 'vitest';
import { defaultData } from '../../src/data/defaults';
import { applyImport, exportJSON, mergeHabits, mergeTodo, parseBackup, resetData } from '../../src/data/backup';
import { blankTask } from '../../src/todo/model/data';
import { applyHabitAction } from '../../src/data/store';
import type { AppData } from '../../src/data/types';
import { doableBackup, habitBackupV1, habitBackupV2 } from './fixtures';

const input = { name: 'Meditate', emoji: '🧘', color: '#a970f0', unit: '', timeOfDay: 'morning' as const, target: 1, schedule: { kind: 'daily' as const } };

function sample(): AppData {
  let d = defaultData(1000);
  d = applyHabitAction(d, { type: 'addHabit', habit: input, id: 'm', today: '2026-11-20' });
  d = applyHabitAction(d, { type: 'tap', id: 'm', date: '2026-11-21', delta: 1 });
  d = { ...d, todo: { ...d.todo, tasks: [blankTask({ id: 't1', title: 'Mine', notifId: d.meta.nextNotifId, updatedAt: 100 })] }, meta: { ...d.meta, nextNotifId: d.meta.nextNotifId + 1 } };
  return { ...d, settings: { ...d.settings, theme: 'dark', accent: '#22b8b0' } };
}

const allIds = (d: AppData) => [...d.todo.tasks.map((t) => t.notifId), ...d.habits.habits.map((h) => h.notifId)];

describe('Tickday backup file', () => {
  it('round-trips everything through export and import', () => {
    const d = sample();
    const plan = parseBackup(exportJSON(d, 5000, '1.0.7'));
    expect(plan.kind).toBe('tickday');
    expect(plan.label).toBe('Tickday backup');
    expect(plan.detected.data).toEqual(d);
    expect(plan.stats).toEqual({ habits: 1, checkIns: 1, tasks: 1, open: 1, lists: 4 });
    expect(JSON.parse(exportJSON(d))).toMatchObject({ app: 'Tickday', format: 1, version: 1 });
  });

  it('replace swaps everything (settings too); merge keeps your settings', () => {
    const mine = sample();
    const theirs = { ...defaultData(2000), settings: { ...defaultData().settings, theme: 'light' as const } };
    const plan = parseBackup(exportJSON(theirs));
    expect(applyImport(mine, plan, 'replace').settings.theme).toBe('light');
    const merged = applyImport(mine, plan, 'merge');
    expect(merged.settings.theme).toBe('dark');
    expect(merged.habits.habits).toHaveLength(1);
    expect(merged.todo.tasks).toHaveLength(1);
  });

  it('rejects junk with a friendly message', () => {
    expect(() => parseBackup('not json')).toThrow(/valid JSON/);
  });
});

describe('importing an old Doable backup', () => {
  it('replace swaps only the tasks; habits and the look stay', () => {
    const mine = sample();
    const plan = parseBackup(JSON.stringify(doableBackup));
    expect(plan).toMatchObject({ kind: 'doable', label: 'Doable backup', stats: { tasks: 3, open: 2, lists: 2, habits: 0 } });
    const d = applyImport(mine, plan, 'replace');
    expect(d.todo.tasks.map((t) => t.id)).toEqual(['d1', 'd2', 'd3']);
    expect(d.habits).toEqual(mine.habits);
    expect(d.settings).toMatchObject({ theme: 'dark', accent: '#22b8b0', allDayReminderTime: '08:00', defaultReminder: 30 });
    expect(new Set(allIds(d)).size).toBe(allIds(d).length);
  });

  it('merge adds the old tasks next to yours', () => {
    const d = applyImport(sample(), parseBackup(JSON.stringify(doableBackup)), 'merge');
    expect(d.todo.tasks.map((t) => t.id).sort()).toEqual(['d1', 'd2', 'd3', 't1']);
    expect(d.todo.lists.some((l) => l.id === 'school')).toBe(true);
    expect(d.meta.welcomeDone).toBe(true);
  });

  it('merge: newest edit wins, new things are added (from Doable’s own tests)', () => {
    const cur = { lists: defaultData().todo.lists, tasks: [blankTask({ id: 't1', title: 'old', notifId: 1, updatedAt: 100 }), blankTask({ id: 't2', title: 'mine', notifId: 2, updatedAt: 500 })] };
    const inc = {
      lists: [...cur.lists, { id: 'new', name: 'New', color: '#000000', order: 9, createdAt: 1 }],
      tasks: [
        blankTask({ id: 't1', title: 'newer', notifId: 1, updatedAt: 200 }),
        blankTask({ id: 't2', title: 'older', notifId: 2, updatedAt: 100 }),
        blankTask({ id: 't3', title: 'brand new', notifId: 2, updatedAt: 1 }),
      ],
    };
    const m = mergeTodo(cur, inc);
    const byId = Object.fromEntries(m.tasks.map((t) => [t.id, t]));
    expect(byId.t1.title).toBe('newer');
    expect(byId.t2.title).toBe('mine');
    expect(byId.t3.title).toBe('brand new');
    expect(m.lists.some((l) => l.id === 'new')).toBe(true);
  });
});

describe('importing an old Habit Tracker backup', () => {
  it('replace swaps only the habits; tasks and the look stay', () => {
    const mine = sample();
    const plan = parseBackup(JSON.stringify(habitBackupV2));
    expect(plan).toMatchObject({ kind: 'habit-tracker', label: 'Habit Tracker backup', stats: { habits: 2, checkIns: 3, tasks: 0 } });
    const d = applyImport(mine, plan, 'replace');
    expect(d.habits.habits.map((h) => h.id)).toEqual(['h1', 'h2']);
    expect(d.todo).toEqual(mine.todo);
    expect(d.settings.accent).toBe('#22b8b0');
    expect(d.habits.habits.every((h) => h.notifId > 0)).toBe(true);
    expect(new Set(allIds(d)).size).toBe(allIds(d).length);
  });

  it('merge keeps your habits and adds theirs; the same habit keeps the higher count and your notes', () => {
    const cur = { habits: [], completions: { h1: { '2026-11-22': 3, '2026-11-24': 2 } }, notes: { h1: { '2026-11-23': 'mine' } }, vacations: [] };
    const inc = parseBackup(JSON.stringify(habitBackupV2)).detected.habits!;
    const m = mergeHabits({ ...cur, habits: [inc.habits[0]] }, inc);
    expect(m.habits.map((h) => h.id)).toEqual(['h1', 'h2']);
    expect(m.completions.h1).toEqual({ '2026-11-22': 8, '2026-11-23': 5, '2026-11-24': 2 });
    expect(m.notes.h1['2026-11-23']).toBe('mine');
    expect(m.vacations).toHaveLength(1);
  });

  it('imports the oldest (v1) files too', () => {
    const d = applyImport(defaultData(), parseBackup(JSON.stringify(habitBackupV1)), 'merge');
    expect(d.habits.habits[0]).toMatchObject({ name: 'Read', reminder: '20:30' });
  });

  it('importing both old apps gives one data set with no notification id clashes', () => {
    let d = defaultData();
    d = applyImport(d, parseBackup(JSON.stringify(habitBackupV2)), 'merge');
    d = applyImport(d, parseBackup(JSON.stringify(doableBackup)), 'merge');
    d = applyImport(d, parseBackup(JSON.stringify(habitBackupV1)), 'merge');
    expect(d.habits.habits).toHaveLength(3);
    expect(d.todo.tasks).toHaveLength(3);
    const ids = allIds(d);
    expect(new Set(ids).size).toBe(ids.length);
    expect(d.meta.nextNotifId).toBeGreaterThan(Math.max(...ids));
  });
});

describe('reset', () => {
  it('can clear just habits, just tasks, or both, keeping settings', () => {
    const mine = sample();
    expect(resetData(mine, 'habits').todo).toEqual(mine.todo);
    expect(resetData(mine, 'habits').habits.habits).toEqual([]);
    expect(resetData(mine, 'tasks').habits).toEqual(mine.habits);
    expect(resetData(mine, 'tasks').todo.tasks).toEqual([]);
    const all = resetData(mine, 'all');
    expect(all.habits.habits).toEqual([]);
    expect(all.todo.tasks).toEqual([]);
    expect(all.settings).toEqual(mine.settings);
  });
});
