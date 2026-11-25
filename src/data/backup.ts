import type { Task } from '../todo/model/types';
import { todayStr } from '../core/dates';
import { defaultData } from './defaults';
import { DataError, detect, type BackupKind, type Detected } from './migrate';
import { assignNotifIds } from './notifIds';
import { DATA_VERSION, type AppData, type HabitData, type TodoData } from './types';

/*
 * One backup file for everything:
 *   { app: 'Tickday', format: 1, version, exportedAt, appVersion, data: AppData }
 * Importing also accepts the old Habit Tracker and Doable backup files. An old single-app file only
 * touches its own half (habits OR tasks) and never changes the look (theme / accent).
 */

export interface BackupFile {
  app: 'Tickday';
  format: 1;
  version: number;
  exportedAt: string;
  appVersion: string;
  data: AppData;
}

export function backupFileName(now = Date.now()) {
  return `tickday-backup-${todayStr(now)}.json`;
}

export function exportJSON(data: AppData, now = Date.now(), appVersion = 'dev'): string {
  const file: BackupFile = { app: 'Tickday', format: 1, version: DATA_VERSION, exportedAt: new Date(now).toISOString(), appVersion, data };
  return JSON.stringify(file, null, 2);
}

export interface ImportStats {
  habits: number;
  checkIns: number;
  tasks: number;
  open: number;
  lists: number;
}

export interface ImportPlan {
  kind: BackupKind;
  /** "Tickday backup", "Habit Tracker backup", "Doable backup" */
  label: string;
  exportedAt?: string;
  detected: Detected;
  stats: ImportStats;
}

const LABEL: Record<BackupKind, string> = { tickday: 'Tickday backup', doable: 'Doable backup', 'habit-tracker': 'Habit Tracker backup' };

function countCheckIns(h?: HabitData): number {
  if (!h) return 0;
  return Object.values(h.completions).reduce((n, days) => n + Object.keys(days).length, 0);
}

/** Read a picked file. Throws DataError with a friendly message if it isn't a backup we know. */
export function parseBackup(text: string): ImportPlan {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new DataError("That file isn't a backup (it isn't valid JSON).");
  }
  const detected = detect(json);
  const habits = detected.data?.habits ?? detected.habits;
  const todo = detected.data?.todo ?? detected.todo;
  return {
    kind: detected.kind,
    label: LABEL[detected.kind],
    exportedAt: detected.exportedAt,
    detected,
    stats: {
      habits: habits?.habits.length ?? 0,
      checkIns: countCheckIns(habits),
      tasks: todo?.tasks.length ?? 0,
      open: todo?.tasks.filter((t) => t.completedAt == null).length ?? 0,
      lists: todo?.lists.length ?? 0,
    },
  };
}

/**
 * Merge tasks (from Doable): lists and tasks are matched by id; for tasks the most recently
 * updated copy wins.
 */
export function mergeTodo(current: TodoData, incoming: TodoData): TodoData {
  const lists = new Map(current.lists.map((l) => [l.id, l]));
  for (const l of incoming.lists) if (!lists.has(l.id)) lists.set(l.id, l);
  const tasks = new Map(current.tasks.map((t) => [t.id, t]));
  for (const t of incoming.tasks) {
    const mine = tasks.get(t.id);
    if (!mine || t.updatedAt > mine.updatedAt) tasks.set(t.id, t);
  }
  return { lists: [...lists.values()], tasks: [...tasks.values()].map((t): Task => ({ ...t })) };
}

/**
 * Merge habits: matched by id. Your habit's settings stay; each day keeps the higher count,
 * your notes win (theirs fill the gaps); new habits are added at the end; vacations are combined.
 */
export function mergeHabits(current: HabitData, incoming: HabitData): HabitData {
  const have = new Set(current.habits.map((h) => h.id));
  const habits = [...current.habits, ...incoming.habits.filter((h) => !have.has(h.id))];
  const completions = { ...current.completions };
  for (const [id, days] of Object.entries(incoming.completions)) {
    const mine = { ...(completions[id] ?? {}) };
    for (const [day, n] of Object.entries(days)) mine[day] = Math.max(mine[day] ?? 0, n);
    completions[id] = mine;
  }
  const notes = { ...current.notes };
  for (const [id, days] of Object.entries(incoming.notes)) notes[id] = { ...days, ...(notes[id] ?? {}) };
  const seen = new Set<string>();
  const vacations = [...current.vacations, ...incoming.vacations]
    .filter((r) => {
      const k = `${r.from}|${r.to}`;
      return seen.has(k) ? false : (seen.add(k), true);
    })
    .sort((a, b) => (a.from < b.from ? -1 : 1));
  return { habits, completions, notes, vacations };
}

export type ImportMode = 'merge' | 'replace';

/** What importing `plan` does to `current`. Notification ids are re-made unique across habits and tasks. */
export function applyImport(current: AppData, plan: ImportPlan, mode: ImportMode): AppData {
  const d = plan.detected;
  let next: AppData;
  if (d.data) {
    next =
      mode === 'replace'
        ? d.data
        : {
            ...current,
            habits: mergeHabits(current.habits, d.data.habits),
            todo: mergeTodo(current.todo, d.data.todo),
            meta: { ...current.meta, nextNotifId: Math.max(current.meta.nextNotifId, d.data.meta.nextNotifId) },
          };
  } else if (d.todo) {
    next =
      mode === 'replace'
        ? { ...current, todo: d.todo, settings: { ...current.settings, ...d.todoSettings } }
        : { ...current, todo: mergeTodo(current.todo, d.todo) };
  } else if (d.habits) {
    next = { ...current, habits: mode === 'replace' ? d.habits : mergeHabits(current.habits, d.habits) };
  } else {
    throw new DataError('Nothing to import.');
  }
  const keep = { tasks: new Set(current.todo.tasks.map((t) => t.id)), habits: new Set(current.habits.habits.map((h) => h.id)) };
  return assignNotifIds({ ...next, meta: { ...next.meta, welcomeDone: true } }, keep);
}

export type ResetWhat = 'habits' | 'tasks' | 'all';

/** Fresh start for one half (or both). Settings are kept. */
export function resetData(current: AppData, what: ResetWhat, now = Date.now()): AppData {
  const fresh = defaultData(now);
  return {
    ...current,
    habits: what === 'tasks' ? current.habits : fresh.habits,
    todo: what === 'habits' ? current.todo : fresh.todo,
  };
}
