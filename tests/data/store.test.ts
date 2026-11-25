import { beforeEach, describe, expect, it } from 'vitest';
import { applyHabitAction, habitView, useData } from '../../src/data/store';
import { defaultData } from '../../src/data/defaults';
import { HABIT_BASE, MAX_NOTIF_ID, RESERVED_BASE, assignNotifIds, habitNotificationId, kindOfNotification } from '../../src/data/notifIds';
import { blankTask } from '../../src/todo/model/data';

const input = { name: 'Read', emoji: '📚', color: '#f5b52e', unit: 'pages', timeOfDay: 'evening' as const, target: 10, schedule: { kind: 'daily' as const } };
const S = () => useData.getState();

beforeEach(() => S().init(defaultData()));

describe('one store for habits and tasks', () => {
  it('habit actions and task actions share one document and one notification counter', () => {
    const t = S().addTask({ title: 'Essay' });
    S().habit({ type: 'addHabit', habit: input, id: 'r' });
    const t2 = S().addTask({ title: 'Maths' });
    const h = S().data.habits.habits[0];
    expect(new Set([t.notifId, h.notifId, t2.notifId]).size).toBe(3);
    expect(S().data.todo.tasks).toHaveLength(2);
    expect(S().data.meta.nextNotifId).toBeGreaterThan(Math.max(t.notifId, h.notifId, t2.notifId));
  });

  it('habit taps land in the habit half only', () => {
    S().habit({ type: 'addHabit', habit: input, id: 'r', today: '2026-11-20' });
    const todoBefore = S().data.todo;
    S().habit({ type: 'tap', id: 'r', date: '2026-11-21', delta: 1 });
    expect(S().data.habits.completions.r).toEqual({ '2026-11-21': 1 });
    expect(S().data.todo).toBe(todoBefore);
  });

  it('the habit view is memoised (same object until habits or week start change)', () => {
    const d = defaultData();
    expect(habitView(d)).toBe(habitView(d));
    const d2 = { ...d, settings: { ...d.settings, weekStart: 0 as const } };
    expect(habitView(d2)).not.toBe(habitView(d));
    expect(habitView(d2).settings.weekStart).toBe(0);
  });

  it('vacation mode and week start from the habit code write back to the right place', () => {
    let d = applyHabitAction(defaultData(), { type: 'pause', id: 'all', from: '2026-12-20', to: null });
    expect(d.habits.vacations).toEqual([{ from: '2026-12-20', to: null }]);
    d = applyHabitAction(d, { type: 'settings', patch: { weekStart: 0 } });
    expect(d.settings.weekStart).toBe(0);
  });

  it('changing a habit reminder clears its snooze', () => {
    let d = applyHabitAction(defaultData(), { type: 'addHabit', habit: { ...input, reminder: '19:00' }, id: 'r' });
    d = { ...d, habits: { ...d.habits, habits: d.habits.habits.map((h) => ({ ...h, snoozedUntil: 123 })) } };
    d = applyHabitAction(d, { type: 'updateHabit', id: 'r', patch: { reminder: '20:00' } });
    expect(d.habits.habits[0]).toMatchObject({ reminder: '20:00', snoozedUntil: null });
  });
});

describe('notification ids', () => {
  it('tasks, habits and test notifications live in separate ranges', () => {
    expect(kindOfNotification(1)).toBe('task');
    expect(kindOfNotification(HABIT_BASE - 1)).toBe('task');
    expect(kindOfNotification(habitNotificationId(1, 0))).toBe('habit');
    expect(habitNotificationId(MAX_NOTIF_ID, 20_000)).toBeLessThan(RESERVED_BASE);
    expect(habitNotificationId(MAX_NOTIF_ID, 20_000)).toBeLessThan(2 ** 31);
    expect(kindOfNotification(RESERVED_BASE)).toBe('reserved');
  });

  it('each habit gets 16 distinct day slots, and different habits never share one', () => {
    const ids = new Set<number>();
    for (let notifId = 1; notifId <= 50; notifId++) for (let day = 20_000; day < 20_016; day++) ids.add(habitNotificationId(notifId, day));
    expect(ids.size).toBe(50 * 16);
  });

  it('repairs duplicates and missing ids across both kinds', () => {
    const d = defaultData();
    let x = applyHabitAction(d, { type: 'addHabit', habit: input, id: 'a' });
    const habitId = x.habits.habits[0].notifId;
    x = { ...x, todo: { ...x.todo, tasks: [blankTask({ id: 't', notifId: habitId }), blankTask({ id: 'u', notifId: 0 }), blankTask({ id: 'v', notifId: 3e9 })] } };
    const fixed = assignNotifIds(x);
    const ids = [...fixed.todo.tasks.map((t) => t.notifId), ...fixed.habits.habits.map((h) => h.notifId)];
    expect(new Set(ids).size).toBe(4);
    expect(ids.every((n) => n > 0 && n <= MAX_NOTIF_ID)).toBe(true);
    expect(assignNotifIds(fixed)).toBe(fixed); // nothing left to fix → same object
  });
});
