import { useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Minus, PencilLine, Plus } from 'lucide-react';
import { useHabits } from '../../data/store';
import { addDays, addMonths, eachDay, endOfMonth, formatDate, startOfMonth, startOfWeek, weekday, weekdayLetters } from '../../core/dates';
import { alpha, onColor } from '../../core/colors';
import { countOn, habitStart, isOff, isScheduled, isWeeklyOn, ruleOn } from '../lib/schedule';
import { dailySeries } from '../lib/stats';
import { tapHaptic } from '../../core/haptics';
import { Tick } from '../../shared/Tick';
import { NoteSheet } from '../components/NoteSheet';
import type { DateKey, Habit } from '../lib/types';

interface Props {
  today: DateKey;
  selected: string; // 'all' or habit id
  onSelect: (id: string) => void;
}

const HEAT_WEEKS = 22;

/** 0..4 intensity bucket for a share of habits done (0 = none, 4 = all). */
function bucket(done: number, possible: number): number {
  if (!possible || !done) return 0;
  if (done >= possible) return 4;
  return Math.min(3, Math.ceil((done / possible) * 3));
}

const HEAT_MIX = [0, 30, 55, 80, 100];

function heatColor(level: number, color: string): string | undefined {
  if (level === 0) return undefined;
  return `color-mix(in oklab, ${color} ${HEAT_MIX[level]}%, var(--heat-empty))`;
}

type DayState = 'done' | 'partial' | 'skip' | 'off' | 'open';

export function CalendarScreen({ today, selected, onSelect }: Props) {
  const { state, dispatch } = useHabits();
  const { completions, settings, notes } = state;
  const habits = useMemo(() => state.habits.filter((h) => !h.archivedAt), [state.habits]);
  const habit = habits.find((h) => h.id === selected);
  const mode: 'all' | 'one' = habit ? 'one' : 'all';
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [pickedDay, setPickedDay] = useState<DateKey>(today);
  const [heatPick, setHeatPick] = useState<DateKey | null>(null);
  const [noteFor, setNoteFor] = useState<{ habit: Habit; date: DateKey } | null>(null);

  /** One habit on one day, as the calendar shows it. */
  const dayState = (h: Habit, d: DateKey): DayState => {
    const n = countOn(completions, h.id, d);
    const target = ruleOn(h, d).target;
    if (n > 0 && n >= target) return 'done';
    if (d < habitStart(h, completions)) return 'skip';
    if (isOff(h, settings, d)) return 'off';
    if (n > 0) return 'partial';
    if (!isWeeklyOn(h, d) && !isScheduled(h, d)) return 'skip';
    return 'open';
  };
  const hasNote = (d: DateKey) => (habit ? !!notes[habit.id]?.[d] : habits.some((h) => !!notes[h.id]?.[d]));

  // ----- Month grid -----
  const monthDays = eachDay(month, endOfMonth(month));
  const lead = (weekday(month) - settings.weekStart + 7) % 7;
  const letters = weekdayLetters(settings.weekStart);
  const canGoNext = month < startOfMonth(today);
  const monthSeries = useMemo(
    () => new Map(dailySeries(habits, state, { start: month, end: endOfMonth(month) }, today).map((d) => [d.date, d])),
    [habits, state, month, today],
  );

  let monthSummary = '';
  if (habit) {
    const n = monthDays.filter((d) => d <= today && dayState(habit, d) === 'done').length;
    monthSummary = `${n} day${n === 1 ? '' : 's'} done this month`;
  } else {
    const perfect = monthDays.filter((d) => {
      const s = monthSeries.get(d);
      return d <= today && !!s && s.possible > 0 && s.done >= s.possible;
    }).length;
    monthSummary = `${perfect} perfect day${perfect === 1 ? '' : 's'} ⭐`;
  }

  const setDay = (h: Habit, d: DateKey, count: number) => {
    tapHaptic();
    dispatch({ type: 'setCount', id: h.id, date: d, count });
  };
  const toggle = (h: Habit, d: DateKey) => setDay(h, d, dayState(h, d) === 'done' ? 0 : ruleOn(h, d).target);

  // ----- Heatmap -----
  const heatStart = startOfWeek(addDays(today, -(HEAT_WEEKS - 1) * 7), settings.weekStart);
  const heatDays = eachDay(heatStart, addDays(startOfWeek(today, settings.weekStart), 6));
  const heatSeries = useMemo(
    () => new Map(dailySeries(habits, state, { start: heatDays[0], end: heatDays[heatDays.length - 1] }, today).map((d) => [d.date, d])),
    [habits, state, heatDays[0], today], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const heatColorBase = habit ? habit.color : 'var(--leaf)';
  const heatLevel = (d: DateKey) => {
    if (d > today) return -1;
    if (habit) {
      const s = dayState(habit, d);
      return s === 'done' ? 4 : s === 'partial' ? 2 : 0;
    }
    const s = heatSeries.get(d);
    return s ? bucket(s.done, s.possible) : 0;
  };
  const monthLabels: { col: number; label: string }[] = [];
  for (let w = 0; w < heatDays.length / 7; w++) {
    const first = heatDays[w * 7];
    const prev = w > 0 ? heatDays[(w - 1) * 7] : null;
    if (!prev || first.slice(5, 7) !== prev.slice(5, 7)) monthLabels.push({ col: w, label: formatDate(first, { month: 'short' }) });
  }
  // Drop the leading partial-month label if it would collide with the next one.
  if (monthLabels.length > 1 && monthLabels[1].col - monthLabels[0].col < 3) monthLabels.shift();
  const STATUS: Record<DayState, string> = { done: 'Done ✅', partial: 'Partly done', skip: 'Not scheduled', off: 'Paused', open: 'Not done' };
  const heatReadout = (d: DateKey) => {
    const label = formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' });
    if (habit) {
      const s = dayState(habit, d);
      return `${label} · ${s === 'partial' ? `${countOn(completions, habit.id, d)} of ${ruleOn(habit, d).target}` : STATUS[s]}`;
    }
    const s = heatSeries.get(d);
    return s?.possible ? `${label} · ${s.done} of ${s.possible} habits done` : `${label} · nothing scheduled`;
  };

  if (habits.length === 0) {
    return (
      <>
        <div className="card empty">
          <Tick mood="sleepy" size={130} label="Tick napping" />
          <h2>Tick’s napping…</h2>
          <p>Add a habit with the + button and your days will light up here.</p>
        </div>
      </>
    );
  }

  const detailHabits = habit ? [habit] : habits.filter((h) => pickedDay >= habitStart(h, completions));

  return (
    <>

      <div className="chips scroll-x habit-filter" role="tablist" aria-label="Choose habit">
        <button className={`chip${mode === 'all' ? ' selected' : ''}`} role="tab" aria-selected={mode === 'all'} onClick={() => onSelect('all')}>
          ✨ All habits
        </button>
        {habits.map((h) => (
          <button
            key={h.id}
            className={`chip${selected === h.id ? ' selected' : ''}`}
            role="tab"
            aria-selected={selected === h.id}
            onClick={() => onSelect(h.id)}
            style={selected === h.id ? { borderColor: h.color, background: alpha(h.color, 0.15) } : undefined}
          >
            <span>{h.emoji}</span> {h.name}
          </button>
        ))}
      </div>

      {/* Month grid */}
      <section className="card month-card">
        <div className="month-head">
          <button className="icon-btn plain" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            <ChevronLeft size={22} />
          </button>
          <div className="month-title">
            <h2>{formatDate(month, { month: 'long', year: 'numeric' })}</h2>
            <p>{monthSummary}</p>
          </div>
          <button className="icon-btn plain" onClick={() => setMonth(addMonths(month, 1))} disabled={!canGoNext} aria-label="Next month">
            <ChevronRight size={22} />
          </button>
        </div>

        <div className="month-grid">
          {letters.map((l, i) => (
            <div key={i} className="month-letter">
              {l}
            </div>
          ))}
          {Array.from({ length: lead }, (_, i) => (
            <div key={`b${i}`} />
          ))}
          {monthDays.map((d, i) => {
            const future = d > today;
            const isToday = d === today;
            const col = (lead + i) % 7;
            let fill: string | undefined;
            let text: string | undefined;
            let ring: string | undefined;
            let joinL = false;
            let joinR = false;
            let cls = '';
            let label: string;
            const dateLabel = formatDate(d, { weekday: 'long', month: 'long', day: 'numeric' });
            if (habit) {
              const s = dayState(habit, d);
              cls = future ? '' : ` s-${s}`;
              if (s === 'done') {
                fill = habit.color;
                text = onColor(habit.color);
                joinL = col > 0 && i > 0 && dayState(habit, monthDays[i - 1]) === 'done';
                joinR = col < 6 && i < monthDays.length - 1 && monthDays[i + 1] <= today && dayState(habit, monthDays[i + 1]) === 'done';
              } else if (s === 'partial') {
                fill = alpha(habit.color, 0.16);
                ring = alpha(habit.color, 0.75);
              }
              label = `${dateLabel}: ${s === 'partial' ? `${countOn(completions, habit.id, d)} of ${ruleOn(habit, d).target}` : STATUS[s].replace(' ✅', '')}`;
            } else {
              const s = monthSeries.get(d);
              const lvl = future || !s ? 0 : bucket(s.done, s.possible);
              fill = heatColor(lvl, 'var(--leaf)');
              text = lvl >= 3 ? 'var(--ink)' : undefined;
              cls = !future && s && s.possible === 0 ? ' s-skip' : '';
              label = `${dateLabel}: ${s?.done ?? 0} of ${s?.possible ?? 0} habits done`;
            }
            const note = !future && hasNote(d);
            const picked = d === pickedDay;
            return (
              <button
                key={d}
                className={`day${future ? ' future' : ''}${isToday ? ' today' : ''}${picked ? ' picked' : ''}${cls}`}
                onClick={() => !future && setPickedDay(d)}
                disabled={future}
                aria-label={`${label}${note ? ', has a note' : ''}`}
                aria-pressed={picked}
              >
                <span
                  className={`day-fill${joinL ? ' jl' : ''}${joinR ? ' jr' : ''}`}
                  style={fill || ring ? { background: fill, color: text, boxShadow: ring ? `inset 0 0 0 2px ${ring}` : undefined } : undefined}
                >
                  {d.slice(8).replace(/^0/, '')}
                </span>
                {note && <i className="note-dot" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
        <p className="month-foot">{habit ? 'Tap a day to change it or add a note' : 'Darker = more habits done · tap a day for details'}</p>
      </section>

      {/* Day detail */}
      <section className="card day-detail">
        <h3>{pickedDay === today ? 'Today' : formatDate(pickedDay, { weekday: 'long', month: 'long', day: 'numeric' })}</h3>
        {detailHabits.map((h) => {
          const s = dayState(h, pickedDay);
          const n = countOn(completions, h.id, pickedDay);
          const target = ruleOn(h, pickedDay).target;
          const on = s === 'done';
          const note = notes[h.id]?.[pickedDay];
          const quiet = s === 'skip' || s === 'off';
          return (
            <div key={h.id} className={`detail-row${quiet ? ' quiet' : ''}`}>
              <span className="emoji-bubble sm" style={{ background: alpha(h.color, 0.2) }}>
                {h.emoji}
              </span>
              <span className="detail-main">
                <span className="detail-name">{h.name}</span>
                {quiet && <span className="detail-sub">{STATUS[s]}</span>}
                <button className={`detail-note${note ? ' has' : ''}`} onClick={() => setNoteFor({ habit: h, date: pickedDay })}>
                  <PencilLine size={13} /> {note ?? 'Add note'}
                </button>
              </span>
              {target > 1 ? (
                <span className="mini-stepper">
                  <button onClick={() => setDay(h, pickedDay, n - 1)} disabled={n === 0} aria-label={`Remove one from ${h.name}`}>
                    <Minus size={15} strokeWidth={3} />
                  </button>
                  <b style={on ? { color: h.color } : undefined}>
                    {n}/{target}
                  </b>
                  <button onClick={() => setDay(h, pickedDay, n + 1)} aria-label={`Add one to ${h.name}`}>
                    <Plus size={15} strokeWidth={3} />
                  </button>
                </span>
              ) : (
                <button
                  className="mini-check"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`${h.name} done on ${formatDate(pickedDay, { month: 'short', day: 'numeric' })}`}
                  onClick={() => toggle(h, pickedDay)}
                  style={on ? { background: h.color, borderColor: h.color, color: onColor(h.color) } : undefined}
                >
                  {on && <Check size={16} strokeWidth={3.4} />}
                </button>
              )}
            </div>
          );
        })}
      </section>

      {/* Heatmap */}
      <section className="card heat-card">
        <div className="heat-head">
          <h3>Last {HEAT_WEEKS} weeks</h3>
          <div className="heat-legend" aria-hidden="true">
            Less
            {(habit ? [0, 2, 4] : [0, 1, 2, 3, 4]).map((l) => (
              <i key={l} style={{ background: heatColor(l, heatColorBase) }} />
            ))}
            More
          </div>
        </div>
        <div className="heat-wrap">
          <div className="heat-months" style={{ gridTemplateColumns: `repeat(${HEAT_WEEKS}, 1fr)` }}>
            {monthLabels.map((m) => (
              <span key={m.col} style={{ gridColumn: `${m.col + 1} / span 3` }}>
                {m.label}
              </span>
            ))}
          </div>
          <div className="heat-grid" style={{ gridTemplateColumns: `repeat(${HEAT_WEEKS}, 1fr)` }}>
            {heatDays.map((d) => {
              const lvl = heatLevel(d);
              return (
                <button
                  key={d}
                  className={`heat-cell${lvl < 0 ? ' future' : ''}${heatPick === d ? ' picked' : ''}`}
                  style={lvl > 0 ? { background: heatColor(lvl, heatColorBase) } : undefined}
                  disabled={lvl < 0}
                  onClick={() => setHeatPick(d)}
                  aria-label={heatReadout(d)}
                />
              );
            })}
          </div>
        </div>
        <p className="heat-readout">{heatPick ? heatReadout(heatPick) : 'Tap a square to see that day'}</p>
      </section>

      {noteFor && <NoteSheet habit={noteFor.habit} date={noteFor.date} onClose={() => setNoteFor(null)} />}
    </>
  );
}
export default CalendarScreen;
