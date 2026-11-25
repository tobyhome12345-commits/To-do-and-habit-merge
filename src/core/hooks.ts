import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { todayKey } from './dates';
import { isNative } from './platform';

/** Today's date, kept fresh across midnight and when the app comes back from the background. */
export function useToday(): string {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const check = () => setToday((t) => (t === todayKey() ? t : todayKey()));
    const timer = setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    const sub = isNative ? CapApp.addListener('resume', check) : null;
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      sub?.then((s) => s.remove());
    };
  }, []);
  return today;
}

/** Current hour (0–23), refreshed every minute and when the app returns to the foreground. */
export function useHour(): number {
  const [hour, setHour] = useState(() => new Date().getHours());
  useEffect(() => {
    const check = () => setHour(new Date().getHours());
    const timer = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return hour;
}
