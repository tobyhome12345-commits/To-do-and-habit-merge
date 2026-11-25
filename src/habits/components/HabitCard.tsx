import { memo, useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { Check, Flame, Minus, Trophy } from 'lucide-react';
import { alpha, onColor } from '../../core/colors';
import { addDays, formatDate } from '../../core/dates';
import { countOn, isOff, isScheduled, isWeeklyOn, ruleOn, type TodayInfo } from '../lib/schedule';
import { streakLabel, type Streak } from '../lib/streaks';
import type { HabitState, DateKey, Habit } from '../lib/types';

interface Props {
  habit: Habit;
  state: HabitState;
  info: TodayInfo;
  streak: Streak;
  best: number;
  today: DateKey;
  /** +1 / −1 on a day. */
  onTap: (habit: Habit, date: DateKey, delta: 1 | -1) => void;
  /** Mark a (past) day done or not done. */
  onToggleDay: (habit: Habit, date: DateKey) => void;
  onEdit: (h: Habit) => void;
  /** Long-press drag hooks from the sortable list (on the name area only). */
  dragProps?: HTMLAttributes<HTMLElement>;
}

/** Check mark that draws itself in when the habit gets done. */
function CheckMark({ on, size = 28 }: { on: boolean; size?: number }) {
  return (
    <svg className={`checkmark${on ? ' on' : ''}`} viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M5 12.5l4.6 4.6L19.2 7.4" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} />
    </svg>
  );
}

const R = 25;
const CIRC = 2 * Math.PI * R;

export const HabitCard = memo(function HabitCard({ habit, state, info, streak, best, today, onTap, onToggleDay, onEdit, dragProps }: Props) {
  const c = habit.color;
  const isDone = info.kind === 'done' || (info.count >= info.target && info.count > 0);
  const counted = info.target > 1;
  const dim = info.kind === 'notToday' || info.kind === 'paused';
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const label = `${habit.name}${counted ? `, ${info.count} of ${info.target}${habit.unit ? ` ${habit.unit}` : ''}` : ''}`;

  // Particle burst when it flips to done (not on first render).
  const [burst, setBurst] = useState(0);
  const prev = useRef(isDone);
  useEffect(() => {
    if (isDone && !prev.current) setBurst((b) => b + 1);
    prev.current = isDone;
  }, [isDone]);

  const progress = Math.min(1, info.count / info.target);

  return (
    <article
      className={`habit-card card${isDone ? ' done' : ''}${dim ? ' dim' : ''}`}
      style={isDone && !dim ? { background: `linear-gradient(135deg, ${alpha(c, 0.16)}, ${alpha(c, 0.04)}), var(--surface)`, borderColor: alpha(c, 0.4) } : undefined}
    >
      <div className="habit-main">
        <button className="habit-info" onClick={() => onEdit(habit)} aria-label={`Edit ${habit.name}`} {...dragProps}>
          <span className="emoji-bubble" style={{ background: alpha(c, 0.18) }}>
            {habit.emoji}
          </span>
          <span className="habit-text">
            <span className="habit-name">{habit.name}</span>
            <span className="habit-meta">
              {dim ? (
                <span className="meta-chip reason">{info.reason}</span>
              ) : (
                <>
                  {counted && (
                    <span className="meta-chip count" style={{ color: isDone ? undefined : 'var(--text)' }}>
                      {info.count}/{info.target}
                      {habit.unit ? ` ${habit.unit}` : ''}
                    </span>
                  )}
                  {info.week && (
                    <span className="meta-chip">
                      {info.week.done}/{info.week.times} this week
                    </span>
                  )}
                  <span className={`meta-chip${streak.count > 0 ? ' hot' : ''}`}>
                    <Flame size={14} strokeWidth={2.6} />
                    {streak.count > 0 ? streakLabel(streak.count, streak.unit) : 'Start today'}
                  </span>
                  {!counted && !info.week && (
                    <span className="meta-chip">
                      <Trophy size={13} strokeWidth={2.6} />
                      Best {best}
                    </span>
                  )}
                </>
              )}
            </span>
          </span>
        </button>
        {counted && info.count > 0 && (
          <button className="minus-btn" onClick={() => onTap(habit, today, -1)} aria-label={`Remove one from ${habit.name}`}>
            <Minus size={18} strokeWidth={3} />
          </button>
        )}
        <div className="check-wrap">
          {counted ? (
            <button
              className={`check-btn ring${isDone ? ' on' : ''}`}
              style={isDone ? { background: c, borderColor: c, color: onColor(c) } : { borderColor: 'transparent', color: 'var(--text)' }}
              onClick={() => onTap(habit, today, 1)}
              aria-label={`Add one to ${label}`}
            >
              {!isDone && (
                <svg className="ring-svg" viewBox="0 0 56 56" aria-hidden="true">
                  <circle cx="28" cy="28" r={R} fill="none" stroke={alpha(c, 0.22)} strokeWidth="5" />
                  <circle
                    cx="28"
                    cy="28"
                    r={R}
                    fill="none"
                    stroke={c}
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={CIRC}
                    strokeDashoffset={CIRC * (1 - progress)}
                    transform="rotate(-90 28 28)"
                  />
                </svg>
              )}
              {isDone ? (
                <span className="ring-done">
                  <CheckMark on size={20} />
                  <b>{info.count}</b>
                </span>
              ) : (
                <span className="ring-count">
                  <b>{info.count}</b>
                  <small>/{info.target}</small>
                </span>
              )}
            </button>
          ) : (
            <button
              className={`check-btn${isDone ? ' on' : ''}`}
              style={isDone ? { background: c, borderColor: c, color: onColor(c) } : { borderColor: alpha(c, 0.5), color: alpha(c, 0.45) }}
              onClick={() => onTap(habit, today, isDone ? -1 : 1)}
              role="checkbox"
              aria-checked={isDone}
              aria-label={`Mark ${habit.name} done today`}
            >
              <CheckMark on={isDone} />
            </button>
          )}
          {burst > 0 && (
            <span key={burst} className="burst" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i / 8) * Math.PI * 2;
                return <i key={i} style={{ background: c, '--bx': `${Math.cos(a) * 38}px`, '--by': `${Math.sin(a) * 38}px` } as React.CSSProperties} />;
              })}
            </span>
          )}
        </div>
      </div>
      <div className="week-strip">
        {week.map((d) => {
          const count = countOn(state.completions, habit.id, d);
          const target = ruleOn(habit, d).target;
          const on = count > 0 && count >= target;
          const partial = count > 0 && !on;
          const off = isOff(habit, state.settings, d);
          const skip = !off && !on && !isWeeklyOn(habit, d) && !isScheduled(habit, d);
          const isToday = d === today;
          const status = on ? 'done' : partial ? `${count} of ${target}` : off ? 'paused' : skip ? 'not scheduled' : 'not done';
          return (
            <button
              key={d}
              className={`week-day${isToday ? ' today' : ''}${on ? ' on' : ''}${skip ? ' skip' : ''}${off ? ' off' : ''}`}
              onClick={() => onToggleDay(habit, d)}
              aria-label={`${formatDate(d, { weekday: 'long', month: 'short', day: 'numeric' })}: ${status}`}
              aria-pressed={on}
            >
              <span className="week-letter">{formatDate(d, { weekday: 'narrow' })}</span>
              <span
                className="week-dot"
                style={
                  on
                    ? { background: c, color: onColor(c) }
                    : partial
                      ? { background: alpha(c, 0.16), boxShadow: `inset 0 0 0 2px ${alpha(c, 0.75)}`, color: 'var(--text)' }
                      : isToday && !off
                        ? { boxShadow: `inset 0 0 0 2px ${alpha(c, 0.7)}` }
                        : undefined
                }
              >
                {on ? <Check size={14} strokeWidth={3.6} /> : off ? '–' : partial ? count : formatDate(d, { day: 'numeric' })}
              </span>
            </button>
          );
        })}
      </div>
    </article>
  );
});
