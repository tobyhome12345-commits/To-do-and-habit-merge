import { lazy, Suspense } from 'react';
import { Plus } from 'lucide-react';
import { Header, SectionSwitch } from '../shared/Header';
import { useUI, type HabitView } from '../data/ui';
import { useHabits } from '../data/store';
import { useHour, useToday } from '../core/hooks';
import { formatDate } from '../core/dates';
import { greeting } from '../mascot/mood';
import { HabitsScreen } from './screens/HabitsScreen';

// Calendar and Stats load on first visit, keeping app start-up fast.
const CalendarScreen = lazy(() => import('./screens/CalendarScreen'));
const StatsScreen = lazy(() => import('./screens/StatsScreen'));

const SUBTITLE: Record<HabitView, string> = { list: '', calendar: 'Your history', stats: 'How you’re doing' };

/** Habits tab: everything from the Habit Tracker, under one header with a Habits · Calendar · Stats switch. */
export function HabitsSection() {
  const view = useUI((s) => s.habitView);
  const setView = useUI((s) => s.setHabitView);
  const openSheet = useUI((s) => s.openSheet);
  const calHabit = useUI((s) => s.calendarHabit);
  const setCalHabit = useUI((s) => s.setCalendarHabit);
  const { state } = useHabits();
  const today = useToday();
  const hour = useHour();
  const hasHabits = state.habits.some((h) => !h.archivedAt);
  const eyebrow = view === 'list' ? `${greeting(hour)} · ${formatDate(today, { weekday: 'short', month: 'short', day: 'numeric' })}` : SUBTITLE[view];

  return (
    <main className="screen">
      <Header
        eyebrow={eyebrow}
        title="Habits"
        gear
        actions={
          hasHabits && (
            <button className="icon-btn primary" aria-label="New habit" onClick={() => openSheet({ kind: 'habit' })}>
              <Plus size={24} strokeWidth={2.6} />
            </button>
          )
        }
      />
      <SectionSwitch<HabitView>
        label="Habit views"
        value={view}
        onChange={(v) => {
          setView(v);
          window.scrollTo({ top: 0 });
        }}
        options={[
          { value: 'list', label: '🌱 Habits' },
          { value: 'calendar', label: '📅 Calendar' },
          { value: 'stats', label: '📊 Stats' },
        ]}
      />
      <Suspense fallback={null}>
        {view === 'list' && <HabitsScreen today={today} hour={hour} />}
        {view === 'calendar' && <CalendarScreen today={today} selected={calHabit} onSelect={setCalHabit} />}
        {view === 'stats' && <StatsScreen today={today} />}
      </Suspense>
    </main>
  );
}
