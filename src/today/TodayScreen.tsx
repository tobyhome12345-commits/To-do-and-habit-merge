import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Plus, Upload } from 'lucide-react';
import { Header } from '../shared/Header';
import { Tick } from '../shared/Tick';
import { ProgressRing } from '../shared/ProgressRing';
import { Confetti } from '../shared/Confetti';
import { useData, useHabits } from '../data/store';
import { useUI } from '../data/ui';
import { pickBackupFile } from '../data/backupIO';
import { useHour, useToday } from '../core/hooks';
import { formatDate, toLocalDate } from '../core/dates';
import { STAGE_BADGES, dayContext, greeting, tickLevel, tickMessage, tickMood, type DayContext } from '../mascot/mood';
import { MOOD_LABEL } from '../habits/screens/HabitsScreen';
import { HabitCard } from '../habits/components/HabitCard';
import { useHabitCheck } from '../habits/useHabitCheck';
import { liveHabits, todayInfo, TIME_OPTIONS } from '../habits/lib/schedule';
import { bestStreak, currentStreak } from '../habits/lib/streaks';
import type { Habit } from '../habits/lib/types';
import { todayView, sortTasks } from '../todo/model/views';
import { TaskList } from '../todo/components/TaskList';
import { QuickAdd } from '../todo/components/QuickAdd';

/*
 * Doable's home: today's habits and today's tasks together, with Tick cheering on the whole day.
 * Habits use the Habit Tracker's cards (compact) and check-off; tasks use Doable's rows, tick animation and undo.
 */

const TIME_ORDER = Object.fromEntries(TIME_OPTIONS.map((t, i) => [t.value, i]));

/** Welcome card on a fresh install, with a shortcut to bring old data across. */
function Welcome() {
  const setMeta = useData((s) => s.setMeta);
  return (
    <section className="card welcome">
      <div className="welcome-art">
        <Tick mood="happy" stage={2} size={92} label="Tick waving hello" />
      </div>
      <div className="welcome-text">
        <h2>Welcome to Doable!</h2>
        <p>Your habits and to-dos, together. Coming from the Habit Tracker or your old to-do app? Import their backups and everything comes along.</p>
        <div className="welcome-actions">
          <button className="btn btn-primary small" onClick={pickBackupFile}>
            <Upload size={16} /> Import a backup
          </button>
          <button className="btn btn-soft small" onClick={() => setMeta({ welcomeDone: true })}>
            Start fresh
          </button>
        </div>
      </div>
    </section>
  );
}

const HabitRows = memo(function HabitRows({ habits, today }: { habits: Habit[]; today: string }) {
  const { state } = useHabits();
  const openSheet = useUI((s) => s.openSheet);
  const { onTap, onToggleDay } = useHabitCheck(today);
  const onEdit = (h: Habit) => openSheet({ kind: 'habit', habitId: h.id });
  return (
    <div className="habit-list">
      {habits.map((h) => (
        <HabitCard
          key={h.id}
          habit={h}
          state={state}
          info={todayInfo(h, state, today)}
          streak={currentStreak(h, state, today)}
          best={bestStreak(h, state, today)}
          today={today}
          onTap={onTap}
          onToggleDay={onToggleDay}
          onEdit={onEdit}
          compact
        />
      ))}
    </div>
  );
});

export function TodayScreen() {
  const today = useToday();
  const hour = useHour();
  const { state } = useHabits();
  const tasks = useData((s) => s.data.todo.tasks);
  const lists = useData((s) => s.data.todo.lists);
  const welcomeDone = useData((s) => s.data.meta.welcomeDone);
  const moveTasksToDate = useData((s) => s.moveTasksToDate);
  const openSheet = useUI((s) => s.openSheet);
  const setTab = useUI((s) => s.setTab);
  const setHabitView = useUI((s) => s.setHabitView);
  const setTodoView = useUI((s) => s.setTodoView);
  const hop = useUI((s) => s.hop);

  // Habits due (or already done) today, in time-of-day order.
  const habitCtx = dayContext(state, today, hour);
  const dueHabits = useMemo(
    () =>
      liveHabits(state, today)
        .filter((h) => {
          const k = todayInfo(h, state, today).kind;
          return k === 'due' || k === 'done';
        })
        .sort((a, b) => TIME_ORDER[a.timeOfDay] - TIME_ORDER[b.timeOfDay]),
    [state, today],
  );

  // Tasks: overdue + due today, and what got done today.
  const { overdue, todays, doneToday } = useMemo(() => {
    const v = todayView(tasks, today);
    return {
      overdue: sortTasks(v.overdue, 'due', lists),
      todays: sortTasks(v.today, 'due', lists),
      doneToday: tasks.filter((t) => t.completedAt != null && toLocalDate(t.completedAt) === today).length,
    };
  }, [tasks, lists, today]);
  const taskTotal = overdue.length + todays.length + doneToday;

  // Tick looks at the whole day: habits and tasks.
  const ctx: DayContext = {
    ...habitCtx,
    done: habitCtx.done + doneToday,
    total: habitCtx.total + taskTotal,
    live: habitCtx.live + tasks.filter((t) => t.completedAt == null).length + doneToday,
    resting: habitCtx.resting && taskTotal === 0,
  };
  const mood = tickMood(ctx);
  const level = tickLevel(state, today);
  const allDone = ctx.total > 0 && ctx.done === ctx.total;

  const [burst, setBurst] = useState(0);
  const prevAllDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !prevAllDone.current) setBurst((b) => b + 1);
    prevAllDone.current = allDone;
  }, [allDone]);

  const goHabits = () => {
    setHabitView('list');
    setTab('habits');
    window.scrollTo({ top: 0 });
  };
  const goTasks = () => {
    setTodoView('today');
    setTab('todo');
    window.scrollTo({ top: 0 });
  };

  return (
    <main className="screen today-home">
      <Header
        eyebrow={`${greeting(hour)} · ${formatDate(today, { weekday: 'short', month: 'short', day: 'numeric' })}`}
        title="Today"
        gear
        actions={
          <button className="icon-btn primary" aria-label="Add a habit or task" onClick={() => openSheet({ kind: 'add' })}>
            <Plus size={24} strokeWidth={2.6} />
          </button>
        }
      />

      {!welcomeDone && <Welcome />}

      <section className={`hero card mood-${mood}`} aria-live="polite">
        <div className="hero-main">
          <div className="hero-art">
            <ProgressRing value={ctx.total ? ctx.done / ctx.total : 0} size={124} stroke={9} color="var(--leaf)">
              <Tick mood={mood} stage={level.stage} size={104} hop={hop} label={`Tick is ${MOOD_LABEL[mood]}`} />
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
        <div className="today-split">
          <button className="split-chip" onClick={goHabits}>
            🌱 <b>{habitCtx.done}</b>/{habitCtx.total} habits
          </button>
          <button className="split-chip" onClick={goTasks}>
            ✅ <b>{doneToday}</b>/{taskTotal} tasks
          </button>
          <span className="stage-badge">{STAGE_BADGES[level.stage]}</span>
        </div>
      </section>

      {/* ---------- Habits ---------- */}
      <div className="section-title">
        🌱 Habits <span className="section-title__count">{dueHabits.length}</span>
        <button className="section-title__action" onClick={goHabits}>
          All habits <ChevronRight size={15} />
        </button>
      </div>
      {dueHabits.length > 0 ? (
        <HabitRows habits={dueHabits} today={today} />
      ) : (
        <button className="add-card" onClick={() => (state.habits.length ? goHabits() : openSheet({ kind: 'habit' }))}>
          {state.habits.length ? '🎈 No habits due today' : (
            <>
              <Plus size={20} strokeWidth={2.6} /> Add your first habit
            </>
          )}
        </button>
      )}

      {/* ---------- Tasks ---------- */}
      <div className="section-title">
        ✅ Tasks <span className="section-title__count">{overdue.length + todays.length}</span>
        <button className="section-title__action" onClick={goTasks}>
          All tasks <ChevronRight size={15} />
        </button>
      </div>
      <QuickAdd defaults={{ dueDate: today }} placeholder="Add a task for today…" />
      {overdue.length > 0 && (
        <>
          <div className="section-title section-title--danger sub">
            Overdue <span className="section-title__count">{overdue.length}</span>
            <button className="section-title__action" onClick={() => moveTasksToDate(overdue.map((t) => t.id), today)}>
              Move to today
            </button>
          </div>
          <TaskList tasks={overdue} today={today} />
        </>
      )}
      {todays.length > 0 && <TaskList tasks={todays} today={today} showDate={false} />}
      {overdue.length + todays.length === 0 && (
        <p className="free-day">{doneToday ? `All ${doneToday} task${doneToday === 1 ? '' : 's'} done today. Legendary 🏆` : 'No tasks due today 🌤️'}</p>
      )}
      <p className="hint">Tap a habit or task to edit · tap the circle to tick it off</p>
    </main>
  );
}
