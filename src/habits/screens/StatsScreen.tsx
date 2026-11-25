import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Minus } from 'lucide-react';
import { useHabits } from '../../data/store';
import { alpha } from '../../core/colors';
import { formatDate } from '../../core/dates';
import { dailySeries, habitPeriodStats, overallStats, periodFor, shiftPeriod, statHabits, type PeriodKind } from '../lib/stats';
import { bestStreak, currentStreak, streakLabel, totalDone } from '../lib/streaks';
import { ruleOn, scheduleLabel } from '../lib/schedule';
import { Tick } from '../../shared/Tick';
import { tickLevel } from '../../mascot/mood';
import type { TickMood } from '../../mascot/tick';
import type { DateKey } from '../lib/types';

interface Props {
  today: DateKey;
}

const pct = (r: number | null) => (r === null ? '—' : `${Math.round(r * 100)}%`);

export function StatsScreen({ today }: Props) {
  const { state } = useHabits();
  const { settings } = state;
  const habits = statHabits(state);
  const [kind, setKind] = useState<PeriodKind>('week');
  const [offset, setOffset] = useState(0); // 0 = current period, -1 = previous, …
  const [picked, setPicked] = useState<DateKey | null>(null);

  const current = periodFor(kind, today, settings.weekStart);
  const period = shiftPeriod(kind, current, offset, settings.weekStart);
  const prev = shiftPeriod(kind, period, -1, settings.weekStart);

  const series = useMemo(() => dailySeries(habits, state, period, today), [state, period.start, period.end, today]); // eslint-disable-line react-hooks/exhaustive-deps
  const overall = overallStats(habits, state, period, today, series);
  const prevOverall = overallStats(habits, state, prev, today, dailySeries(habits, state, prev, today));
  const delta = overall.rate !== null && prevOverall.rate !== null ? Math.round((overall.rate - prevOverall.rate) * 100) : null;

  const perHabit = habits
    .map((h) => ({
      habit: h,
      stats: habitPeriodStats(h, state, period, today),
      streak: currentStreak(h, state, today),
      best: bestStreak(h, state, today),
      total: totalDone(h, state, today),
    }))
    .sort((a, b) => (b.stats.rate ?? -1) - (a.stats.rate ?? -1));

  const topStreak = perHabit.reduce<(typeof perHabit)[number] | null>((m, x) => (!m || x.streak.count > m.streak.count ? x : m), null);

  const periodLabel =
    kind === 'week'
      ? offset === 0
        ? 'This week'
        : offset === -1
          ? 'Last week'
          : `Week of ${formatDate(period.start, { month: 'short', day: 'numeric' })}`
      : formatDate(period.start, { month: 'long', year: 'numeric' });
  const rangeLabel =
    kind === 'week'
      ? `${formatDate(period.start, { month: 'short', day: 'numeric' })} – ${formatDate(period.end, { month: 'short', day: 'numeric' })}`
      : offset === 0
        ? 'This month'
        : offset === -1
          ? 'Last month'
          : '';
  const prevName = kind === 'week' ? 'last week' : 'last month';

  // Tick's take on the period
  const tickTake: { mood: TickMood; text: string } =
    overall.rate === null
      ? { mood: 'shrug', text: 'Nothing to count yet. I’m just standing here 🤷' }
      : delta === null
        ? { mood: 'happy', text: `Your first ${kind}! Every tick counts ✓` }
        : delta >= 5
          ? { mood: 'celebrate', text: `Up ${delta} points on ${prevName}! Who even are you?! 🎉` }
          : delta <= -5
            ? { mood: 'encourage', text: `A little dip vs ${prevName}. Happens! Let’s bounce back 💪` }
            : overall.rate >= 0.8
              ? { mood: 'proud', text: 'Rock solid. Honestly? Kinda showing off 😎' }
              : { mood: 'happy', text: `Steady vs ${prevName}. One extra tick a day adds up fast ✨` };

  const pickedDay = series.find((d) => d.date === picked);
  const readout = pickedDay
    ? `${formatDate(pickedDay.date, { weekday: 'short', month: 'short', day: 'numeric' })} · ${pickedDay.done} of ${pickedDay.possible} habits (${pct(pickedDay.possible ? pickedDay.done / pickedDay.possible : null)})`
    : 'Tap a bar to see that day';

  if (habits.length === 0) {
    return (
      <main className="screen">
        <header className="screen-header">
          <h1>Stats</h1>
        </header>
        <div className="card empty">
          <Tick mood="sleepy" size={130} label="Tick napping" />
          <h2>Tick’s napping…</h2>
          <p>Add a habit and check it off, and your weekly and monthly progress will show up here.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <header className="screen-header">
        <div>
          <p className="subtitle">How you’re doing</p>
          <h1>Stats</h1>
        </div>
      </header>

      <div className="segmented" role="tablist" aria-label="Period">
        {(['week', 'month'] as const).map((k) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            className={kind === k ? 'active' : undefined}
            onClick={() => {
              setKind(k);
              setOffset(0);
              setPicked(null);
            }}
          >
            {k === 'week' ? 'Week' : 'Month'}
          </button>
        ))}
      </div>

      <div className="period-nav">
        <button className="icon-btn plain" aria-label="Previous period" onClick={() => (setOffset(offset - 1), setPicked(null))}>
          <ChevronLeft size={22} />
        </button>
        <div className="period-title">
          <h2>{periodLabel}</h2>
          {rangeLabel && <p>{rangeLabel}</p>}
        </div>
        <button className="icon-btn plain" aria-label="Next period" disabled={offset >= 0} onClick={() => (setOffset(offset + 1), setPicked(null))}>
          <ChevronRight size={22} />
        </button>
      </div>

      <div className="tiles">
        <div className="tile card">
          <span className="tile-label">Completion</span>
          <span className="tile-value">{pct(overall.rate)}</span>
          {delta !== null ? (
            <span className={`tile-delta ${delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'}`}>
              {delta > 0 ? <ArrowUpRight size={15} strokeWidth={2.8} /> : delta < 0 ? <ArrowDownRight size={15} strokeWidth={2.8} /> : <Minus size={15} strokeWidth={2.8} />}
              {delta > 0 ? '+' : ''}
              {delta} pts vs {prevName}
            </span>
          ) : (
            <span className="tile-sub">First {kind} 🎉</span>
          )}
        </div>
        <div className="tile card">
          <span className="tile-label">Check-ins</span>
          <span className="tile-value">{overall.done}</span>
          <span className="tile-sub">of {overall.possible} possible</span>
        </div>
        <div className="tile card">
          <span className="tile-label">Perfect days</span>
          <span className="tile-value">{overall.perfectDays}</span>
          <span className="tile-sub">every habit done</span>
        </div>
        <div className="tile card">
          <span className="tile-label">Top streak</span>
          <span className="tile-value">🔥 {topStreak?.streak.count ?? 0}</span>
          <span className="tile-sub ellipsis">
            {topStreak && topStreak.streak.count > 0
              ? `${topStreak.streak.unit === 'day' ? '' : `${streakLabel(topStreak.streak.count, topStreak.streak.unit).replace(/^\d+ /, '')} · `}${topStreak.habit.emoji} ${topStreak.habit.name}`
              : 'Start one today!'}
          </span>
        </div>
      </div>

      <section className="card tick-take">
        <Tick mood={tickTake.mood} stage={tickLevel(state, today).stage} size={58} />
        <p>
          <b>Tick’s take:</b> {tickTake.text}
        </p>
      </section>

      <section className="card chart-card">
        <div className="chart-head">
          <h3>Daily completion</h3>
          <span>% of habits done</span>
        </div>
        <div className="chart">
          <div className="chart-y" aria-hidden="true">
            <span>100%</span>
            <span>50%</span>
            <span>0%</span>
          </div>
          <div className="chart-plot">
            <div className="chart-grid" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="chart-bars" style={{ gridTemplateColumns: `repeat(${series.length}, 1fr)` }}>
              {series.map((d) => {
                const r = d.possible ? d.done / d.possible : 0;
                const label = `${formatDate(d.date, { weekday: 'long', month: 'short', day: 'numeric' })}: ${d.future ? 'upcoming' : `${d.done} of ${d.possible} habits`}`;
                return (
                  <button
                    key={d.date}
                    className={`bar-slot${picked === d.date ? ' picked' : ''}${d.date === today ? ' is-today' : ''}`}
                    disabled={d.future}
                    onClick={() => setPicked(d.date)}
                    aria-label={label}
                  >
                    {!d.future && <span className="bar" style={{ height: `${Math.max(r * 100, r > 0 ? 4 : 0)}%` }} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <div className="chart-x" style={{ gridTemplateColumns: `repeat(${series.length}, 1fr)` }} aria-hidden="true">
          {series.map((d) => {
            const day = Number(d.date.slice(8));
            const show = kind === 'week' || day === 1 || day % 5 === 0;
            return (
              <span key={d.date} className={d.date === today ? 'today' : undefined}>
                {show ? (kind === 'week' ? formatDate(d.date, { weekday: 'narrow' }) : day) : ''}
              </span>
            );
          })}
        </div>
        <p className="heat-readout">{readout}</p>
      </section>

      <h3 className="section-title">Habits</h3>
      <section className="card habit-stats">
        {perHabit.map(({ habit: h, stats, streak, best, total }) => (
          <div key={h.id} className="hs-row">
            <span className="emoji-bubble sm" style={{ background: alpha(h.color, 0.2) }}>
              {h.emoji}
            </span>
            <div className="hs-main">
              <div className="hs-top">
                <span className="hs-name">
                  {h.name}
                  <small>{scheduleLabel(ruleOn(h, today).schedule, settings.weekStart)}</small>
                </span>
                <span className="hs-pct">{pct(stats.rate)}</span>
              </div>
              <div
                className="meter"
                style={{ background: alpha(h.color, 0.18) }}
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={stats.rate === null ? 0 : Math.round(stats.rate * 100)}
                aria-label={`${h.name} completion`}
              >
                <span style={{ width: `${(stats.rate ?? 0) * 100}%`, background: h.color }} />
              </div>
              <div className="hs-meta">
                {stats.rate === null ? (
                  <span>Nothing due yet</span>
                ) : (
                  <span>
                    {stats.done}/{stats.possible} {stats.weekly ? 'check-ins' : ruleOn(h, today).schedule.kind === 'daily' ? 'days' : 'scheduled days'}
                  </span>
                )}
                <span>🔥 {streakLabel(streak.count, streak.unit)}</span>
                <span>🏆 {best}</span>
                <span>✅ {total} total</span>
              </div>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
