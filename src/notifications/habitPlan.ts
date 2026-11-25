import { addDays, epochDay, localEpoch, toLocalDate } from '../core/dates';
import { habitView } from '../data/habitView';
import { habitNotificationId } from '../data/notifIds';
import type { AppData } from '../data/types';
import { countOn, isMet, isOff, isScheduled, ruleOn, weekOf, weekProgress } from '../habits/lib/schedule';
import { currentStreak, streakLabel } from '../habits/lib/streaks';
import type { Habit, HabitState } from '../habits/lib/types';

/*
 * Habit reminders (new in Doable: the Habit Tracker's own reminders were removed because they didn't work).
 *
 * Each habit with a reminder time gets one notification per upcoming day it's actually due, planned
 * HORIZON_DAYS ahead, instead of one repeating alarm. That way it can skip days that are paused, on
 * vacation, not scheduled, or already done (no nagging after you've ticked it off), and it uses the same
 * reliable engine as task reminders (exact alarms, re-planned on every change and every app start/resume).
 */

export const HORIZON_DAYS = 14;
export const MAX_HABIT_REMINDERS = 150;

export interface PlannedHabitReminder {
  kind: 'habit';
  id: number;
  at: number;
  habitId: string;
  date: string;
  title: string;
  body: string;
  /** fingerprint: changes whenever anything visible or the time changes */
  fp: string;
}

function pick<T>(list: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return list[Math.abs(h) % list.length];
}

/** What Tick says in the notification (short, cheeky, same voice as the app). */
function bodyFor(h: Habit, state: HabitState, date: string, today: string): string {
  const target = ruleOn(h, date).target;
  const count = date === today ? countOn(state.completions, h.id, date) : 0;
  const unit = h.unit ? ` ${h.unit}` : '';
  if (target > 1 && count > 0) return `${count}/${target}${unit} so far. Tick believes in you ✓`;
  if (date === today) {
    const s = currentStreak(h, state, today);
    if (s.count >= 2) return pick([`Keep your 🔥 ${streakLabel(s.count, s.unit)} streak going!`, `${streakLabel(s.count, s.unit)} in a row. Don’t break the chain! 💪`], h.id + date);
  }
  const goal = target > 1 ? `Goal: ${target}${unit}. ` : '';
  return goal + pick(['Tick says it’s time ✓', 'Quick one? Tick’s waiting 👀', 'One tick and you’re done for today ✨', 'Your future self says thanks 🙌'], h.id + date);
}

/** Should the habit be reminded about on `d`? (Not paused/archived, scheduled, not yet done.) */
function dueOn(h: Habit, state: HabitState, d: string, today: string, thisWeekMet: () => boolean): boolean {
  if (d < h.createdAt || isOff(h, state.settings, d)) return false;
  if (ruleOn(h, d).schedule.kind === 'weekly') {
    // "N times a week": any day counts until this week's goal is met (later weeks start fresh).
    if (weekOf(d, state.settings.weekStart).start === weekOf(today, state.settings.weekStart).start && thisWeekMet()) return false;
  } else if (!isScheduled(h, d)) {
    return false;
  }
  return !isMet(h, state.completions, d);
}

export function planHabitReminders(data: AppData, now: number, max = MAX_HABIT_REMINDERS): PlannedHabitReminder[] {
  if (!data.settings.notify.habits) return [];
  const state = habitView(data);
  const today = toLocalDate(now);
  const out: PlannedHabitReminder[] = [];
  for (const h of state.habits) {
    if (!h.reminder || !h.notifId || (h.archivedAt && h.archivedAt <= today)) continue;
    let met: boolean | undefined;
    const thisWeekMet = () => {
      if (met === undefined) {
        const p = weekProgress(h, state, today);
        met = p.done >= p.times;
      }
      return met;
    };
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const d = addDays(today, i);
      if (!dueOn(h, state, d, today, thisWeekMet)) continue;
      let at = localEpoch(d, h.reminder);
      // Snoozed from the notification: today's reminder moves to the snooze time.
      if (d === today && h.snoozedUntil != null && h.snoozedUntil > now && toLocalDate(h.snoozedUntil) === today) at = h.snoozedUntil;
      if (at <= now) continue;
      const title = `${h.emoji} ${h.name}`;
      const body = bodyFor(h, state, d, today);
      out.push({ kind: 'habit', id: habitNotificationId(h.notifId, epochDay(d)), at, habitId: h.id, date: d, title, body, fp: `${at}|${title}|${body}` });
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out.slice(0, max);
}
