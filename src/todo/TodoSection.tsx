import { Plus } from 'lucide-react';
import { useUI } from '../data/ui';
import { useData } from '../data/store';
import { useToday } from '../core/hooks';
import type { Task } from './model/types';
import { TodoTodayScreen } from './screens/TodoTodayScreen';
import { UpcomingScreen } from './screens/UpcomingScreen';
import { BrowseScreen } from './screens/BrowseScreen';

/** To-Do tab: everything from Doable (Today, Upcoming, Lists; lists, smart views and search open on top). */
export function TodoSection() {
  const view = useUI((s) => s.todoView);
  const today = useToday();
  return (
    <>
      {view === 'today' ? <TodoTodayScreen /> : view === 'upcoming' ? <UpcomingScreen /> : <BrowseScreen />}
      <Fab draft={view === 'today' ? { dueDate: today } : {}} />
    </>
  );
}

/** The round + button for a new task (lifts above the snackbar). */
export function Fab({ draft }: { draft: Partial<Task> }) {
  const openSheet = useUI((s) => s.openSheet);
  const snack = useData((s) => s.snack);
  return (
    <button className={`fab${snack ? ' fab--lifted' : ''}`} aria-label="New task" onClick={() => openSheet({ kind: 'task', draft })}>
      <Plus size={28} strokeWidth={2.6} />
    </button>
  );
}
