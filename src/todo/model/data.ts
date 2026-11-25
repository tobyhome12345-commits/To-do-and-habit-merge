import type { ID, List, Priority, Repeat, Settings, Subtask, Task, TodoData, ViewPrefs } from './types';
import { DOABLE_SCHEMA, INBOX_ID, defaultFilters } from './types';
import { isValidDate, isValidTime, todayStr } from '../../core/dates';
import { uid } from '../../core/ids';

export { uid };

export const INBOX_COLOR = '#6f7cf7';

export function inboxList(now = Date.now(), order = 0): List {
  return { id: INBOX_ID, name: 'Inbox', color: INBOX_COLOR, emoji: '📥', order, createdAt: now };
}

export function defaultLists(now = Date.now()): List[] {
  return [
    inboxList(now),
    { id: uid(), name: 'Home', color: '#ff8f3f', emoji: '🏠', order: 1, createdAt: now },
    { id: uid(), name: 'School', color: '#3aa5f2', emoji: '🎒', order: 2, createdAt: now },
    { id: uid(), name: 'Personal', color: '#3dbe7e', emoji: '🌱', order: 3, createdAt: now },
  ];
}

export function blankTask(p: Partial<Task> & { notifId: number }, now = Date.now()): Task {
  return {
    id: uid(),
    listId: INBOX_ID,
    title: '',
    notes: '',
    priority: 0,
    dueDate: null,
    dueTime: null,
    reminder: null,
    snoozedUntil: null,
    repeat: null,
    subtasks: [],
    completedAt: null,
    order: 0,
    createdAt: now,
    updatedAt: now,
    ...(Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined)) as Partial<Task>),
    notifId: p.notifId,
  };
}

/* ---------------- validation / migration ---------------- */

const isObj = (x: unknown): x is Record<string, any> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown, d = '') => (typeof x === 'string' ? x : d);
const num = (x: unknown, d: number) => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const hex = (x: unknown, d: string) => (typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x) ? x.toLowerCase() : d);

function cleanRepeat(x: unknown, due: string | null): Repeat | null {
  if (!isObj(x)) return null;
  if (!['daily', 'weekly', 'monthly', 'yearly'].includes(x.freq)) return null;
  const anchor = isValidDate(x.anchor) ? x.anchor : due ?? todayStr();
  const r: Repeat = {
    freq: x.freq,
    interval: Math.max(1, Math.min(999, Math.floor(num(x.interval, 1)))),
    basis: x.basis === 'completion' ? 'completion' : 'due',
    anchor,
  };
  if (Array.isArray(x.weekdays)) {
    const wd = [...new Set(x.weekdays.filter((d: unknown) => Number.isInteger(d) && (d as number) >= 0 && (d as number) <= 6))] as number[];
    if (wd.length) r.weekdays = wd.sort();
  }
  if (isValidDate(x.until)) r.until = x.until;
  return r;
}

function cleanTask(x: unknown, listIds: Set<ID>): Task | null {
  if (!isObj(x) || typeof x.id !== 'string' || !x.id) return null;
  const dueDate = isValidDate(x.dueDate) ? x.dueDate : null;
  const subtasks: Subtask[] = Array.isArray(x.subtasks)
    ? x.subtasks.filter(isObj).map((s) => ({ id: str(s.id) || uid(), title: str(s.title), done: !!s.done }))
    : [];
  const now = Date.now();
  return {
    id: x.id,
    listId: typeof x.listId === 'string' && listIds.has(x.listId) ? x.listId : INBOX_ID,
    title: str(x.title).slice(0, 500),
    notes: str(x.notes).slice(0, 20000),
    emoji: typeof x.emoji === 'string' && x.emoji ? x.emoji.slice(0, 16) : undefined,
    priority: ([0, 1, 2, 3].includes(x.priority) ? x.priority : 0) as Priority,
    dueDate,
    dueTime: dueDate && isValidTime(x.dueTime) ? x.dueTime : null,
    reminder: typeof x.reminder === 'number' && x.reminder >= 0 ? x.reminder : null,
    snoozedUntil: typeof x.snoozedUntil === 'number' ? x.snoozedUntil : null,
    repeat: dueDate ? cleanRepeat(x.repeat, dueDate) : null,
    subtasks,
    completedAt: typeof x.completedAt === 'number' ? x.completedAt : null,
    seriesId: typeof x.seriesId === 'string' ? x.seriesId : undefined,
    order: num(x.order, 0),
    notifId: Number.isInteger(x.notifId) && x.notifId > 0 && x.notifId < 2 ** 31 ? x.notifId : 0,
    createdAt: num(x.createdAt, now),
    updatedAt: num(x.updatedAt, now),
  };
}

function cleanList(x: unknown): List | null {
  if (!isObj(x) || typeof x.id !== 'string' || !x.id) return null;
  return {
    id: x.id,
    name: str(x.name, 'List').slice(0, 80) || 'List',
    color: hex(x.color, '#6c5ce7'),
    emoji: typeof x.emoji === 'string' && x.emoji ? x.emoji.slice(0, 16) : undefined,
    order: num(x.order, 0),
    createdAt: num(x.createdAt, Date.now()),
  };
}

/** The task-only settings an old Doable backup carries (its theme/accent are not copied over). */
export type TodoSettings = Pick<Settings, 'allDayReminderTime' | 'defaultReminder' | 'showCompletedInLists' | 'viewPrefs'>;

export const defaultTodoSettings = (): TodoSettings => ({
  allDayReminderTime: '09:00',
  defaultReminder: 0,
  showCompletedInLists: false,
  viewPrefs: {},
});

export function cleanViewPrefs(x: unknown): Record<string, ViewPrefs> {
  const vp: Record<string, ViewPrefs> = {};
  if (!isObj(x)) return vp;
  for (const [k, v] of Object.entries(x)) {
    if (!isObj(v)) continue;
    const f = isObj(v.filters) ? v.filters : {};
    vp[k] = {
      sort: ['manual', 'due', 'priority', 'list', 'created', 'alpha'].includes(v.sort) ? v.sort : 'manual',
      filters: {
        ...defaultFilters(),
        priorities: Array.isArray(f.priorities) ? f.priorities.filter((p: unknown) => [0, 1, 2, 3].includes(p as number)) : [],
        listIds: Array.isArray(f.listIds) ? f.listIds.filter((p: unknown) => typeof p === 'string') : [],
        status: ['open', 'done', 'all'].includes(f.status) ? f.status : 'open',
        due: ['any', 'overdue', 'today', 'week', 'nodate', 'hasdate'].includes(f.due) ? f.due : 'any',
      },
    };
  }
  return vp;
}

export function cleanTodoSettings(x: unknown): TodoSettings {
  const d = defaultTodoSettings();
  if (!isObj(x)) return d;
  return {
    allDayReminderTime: isValidTime(x.allDayReminderTime) ? x.allDayReminderTime : d.allDayReminderTime,
    defaultReminder: x.defaultReminder === null ? null : typeof x.defaultReminder === 'number' && x.defaultReminder >= 0 ? x.defaultReminder : d.defaultReminder,
    showCompletedInLists: typeof x.showCompletedInLists === 'boolean' ? x.showCompletedInLists : d.showCompletedInLists,
    viewPrefs: cleanViewPrefs(x.viewPrefs),
  };
}

export class DataError extends Error {}

/**
 * Clean a to-do slice ({ lists, tasks }): from this app's own save, or from the old to-do app's
 * file (schemaVersion 1, which also has settings + meta). Throws DataError if it isn't task data.
 * Task notification ids are made unique here; data/notifIds.ts then makes them unique against habits too.
 */
export function cleanTodo(raw: unknown): TodoData {
  if (!isObj(raw)) throw new DataError('Not task data');
  const version = num(raw.schemaVersion, 0);
  if (version > DOABLE_SCHEMA) throw new DataError(`This backup is from a newer version of Doable (v${version}).`);
  if (!Array.isArray(raw.tasks) || !Array.isArray(raw.lists)) throw new DataError('Missing tasks or lists');

  const lists = raw.lists.map(cleanList).filter((l): l is List => !!l);
  const seenL = new Set<ID>();
  const uniqLists = lists.filter((l) => (seenL.has(l.id) ? false : (seenL.add(l.id), true)));
  if (!uniqLists.some((l) => l.id === INBOX_ID)) uniqLists.unshift(inboxList(Date.now(), -1));
  const listIds = new Set(uniqLists.map((l) => l.id));

  const seenT = new Set<ID>();
  const tasks = raw.tasks
    .map((t) => cleanTask(t, listIds))
    .filter((t): t is Task => !!t && (seenT.has(t.id) ? false : (seenT.add(t.id), true)));

  return { lists: uniqLists, tasks };
}
