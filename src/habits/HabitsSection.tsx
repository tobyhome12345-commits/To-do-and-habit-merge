import { Header, SectionSwitch } from '../shared/Header';
import { useUI, type HabitView } from '../data/ui';

export function HabitsSection() {
  const view = useUI((s) => s.habitView);
  const setView = useUI((s) => s.setHabitView);
  return (
    <main className="screen">
      <Header title="Habits" gear />
      <SectionSwitch<HabitView>
        label="Habit views"
        value={view}
        onChange={setView}
        options={[
          { value: 'list', label: '🌱 Habits' },
          { value: 'calendar', label: '📅 Calendar' },
          { value: 'stats', label: '📊 Stats' },
        ]}
      />
    </main>
  );
}
