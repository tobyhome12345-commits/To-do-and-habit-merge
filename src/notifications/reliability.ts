import { registerPlugin } from '@capacitor/core';
import { isNative } from '../core/platform';
import { kv } from '../data/persistence';

/*
 * Keeping reminders working when Doable is closed or swiped away. Some phones (Samsung especially) put
 * "optimized" apps to sleep and hold back their alarms. Doable's own native helper
 * (android/…/ReminderHelperPlugin.java) can ask Android to leave Doable out of battery optimization.
 */

interface ReminderHelperPlugin {
  getStatus(): Promise<{ ignoringBatteryOptimizations: boolean; manufacturer: string }>;
  requestIgnoreBatteryOptimizations(): Promise<void>;
  openAppSettings(): Promise<void>;
}

const ReminderHelper = registerPlugin<ReminderHelperPlugin>('ReminderHelper');

export interface BatteryStatus {
  ignoring: boolean;
  manufacturer: string;
  samsung: boolean;
}

/** null in a browser (or if the helper isn't there). */
export async function getBatteryStatus(): Promise<BatteryStatus | null> {
  if (!isNative) return null;
  try {
    const s = await ReminderHelper.getStatus();
    return { ignoring: s.ignoringBatteryOptimizations, manufacturer: s.manufacturer, samsung: /samsung/i.test(s.manufacturer) };
  } catch {
    return null;
  }
}

/** Shows Android's "Let Doable run in the background?" dialog (Samsung: battery → Unrestricted). */
export async function askToRunInBackground(): Promise<void> {
  if (!isNative) return;
  try {
    await ReminderHelper.requestIgnoreBatteryOptimizations();
  } catch {
    await openAppSettings();
  }
}

export async function openAppSettings(): Promise<void> {
  if (!isNative) return;
  try {
    await ReminderHelper.openAppSettings();
  } catch {
    /* nothing else to open */
  }
}

const ASKED = 'doable.batteryAsked';

/** The first time a reminder is set, ask once (per install) to run in the background. */
export async function askToRunInBackgroundOnce(): Promise<void> {
  if (!isNative || (await kv.get(ASKED))) return;
  const status = await getBatteryStatus();
  if (!status || status.ignoring) return;
  await kv.set(ASKED, '1');
  await askToRunInBackground();
}
