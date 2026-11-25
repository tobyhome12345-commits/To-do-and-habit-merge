import { describe, expect, it } from 'vitest';
import { defaultData } from '../../src/data/defaults';
import { applyHabitAction } from '../../src/data/store';
import { HABIT_BASE, RESERVED_BASE, kindOfNotification } from '../../src/data/notifIds';
import { HORIZON_DAYS, planHabitReminders } from '../../src/notifications/habitPlan';
import { describeWhen, diffPlanned, nextAllDayReminder, planAll, upcomingReminders } from '../../src/notifications/plan';
import { blankTask } from '../../src/todo/model/data';
import { addDays, weekday } from '../../src/core/dates';
import type { AppData } from '../../src/data/types';
import type { Schedule } from '../../src/habits/lib/types';

// Tests run with TZ=Europe/London (see package.json). "Now" is Wed 25 Nov 2026, 08:00.
const local = (y: number, mo: number, d: number, h: number, mi: number) => new Date(y, mo - 1, d, h, mi).getTime();
const NOW = local(2026, 11, 25, 8, 0);
const TODAY = '2026-11-25';

function withHabit(opts: { reminder?: string | null; schedule?: Schedule; target?: number; since?: string } = {}, base: AppData = defaultData(NOW)): AppData {
  const habit = { name: 'Read', emoji: '📚', color: '#f5b52e', unit: 'pages', timeOfDay: 'evening' as const, target: opts.target ?? 1, schedule: opts.schedule ?? { kind: 'daily' as const }, reminder: opts.reminder === undefined ? '19:00' : opts.reminder };
  return applyHabitAction(base, { type: 'addHabit', habit, id: `h${base.habits.habits.length}`, today: opts.since ?? '2026-11-01' });
}

describe('habit reminders', () => {
  it('one per due day, at the habit’s time, for the next two weeks, in the habit id range', () => {
    const plan = planHabitReminders(withHabit(), NOW);
    expect(plan).toHaveLength(HORIZON_DAYS);
    expect(plan[0]).toMatchObject({ date: TODAY, at: local(2026, 11, 25, 19, 0), title: '📚 Read' });
    expect(plan.every((p) => kindOfNotification(p.id) === 'habit')).toBe(true);
    expect(new Set(plan.map((p) => p.id)).size).toBe(plan.length);
  });

  it('no reminder time, reminders switched off, or archived → nothing', () => {
    expect(planHabitReminders(withHabit({ reminder: null }), NOW)).toEqual([]);
    const d = withHabit();
    expect(planHabitReminders({ ...d, settings: { ...d.settings, notify: { habits: false, tasks: true } } }, NOW)).toEqual([]);
    expect(planHabitReminders(applyHabitAction(d, { type: 'archive', id: 'h0', today: TODAY }), NOW)).toEqual([]);
  });

  it('stays quiet once today is done, and skips times that already passed', () => {
    const done = applyHabitAction(withHabit(), { type: 'tap', id: 'h0', date: TODAY, delta: 1 });
    expect(planHabitReminders(done, NOW)[0].date).toBe(addDays(TODAY, 1));
    expect(planHabitReminders(withHabit({ reminder: '07:00' }), NOW)[0].date).toBe(addDays(TODAY, 1));
  });

  it('counted habits keep reminding until the goal is reached', () => {
    let d = withHabit({ target: 8 });
    d = applyHabitAction(d, { type: 'setCount', id: 'h0', date: TODAY, count: 5 });
    const today = planHabitReminders(d, NOW)[0];
    expect(today.date).toBe(TODAY);
    expect(today.body).toContain('5/8 pages');
  });

  it('only on scheduled days, never on paused or vacation days', () => {
    const wd = weekday(TODAY); // Wednesday
    const plan = planHabitReminders(withHabit({ schedule: { kind: 'weekdays', days: [wd] } }), NOW);
    expect(plan.map((p) => p.date)).toEqual([TODAY, addDays(TODAY, 7)]);
    let d = withHabit();
    d = applyHabitAction(d, { type: 'pause', id: 'h0', from: addDays(TODAY, 1), to: addDays(TODAY, 3) });
    d = applyHabitAction(d, { type: 'pause', id: 'all', from: addDays(TODAY, 10), to: null });
    const dates = planHabitReminders(d, NOW).map((p) => p.date);
    expect(dates).toEqual([TODAY, addDays(TODAY, 4), addDays(TODAY, 5), addDays(TODAY, 6), addDays(TODAY, 7), addDays(TODAY, 8), addDays(TODAY, 9)]);
  });

  it('"N times a week": stops for the rest of the week once the goal is met', () => {
    let d = withHabit({ schedule: { kind: 'weekly', times: 2 } });
    // Week starts Monday 23 Nov; two check-ins already this week.
    d = applyHabitAction(d, { type: 'tap', id: 'h0', date: '2026-11-23', delta: 1 });
    d = applyHabitAction(d, { type: 'tap', id: 'h0', date: '2026-11-24', delta: 1 });
    const dates = planHabitReminders(d, NOW).map((p) => p.date);
    expect(dates[0]).toBe('2026-11-30'); // next Monday
    expect(dates).not.toContain(TODAY);
  });

  it('a snooze moves today’s reminder', () => {
    let d = withHabit({ reminder: '07:00' });
    d = { ...d, habits: { ...d.habits, habits: d.habits.habits.map((h) => ({ ...h, snoozedUntil: NOW + 10 * 60_000 })) } };
    expect(planHabitReminders(d, NOW)[0]).toMatchObject({ date: TODAY, at: NOW + 10 * 60_000 });
  });
});

describe('habits + tasks together', () => {
  it('never share a notification id', () => {
    let d = defaultData(NOW);
    for (let i = 0; i < 5; i++) d = withHabit({}, d);
    const tasks = Array.from({ length: 40 }, (_, i) =>
      blankTask({ title: `T${i}`, notifId: d.meta.nextNotifId + i, dueDate: addDays(TODAY, i % 10), dueTime: '18:30', reminder: 0 }),
    );
    d = { ...d, todo: { ...d.todo, tasks }, meta: { ...d.meta, nextNotifId: d.meta.nextNotifId + 40 } };
    const plan = planAll(d, NOW);
    const ids = plan.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(plan.filter((p) => p.kind === 'task').every((p) => p.id < HABIT_BASE)).toBe(true);
    expect(plan.filter((p) => p.kind === 'habit').every((p) => p.id >= HABIT_BASE && p.id < RESERVED_BASE)).toBe(true);
    expect(plan.length).toBe(40 + 5 * HORIZON_DAYS);
    expect(plan.map((p) => p.at)).toEqual([...plan.map((p) => p.at)].sort((a, b) => a - b));
  });

  it('task reminders can be switched off on their own', () => {
    let d = withHabit();
    d = { ...d, todo: { ...d.todo, tasks: [blankTask({ notifId: 99, dueDate: TODAY, dueTime: '18:00', reminder: 0 })] } };
    expect(planAll(d, NOW).some((p) => p.kind === 'task')).toBe(true);
    const off = { ...d, settings: { ...d.settings, notify: { habits: true, tasks: false } } };
    expect(planAll(off, NOW).some((p) => p.kind === 'task')).toBe(false);
    expect(planAll(off, NOW).some((p) => p.kind === 'habit')).toBe(true);
  });

  it('the diff only touches what changed', () => {
    const d = withHabit();
    const plan = planAll(d, NOW);
    const pending = plan.map((p) => ({ id: p.id, extra: { fp: p.fp } }));
    expect(diffPlanned(plan, pending)).toEqual({ cancel: [], schedule: [] });
    // Ticking today off cancels exactly today's reminder.
    const after = planAll(applyHabitAction(d, { type: 'tap', id: 'h0', date: TODAY, delta: 1 }), NOW);
    const { cancel, schedule } = diffPlanned(after, pending);
    expect(cancel).toEqual([plan[0].id]);
    expect(schedule).toEqual([]);
  });
});

describe('saying when reminders will fire', () => {
  it('describes the day and time', () => {
    expect(describeWhen(local(2026, 11, 25, 20, 11), NOW)).toBe('Today 8:11 PM');
    expect(describeWhen(local(2026, 11, 26, 9, 0), NOW)).toBe('Tomorrow 9:00 AM');
    expect(describeWhen(local(2026, 11, 28, 9, 0), NOW)).toBe('Sat 9:00 AM');
    expect(describeWhen(local(2026, 12, 10, 9, 0), NOW)).toBe('Thu 10 Dec 9:00 AM');
  });

  it('the all-day time fires on the day the task is due, which may not be today', () => {
    const base = defaultData(NOW);
    const sat = blankTask({ id: 's', title: 'Learn something new', emoji: '🧠', notifId: 7, dueDate: '2026-11-28', reminder: 0 });
    let d: AppData = { ...base, todo: { ...base.todo, tasks: [sat] }, settings: { ...base.settings, allDayReminderTime: '08:11' } };
    expect(nextAllDayReminder(d, NOW)).toEqual({ title: '🧠 Learn something new', at: local(2026, 11, 28, 8, 11) });
    const today = blankTask({ id: 't', title: 'Tidy desk', notifId: 8, dueDate: TODAY, reminder: 0 });
    d = { ...d, todo: { ...d.todo, tasks: [sat, today] } };
    expect(nextAllDayReminder(d, NOW)).toEqual({ title: 'Tidy desk', at: local(2026, 11, 25, 8, 11) });
    // Tasks with a time don't use the all-day time.
    const timed = blankTask({ id: 'x', title: 'Gym', notifId: 9, dueDate: TODAY, dueTime: '18:00', reminder: 0 });
    expect(nextAllDayReminder({ ...d, todo: { ...d.todo, tasks: [timed] } }, NOW)).toBeNull();
  });

  it('lists the next few reminders, tasks and habits mixed, soonest first', () => {
    let d = withHabit({ reminder: '19:00' });
    d = { ...d, todo: { ...d.todo, tasks: [blankTask({ id: 'a', title: 'Essay', notifId: 50, dueDate: TODAY, dueTime: '12:00', reminder: 0 })] } };
    expect(upcomingReminders(d, NOW, 3).map((p) => p.title)).toEqual(['Essay', '📚 Read', '📚 Read']);
  });

  it('one broken task or habit never stops the other reminders', () => {
    let d = withHabit({ reminder: '19:00' });
    const broken = { ...blankTask({ id: 'b', title: 'Broken', notifId: 60, dueDate: TODAY, reminder: 0 }), dueTime: 'nonsense' as string };
    const ok = blankTask({ id: 'o', title: 'Fine', notifId: 61, dueDate: TODAY, dueTime: '12:00', reminder: 0 });
    d = { ...d, todo: { ...d.todo, tasks: [broken, ok] } };
    d = { ...d, habits: { ...d.habits, habits: [{ ...d.habits.habits[0], rules: [] as never }, ...d.habits.habits] } };
    const titles = planAll(d, NOW).map((p) => p.title);
    expect(titles).toContain('Fine');
    expect(titles).toContain('📚 Read');
  });
});
