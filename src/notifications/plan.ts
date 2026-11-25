import type { AppData } from '../data/types';
import { diffDays, formatTime, nowTime, toLocalDate, weekday, weekdayShort, shortDate } from '../core/dates';
import { fireTimeFor, planReminders, type PlannedReminder } from '../todo/model/reminderPlan';
import { planHabitReminders, type PlannedHabitReminder } from './habitPlan';

/*
 * Everything Android should have scheduled, for tasks AND habits, worked out from the data alone.
 * The native layer compares this with what Android actually has pending and only applies the
 * difference (diffReminders), so edits, deletes, check-offs, imports and repeats can never leave a
 * stale or missing alarm. Ids come from separate ranges (data/notifIds.ts), so the two kinds never collide.
 */

export const MAX_TASK_REMINDERS = 64;

export type PlannedTaskReminder = PlannedReminder & { kind: 'task' };
export type Planned = PlannedTaskReminder | PlannedHabitReminder;

export function planAll(data: AppData, now: number): Planned[] {
  const tasks: Planned[] = data.settings.notify.tasks ? planReminders(data, now, MAX_TASK_REMINDERS).map((p) => ({ ...p, kind: 'task' as const })) : [];
  const habits: Planned[] = planHabitReminders(data, now);
  return [...tasks, ...habits].sort((a, b) => a.at - b.at);
}

export { diffReminders as diffPlanned } from '../todo/model/reminderPlan';

/** "Today 8:11 PM", "Tomorrow 9:00 AM", "Sat 9:00 AM", "Thu 3 Dec 9:00 AM" (for labels and messages). */
export function describeWhen(at: number, now: number): string {
  const day = toLocalDate(at);
  const today = toLocalDate(now);
  const time = formatTime(nowTime(new Date(at)));
  const diff = diffDays(today, day);
  const dayLabel = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff > 1 && diff < 7 ? weekdayShort(weekday(day)) : `${weekdayShort(weekday(day))} ${shortDate(day, today)}`;
  return `${dayLabel} ${time}`;
}

/** The next few reminders that will pop up (tasks and habits), soonest first. */
export function upcomingReminders(data: AppData, now: number, n = 3): Planned[] {
  return planAll(data, now).slice(0, n);
}

/**
 * The next reminder for tasks that use the all-day time (a due date but no time), so changing
 * "All-day tasks remind at" can say when it will actually fire, which may not be today.
 */
export function nextAllDayReminder(data: AppData, now: number): { title: string; at: number } | null {
  let best: { title: string; at: number } | null = null;
  for (const t of data.todo.tasks) {
    if (t.dueTime || t.snoozedUntil != null) continue;
    const at = fireTimeFor(t, data.settings);
    if (at == null || at <= now) continue;
    if (!best || at < best.at) best = { title: `${t.emoji ? t.emoji + ' ' : ''}${t.title}`, at };
  }
  return best;
}
