import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysInMonth, diffDays, eachDay, endOfMonth, startOfWeek, toKey, weekday } from '../../src/core/dates';

describe('dates', () => {
  it('formats local dates as keys', () => {
    expect(toKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29'); // leap year
  });

  it('is not affected by daylight saving changes', () => {
    // DST starts/ends in late March / late October in Europe, March / November in the US
    expect(eachDay('2026-03-27', '2026-04-02')).toHaveLength(7);
    expect(eachDay('2026-10-30', '2026-11-03')).toHaveLength(5);
    expect(diffDays('2026-03-01', '2026-04-01')).toBe(31);
  });

  it('finds week starts for Monday and Sunday weeks', () => {
    // 2026-11-24 is a Tuesday
    expect(weekday('2026-11-24')).toBe(2);
    expect(startOfWeek('2026-11-24', 1)).toBe('2026-11-23');
    expect(startOfWeek('2026-11-24', 0)).toBe('2026-11-22');
    expect(startOfWeek('2026-11-22', 1)).toBe('2026-11-16'); // Sunday belongs to previous Mon-week
    expect(startOfWeek('2026-11-22', 0)).toBe('2026-11-22');
  });

  it('handles months', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(endOfMonth('2026-11-24')).toBe('2026-11-30');
    expect(addMonths('2026-11-24', 2)).toBe('2027-01-01');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-01');
  });
});
