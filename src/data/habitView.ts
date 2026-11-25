import { reducer as habitReducer, type Action as HabitAction } from '../habits/lib/reducer';
import type { HabitState } from '../habits/lib/types';
import { assignNotifIds } from './notifIds';
import type { AppData } from './types';

/* The habit code works on its own shape; this joins it to Tickday's document. */

let viewCache: { habits: AppData['habits']; weekStart: 0 | 1; view: HabitState } | null = null;

/**
 * The habit code's view of the data: { habits, completions, notes, settings: { weekStart, vacations } }.
 * Memoised, so it returns the SAME object until habits or the week start change (keeps React fast).
 */
export function habitView(data: AppData): HabitState {
  const h = data.habits;
  const weekStart = data.settings.weekStart;
  if (viewCache && viewCache.habits === h && viewCache.weekStart === weekStart) return viewCache.view;
  const view: HabitState = { habits: h.habits, completions: h.completions, notes: h.notes, settings: { weekStart, vacations: h.vacations } };
  viewCache = { habits: h, weekStart, view };
  return view;
}

/** Write a habit-code state back into the document (and give new habits a notification number). */
export function withHabitState(data: AppData, s: HabitState): AppData {
  const next: AppData = {
    ...data,
    habits: { habits: s.habits, completions: s.completions, notes: s.notes, vacations: s.settings.vacations },
    settings: s.settings.weekStart === data.settings.weekStart ? data.settings : { ...data.settings, weekStart: s.settings.weekStart },
  };
  return next.habits.habits.some((h) => !h.notifId) ? assignNotifIds(next) : next;
}

/** Apply one habit action to the document (pure; used by the store and the tests). */
export function applyHabitAction(data: AppData, action: HabitAction): AppData {
  const view = habitView(data);
  const after = habitReducer(view, action);
  return after === view ? data : withHabitState(data, after);
}

