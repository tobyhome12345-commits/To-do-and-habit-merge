import { Header } from '../shared/Header';
import { EmptyState } from '../shared/EmptyState';
import { greeting } from '../mascot/mood';
import { formatDate } from '../core/dates';
import { useHour, useToday } from '../core/hooks';

/** Step 1 placeholder: the combined Today view arrives in step 5. */
export function TodayScreen() {
  const today = useToday();
  const hour = useHour();
  return (
    <main className="screen">
      <Header eyebrow={`${greeting(hour)} · ${formatDate(today, { weekday: 'short', month: 'short', day: 'numeric' })}`} title="Today" gear />
      <section className="card">
        <EmptyState mood="happy" title="Hi, I’m Tick!" text="Habits and to-dos, together at last. Your day lives here." />
      </section>
    </main>
  );
}
