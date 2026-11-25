import { defaultState } from '../../src/habits/lib/normalize';
import type { HabitState, DateKey, DateRange, Habit, Schedule } from '../../src/habits/lib/types';

export const TODAY = '2026-11-24'; // a Tuesday; weeks start on Monday (2026-11-23)

export function mkHabit(id: string, opts: Partial<Habit> & { schedule?: Schedule; target?: number } = {}): Habit {
  const { schedule = { kind: 'daily' }, target = 1, ...rest } = opts;
  const createdAt = rest.createdAt ?? '2026-11-01';
  return {
    id,
    name: id,
    emoji: '⭐',
    color: '#3dbe7e',
    createdAt,
    unit: '',
    timeOfDay: 'anytime',
    rules: [{ since: createdAt, target, schedule }],
    pauses: [],
    archivedAt: null,
    reminder: null,
    notifId: 0,
    snoozedUntil: null,
    ...rest,
  };
}

/** Days → count 1 (or the given count with "day:count"). */
export function days(...list: string[]): Record<DateKey, number> {
  return Object.fromEntries(list.map((d) => (d.includes(':') ? [d.split(':')[0], Number(d.split(':')[1])] : [d, 1])));
}

export function mkState(habits: Habit[], completions: HabitState['completions'] = {}, vacations: DateRange[] = []): HabitState {
  const s = defaultState();
  return { ...s, habits, completions, settings: { ...s.settings, vacations } };
}
