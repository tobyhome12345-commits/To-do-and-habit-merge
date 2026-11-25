import { describe, expect, it } from 'vitest';
import { LEGACY_KEYS, PRE_IMPORT, getSafetyCopy, loadData } from '../../src/data/persistence';
import { applyHabitAction } from '../../src/data/store';
import { defaultData } from '../../src/data/defaults';

/** In-memory key/value store standing in for the phone's app storage. */
function memory(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  return { m, get: async (k: string) => m.get(k) ?? null, set: async (k: string, v: string) => void m.set(k, v) };
}

const input = { name: 'Read', emoji: '📚', color: '#f5b52e', unit: '', timeOfDay: 'evening' as const, target: 1, schedule: { kind: 'daily' as const } };

describe('updating from Tickday (same app, new name)', () => {
  it('moves the saved data to the new key on the first start, and keeps the old copy', async () => {
    let old = applyHabitAction(defaultData(1), { type: 'addHabit', habit: input, id: 'r', today: '2026-11-20' });
    old = applyHabitAction(old, { type: 'tap', id: 'r', date: '2026-11-21', delta: 1 });
    const oldJson = JSON.stringify(old);
    const store = memory({ [LEGACY_KEYS.main]: oldJson });
    const { data, source } = await loadData(store);
    expect(source).toBe('moved');
    expect(data.habits.habits[0].name).toBe('Read');
    expect(data.habits.completions.r).toEqual({ '2026-11-21': 1 });
    expect(JSON.parse(store.m.get('doable.data')!)).toEqual(data);
    expect(store.m.get(LEGACY_KEYS.main)).toBe(oldJson); // safety net untouched
    // Next start reads the new key.
    expect((await loadData(store)).source).toBe('main');
  });

  it('falls back to the old "last good" copy, and starts fresh when there is nothing', async () => {
    const prevOnly = memory({ [LEGACY_KEYS.main]: '{broken', [LEGACY_KEYS.prev]: JSON.stringify(defaultData(2)) });
    expect((await loadData(prevOnly)).source).toBe('moved');
    expect((await loadData(memory())).source).toBe('new');
  });

  it('never touches the old key once the new one exists', async () => {
    const store = memory({ 'doable.data': JSON.stringify(defaultData(3)), [LEGACY_KEYS.main]: JSON.stringify(applyHabitAction(defaultData(4), { type: 'addHabit', habit: input, id: 'x' })) });
    const { data, source } = await loadData(store);
    expect(source).toBe('main');
    expect(data.habits.habits).toEqual([]);
  });

  it('finds the undo-import safety copy from before the update too', async () => {
    expect(await getSafetyCopy(memory({ [LEGACY_KEYS.preImport]: 'old' }))).toBe('old');
    expect(await getSafetyCopy(memory({ [LEGACY_KEYS.preImport]: 'old', [PRE_IMPORT]: 'new' }))).toBe('new');
  });
});
