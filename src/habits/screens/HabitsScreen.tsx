import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { DndContext, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useHabits } from '../../data/store';
import { formatDate } from '../../core/dates';
import { tapHaptic } from '../../core/haptics';
import { HabitCard } from '../components/HabitCard';
import { ProgressRing } from '../../shared/ProgressRing';
import { Confetti } from '../../shared/Confetti';
import { Tick } from '../../shared/Tick';
import { useUI } from '../../data/ui';
import { useHabitCheck } from '../useHabitCheck';
import { STAGE_BADGES, dayContext, tickLevel, tickMessage, tickMood } from '../../mascot/mood';
import { TIME_OPTIONS, liveHabits, pauseOn, todayInfo, type TodayInfo } from '../lib/schedule';
import { bestStreak, currentStreak, type Streak } from '../lib/streaks';
import type { TickMood } from '../../mascot/tick';
import type { DateKey, Habit } from '../lib/types';

export const MOOD_LABEL: Record<TickMood, string> = {
  happy: 'happy and waving',
  celebrate: 'celebrating',
  sleepy: 'sleepy',
  encourage: 'cheering you on',
  proud: 'proud of you',
  shrug: 'shrugging',
};

interface Props {
  today: DateKey;
  hour: number;
}

interface Row {
  habit: Habit;
  info: TodayInfo;
  streak: Streak;
  best: number;
}

type CardHandlers = Pick<Parameters<typeof HabitCard>[0], 'onTap' | 'onToggleDay' | 'onEdit' | 'today' | 'state'>;

const onlyVertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });

const SortableCard = memo(function SortableCard({ row, ...rest }: { row: Row } & CardHandlers) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.habit.id });
  const style: CSSProperties = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={`sortable${isDragging ? ' dragging' : ''}`}>
      <HabitCard habit={row.habit} info={row.info} streak={row.streak} best={row.best} dragProps={{ ...attributes, ...listeners }} {...rest} />
    </div>
  );
});

/** A list you can reorder by long-pressing a habit's name and dragging. */
function SortableList({ rows, ...rest }: { rows: Row[] } & CardHandlers) {
  const { dispatch } = useHabits();
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (e.over && e.active.id !== e.over.id) dispatch({ type: 'reorder', id: String(e.active.id), overId: String(e.over.id) });
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[onlyVertical]} onDragStart={tapHaptic} onDragEnd={onDragEnd}>
      <SortableContext items={rows.map((r) => r.habit.id)} strategy={verticalListSortingStrategy}>
        <div className="habit-list">
          {rows.map((r) => (
            <SortableCard key={r.habit.id} row={r} {...rest} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

const NOT_TODAY_KEY = 'ht-not-today-collapsed';

/** The Habit Tracker's Today screen: the full habit list (Habits tab → Habits). */
export function HabitsScreen({ today, hour }: Props) {
  const { state, dispatch } = useHabits();
  const habits = liveHabits(state, today);
  const ctx = dayContext(state, today, hour);
  const mood = tickMood(ctx);
  const growth = tickLevel(state, today);
  const allDone = ctx.total > 0 && ctx.done === ctx.total;

  const rows: Row[] = habits.map((h) => ({ habit: h, info: todayInfo(h, state, today), streak: currentStreak(h, state, today), best: bestStreak(h, state, today) }));
  const main = rows.filter((r) => r.info.kind === 'due' || r.info.kind === 'done');
  const rest = rows.filter((r) => r.info.kind === 'notToday' || r.info.kind === 'paused');
  const grouped = main.some((r) => r.habit.timeOfDay !== 'anytime');
  const groups = grouped
    ? TIME_OPTIONS.map((t) => ({ key: t.value, label: `${t.icon} ${t.label}`, rows: main.filter((r) => r.habit.timeOfDay === t.value) })).filter((g) => g.rows.length)
    : [{ key: 'all', label: '', rows: main }];
  const vacation = habits.length > 0 ? pauseOn(habits[0], state.settings, today) : null;
  const onVacation = vacation?.vacation ? vacation.range : null;

  const [restCollapsed, setRestCollapsed] = useState(() => {
    try {
      return localStorage.getItem(NOT_TODAY_KEY) === '1';
    } catch {
      return false;
    }
  });
  const toggleRest = () =>
    setRestCollapsed((v) => {
      try {
        localStorage.setItem(NOT_TODAY_KEY, v ? '0' : '1');
      } catch {
        /* private mode: just don't remember */
      }
      return !v;
    });

  // Confetti when the last habit of the day gets ticked (not on first render).
  const [burst, setBurst] = useState(0);
  const hop = useUI((u) => u.hop);
  const openSheet = useUI((u) => u.openSheet);
  const prevAllDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !prevAllDone.current) setBurst((b) => b + 1);
    prevAllDone.current = allDone;
  }, [allDone]);

  const { onTap, onToggleDay } = useHabitCheck(today);
  const onAdd = () => openSheet({ kind: 'habit' });
  const onEdit = (h: Habit) => openSheet({ kind: 'habit', habitId: h.id });

  if (habits.length === 0) {
    return (
      <>
        <section className="card empty hello">
          <div className="hello-art">
            <Tick mood="happy" stage={2} size={156} label="Tick the checkmark, waving hello" />
          </div>
          <h2>Hi, I’m Tick!</h2>
          <p>I’m a checkmark with big dreams. Add a habit, tick it off every day, and watch me level up from Faint to Legend 👑</p>
          <button className="btn btn-primary" onClick={onAdd}>
            <Plus size={20} strokeWidth={2.6} /> Add your first habit
          </button>
        </section>
      </>
    );
  }

  const cardProps: CardHandlers = { onTap, onToggleDay, onEdit, today, state };

  return (
    <>

      {onVacation && (
        <section className="card vacation-banner">
          <span className="vacation-icon" aria-hidden="true">
            🏖️
          </span>
          <span className="vacation-text">
            <b>Vacation mode</b>
            <small>
              Streaks are frozen{onVacation.to ? ` until ${formatDate(onVacation.to, { month: 'short', day: 'numeric' })}` : ''}. Enjoy the break!
            </small>
          </span>
          <button className="btn btn-soft small" onClick={() => dispatch({ type: 'resume', id: 'all' })}>
            Resume
          </button>
        </section>
      )}

      <section className={`hero card mood-${mood}`} aria-live="polite">
        <div className="hero-main">
          <div className="hero-art">
            <ProgressRing value={ctx.total ? ctx.done / ctx.total : 0} size={124} stroke={9} color="var(--leaf)">
              <Tick mood={mood} stage={growth.stage} size={104} hop={hop} label={`Tick is ${MOOD_LABEL[mood]}`} />
            </ProgressRing>
            {burst > 0 && <Confetti key={burst} />}
          </div>
          <div className="hero-text">
            <p className="bubble">{tickMessage(ctx, mood)}</p>
            <p className="hero-count">
              {ctx.total > 0 ? (
                <>
                  <strong>{ctx.done}</strong> of {ctx.total} done
                </>
              ) : ctx.resting ? (
                <>🏖️ Rest day</>
              ) : (
                <>🎈 Free day</>
              )}
            </p>
          </div>
        </div>
        <div className="growth">
          <div className="growth-row">
            <span className="stage-badge">{STAGE_BADGES[growth.stage]}</span>
            <span className="growth-label">
              {growth.next !== null ? (
                <>
                  Next: <b>{STAGE_BADGES[growth.stage + 1]}</b> at a {growth.next}-day streak
                </>
              ) : (
                <>Max level! Keep that {growth.best}-day streak going</>
              )}
            </span>
          </div>
          {growth.next !== null && (
            <div className="growth-row">
              <span className="growth-bar" aria-hidden="true">
                <i style={{ width: `${Math.min(100, (growth.best / growth.next) * 100)}%` }} />
              </span>
              <span className="growth-num">
                {growth.best}/{growth.next} days
              </span>
            </div>
          )}
        </div>
      </section>

      {main.length === 0 && !onVacation && <p className="free-day">Nothing due today 🎈 Enjoy the free day!</p>}

      {groups.map((g) => (
        <section key={g.key} className="habit-group" aria-label={g.label || 'Today’s habits'}>
          {g.label && <h3 className="group-title">{g.label}</h3>}
          <SortableList rows={g.rows} {...cardProps} />
        </section>
      ))}

      {rest.length > 0 && (
        <section className="habit-group not-today" aria-label="Not today">
          <button className="group-title toggle" onClick={toggleRest} aria-expanded={!restCollapsed}>
            {onVacation ? 'Paused' : 'Not today'} <span className="group-count">{rest.length}</span>
            <ChevronDown size={18} className={`group-chev${restCollapsed ? '' : ' open'}`} />
          </button>
          {!restCollapsed && <SortableList rows={rest} {...cardProps} />}
        </section>
      )}

      <button className="add-card" onClick={onAdd}>
        <Plus size={20} strokeWidth={2.6} /> Add a habit
      </button>
      <p className="hint">Tap a habit to edit · hold and drag to reorder · tap a day to fix it</p>

    </>
  );
}
