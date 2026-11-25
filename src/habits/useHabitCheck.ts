import { useCallback } from 'react';
import { useData, habitView, type HabitAction } from '../data/store';
import { useUI } from '../data/ui';
import { successHaptic, tapHaptic } from '../core/haptics';
import { countOn, liveHabits, ruleOn, todayInfo } from './lib/schedule';
import { currentStreak } from './lib/streaks';
import { isMilestone, tickLevel } from '../mascot/mood';
import type { DateKey, Habit } from './lib/types';

/*
 * Checking a habit off, the same way everywhere (the Habits tab and the combined Today view).
 * From the Habit Tracker: Tick hops, a snackbar offers "Note" and "Undo", the phone buzzes
 * (a stronger buzz when it finishes the day) and streak milestones get celebrated.
 */

const shown = new Set<string>();

function celebrateMilestone(habit: Habit, date: DateKey, count: number, today: DateKey) {
  if (date !== today) return;
  const before = habitView(useData.getState().data);
  const days = { ...(before.completions[habit.id] ?? {}), [date]: count };
  const after = { ...before, completions: { ...before.completions, [habit.id]: days } };
  const s = currentStreak(habit, after, today);
  // Only when this check-off actually grew the streak (not a bonus tick on an off day)
  if (!isMilestone(s.count) || s.count <= currentStreak(habit, before, today).count) return;
  const key = `${habit.id}:${today}:${s.count}`;
  if (shown.has(key)) return;
  shown.add(key);
  const oldStage = tickLevel(before, today).stage;
  const stage = tickLevel(after, today).stage;
  useUI.getState().setMilestone({ key, habit, streak: s.count, unit: s.unit, stage, grew: stage > oldStage });
  setTimeout(successHaptic, 250);
}

/** Would checking `habit` off finish everything due today? */
function finishesDay(habit: Habit, today: DateKey): boolean {
  const state = habitView(useData.getState().data);
  return liveHabits(state, today).every((h) => {
    if (h.id === habit.id) return true;
    const k = todayInfo(h, state, today).kind;
    return k !== 'due';
  });
}

export function applyCount(habit: Habit, date: DateKey, next: number, today: DateKey) {
  const store = useData.getState();
  const ui = useUI.getState();
  const prev = countOn(store.data.habits.completions, habit.id, date);
  const target = ruleOn(habit, date).target;
  const before = finishesDay(habit, today);
  celebrateMilestoneIfMet(habit, date, prev, next, target, today);
  store.habit({ type: 'setCount', id: habit.id, date, count: next } satisfies HabitAction);
  if (date === today && next > prev) ui.bumpHop();
  const justMet = prev < target && next >= target;
  if (!justMet || date !== today) {
    tapHaptic();
    return;
  }
  store.showSnack(`✓ ${habit.emoji} ${habit.name}`, undefined, undefined, [
    { label: 'Note', icon: 'note', run: () => useUI.getState().openSheet({ kind: 'note', habitId: habit.id, date }) },
    { label: 'Undo', icon: 'undo', run: () => useData.getState().habit({ type: 'setCount', id: habit.id, date, count: prev }) },
  ]);
  if (before) successHaptic();
  else tapHaptic();
}

function celebrateMilestoneIfMet(habit: Habit, date: DateKey, prev: number, next: number, target: number, today: DateKey) {
  if (prev < target && next >= target) celebrateMilestone(habit, date, next, today);
}

/** onTap (+1 / −1) and onToggleDay (done ↔ not done) for habit cards and rows. */
export function useHabitCheck(today: DateKey) {
  const onTap = useCallback(
    (habit: Habit, date: DateKey, delta: 1 | -1) => {
      const cur = countOn(useData.getState().data.habits.completions, habit.id, date);
      applyCount(habit, date, Math.max(0, cur + delta), today);
    },
    [today],
  );
  const onToggleDay = useCallback(
    (habit: Habit, date: DateKey) => {
      const target = ruleOn(habit, date).target;
      const cur = countOn(useData.getState().data.habits.completions, habit.id, date);
      applyCount(habit, date, cur >= target ? 0 : target, today);
    },
    [today],
  );
  return { onTap, onToggleDay };
}
