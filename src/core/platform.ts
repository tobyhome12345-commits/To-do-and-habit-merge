import { Capacitor } from '@capacitor/core';

/** True inside the phone app (Android or iPhone), false in a browser preview. */
export const isNative = Capacitor.isNativePlatform();

/** 'android', 'ios' or 'web'. */
export const platform = Capacitor.getPlatform();
export const isIOS = platform === 'ios';
export const isAndroid = platform === 'android';

/** What to call the phone's system in messages ("waiting with iOS", "Android Settings"). */
export const osName = isIOS ? 'iOS' : 'Android';
