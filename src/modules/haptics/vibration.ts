import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

function nativeVibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // Ignore browser blocks before user gesture
    }
  }
}

/**
 * Triggers a real phone vibration on recitation error.
 * - First error: 1 short pulse
 * - Repeated error on the same word: 2 short pulses
 * - Never vibrates on normal word verification
 */
export async function triggerErrorVibration(isRepeatError: boolean, enabled: boolean): Promise<void> {
  if (!enabled) return;

  if (Capacitor.isNativePlatform()) {
    try {
      if (!isRepeatError) {
        await Haptics.impact({ style: ImpactStyle.Medium });
      } else {
        await Haptics.impact({ style: ImpactStyle.Medium });
        await new Promise((r) => setTimeout(r, 95));
        await Haptics.impact({ style: ImpactStyle.Heavy });
      }
      return;
    } catch {
      // Fallback to Web Vibration API
    }
  }

  if (!isRepeatError) {
    nativeVibrate(95);
  } else {
    nativeVibrate([80, 75, 85]);
  }
}

/**
 * Gentle celebratory haptic when an entire Mushaf page is completed.
 */
export async function triggerSuccessVibration(enabled: boolean): Promise<void> {
  if (!enabled) return;

  if (Capacitor.isNativePlatform()) {
    try {
      await Haptics.notification({ type: NotificationType.Success });
      return;
    } catch {
      // Fallback
    }
  }

  nativeVibrate([50, 60, 100]);
}
