import { Header, SectionSwitch } from '../shared/Header';
import { useUI, type TodoView } from '../data/ui';

export function TodoSection() {
  const view = useUI((s) => s.todoView);
  const setView = useUI((s) => s.setTodoView);
  return (
    <main className="screen">
      <Header title="To-Do" search gear />
      <SectionSwitch<TodoView>
        label="To-do views"
        value={view}
        onChange={setView}
        options={[
          { value: 'today', label: '☀️ Today' },
          { value: 'upcoming', label: '🗓️ Upcoming' },
          { value: 'browse', label: '🗂️ Lists' },
        ]}
      />
    </main>
  );
}
