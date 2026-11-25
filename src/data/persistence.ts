import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import type { AppData } from './types';
import { defaultData } from './defaults';
import { migrate } from './migrate';
import { useData } from './store';

/*
 * Storage: Android SharedPreferences (via Capacitor Preferences) on the phone: private to the app,
 * survives updates. localStorage in a browser. ONE JSON document for habits + tasks + settings
 * (see data/types.ts), plus a "last good" copy for recovery.
 */

const KEY = 'doable.data';
const PREV = 'doable.data.prev';
/** Safety copy taken right before an import or a reset replaces anything. */
export const PRE_IMPORT = 'doable.data.preimport';

/**
 * Where v1.0.1–1.0.2 (when the app was called Tickday) saved everything. Read once to move your data
 * across on the first start after the update, and left untouched as a safety net. Never shown to you.
 */
export const LEGACY_KEYS = { main: 'tickday.data', prev: 'tickday.data.prev', preImport: 'tickday.data.preimport' } as const;

type KV = { get(key: string): Promise<string | null>; set(key: string, value: string): Promise<void> };

const native = Capacitor.isNativePlatform();

export const kv = {
  async get(key: string): Promise<string | null> {
    if (native) return (await Preferences.get({ key })).value;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (native) return Preferences.set({ key, value });
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.error('save failed', e);
    }
  },
};

export async function loadData(store: KV = kv): Promise<{ data: AppData; source: 'main' | 'backup' | 'moved' | 'new' }> {
  const tryParse = (raw: string | null) => {
    if (!raw) return null;
    try {
      return migrate(JSON.parse(raw));
    } catch (e) {
      console.error('saved data unreadable', e);
      return null;
    }
  };
  const raw = await store.get(KEY);
  if (raw) {
    const data = tryParse(raw);
    if (data) {
      await store.set(PREV, raw); // remember the last copy that loaded fine
      return { data, source: 'main' };
    }
    const prev = tryParse(await store.get(PREV));
    if (prev) return { data: prev, source: 'backup' };
  } else {
    // First start after the update from Tickday: move the data to the new key (the old copy stays).
    const moved = tryParse(await store.get(LEGACY_KEYS.main)) ?? tryParse(await store.get(LEGACY_KEYS.prev));
    if (moved) {
      const json = JSON.stringify(moved);
      await store.set(KEY, json);
      await store.set(PREV, json);
      return { data: moved, source: 'moved' };
    }
  }
  return { data: defaultData(), source: 'new' };
}

/** The safety copy from before the last import or reset (from before the update too). */
export async function getSafetyCopy(store: KV = kv): Promise<string | null> {
  return (await store.get(PRE_IMPORT)) ?? (await store.get(LEGACY_KEYS.preImport));
}

let timer: ReturnType<typeof setTimeout> | null = null;
let pending: AppData | null = null;

async function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (!pending) return;
  const d = pending;
  pending = null;
  await kv.set(KEY, JSON.stringify(d));
}

export const saveNow = flush;

/** Save shortly after every change, and immediately when the app goes to the background. */
export function startAutosave() {
  useData.subscribe((s, prev) => {
    if (!s.ready || s.data === prev.data) return;
    pending = s.data;
    if (timer) clearTimeout(timer);
    timer = setTimeout(flush, 300);
  });
  const onHide = () => {
    if (document.visibilityState === 'hidden') void flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', () => void flush());
}
