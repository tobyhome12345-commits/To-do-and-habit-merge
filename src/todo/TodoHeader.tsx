import type { ReactNode } from 'react';
import { Header, SectionSwitch } from '../shared/Header';
import { useUI, type TodoView } from '../data/ui';

/** The To-Do section's header: title, search, settings gear, and the Today · Upcoming · Lists switch. */
export function TodoHeader({ eyebrow, actions }: { eyebrow?: ReactNode; actions?: ReactNode }) {
  const view = useUI((s) => s.todoView);
  const setView = useUI((s) => s.setTodoView);
  return (
    <>
      <Header eyebrow={eyebrow} title="To-Do" actions={actions} search gear />
      <SectionSwitch<TodoView>
        label="To-do views"
        value={view}
        onChange={(v) => {
          setView(v);
          window.scrollTo({ top: 0 });
        }}
        options={[
          { value: 'today', label: '☀️ Today' },
          { value: 'upcoming', label: '🗓️ Upcoming' },
          { value: 'browse', label: '🗂️ Lists' },
        ]}
      />
    </>
  );
}
