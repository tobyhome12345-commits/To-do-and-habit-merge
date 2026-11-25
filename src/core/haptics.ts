import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isNative } from './platform';

/*
 * One haptics helper for habits and tasks. Follows Settings → Haptics (set by the store),
 * so turning buzzes off works everywhere, not just in the to-do part.
 */

let enabled = true;
export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

export function haptic(kind: 'light' | 'medium' | 'success' | 'warning' = 'light') {
  if (!isNative || !enabled) return;
  try {
    if (kind === 'success') void Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else if (kind === 'warning') void Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
    else void Haptics.impact({ style: kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
  } catch {
    /* ignore */
  }
}

export const tapHaptic = () => haptic('light');
export const successHaptic = () => haptic('success');
