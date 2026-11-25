import { LocalNotifications, type ActionPerformed, type LocalNotificationSchema } from '@capacitor/local-notifications';
import { App } from '@capacitor/app';
import { isAndroid, isIOS, isNative } from '../core/platform';
import { todayKey } from '../core/dates';
import { useData } from '../data/store';
import { useUI } from '../data/ui';
import { RESERVED_BASE, TEST_HABIT_ID, TEST_TASK_ID } from '../data/notifIds';
import { countOn, ruleOn } from '../habits/lib/schedule';
import { diffPlanned, planAll, type Planned } from './plan';
import { askToRunInBackgroundOnce } from './reliability';

/*
 * Real OS-scheduled reminders for tasks AND habits (Android AlarmManager via @capacitor/local-notifications).
 * This is Doable's reminder engine (which works), extended to habits.
 *
 * The data is the single source of truth. syncReminders() works out what *should* be scheduled (planAll),
 * compares it with what Android *has* pending (getPending) and cancels/schedules only the difference.
 * It runs after every relevant change, on start and on resume. Android restores pending alarms after a
 * reboot (the plugin's boot receiver). Exact timing uses USE_EXACT_ALARM (see AndroidManifest.xml).
 */

const CHANNEL = { task: 'task-reminders', habit: 'habit-reminders' } as const;
const ACTIONS = { task: 'TASK_REMINDER', habit: 'HABIT_REMINDER' } as const;
const SMALL_ICON = 'ic_stat_tick';

export type ReminderStatus =
  | { platform: 'web' }
  | { platform: 'native'; permission: string; exact: string; scheduled: number; lastError: string | null };

/** The last thing that went wrong while handing reminders to Android (shown in Settings). */
let lastError: string | null = null;
let syncTimer: ReturnType<typeof setTimeout> | null = null;

/** Hand reminders to Android right now (e.g. as the app goes to the background), instead of waiting. */
export function flushReminders(): Promise<void> {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = null;
  return syncReminders();
}

let initialised = false;

export async function initNotifications() {
  if (!isNative || initialised) return;
  initialised = true;
  // Notification channels are Android-only (iOS has none, and the call fails there).
  if (isAndroid) {
    try {
      await LocalNotifications.createChannel({
        id: CHANNEL.task,
        name: 'Task reminders',
        description: 'Reminders at the time your tasks are due',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
        lightColor: '#F5A524',
      });
      await LocalNotifications.createChannel({
        id: CHANNEL.habit,
        name: 'Habit reminders',
        description: 'Tick’s daily nudges for your habits',
        importance: 4,
        visibility: 1,
        vibration: true,
      });
    } catch (e) {
      console.error('reminder channels failed', e);
    }
  }
  // Set up separately from the channels, so the ✓ Done / Snooze buttons always exist (on iPhone too).
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        { id: ACTIONS.task, actions: [{ id: 'done', title: '✓ Done' }, { id: 'snooze', title: 'Snooze 10 min' }] },
        { id: ACTIONS.habit, actions: [{ id: 'done', title: '✓ Done' }, { id: 'snooze', title: 'Snooze 10 min' }] },
      ],
    });
  } catch (e) {
    console.error('reminder buttons failed', e);
  }

  await LocalNotifications.addListener('localNotificationActionPerformed', onAction);

  // Re-sync whenever anything that affects reminders changes. Settings changes (like the all-day time)
  // go straight away; edits are batched for a moment while you type, and flushed if the app is left.
  useData.subscribe((s, prev) => {
    const a = s.data;
    const b = prev.data;
    if (a.todo === b.todo && a.habits === b.habits && a.settings === b.settings) return;
    if (syncTimer) clearTimeout(syncTimer);
    if (a.todo === b.todo && a.habits === b.habits) {
      syncTimer = null;
      void syncReminders();
    } else {
      syncTimer = setTimeout(() => void flushReminders(), 300);
    }
  });
  await App.addListener('resume', () => void syncReminders());
  // Leaving the app (home button, switching apps, swiping it away): make sure Android has everything first.
  await App.addListener('pause', () => void flushReminders());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushReminders();
  });
  await syncReminders();
}

function toNotification(p: Planned, exact: boolean): LocalNotificationSchema {
  return {
    id: p.id,
    title: p.title,
    body: p.body,
    largeBody: p.body,
    schedule: { at: new Date(p.at), allowWhileIdle: true },
    isExactNotification: exact,
    channelId: CHANNEL[p.kind],
    actionTypeId: ACTIONS[p.kind],
    smallIcon: SMALL_ICON,
    iconColor: useData.getState().data.settings.accent ?? '#F5A524',
    autoCancel: true,
    extra: p.kind === 'task' ? { kind: 'task', taskId: p.taskId, fp: p.fp } : { kind: 'habit', habitId: p.habitId, date: p.date, fp: p.fp },
  } as LocalNotificationSchema;
}

async function canExact(): Promise<boolean> {
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
  } catch {
    return true; // older Android: always allowed
  }
}

const BATCH = 25;
/** iOS holds at most 64 pending notifications; a few stay free for the test notifications. */
const IOS_MAX_PENDING = 60;
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 160);

let running: Promise<void> | null = null;
let again = false;
let askedThisSession = false;

/** Make Android's pending alarms match the data. Safe to call any time. */
export function syncReminders(): Promise<void> {
  if (!isNative) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      try {
        // iOS keeps at most 64 pending notifications: hand it the soonest ones (planAll is soonest-first,
        // and it re-plans on every change, start and resume, so later ones fill in as these fire).
        const all = planAll(useData.getState().data, Date.now());
        const desired = isIOS ? all.slice(0, IOS_MAX_PENDING) : all;
        let perm = await LocalNotifications.checkPermissions();
        // First reminder that needs showing (from a sheet, quick-add or an import): ask once per session.
        if (perm.display !== 'granted' && perm.display !== 'denied' && desired.length && !askedThisSession) {
          askedThisSession = true;
          perm = await LocalNotifications.requestPermissions();
        }
        if (perm.display !== 'granted') return; // nothing can be shown; we'll sync once allowed
        const exact = await canExact();
        const { notifications } = await LocalNotifications.getPending();
        const ours = notifications.filter((n) => n.id < RESERVED_BASE).map((n) => ({ id: n.id, extra: n.extra }));
        const { cancel, schedule } = diffPlanned(desired, ours);
        if (cancel.length) await LocalNotifications.cancel({ notifications: cancel.map((id) => ({ id })) });
        // Soonest first, in small batches, so one problem can't stop every other reminder.
        let failed: string | null = null;
        for (let i = 0; i < schedule.length; i += BATCH) {
          const batch = schedule.slice(i, i + BATCH);
          try {
            await LocalNotifications.schedule({ notifications: batch.map((p) => toNotification(p, exact)) });
          } catch (e) {
            failed = errorText(e);
            console.error('scheduling a batch of reminders failed', e);
          }
        }
        lastError = failed;
      } catch (e) {
        lastError = errorText(e);
        console.error('syncReminders failed', e);
      }
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

function onAction(a: ActionPerformed) {
  const extra = (a.notification.extra ?? {}) as { kind?: string; taskId?: string; habitId?: string; date?: string };
  const store = useData.getState();
  if (extra.kind === 'habit' && extra.habitId) {
    const habit = store.data.habits.habits.find((h) => h.id === extra.habitId);
    if (!habit) return;
    const date = extra.date ?? todayKey();
    if (a.actionId === 'done') {
      // ✓ Done: one tap (counted habits) or the whole goal (simple habits).
      const target = ruleOn(habit, date).target;
      const cur = countOn(store.data.habits.completions, habit.id, date);
      store.habit({ type: 'setCount', id: habit.id, date, count: target > 1 ? cur + 1 : Math.max(cur, target) });
    } else if (a.actionId === 'snooze') {
      store.snoozeHabit(habit.id, 10);
      store.showSnack(`Snoozed “${habit.name}” for 10 minutes`, undefined, '😴');
    } else {
      useUI.getState().setTab('today');
    }
  } else if (extra.taskId) {
    const task = store.data.todo.tasks.find((t) => t.id === extra.taskId);
    if (!task) return;
    if (a.actionId === 'done') {
      if (task.completedAt == null) store.toggleComplete(task.id);
    } else if (a.actionId === 'snooze') {
      store.snooze(task.id, 10);
      store.showSnack(`Snoozed “${task.title}” for 10 minutes`, undefined, '😴');
    } else {
      useUI.getState().openSheet({ kind: 'task', taskId: task.id });
    }
  }
  void LocalNotifications.removeDeliveredNotifications({ notifications: [{ id: a.notification.id, title: '', body: '' }] }).catch(() => {});
}

/** Ask for notification permission (the first time someone sets a reminder, or from Settings). */
export async function requestReminderPermission(force = false): Promise<boolean> {
  if (!isNative) return true;
  try {
    const cur = await LocalNotifications.checkPermissions();
    if (cur.display === 'granted') {
      if (!force) void askToRunInBackgroundOnce();
      return true;
    }
    if (cur.display === 'denied' && !force) return false;
    const res = await LocalNotifications.requestPermissions();
    const ok = res.display === 'granted';
    if (ok) void syncReminders();
    if (ok && !force) void askToRunInBackgroundOnce();
    return ok;
  } catch {
    return false;
  }
}

export async function getReminderStatus(): Promise<ReminderStatus> {
  if (!isNative) return { platform: 'web' };
  try {
    const [perm, exact, pending] = await Promise.all([
      LocalNotifications.checkPermissions(),
      LocalNotifications.checkExactNotificationSetting().catch(() => ({ exact_alarm: 'granted' })),
      LocalNotifications.getPending(),
    ]);
    // Android keeps reminders that already popped up in this list, so count only the ones still to come.
    const now = Date.now();
    const upcoming = pending.notifications.filter((n) => {
      if (n.id >= RESERVED_BASE) return false;
      const fp = (n.extra as { fp?: unknown } | undefined)?.fp;
      const at = typeof fp === 'string' ? Number(fp.split('|')[0]) : NaN;
      return Number.isFinite(at) && at > now;
    }).length;
    return { platform: 'native', permission: perm.display, exact: exact.exact_alarm, scheduled: upcoming, lastError };
  } catch {
    return { platform: 'native', permission: 'unknown', exact: 'unknown', scheduled: 0, lastError };
  }
}

/** Opens Android's "Alarms & reminders" screen so reminders can fire on the exact minute. */
export async function openExactAlarmSettings() {
  if (!isNative) return;
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } finally {
    void syncReminders();
  }
}

/** A habit-style and a task-style notification 5 seconds from now, so you can see both work. */
export async function sendTestNotification(): Promise<boolean> {
  if (!isNative) return false;
  if (!(await requestReminderPermission(true))) return false;
  const exact = await canExact();
  const at = (s: number) => ({ at: new Date(Date.now() + s * 1000), allowWhileIdle: true });
  const iconColor = useData.getState().data.settings.accent ?? '#F5A524';
  await LocalNotifications.schedule({
    notifications: [
      { id: TEST_TASK_ID, title: '✅ Doable test: task reminder', body: 'Task reminders are working! This is what they look like.', schedule: at(5), isExactNotification: exact, channelId: CHANNEL.task, smallIcon: SMALL_ICON, iconColor } as LocalNotificationSchema,
      { id: TEST_HABIT_ID, title: '🌱 Doable test: habit reminder', body: 'Tick says hi! Habit reminders are working too ✓', schedule: at(7), isExactNotification: exact, channelId: CHANNEL.habit, smallIcon: SMALL_ICON, iconColor } as LocalNotificationSchema,
    ],
  });
  return true;
}
