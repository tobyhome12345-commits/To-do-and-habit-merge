import { useState, type ReactNode } from 'react';
import { Archive, Bell, BellOff, Check, ChevronDown, Clock, Minus, Pause, Play, Plus, Repeat, Target, Trash2, X } from 'lucide-react';
import { Sheet } from '../../shared/Sheet';
import { DEFAULT_HABIT_COLOR, HABIT_COLORS, alpha, onColor } from '../../core/colors';
import { EMOJIS, QUICK_PICKS, firstGrapheme } from '../lib/emojis';
import { useHabits } from '../../data/store';
import type { HabitInput } from '../lib/reducer';
import { addDays, formatDate, formatTime, todayKey, weekdayLetters } from '../../core/dates';
import { requestReminderPermission } from '../../notifications/native';
import { TIME_OPTIONS, goalLabel, ruleOn, scheduleLabel } from '../lib/schedule';
import type { Habit, Schedule, TimeOfDay } from '../lib/types';

interface Props {
  habit?: Habit;
  onClose: () => void;
}

type Kind = Schedule['kind'];
type Panel = 'goal' | 'repeat' | 'time' | 'reminder' | 'pause' | null;

/** Suggested reminder time for each time of day. */
const REMIND_AT: Record<TimeOfDay, string> = { morning: '08:00', afternoon: '13:00', evening: '19:30', anytime: '18:00' };
const QUICK_TIMES = ['07:30', '08:00', '12:30', '16:00', '18:00', '19:30', '21:00'];

const UNITS = ['glasses', 'pages', 'minutes', 'reps', 'steps'];
const KINDS: { value: Kind; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'On certain days' },
  { value: 'interval', label: 'Every few days' },
  { value: 'weekly', label: 'Times a week' },
];

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`Fewer ${label}`}>
        <Minus size={18} strokeWidth={2.8} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`More ${label}`}>
        <Plus size={18} strokeWidth={2.8} />
      </button>
    </div>
  );
}

/** A compact summary row that opens its editor in place (keeps the sheet tidy). */
function OptionRow(props: { icon: ReactNode; title: string; value: string; open: boolean; onToggle: () => void; color: string; children: ReactNode }) {
  return (
    <div className={`opt${props.open ? ' open' : ''}`}>
      <button type="button" className="opt-row" onClick={props.onToggle} aria-expanded={props.open}>
        <span className="opt-icon" style={{ color: props.color, background: alpha(props.color, 0.16) }}>
          {props.icon}
        </span>
        <span className="opt-title">{props.title}</span>
        <span className="opt-value">{props.value}</span>
        <ChevronDown className="opt-chev" size={18} />
      </button>
      {props.open && <div className="opt-editor">{props.children}</div>}
    </div>
  );
}

export function HabitSheet({ habit, onClose }: Props) {
  const { state, dispatch } = useHabits();
  const today = todayKey();
  const weekStart = state.settings.weekStart;
  const rule = habit ? ruleOn(habit, today) : null;
  const sched = rule?.schedule;

  const [name, setName] = useState(habit?.name ?? '');
  const [emoji, setEmoji] = useState(habit?.emoji ?? '💧');
  const [color, setColor] = useState(habit?.color ?? DEFAULT_HABIT_COLOR);
  const [customEmoji, setCustomEmoji] = useState('');
  const [target, setTarget] = useState(rule?.target ?? 1);
  const [counted, setCounted] = useState((rule?.target ?? 1) > 1);
  const [unit, setUnit] = useState(habit?.unit ?? '');
  const [kind, setKind] = useState<Kind>(sched?.kind ?? 'daily');
  const [days, setDays] = useState<number[]>(sched?.kind === 'weekdays' ? sched.days : [1, 3, 5]);
  const [every, setEvery] = useState(sched?.kind === 'interval' ? sched.every : 2);
  const [times, setTimes] = useState(sched?.kind === 'weekly' ? sched.times : 3);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(habit?.timeOfDay ?? 'anytime');
  const [panel, setPanel] = useState<Panel>(null);
  const [reminder, setReminder] = useState<string | null>(habit?.reminder ?? null);
  const [pauseFrom, setPauseFrom] = useState(today);
  const [pauseTo, setPauseTo] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const trimmed = name.trim();
  const isNew = !habit;
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));

  const schedule: Schedule =
    kind === 'weekdays' ? { kind, days: [...days].sort() } : kind === 'interval' ? { kind, every } : kind === 'weekly' ? { kind, times } : { kind: 'daily' };
  const finalTarget = counted ? target : 1;
  const finalUnit = counted ? unit.trim() : '';
  const activePause = habit?.pauses.find((r) => r.to === null || r.to >= today);
  const letters = weekdayLetters(weekStart, 'short');
  const order = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7);

  return (
    <Sheet onClose={onClose} label={isNew ? 'New habit' : 'Edit habit'}>
      {(close) => {
        const save = () => {
          if (!trimmed) return;
          const data: HabitInput = { name: trimmed, emoji, color, unit: finalUnit, timeOfDay, target: finalTarget, schedule, reminder };
          if (reminder) void requestReminderPermission();
          if (habit) dispatch({ type: 'updateHabit', id: habit.id, patch: data });
          else dispatch({ type: 'addHabit', habit: data });
          close();
        };
        return (
          <>
            <div className="sheet-head">
              <h2>{isNew ? 'New habit' : 'Edit habit'}</h2>
              <button className="icon-btn plain" onClick={close} aria-label="Close">
                <X size={22} />
              </button>
            </div>

            <div className="sheet-body">
              <div className="habit-preview" style={{ background: alpha(color, 0.14) }}>
                <span className="emoji-bubble lg" style={{ background: alpha(color, 0.25) }}>
                  {emoji}
                </span>
                <span className="habit-preview-text">
                  <span className="habit-preview-name" style={{ color: trimmed ? undefined : 'var(--text-3)' }}>
                    {trimmed || 'Your new habit'}
                  </span>
                  <span className="habit-preview-sub">
                    {goalLabel(finalTarget, finalUnit)} · {scheduleLabel(schedule, weekStart)}
                    {timeOfDay !== 'anytime' ? ` · ${TIME_OPTIONS.find((t) => t.value === timeOfDay)?.label}` : ''}
                  </span>
                </span>
              </div>

              {isNew && !trimmed && (
                <>
                  <p className="field-label">Quick picks</p>
                  <div className="chips scroll-x">
                    {QUICK_PICKS.map((q) => (
                      <button
                        key={q.name}
                        className="chip"
                        onClick={() => {
                          setName(q.name);
                          setEmoji(q.emoji);
                          setColor(q.color);
                          setCounted(q.target > 1);
                          setTarget(q.target);
                          setUnit(q.unit);
                          setKind(q.schedule.kind);
                          if (q.schedule.kind === 'weekdays') setDays(q.schedule.days);
                          if (q.schedule.kind === 'weekly') setTimes(q.schedule.times);
                          setTimeOfDay(q.timeOfDay);
                        }}
                      >
                        <span>{q.emoji}</span> {q.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              <label className="field-label" htmlFor="habit-name">
                Name
              </label>
              <input
                id="habit-name"
                className="text-input"
                placeholder="e.g. Drink water"
                value={name}
                maxLength={40}
                autoComplete="off"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && save()}
              />

              <p className="field-label">Goal & schedule</p>
              <div className="opt-group">
                <OptionRow icon={<Target size={19} />} title="Daily goal" value={goalLabel(finalTarget, finalUnit)} open={panel === 'goal'} onToggle={() => toggle('goal')} color={color}>
                  <div className="segmented" role="radiogroup" aria-label="Daily goal">
                    {[false, true].map((c) => (
                      <button
                        key={String(c)}
                        role="radio"
                        aria-checked={counted === c}
                        className={counted === c ? 'active' : undefined}
                        onClick={() => {
                          setCounted(c);
                          if (c && target < 2) setTarget(8);
                        }}
                      >
                        {c ? 'Several times' : 'Once a day'}
                      </button>
                    ))}
                  </div>
                  {counted && (
                    <>
                      <div className="opt-line">
                        <Stepper value={target} min={2} max={99} onChange={setTarget} label="taps per day" />
                        <span className="opt-hint">{unit.trim() || 'times'} a day</span>
                      </div>
                      <input
                        className="text-input small"
                        placeholder="Unit (optional), e.g. glasses"
                        value={unit}
                        maxLength={16}
                        onChange={(e) => setUnit(e.target.value)}
                        aria-label="Unit"
                      />
                      <div className="chips wrap">
                        {UNITS.map((u) => (
                          <button key={u} className={`chip small${unit === u ? ' selected' : ''}`} onClick={() => setUnit(unit === u ? '' : u)}>
                            {u}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </OptionRow>

                <OptionRow icon={<Repeat size={19} />} title="Repeat" value={scheduleLabel(schedule, weekStart)} open={panel === 'repeat'} onToggle={() => toggle('repeat')} color={color}>
                  <div className="kind-grid" role="radiogroup" aria-label="Repeat">
                    {KINDS.map((k) => (
                      <button key={k.value} role="radio" aria-checked={kind === k.value} className={`chip${kind === k.value ? ' selected' : ''}`} onClick={() => setKind(k.value)}>
                        {k.label}
                      </button>
                    ))}
                  </div>
                  {kind === 'weekdays' && (
                    <div className="day-toggles" role="group" aria-label="Days">
                      {order.map((d, i) => {
                        const on = days.includes(d);
                        return (
                          <button
                            key={d}
                            className={`day-toggle${on ? ' on' : ''}`}
                            style={on ? { background: color, color: onColor(color) } : undefined}
                            aria-pressed={on}
                            aria-label={formatDate(addDays('2023-01-01', d), { weekday: 'long' })}
                            // Always keep at least one day
                            onClick={() => setDays(on ? (days.length > 1 ? days.filter((x) => x !== d) : days) : [...days, d])}
                          >
                            {letters[i].slice(0, 2)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {kind === 'interval' && (
                    <>
                      <div className="opt-line">
                        <span className="opt-hint">Every</span>
                        <Stepper value={every} min={2} max={30} onChange={setEvery} label="days" />
                        <span className="opt-hint">days</span>
                      </div>
                      <p className="opt-note">
                        Next ones: {[0, 1, 2].map((i) => formatDate(addDays(today, i * every), { weekday: 'short', day: 'numeric' })).join(' → ')}
                      </p>
                    </>
                  )}
                  {kind === 'weekly' && (
                    <div className="opt-line">
                      <Stepper value={times} min={1} max={6} onChange={setTimes} label="times a week" />
                      <span className="opt-hint">times a week, any days</span>
                    </div>
                  )}
                  {!isNew && <p className="opt-note">Changes apply from today. Your past streaks stay as they were.</p>}
                </OptionRow>

                <OptionRow
                  icon={<Clock size={19} />}
                  title="Time of day"
                  value={TIME_OPTIONS.find((t) => t.value === timeOfDay)!.label}
                  open={panel === 'time'}
                  onToggle={() => toggle('time')}
                  color={color}
                >
                  <div className="chips wrap" role="radiogroup" aria-label="Time of day">
                    {TIME_OPTIONS.map((t) => (
                      <button key={t.value} role="radio" aria-checked={timeOfDay === t.value} className={`chip${timeOfDay === t.value ? ' selected' : ''}`} onClick={() => setTimeOfDay(t.value)}>
                        <span>{t.icon}</span> {t.label}
                      </button>
                    ))}
                  </div>
                </OptionRow>

                <OptionRow
                  icon={<Bell size={19} />}
                  title="Reminder"
                  value={reminder ? `At ${formatTime(reminder)}` : 'Off'}
                  open={panel === 'reminder'}
                  onToggle={() => {
                    if (!reminder && panel !== 'reminder') setReminder(REMIND_AT[timeOfDay]);
                    toggle('reminder');
                  }}
                  color={color}
                >
                  <div className="reminder-edit">
                    <label className="reminder-time">
                      <span>Remind me at</span>
                      <input type="time" className="text-input small" value={reminder ?? ''} onChange={(e) => setReminder(e.target.value || null)} aria-label="Reminder time" />
                    </label>
                    <div className="chips wrap" aria-label="Quick times">
                      {QUICK_TIMES.map((t) => (
                        <button key={t} className={`chip small${reminder === t ? ' selected' : ''}`} onClick={() => setReminder(t)}>
                          {formatTime(t)}
                        </button>
                      ))}
                      <button className={`chip small${reminder === null ? ' selected' : ''}`} onClick={() => setReminder(null)}>
                        <BellOff size={14} /> Off
                      </button>
                    </div>
                  </div>
                  <p className="opt-note">
                    {reminder
                      ? 'Tick nudges you on days this habit is due, and stays quiet once it’s done, paused or on vacation.'
                      : 'No reminder for this habit.'}
                  </p>
                </OptionRow>
              </div>

              <p className="field-label">Emoji</p>
              <div className="emoji-grid">
                {EMOJIS.map((e) => (
                  <button
                    key={e}
                    className={`emoji-opt${emoji === e ? ' selected' : ''}`}
                    style={emoji === e ? { background: alpha(color, 0.22), borderColor: color } : undefined}
                    onClick={() => setEmoji(e)}
                    aria-label={`Emoji ${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              <input
                className="text-input small"
                placeholder="…or type any emoji here ✨"
                value={customEmoji}
                onChange={(e) => {
                  setCustomEmoji(e.target.value);
                  const g = firstGrapheme(e.target.value);
                  if (g) setEmoji(g);
                }}
              />

              <p className="field-label">Colour</p>
              <div className="color-grid">
                {HABIT_COLORS.map((c) => (
                  <button
                    key={c.value}
                    className={`color-opt${color === c.value ? ' selected' : ''}`}
                    style={{ background: c.value, color: c.value }}
                    onClick={() => setColor(c.value)}
                    aria-label={c.name}
                    aria-pressed={color === c.value}
                  >
                    {color === c.value && <Check size={20} strokeWidth={3} color={onColor(c.value)} />}
                  </button>
                ))}
              </div>

              {habit && (
                <>
                  <p className="field-label">Manage</p>
                  <div className="opt-group">
                    {activePause ? (
                      <div className="opt-row static">
                        <span className="opt-icon" style={{ color, background: alpha(color, 0.16) }}>
                          <Pause size={19} />
                        </span>
                        <span className="opt-title">
                          Paused
                          <small>
                            {activePause.from > today ? `From ${formatDate(activePause.from, { month: 'short', day: 'numeric' })}` : 'Streak is frozen'}
                            {activePause.to ? ` until ${formatDate(activePause.to, { month: 'short', day: 'numeric' })}` : ''}
                          </small>
                        </span>
                        <button
                          className="btn btn-soft small"
                          onClick={() => {
                            dispatch({ type: 'resume', id: habit.id });
                            close();
                          }}
                        >
                          <Play size={16} /> Resume
                        </button>
                      </div>
                    ) : (
                      <OptionRow icon={<Pause size={19} />} title="Pause habit" value="Holiday, sick day…" open={panel === 'pause'} onToggle={() => toggle('pause')} color={color}>
                        <p className="opt-note top">Paused days don’t count, so your streak stays safe.</p>
                        <div className="date-row">
                          <label>
                            From
                            <input type="date" className="text-input small" value={pauseFrom} max={addDays(today, 365)} onChange={(e) => setPauseFrom(e.target.value || today)} />
                          </label>
                          <label>
                            Until
                            <input type="date" className="text-input small" value={pauseTo} min={pauseFrom} onChange={(e) => setPauseTo(e.target.value)} />
                          </label>
                        </div>
                        <button
                          className="btn btn-soft btn-block"
                          onClick={() => {
                            dispatch({ type: 'pause', id: habit.id, from: pauseFrom, to: pauseTo || null });
                            close();
                          }}
                        >
                          <Pause size={18} /> Pause {pauseTo ? `until ${formatDate(pauseTo, { month: 'short', day: 'numeric' })}` : 'until I resume'}
                        </button>
                      </OptionRow>
                    )}
                    <div className="opt-row static">
                      <span className="opt-icon" style={{ color, background: alpha(color, 0.16) }}>
                        <Archive size={19} />
                      </span>
                      <span className="opt-title">
                        Archive
                        <small>Hide it, keep its history. Restore it in Settings.</small>
                      </span>
                      <button
                        className="btn btn-soft small"
                        onClick={() => {
                          dispatch({ type: 'archive', id: habit.id });
                          close();
                        }}
                      >
                        Archive
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="sheet-foot">
              {!isNew &&
                (confirmDelete ? (
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      dispatch({ type: 'deleteHabit', id: habit.id });
                      close();
                    }}
                  >
                    <Trash2 size={18} /> Tap again to delete
                  </button>
                ) : (
                  <button className="btn btn-danger" onClick={() => setConfirmDelete(true)} aria-label="Delete habit">
                    <Trash2 size={18} />
                  </button>
                ))}
              <button className="btn btn-primary grow" disabled={!trimmed} onClick={save} style={{ background: color, color: onColor(color) }}>
                {isNew ? 'Add habit' : 'Save changes'}
              </button>
            </div>
          </>
        );
      }}
    </Sheet>
  );
}
