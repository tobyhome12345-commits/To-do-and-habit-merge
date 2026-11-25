import { normalizeAccent, normalizeState } from '../habits/lib/normalize';
import { DataError, cleanTodo, cleanTodoSettings, type TodoSettings } from '../todo/model/data';
import { defaultData, defaultSettings } from './defaults';
import { assignNotifIds } from './notifIds';
import { DATA_VERSION, type AppData, type HabitData, type Settings, type TodoData } from './types';

export { DataError };

/*
 * Reading saved data and backup files.
 *
 * Tickday's own document has a `version`. When the shape changes, bump DATA_VERSION and add a step to
 * MIGRATIONS that turns version N into N+1; older saves and backups are upgraded one step at a time.
 *
 * It also reads the two apps Tickday replaces:
 *  - Doable backups:        { app: 'Doable', format: 1, data: { schemaVersion: 1, lists, tasks, settings, meta } }
 *  - Habit Tracker backups: { app: 'habit-tracker', version: 1 | 2, habits, completions, notes?, settings }
 * Each half is cleaned by the old app's own validation code (normalizeState / cleanTodo).
 */

type Raw = Record<string, any>;
const isObj = (x: unknown): x is Raw => !!x && typeof x === 'object' && !Array.isArray(x);
const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);

/** MIGRATIONS[n] upgrades a version-n document to version n+1. (None yet: v1 is the first.) */
export const MIGRATIONS: Record<number, (doc: Raw) => Raw> = {};

export function upgrade(doc: Raw): Raw {
  let v = Math.floor(num(doc.version, 1));
  if (v > DATA_VERSION) throw new DataError(`This file is from a newer version of Tickday (data v${v}). Update the app first.`);
  if (v < 1) v = 1;
  let out = doc;
  while (v < DATA_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new DataError(`Can't upgrade data from v${v}.`);
    out = step(out);
    v++;
  }
  return { ...out, version: DATA_VERSION };
}

export function cleanSettings(x: unknown): Settings {
  const d = defaultSettings();
  if (!isObj(x)) return d;
  const notify = isObj(x.notify) ? x.notify : {};
  return {
    theme: ['system', 'light', 'dark'].includes(x.theme) ? x.theme : d.theme,
    accent: normalizeAccent(x.accent),
    weekStart: x.weekStart === 0 ? 0 : 1,
    haptics: typeof x.haptics === 'boolean' ? x.haptics : d.haptics,
    reduceMotion: typeof x.reduceMotion === 'boolean' ? x.reduceMotion : d.reduceMotion,
    notify: {
      habits: typeof notify.habits === 'boolean' ? notify.habits : d.notify.habits,
      tasks: typeof notify.tasks === 'boolean' ? notify.tasks : d.notify.tasks,
    },
    ...cleanTodoSettings(x),
  };
}

/** Clean the habit half using the Habit Tracker's own validation (also migrates its v1 format). */
export function cleanHabits(raw: unknown, weekStart: 0 | 1 = 1): HabitData {
  const src = isObj(raw) ? raw : {};
  const vacations = isObj(src.settings) ? src.settings.vacations : src.vacations;
  const s = normalizeState({ ...src, habits: Array.isArray(src.habits) ? src.habits : [], settings: { weekStart, vacations } });
  return { habits: s.habits, completions: s.completions, notes: s.notes, vacations: s.settings.vacations };
}

/** Turn a Tickday document (any supported version) into valid, current AppData. */
export function normalizeAppData(raw: unknown): AppData {
  if (!isObj(raw) || !isObj(raw.habits) || !isObj(raw.todo)) throw new DataError("That doesn't look like Tickday data.");
  const doc = upgrade(raw);
  const settings = cleanSettings(doc.settings);
  const habits = cleanHabits(doc.habits, settings.weekStart);
  let todo: TodoData;
  try {
    todo = cleanTodo(doc.todo);
  } catch {
    todo = defaultData().todo;
  }
  const meta = isObj(doc.meta) ? doc.meta : {};
  return assignNotifIds({
    version: DATA_VERSION,
    settings,
    habits,
    todo,
    meta: {
      createdAt: num(meta.createdAt, Date.now()),
      nextNotifId: Math.max(1, Math.floor(num(meta.nextNotifId, 1))),
      welcomeDone: meta.welcomeDone === true,
    },
  });
}

/* ---------------- recognising any file ---------------- */

export type BackupKind = 'tickday' | 'doable' | 'habit-tracker';

export interface Detected {
  kind: BackupKind;
  exportedAt?: string;
  /** Full document (Tickday files only). */
  data?: AppData;
  /** One half (old single-app files). */
  habits?: HabitData;
  todo?: TodoData;
  todoSettings?: TodoSettings;
}

function looksDoable(o: Raw) {
  return Array.isArray(o.tasks) && Array.isArray(o.lists);
}
function looksHabit(o: Raw) {
  return Array.isArray(o.habits) && !looksDoable(o);
}

/** Work out what a parsed JSON file is and clean it. Throws DataError with a friendly message. */
export function detect(json: unknown): Detected {
  if (!isObj(json)) throw new DataError("That file isn't a Tickday, Habit Tracker or Doable backup.");
  const exportedAt = typeof json.exportedAt === 'string' ? json.exportedAt : undefined;

  // Tickday (wrapped backup file, or a bare document)
  if (json.app === 'Tickday' || (isObj(json.habits) && isObj(json.todo))) {
    const payload = json.app === 'Tickday' && isObj(json.data) ? json.data : json;
    return { kind: 'tickday', exportedAt, data: normalizeAppData(payload) };
  }

  // Doable (wrapped backup file, or bare Doable data)
  if (json.app === 'Doable' || looksDoable(json)) {
    const payload = json.app === 'Doable' && isObj(json.data) ? json.data : json;
    try {
      return { kind: 'doable', exportedAt, todo: cleanTodo(payload), todoSettings: cleanTodoSettings(payload.settings) };
    } catch (e) {
      throw new DataError(e instanceof DataError && e.message.includes('newer') ? e.message : "That doesn't look like a Doable backup.");
    }
  }

  // Habit Tracker (v1 or v2)
  if (json.app === 'habit-tracker' || looksHabit(json)) {
    try {
      return { kind: 'habit-tracker', exportedAt, habits: cleanHabits(json) };
    } catch {
      throw new DataError("That doesn't look like a Habit Tracker backup.");
    }
  }

  throw new DataError("That file isn't a Tickday, Habit Tracker or Doable backup.");
}

/**
 * Load Tickday's saved document from storage. Falls back to wrapping old single-app data,
 * so it never throws for anything recognisable.
 */
export function migrate(raw: unknown): AppData {
  const d = detect(raw);
  if (d.data) return d.data;
  const base = defaultData();
  if (d.todo) return assignNotifIds({ ...base, todo: d.todo, settings: { ...base.settings, ...d.todoSettings } });
  return assignNotifIds({ ...base, habits: d.habits! });
}
