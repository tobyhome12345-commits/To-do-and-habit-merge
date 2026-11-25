import { create } from 'zustand';
import type { ID, List, Task, ViewPrefs } from '../todo/model/types';
import { INBOX_ID } from '../todo/model/types';
import { blankTask, uid } from '../todo/model/data';
import { nextOccurrence } from '../todo/model/recurrence';
import { relativeDay, todayStr } from '../core/dates';
import type { Action as HabitAction } from '../habits/lib/reducer';
import type { HabitState } from '../habits/lib/types';
import { applyHabitAction, habitView } from './habitView';
import { defaultData } from './defaults';
import { assignNotifIds } from './notifIds';
import type { AppData, Settings } from './types';

/*
 * Doable's one store (Zustand). It holds the whole saved document:
 *  - task changes go through transact() (from Doable), which records the "before" copy of every task/list
 *    it touches, so undo puts exactly those back without wiping out unrelated edits made afterwards;
 *  - habit changes go through the Habit Tracker's pure reducer, via habitView()/withHabitState();
 *  - settings are shared.
 */

export type { HabitAction };
export { applyHabitAction, habitView, withHabitState } from './habitView';

export interface UndoEntry {
  id: number;
  label: string;
  tasks: [ID, Task | null][]; // null = didn't exist before (so undo deletes it)
  lists: [ID, List | null][];
}

export interface SnackAction {
  label: string;
  icon?: 'undo' | 'note';
  run: () => void;
}

export interface Snack {
  id: number;
  text: string;
  emoji?: string;
  /** Task undo entry (Doable-style UNDO button). */
  undoId?: number;
  /** Extra buttons (habit check-offs get "Note" and "Undo"). */
  actions?: SnackAction[];
}

interface Tx {
  data: AppData;
  task(id: ID): Task | undefined;
  putTask(t: Task): void;
  removeTask(id: ID): void;
  list(id: ID): List | undefined;
  putList(l: List): void;
  removeList(id: ID): void;
  allocNotifId(): number;
  tasks(): Task[];
  lists(): List[];
}

export interface DataState {
  data: AppData;
  ready: boolean;
  undoStack: UndoEntry[];
  snack: Snack | null;

  init(data: AppData): void;
  replaceData(data: AppData): void;

  /* habits */
  habit(action: HabitAction): void;
  /** Move today's reminder for a habit `minutes` from now (notification Snooze button). */
  snoozeHabit(id: string, minutes: number): void;

  /* tasks */
  addTask(p: Partial<Task>, opts?: { position?: 'top' | 'bottom'; silent?: boolean }): Task;
  updateTask(id: ID, patch: Partial<Task>): void;
  deleteTask(id: ID): void;
  toggleComplete(id: ID): void;
  snooze(id: ID, minutes: number): void;
  setOrders(entries: [ID, number][]): void;
  toggleSubtask(taskId: ID, subId: ID): void;
  clearCompleted(ids: ID[]): void;
  moveTasksToDate(ids: ID[], date: string): void;

  addList(p: Partial<List>): List;
  updateList(id: ID, patch: Partial<List>): void;
  deleteList(id: ID, mode: 'move' | 'delete'): void;
  setListOrder(ids: ID[]): void;

  /* shared */
  updateSettings(patch: Partial<Settings>): void;
  setViewPrefs(key: string, prefs: ViewPrefs): void;
  setMeta(patch: Partial<AppData['meta']>): void;

  undo(entryId?: number): void;
  showSnack(text: string, undoId?: number, emoji?: string, actions?: SnackAction[]): void;
  dismissSnack(): void;
}

let undoSeq = 1;
let snackSeq = 1;

export const useData = create<DataState>((set, get) => {
  function transact(label: string | null, fn: (tx: Tx) => void): number | undefined {
    const data = get().data;
    const tasks = new Map(data.todo.tasks.map((t) => [t.id, t]));
    const lists = new Map(data.todo.lists.map((l) => [l.id, l]));
    const beforeT = new Map<ID, Task | null>();
    const beforeL = new Map<ID, List | null>();
    let nextNotifId = data.meta.nextNotifId;
    const tx: Tx = {
      data,
      task: (id) => tasks.get(id),
      putTask(t) {
        if (!beforeT.has(t.id)) beforeT.set(t.id, tasks.get(t.id) ?? null);
        tasks.set(t.id, t);
      },
      removeTask(id) {
        if (!beforeT.has(id)) beforeT.set(id, tasks.get(id) ?? null);
        tasks.delete(id);
      },
      list: (id) => lists.get(id),
      putList(l) {
        if (!beforeL.has(l.id)) beforeL.set(l.id, lists.get(l.id) ?? null);
        lists.set(l.id, l);
      },
      removeList(id) {
        if (!beforeL.has(id)) beforeL.set(id, lists.get(id) ?? null);
        lists.delete(id);
      },
      allocNotifId: () => nextNotifId++,
      tasks: () => [...tasks.values()],
      lists: () => [...lists.values()],
    };
    fn(tx);
    if (!beforeT.size && !beforeL.size && nextNotifId === data.meta.nextNotifId) return undefined;
    const newData: AppData = {
      ...data,
      todo: { tasks: [...tasks.values()], lists: [...lists.values()] },
      meta: { ...data.meta, nextNotifId },
    };
    let entryId: number | undefined;
    const patch: Partial<DataState> = { data: newData };
    if (label) {
      entryId = undoSeq++;
      patch.undoStack = [...get().undoStack, { id: entryId, label, tasks: [...beforeT], lists: [...beforeL] }].slice(-20);
    }
    set(patch);
    return entryId;
  }

  const minOrder = (ts: Task[]) => ts.reduce((m, t) => Math.min(m, t.order), Infinity);
  const maxOrder = (ts: Task[]) => ts.reduce((m, t) => Math.max(m, t.order), -Infinity);

  return {
    data: defaultData(),
    ready: false,
    undoStack: [],
    snack: null,

    init: (data) => set({ data, ready: true, undoStack: [] }),
    replaceData: (data) => set({ data: assignNotifIds(data), undoStack: [], snack: null }),

    habit(action) {
      const data = get().data;
      const next = applyHabitAction(data, action);
      if (next !== data) set({ data: next });
    },

    snoozeHabit(id, minutes) {
      const data = get().data;
      const until = Date.now() + minutes * 60_000;
      set({ data: { ...data, habits: { ...data.habits, habits: data.habits.habits.map((h) => (h.id === id ? { ...h, snoozedUntil: until } : h)) } } });
    },

    addTask(p, opts = {}) {
      let created!: Task;
      transact(null, (tx) => {
        const all = tx.tasks();
        const order =
          opts.position === 'bottom'
            ? (all.length ? maxOrder(all) : 0) + 1
            : (all.length ? minOrder(all) : 0) - 1;
        const now = Date.now();
        created = blankTask({ ...p, id: uid(), notifId: tx.allocNotifId(), order, createdAt: now, updatedAt: now }, now);
        if (!tx.list(created.listId)) created.listId = INBOX_ID;
        if (created.repeat && !created.dueDate) created.dueDate = todayStr();
        if (p.reminder === undefined && created.dueDate) created.reminder = tx.data.settings.defaultReminder;
        if (!created.dueDate) created.dueTime = null;
        tx.putTask(created);
      });
      return created;
    },

    updateTask(id, patch) {
      transact(null, (tx) => {
        const t = tx.task(id);
        if (!t) return;
        const next: Task = { ...t, ...patch, updatedAt: Date.now() };
        const timingChanged =
          ('dueDate' in patch && patch.dueDate !== t.dueDate) ||
          ('dueTime' in patch && patch.dueTime !== t.dueTime) ||
          ('reminder' in patch && patch.reminder !== t.reminder);
        if (timingChanged) next.snoozedUntil = null;
        if (!next.dueDate) {
          next.dueTime = null;
          next.repeat = null;
        }
        // Moving a repeating task's date re-anchors the series on the new date.
        if (next.repeat && next.dueDate && 'dueDate' in patch && patch.dueDate !== t.dueDate && !('repeat' in patch)) {
          next.repeat = { ...next.repeat, anchor: next.dueDate };
        }
        tx.putTask(next);
      });
    },

    deleteTask(id) {
      const t = get().data.todo.tasks.find((x) => x.id === id);
      if (!t) return;
      const undoId = transact('Delete task', (tx) => tx.removeTask(id));
      get().showSnack(`Deleted “${truncate(t.title)}”`, undoId, '🗑️');
    },

    toggleComplete(id) {
      const t = get().data.todo.tasks.find((x) => x.id === id);
      if (!t) return;
      const now = Date.now();
      if (t.completedAt != null) {
        const undoId = transact('Uncomplete', (tx) => tx.putTask({ ...t, completedAt: null, updatedAt: now }));
        get().showSnack(`Moved “${truncate(t.title)}” back to open`, undoId, '↩️');
        return;
      }
      let msg = `Completed “${truncate(t.title)}”`;
      const undoId = transact('Complete', (tx) => {
        const today = todayStr(now);
        const next = t.repeat && t.dueDate ? nextOccurrence(t.repeat, t.dueDate, today, today, tx.data.settings.weekStart) : null;
        if (t.repeat && next) {
          const seriesId = t.seriesId ?? t.id;
          // History copy for the Completed view…
          tx.putTask({
            ...t,
            id: uid(),
            repeat: null,
            seriesId,
            completedAt: now,
            snoozedUntil: null,
            notifId: tx.allocNotifId(),
            subtasks: t.subtasks.map((s) => ({ ...s })),
            updatedAt: now,
          });
          // …and the live task rolls forward.
          tx.putTask({
            ...t,
            seriesId,
            dueDate: next,
            snoozedUntil: null,
            subtasks: t.subtasks.map((s) => ({ ...s, done: false })),
            updatedAt: now,
          });
          msg = `Nice! Next one: ${relativeDay(next, today)}`;
        } else {
          tx.putTask({ ...t, completedAt: now, snoozedUntil: null, updatedAt: now });
        }
      });
      get().showSnack(msg, undoId, '🎉');
    },

    snooze(id, minutes) {
      transact(null, (tx) => {
        const t = tx.task(id);
        if (t) tx.putTask({ ...t, snoozedUntil: Date.now() + minutes * 60_000, updatedAt: Date.now() });
      });
    },

    setOrders(entries) {
      transact(null, (tx) => {
        for (const [id, order] of entries) {
          const t = tx.task(id);
          if (t && t.order !== order) tx.putTask({ ...t, order, updatedAt: Date.now() });
        }
      });
    },

    toggleSubtask(taskId, subId) {
      transact(null, (tx) => {
        const t = tx.task(taskId);
        if (!t) return;
        tx.putTask({ ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)), updatedAt: Date.now() });
      });
    },

    clearCompleted(ids) {
      if (!ids.length) return;
      const undoId = transact('Clear completed', (tx) => ids.forEach((id) => tx.removeTask(id)));
      get().showSnack(`Cleared ${ids.length} completed task${ids.length === 1 ? '' : 's'}`, undoId, '🧹');
    },

    moveTasksToDate(ids, date) {
      if (!ids.length) return;
      const undoId = transact('Reschedule', (tx) => {
        for (const id of ids) {
          const t = tx.task(id);
          if (!t) continue;
          tx.putTask({ ...t, dueDate: date, snoozedUntil: null, repeat: t.repeat ? { ...t.repeat, anchor: date } : null, updatedAt: Date.now() });
        }
      });
      get().showSnack(`Moved ${ids.length} task${ids.length === 1 ? '' : 's'} to ${relativeDay(date, todayStr()).toLowerCase()}`, undoId, '📅');
    },

    addList(p) {
      let created!: List;
      transact(null, (tx) => {
        const ls = tx.lists();
        created = {
          id: uid(),
          name: 'New list',
          color: '#6f7cf7',
          order: (ls.length ? Math.max(...ls.map((l) => l.order)) : 0) + 1,
          createdAt: Date.now(),
          ...p,
        };
        tx.putList(created);
      });
      return created;
    },

    updateList(id, patch) {
      transact(null, (tx) => {
        const l = tx.list(id);
        if (l) tx.putList({ ...l, ...patch, id });
      });
    },

    deleteList(id, mode) {
      if (id === INBOX_ID) return;
      const l = get().data.todo.lists.find((x) => x.id === id);
      if (!l) return;
      const undoId = transact('Delete list', (tx) => {
        for (const t of tx.tasks()) {
          if (t.listId !== id) continue;
          if (mode === 'move') tx.putTask({ ...t, listId: INBOX_ID, updatedAt: Date.now() });
          else tx.removeTask(t.id);
        }
        tx.removeList(id);
      });
      get().showSnack(`Deleted list “${truncate(l.name)}”`, undoId, '🗑️');
    },

    setListOrder(ids) {
      transact(null, (tx) => {
        ids.forEach((id, i) => {
          const l = tx.list(id);
          if (l && l.order !== i) tx.putList({ ...l, order: i });
        });
      });
    },

    updateSettings(patch) {
      const data = get().data;
      set({ data: { ...data, settings: { ...data.settings, ...patch } } });
    },

    setViewPrefs(key, prefs) {
      const data = get().data;
      set({ data: { ...data, settings: { ...data.settings, viewPrefs: { ...data.settings.viewPrefs, [key]: prefs } } } });
    },

    setMeta(patch) {
      const data = get().data;
      set({ data: { ...data, meta: { ...data.meta, ...patch } } });
    },

    undo(entryId) {
      const stack = get().undoStack;
      const idx = entryId == null ? stack.length - 1 : stack.findIndex((e) => e.id === entryId);
      if (idx < 0) return;
      const entry = stack[idx];
      set({ undoStack: stack.filter((_, i) => i !== idx) });
      transact(null, (tx) => {
        for (const [id, before] of entry.lists) before ? tx.putList(before) : tx.removeList(id);
        for (const [id, before] of entry.tasks) before ? tx.putTask(before) : tx.removeTask(id);
      });
      set({ snack: null });
    },

    showSnack: (text, undoId, emoji, actions) => set({ snack: { id: snackSeq++, text, undoId, emoji, actions } }),
    dismissSnack: () => set({ snack: null }),
  };
});

function truncate(s: string, n = 28) {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

/** Non-hook accessor for code outside React. */
export const store = () => useData.getState();

/** The Habit Tracker's `useStore()`: habit state + dispatch, on top of the shared store. */
export function useHabits(): { state: HabitState; dispatch: (a: HabitAction) => void } {
  const state = useData((s) => habitView(s.data));
  const dispatch = useData((s) => s.habit);
  return { state, dispatch };
}
