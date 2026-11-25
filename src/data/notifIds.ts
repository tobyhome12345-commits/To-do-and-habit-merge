import type { AppData } from './types';

/*
 * Notification ids. Android identifies each scheduled notification by a 32-bit int, so habits and
 * tasks must never hand out the same number, or one reminder would silently replace another.
 *
 *   1 … 999,999,999              tasks: task.notifId itself
 *   1,000,000,000 … 1,999,999,999 habits: HABIT_BASE + habit.notifId × 16 + (day mod 16)
 *   2,000,000,000 +               reserved (test notifications)
 *
 * Every task and habit gets its notifId from ONE counter (meta.nextNotifId), so they are unique
 * across both kinds too. A habit has 16 day-slots because its reminders are planned up to 14 days ahead.
 */

export const HABIT_BASE = 1_000_000_000;
export const HABIT_SLOTS = 16;
export const RESERVED_BASE = 2_000_000_000;
/** Largest notifId that still fits the habit range. */
export const MAX_NOTIF_ID = Math.floor((RESERVED_BASE - HABIT_BASE) / HABIT_SLOTS) - 1;

export const TEST_TASK_ID = RESERVED_BASE;
export const TEST_HABIT_ID = RESERVED_BASE + 1;

export function habitNotificationId(notifId: number, epochDay: number): number {
  return HABIT_BASE + notifId * HABIT_SLOTS + (((epochDay % HABIT_SLOTS) + HABIT_SLOTS) % HABIT_SLOTS);
}

export type NotificationKind = 'task' | 'habit' | 'reserved';

export function kindOfNotification(id: number): NotificationKind {
  if (id >= RESERVED_BASE) return 'reserved';
  return id >= HABIT_BASE ? 'habit' : 'task';
}

const valid = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0 && (n as number) <= MAX_NOTIF_ID;

/**
 * Makes every task's and habit's notifId unique (across both kinds) and in range, and moves
 * meta.nextNotifId past all of them. Run after loading, importing and merging.
 * Items listed in `keep` (your existing ones, during an import) hold on to their number when there's
 * a clash, so only the newcomers get renumbered. Returns the same object when nothing needed fixing.
 */
export function assignNotifIds(data: AppData, keep?: { tasks: Set<string>; habits: Set<string> }): AppData {
  let next = Math.max(1, valid(data.meta.nextNotifId) ? data.meta.nextNotifId : 1);
  for (const t of data.todo.tasks) if (valid(t.notifId)) next = Math.max(next, t.notifId + 1);
  for (const h of data.habits.habits) if (valid(h.notifId)) next = Math.max(next, h.notifId + 1);

  const used = new Set<number>();
  let changed = next !== data.meta.nextNotifId;
  const fix = <T extends { notifId: number }>(item: T): T => {
    if (valid(item.notifId) && !used.has(item.notifId)) {
      used.add(item.notifId);
      return item;
    }
    changed = true;
    const notifId = next++;
    used.add(notifId);
    return { ...item, notifId };
  };
  // Kept items (tasks AND habits) claim their numbers first; everyone else fills in after.
  const tasks = [...data.todo.tasks];
  const habits = [...data.habits.habits];
  const pass = (keptPass: boolean) => {
    tasks.forEach((t, i) => !!keep?.tasks.has(t.id) === keptPass && (tasks[i] = fix(t)));
    habits.forEach((h, i) => !!keep?.habits.has(h.id) === keptPass && (habits[i] = fix(h)));
  };
  pass(true);
  pass(false);
  if (!changed) return data;
  return {
    ...data,
    todo: { ...data.todo, tasks },
    habits: { ...data.habits, habits },
    meta: { ...data.meta, nextNotifId: next },
  };
}
