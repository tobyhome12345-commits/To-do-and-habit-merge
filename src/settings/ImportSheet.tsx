import { useState } from 'react';
import { GitMerge, Replace } from 'lucide-react';
import { useData } from '../data/store';
import { useUI } from '../data/ui';
import { applyImport, type ImportMode, type ImportPlan } from '../data/backup';
import { kv, PRE_IMPORT, saveNow } from '../data/persistence';
import { Sheet } from '../shared/Sheet';
import { haptic } from '../core/haptics';

const ART: Record<ImportPlan['kind'], string> = { tickday: '📦', 'habit-tracker': '🌱', doable: '✅' };

/** Import a Tickday, Habit Tracker or Doable backup: merge with what you have, or replace it. */
export default function ImportSheet({ plan }: { plan: ImportPlan }) {
  const closeSheet = useUI((s) => s.closeSheet);
  const replaceData = useData((s) => s.replaceData);
  const showSnack = useData((s) => s.showSnack);
  const [busy, setBusy] = useState(false);
  const { stats, kind } = plan;
  const when = plan.exportedAt ? new Date(plan.exportedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null;
  const what = kind === 'habit-tracker' ? 'habits' : kind === 'doable' ? 'tasks' : 'everything';

  const parts: string[] = [];
  if (kind !== 'doable') parts.push(`${stats.habits} habit${stats.habits === 1 ? '' : 's'}`, `${stats.checkIns} check-ins`);
  if (kind !== 'habit-tracker') parts.push(`${stats.tasks} task${stats.tasks === 1 ? '' : 's'}`, `${stats.lists} lists`);

  const run = async (mode: ImportMode) => {
    setBusy(true);
    const current = useData.getState().data;
    await kv.set(PRE_IMPORT, JSON.stringify(current)); // safety copy first
    const next = applyImport(current, plan, mode);
    replaceData(next);
    await saveNow();
    haptic('success');
    closeSheet();
    const h = next.habits.habits.length;
    const t = next.todo.tasks.length;
    showSnack(mode === 'merge' ? `Merged! You now have ${h} habits and ${t} tasks` : `Restored from the ${plan.label.toLowerCase()}`, undefined, '📦');
  };

  return (
    <Sheet onClose={closeSheet} label="Import backup" title="Import backup">
      <div className="import-card">
        <div className="import-card__emoji">{ART[kind]}</div>
        <div>
          <div className="import-card__title">{plan.label}</div>
          <div className="import-card__sub">
            {parts.join(' · ')}
            {when ? <><br />Saved {when}</> : null}
          </div>
        </div>
      </div>
      <p className="sheet__text">
        {kind === 'tickday' ? (
          <>
            <b>Merge</b> adds anything new and keeps the newest version of things you have in both. <b>Replace</b> swaps everything (settings too) for the backup.
          </>
        ) : (
          <>
            This only touches your <b>{what}</b>. <b>Merge</b> keeps yours and adds the backup’s; <b>Replace</b> swaps your {what} for the backup’s. Your {kind === 'doable' ? 'habits' : 'tasks'}, theme and colours stay as they are.
          </>
        )}{' '}
        A safety copy is kept either way (Settings → Undo last import).
      </p>
      <div className="stack">
        <button className="btn btn-primary btn-block" disabled={busy} onClick={() => run('merge')}>
          <GitMerge size={18} /> Merge with my {what === 'everything' ? 'stuff' : what}
        </button>
        <button className="btn btn-danger btn-block" disabled={busy} onClick={() => run('replace')}>
          <Replace size={18} /> Replace {what === 'everything' ? 'everything' : `my ${what}`}
        </button>
        <button className="btn btn--ghost btn-block" onClick={closeSheet}>
          Cancel
        </button>
      </div>
    </Sheet>
  );
}
