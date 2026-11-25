import { Capacitor } from '@capacitor/core';

/** True inside the Android app, false in a browser preview. */
export const isNative = Capacitor.isNativePlatform();
