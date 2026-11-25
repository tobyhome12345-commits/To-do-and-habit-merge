import { useState } from 'react';
import { ListTodo, Sprout, Trash2 } from 'lucide-react';
import { useData } from '../data/store';
import { useUI } from '../data/ui';
import { resetData, type ResetWhat } from '../data/backup';
import { kv, PRE_IMPORT, saveNow } from '../data/persistence';
import { Sheet } from '../shared/Sheet';
import { haptic } from '../core/haptics';

const OPTIONS: { what: ResetWhat; label: string; sub: string; Icon: typeof Trash2 }[] = [
  { what: 'habits', label: 'Delete all habits', sub: 'Tasks and lists stay', Icon: Sprout },
  { what: 'tasks', label: 'Delete all tasks', sub: 'Habits and streaks stay; lists go back to the starters', Icon: ListTodo },
  { what: 'all', label: 'Delete everything', sub: 'A completely fresh start (settings stay)', Icon: Trash2 },
];

/** Settings → Reset: habits, tasks or both. Tap twice to confirm; a safety copy is kept. */
export default function ResetSheet() {
  const closeSheet = useUI((s) => s.closeSheet);
  const replaceData = useData((s) => s.replaceData);
  const showSnack = useData((s) => s.showSnack);
  const [armed, setArmed] = useState<ResetWhat | null>(null);

  const run = async (what: ResetWhat) => {
    if (armed !== what) {
      haptic('warning');
      setArmed(what);
      return;
    }
    const current = useData.getState().data;
    await kv.set(PRE_IMPORT, JSON.stringify(current));
    replaceData(resetData(current, what));
    await saveNow();
    closeSheet();
    showSnack(what === 'habits' ? 'All habits deleted. Fresh start! ✓' : what === 'tasks' ? 'All tasks deleted. Clean slate!' : 'Everything deleted. Hello again 👋', undefined, '🧹');
  };

  return (
    <Sheet onClose={closeSheet} label="Reset" title="Reset">
      <p className="sheet__text">Pick what to delete. You can still get it back with Settings → Undo last import or reset, until the next import or reset.</p>
      <div className="stack">
        {OPTIONS.map(({ what, label, sub, Icon }) => (
          <button key={what} className={`reset-opt${armed === what ? ' armed' : ''}`} onClick={() => void run(what)}>
            <Icon size={20} />
            <span>
              <b>{armed === what ? 'Tap again to confirm' : label}</b>
              <small>{sub}</small>
            </span>
          </button>
        ))}
        <button className="btn btn--ghost btn-block" onClick={closeSheet}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}
