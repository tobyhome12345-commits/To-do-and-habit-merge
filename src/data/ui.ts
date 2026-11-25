import { create } from 'zustand';
import type { ID, Task } from '../todo/model/types';
import type { DateKey } from '../core/dates';
import type { Milestone } from '../habits/components/MilestoneToast';
import type { ImportPlan } from './backup';
import { popBack } from '../core/backStack';

/*
 * Where you are in the app (not saved). Bottom tabs: Today · Habits · To-Do.
 * Each section has its own sub-views, and the To-Do section can push list / smart-view / search screens.
 * Settings is a full-screen page opened from the gear in any header.
 */

export type Tab = 'today' | 'habits' | 'todo';
export type HabitView = 'list' | 'calendar' | 'stats';
export type TodoView = 'today' | 'upcoming' | 'browse';
export type SmartViewId = 'overdue' | 'completed' | 'all';

export type Route =
  | { kind: 'list'; listId: ID }
  | { kind: 'smart'; view: SmartViewId }
  | { kind: 'search' }
  | { kind: 'settings' };

export type Sheet =
  | { kind: 'task'; taskId?: ID; draft?: Partial<Task> }
  | { kind: 'list'; listId?: ID }
  | { kind: 'sort'; viewKey: string; allowManual: boolean; showListFilter: boolean }
  | { kind: 'deleteList'; listId: ID }
  | { kind: 'habit'; habitId?: string }
  | { kind: 'note'; habitId: string; date: DateKey }
  | { kind: 'add' }
  | { kind: 'import'; plan: ImportPlan }
  | { kind: 'reset' }
  | null;

interface UIState {
  tab: Tab;
  habitView: HabitView;
  todoView: TodoView;
  stack: Route[];
  sheet: Sheet;
  /** tasks currently playing the tick animation (committed after it finishes) */
  completing: Record<ID, true>;
  /** Habit streak milestone being celebrated. */
  milestone: Milestone | null;
  /** Calendar's selected habit ('all' or a habit id). */
  calendarHabit: string;
  /** Bumped to make Tick hop (any check-off). */
  hop: number;
  setTab: (t: Tab) => void;
  setHabitView: (v: HabitView) => void;
  setTodoView: (v: TodoView) => void;
  push: (r: Route) => void;
  pop: () => void;
  openSheet: (s: NonNullable<Sheet>) => void;
  closeSheet: () => void;
  /** Android back button. Returns false when there's nothing left to go back to. */
  back: () => boolean;
  setCompleting: (id: ID, on: boolean) => void;
  setMilestone: (m: Milestone | null) => void;
  setCalendarHabit: (id: string) => void;
  bumpHop: () => void;
}

export const useUI = create<UIState>((set, get) => ({
  tab: 'today',
  habitView: 'list',
  todoView: 'today',
  stack: [],
  sheet: null,
  completing: {},
  milestone: null,
  calendarHabit: 'all',
  hop: 0,
  setTab: (tab) => set({ tab, stack: [] }),
  setHabitView: (habitView) => set({ habitView }),
  setTodoView: (todoView) => set({ todoView, stack: [] }),
  push: (r) => set((s) => ({ stack: [...s.stack, r] })),
  pop: () => set((s) => ({ stack: s.stack.slice(0, -1) })),
  openSheet: (sheet) => set({ sheet }),
  closeSheet: () => set({ sheet: null }),
  back: () => {
    // Open sheets and pop-ups close themselves (with their animation) through the back stack.
    if (popBack()) return true;
    const s = get();
    if (s.sheet) {
      set({ sheet: null });
      return true;
    }
    if (s.stack.length) {
      set({ stack: s.stack.slice(0, -1) });
      return true;
    }
    if (s.tab !== 'today') {
      set({ tab: 'today' });
      return true;
    }
    return false;
  },
  setCompleting: (id, on) =>
    set((s) => {
      const next = { ...s.completing };
      if (on) next[id] = true;
      else delete next[id];
      return { completing: next };
    }),
  setMilestone: (milestone) => set({ milestone }),
  setCalendarHabit: (calendarHabit) => set({ calendarHabit }),
  bumpHop: () => set((s) => ({ hop: s.hop + 1 })),
}));
