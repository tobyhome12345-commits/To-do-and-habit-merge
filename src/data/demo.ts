import { addDays, todayKey, weekday } from '../core/dates';
import { demoTodo } from '../todo/model/demo';
import { defaultData } from './defaults';
import { assignNotifIds } from './notifIds';
import type { AppData } from './types';
import type { Habit, Schedule, TimeOfDay } from '../habits/lib/types';

/*
 * Sample habits + tasks for screenshots and trying Tickday in a browser (?demo=1). Never used on the phone.
 *   ?demo=1        a normal day in progress
 *   ?demo=done     everything ticked off (Tick celebrates)
 *   ?demo=new      a fresh install (welcome card)
 */

function habit(id: string, name: string, emoji: string, color: string, opts: { since: string; target?: number; unit?: string; schedule?: Schedule; time?: TimeOfDay; reminder?: string }): Habit {
  return {
    id,
    name,
    emoji,
    color,
    createdAt: opts.since,
    unit: opts.unit ?? '',
    timeOfDay: opts.time ?? 'anytime',
    rules: [{ since: opts.since, target: opts.target ?? 1, schedule: opts.schedule ?? { kind: 'daily' } }],
    pauses: [],
    archivedAt: null,
    reminder: opts.reminder ?? null,
    notifId: 0,
    snoozedUntil: null,
  };
}

export function demoData(variant = ''): AppData {
  const base = defaultData();
  if (variant === 'new') return base;
  const today = todayKey();
  const d = (n: number) => addDays(today, n);
  const since = d(-70);

  const habits: Habit[] = [
    habit('meditate', 'Meditate', '🧘', '#a970f0', { since, time: 'morning', reminder: '07:30' }),
    habit('read', 'Read', '📚', '#f5b52e', { since, target: 10, unit: 'pages', time: 'evening', reminder: '20:30' }),
    habit('water', 'Drink water', '💧', '#3aa5f2', { since, target: 8, unit: 'glasses' }),
    habit('workout', 'Workout', '🏋️', '#3dbe7e', { since, schedule: { kind: 'weekly', times: 3 } }),
    habit('plants', 'Water the plants', '🌱', '#8cbf3f', { since: d(-69), schedule: { kind: 'interval', every: 3 } }),
    habit('guitar', 'Practice guitar', '🎸', '#ff6b5b', { since, schedule: { kind: 'weekdays', days: [weekday(d(1)), weekday(d(3)), weekday(d(5))] }, time: 'afternoon' }),
    habit('swim', 'Swim', '🏊', '#22b8b0', { since, schedule: { kind: 'weekdays', days: [weekday(d(-2)), weekday(d(4))] } }),
  ];
  habits[6].pauses = [{ from: d(-1), to: d(7) }];

  const completions: Record<string, Record<string, number>> = {};
  const fill = (id: string, from: number, to: number, count = 1, skip: number[] = []) => {
    const days = (completions[id] ??= {});
    for (let i = from; i <= to; i++) if (!skip.includes(i)) days[d(i)] = count;
  };
  fill('meditate', -70, -1, 1, [-52, -41, -35]);
  fill('read', -70, -1, 10, [-60, -44, -31, -22, -13, -6]);
  fill('water', -70, -1, 8, [-58, -40, -27, -13]);
  completions.water[d(-30)] = 6;
  completions.water[d(-13)] = 5;
  for (let i = -70; i <= -1; i++) if (weekday(d(i)) === 1 || weekday(d(i)) === 3 || weekday(d(i)) === 5) (completions.workout ??= {})[d(i)] = 1;
  for (let i = -69; i <= -3; i += 3) (completions.plants ??= {})[d(i)] = 1;
  for (const i of [-70, -66, -63, -59, -56, -52, -49, -45, -42, -38, -35, -31, -28, -24, -21, -17, -14, -10, -7, -3]) (completions.guitar ??= {})[d(i)] = 1;
  for (const i of [-65, -58, -51, -44, -37, -30, -23, -16, -9]) (completions.swim ??= {})[d(i)] = 1;

  // Today, in progress
  completions.meditate[d(0)] = 1;
  completions.water[d(0)] = 5;

  if (variant === 'done') {
    completions.read[d(0)] = 10;
    completions.water[d(0)] = 8;
    completions.workout[d(0)] = 1;
    completions.plants[d(0)] = 1;
  }

  const notes = {
    read: { [d(-2)]: 'Finished “Wonder” 📖', [d(-9)]: 'Started a new book' },
    water: { [d(-13)]: 'Busy day at school' },
  };

  const todo = demoTodo();
  const now = Date.now();
  let tasks = todo.tasks;
  if (variant === 'done') tasks = tasks.map((t) => (t.dueDate && t.dueDate <= today && t.completedAt == null ? { ...t, completedAt: now - 60_000, repeat: null } : t));

  return assignNotifIds({
    ...base,
    habits: { habits, completions, notes, vacations: [] },
    todo: { lists: todo.lists, tasks },
    meta: { ...base.meta, nextNotifId: todo.nextNotifId, welcomeDone: true },
  });
}
