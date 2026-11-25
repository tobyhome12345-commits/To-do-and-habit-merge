import type { AppData } from '../data/types';
import { planReminders, type PlannedReminder } from '../todo/model/reminderPlan';
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
