import { defaultLists, defaultTodoSettings } from '../todo/model/data';
import { DATA_VERSION, type AppData, type Settings } from './types';

export const defaultSettings = (): Settings => ({
  theme: 'system',
  accent: null,
  weekStart: 1,
  haptics: true,
  reduceMotion: false,
  notify: { habits: true, tasks: true },
  ...defaultTodoSettings(),
});

/** Fresh install: no habits, the starter lists, no sample tasks (Tick's welcome card teaches the app). */
export function defaultData(now = Date.now()): AppData {
  return {
    version: DATA_VERSION,
    settings: defaultSettings(),
    habits: { habits: [], completions: {}, notes: {}, vacations: [] },
    todo: { lists: defaultLists(now), tasks: [] },
    meta: { createdAt: now, nextNotifId: 1, welcomeDone: false },
  };
}
