import { lazy, Suspense } from 'react';
import { ListTodo, Sprout } from 'lucide-react';
import { useUI } from '../data/ui';
import { useHabits } from '../data/store';
import { Sheet, useCloseSheet } from './Sheet';
import { Tick } from './Tick';

// Editors load when first opened (keeps start-up fast).
const TaskSheet = lazy(() => import('../todo/sheets/TaskSheet').then((m) => ({ default: m.TaskSheet })));
const ListSheet = lazy(() => import('../todo/sheets/ListSheet').then((m) => ({ default: m.ListSheet })));
const DeleteListSheet = lazy(() => import('../todo/sheets/ListSheet').then((m) => ({ default: m.DeleteListSheet })));
const SortSheet = lazy(() => import('../todo/sheets/SortSheet').then((m) => ({ default: m.SortSheet })));
const HabitSheet = lazy(() => import('../habits/components/HabitSheet').then((m) => ({ default: m.HabitSheet })));
const NoteSheet = lazy(() => import('../habits/components/NoteSheet').then((m) => ({ default: m.NoteSheet })));
const ImportSheet = lazy(() => import('../settings/ImportSheet'));
const ResetSheet = lazy(() => import('../settings/ResetSheet'));

/** "What do you want to add?": the + on the combined Today screen. */
function AddChooser() {
  const close = useUI((s) => s.closeSheet);
  return (
    <Sheet onClose={close} label="Add something" title="Add something">
      <AddChoices />
    </Sheet>
  );
}

function AddChoices() {
  const closeAnimated = useCloseSheet();
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const go = (fn: () => void) => {
    closeAnimated();
    setTimeout(fn, 220);
  };
  return (
    <div className="add-choices">
      <button className="add-choice" onClick={() => go(() => useUI.getState().openSheet({ kind: 'habit' }))}>
        <span className="add-choice-icon habit">
          <Sprout size={24} />
        </span>
        <span>
          <b>New habit</b>
          <small>Something to do regularly, with streaks</small>
        </span>
      </button>
      <button className="add-choice" onClick={() => go(() => useUI.getState().openSheet({ kind: 'task', draft: { dueDate: todayKey } }))}>
        <span className="add-choice-icon task">
          <ListTodo size={24} />
        </span>
        <span>
          <b>New task</b>
          <small>A one-off to-do, due today (change it any time)</small>
        </span>
      </button>
      <div className="add-tick" aria-hidden>
        <Tick mood="happy" stage={2} size={64} still />
      </div>
    </div>
  );
}

function HabitSheetFor({ habitId }: { habitId?: string }) {
  const { state } = useHabits();
  const close = useUI((s) => s.closeSheet);
  const habit = habitId ? state.habits.find((h) => h.id === habitId) : undefined;
  return <HabitSheet key={habitId ?? 'new'} habit={habit} onClose={close} />;
}

function NoteSheetFor({ habitId, date }: { habitId: string; date: string }) {
  const { state } = useHabits();
  const close = useUI((s) => s.closeSheet);
  const habit = state.habits.find((h) => h.id === habitId);
  return habit ? <NoteSheet habit={habit} date={date} onClose={close} /> : null;
}

/** Shows whichever bottom sheet is open (habits, tasks, lists, import…). */
export function SheetHost() {
  const sheet = useUI((s) => s.sheet);
  if (!sheet) return null;
  return (
    <Suspense fallback={null}>
      {(() => {
        switch (sheet.kind) {
          case 'task':
            return <TaskSheet taskId={sheet.taskId} draft={sheet.draft} />;
          case 'list':
            return <ListSheet key={sheet.listId ?? 'new'} listId={sheet.listId} />;
          case 'sort':
            return <SortSheet viewKey={sheet.viewKey} allowManual={sheet.allowManual} showListFilter={sheet.showListFilter} />;
          case 'deleteList':
            return <DeleteListSheet listId={sheet.listId} />;
          case 'habit':
            return <HabitSheetFor habitId={sheet.habitId} />;
          case 'note':
            return <NoteSheetFor habitId={sheet.habitId} date={sheet.date} />;
          case 'add':
            return <AddChooser />;
          case 'import':
            return <ImportSheet plan={sheet.plan} />;
          case 'reset':
            return <ResetSheet />;
        }
      })()}
    </Suspense>
  );
}
