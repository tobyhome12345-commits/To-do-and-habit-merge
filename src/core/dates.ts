/*
 * One set of calendar helpers for habits AND tasks (both apps had their own copy).
 * Days are 'YYYY-MM-DD' strings in the user's local calendar ("floating": not tied to a timezone).
 * Date-only arithmetic is done in UTC so daylight-saving changes can never skip or repeat a day.
 * Only localEpoch() touches the device timezone, because reminders need a real instant.
 */

/** A local calendar day, 'YYYY-MM-DD'. */
export type DateKey = string;
export type LocalDate = DateKey;
/** A local wall-clock time, 'HH:mm' (24h). */
export type LocalTime = string;

const DAY = 86_400_000;
export const pad = (n: number) => String(n).padStart(2, '0');

export function parts(d: DateKey): [number, number, number] {
  const [y, m, day] = d.split('-').map(Number);
  return [y, m, day];
}

function toUTC(d: DateKey): number {
  const [y, m, day] = parts(d);
  return Date.UTC(y, m - 1, day);
}

function fromUTC(ms: number): DateKey {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function make(y: number, m: number, day: number): DateKey {
  return fromUTC(Date.UTC(y, m - 1, day));
}

/** Local calendar date of a JS Date / epoch in the device timezone. */
export function toLocalDate(dt: Date | number = new Date()): DateKey {
  const x = typeof dt === 'number' ? new Date(dt) : dt;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
export const toKey = (d: Date) => toLocalDate(d);
export const todayStr = (now: Date | number = new Date()) => toLocalDate(now);
export const todayKey = (): DateKey => toLocalDate(new Date());

/** Local-midnight Date for a key (for display formatting). */
export function fromKey(key: DateKey): Date {
  const [y, m, d] = parts(key);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, n: number): DateKey {
  return fromUTC(toUTC(key) + n * DAY);
}

/** Whole days from a to b (positive when b is later). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((toUTC(b) - toUTC(a)) / DAY);
}

/** Days since 1970-01-01 (used to give each day's habit reminder its own notification slot). */
export function epochDay(key: DateKey): number {
  return Math.round(toUTC(key) / DAY);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(key: DateKey): number {
  return new Date(toUTC(key)).getUTCDay();
}

export function startOfWeek(key: DateKey, weekStart: 0 | 1): DateKey {
  return addDays(key, -((weekday(key) - weekStart + 7) % 7));
}

/** Days in month m (1-12) of year y. */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Date in year y / month m (1-12) on `day`, clamped to the month length (31 → 30/29/28). */
export function clampedDate(y: number, m: number, day: number): DateKey {
  return make(y, m, Math.min(day, daysInMonth(y, m)));
}

export function startOfMonth(key: DateKey): DateKey {
  return key.slice(0, 8) + '01';
}

export function endOfMonth(key: DateKey): DateKey {
  const [y, m] = parts(key);
  return key.slice(0, 8) + pad(daysInMonth(y, m));
}

export function addMonths(key: DateKey, n: number): DateKey {
  const [y, m] = parts(key);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}-01`;
}

/** Inclusive list of days from `from` to `to`. */
export function eachDay(from: DateKey, to: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) out.push(k);
  return out;
}

export const minKey = (a: DateKey, b: DateKey) => (a < b ? a : b);
export const maxKey = (a: DateKey, b: DateKey) => (a > b ? a : b);

export function isValidDate(s: unknown): s is DateKey {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = parts(s);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function isValidTime(s: unknown): s is LocalTime {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

/** Real instant (epoch ms) for a local date + time in the device timezone. */
export function localEpoch(d: DateKey, t: LocalTime): number {
  const [y, m, day] = parts(d);
  const [hh, mm] = t.split(':').map(Number);
  return new Date(y, m - 1, day, hh, mm, 0, 0).getTime();
}

/* ---------------- formatting ---------------- */

export function formatDate(key: DateKey, opts: Intl.DateTimeFormatOptions): string {
  return fromKey(key).toLocaleDateString(undefined, opts);
}

/** Short weekday labels starting at weekStart, e.g. ['M','T','W',…] */
export function weekdayLetters(weekStart: 0 | 1, style: 'narrow' | 'short' = 'narrow'): string[] {
  // 2023-01-01 was a Sunday
  return Array.from({ length: 7 }, (_, i) => formatDate(addDays('2023-01-01', i + weekStart), { weekday: style }));
}

const WD_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const weekdayShort = (i: number) => WD_SHORT[i];
export const weekdayLong = (i: number) => WD_LONG[i];
export const monthShort = (m: number) => MON_SHORT[m - 1];

/** "Wednesday, 25 November" */
export function longDate(d: DateKey): string {
  const [, m, day] = parts(d);
  return `${WD_LONG[weekday(d)]}, ${day} ${MON_LONG[m - 1]}`;
}

/** "25 Nov" (+ year if not the current year) */
export function shortDate(d: DateKey, today: DateKey): string {
  const [y, m, day] = parts(d);
  const [ty] = parts(today);
  return `${day} ${MON_SHORT[m - 1]}${y !== ty ? ` ${y}` : ''}`;
}

/** Friendly relative label: Today, Tomorrow, Yesterday, Friday, Thu 3 Dec */
export function relativeDay(d: DateKey, today: DateKey): string {
  const diff = diffDays(today, d);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  if (diff > 1 && diff < 7) return WD_LONG[weekday(d)];
  return `${WD_SHORT[weekday(d)]} ${shortDate(d, today)}`;
}

/** '17:30' → '5:30 PM' */
export function formatTime(t: LocalTime): string {
  const [hh, mm] = t.split(':').map(Number);
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${pad(mm)} ${hh < 12 ? 'AM' : 'PM'}`;
}

export function nowTime(now = new Date()): LocalTime {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
