import { useState } from 'react';
import { ArchiveRestore, Palmtree, Play, Trash2 } from 'lucide-react';
import { alpha } from '../core/colors';
import { formatDate, todayKey } from '../core/dates';
import { useHabits } from '../data/store';

/** Settings › Habits: vacation mode (pause everything) and archived habits. */
export function HabitSettings() {
  const { state, dispatch } = useHabits();
  const today = todayKey();
  const vacation = state.settings.vacations.find((r) => r.to === null || r.to >= today);
  const archived = state.habits.filter((h) => h.archivedAt);
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const short = (d: string) => formatDate(d, { month: 'short', day: 'numeric' });

  return (
    <>
      <div className="opt-group">
        {vacation ? (
          <div className="opt-row static">
            <span className="opt-icon vacation">🏖️</span>
            <span className="opt-title">
              Vacation mode is on
              <small>
                {vacation.from > today ? `Starts ${short(vacation.from)}` : 'All streaks are frozen'}
                {vacation.to ? ` · until ${short(vacation.to)}` : ''}
              </small>
            </span>
            <button className="btn btn-soft small" onClick={() => dispatch({ type: 'resume', id: 'all' })}>
              <Play size={16} /> Resume
            </button>
          </div>
        ) : (
          <div className={`opt${open ? ' open' : ''}`}>
            <button className="opt-row" onClick={() => setOpen(!open)} aria-expanded={open}>
              <span className="opt-icon vacation">
                <Palmtree size={19} />
              </span>
              <span className="opt-title">
                Vacation mode
                <small>Pause every habit without breaking streaks</small>
              </span>
            </button>
            {open && (
              <div className="opt-editor">
                <div className="date-row">
                  <label>
                    From
                    <input type="date" className="text-input small" value={from} onChange={(e) => setFrom(e.target.value || today)} />
                  </label>
                  <label>
                    Until
                    <input type="date" className="text-input small" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
                  </label>
                </div>
                <button
                  className="btn btn-primary btn-block"
                  onClick={() => {
                    dispatch({ type: 'pause', id: 'all', from, to: to || null });
                    setOpen(false);
                  }}
                >
                  🏖️ Start vacation mode
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="field-label">Archived habits {archived.length > 0 && `(${archived.length})`}</p>
      {archived.length === 0 ? (
        <p className="settings-note top">Nothing archived. Archive a habit from its edit sheet to hide it without losing its history.</p>
      ) : (
        <div className="opt-group">
          {archived.map((h) => (
            <div key={h.id} className="opt-row static">
              <span className="opt-icon" style={{ background: alpha(h.color, 0.18) }}>
                {h.emoji}
              </span>
              <span className="opt-title">
                {h.name}
                <small>Archived {short(h.archivedAt!)}</small>
              </span>
              {confirm === h.id ? (
                <button
                  className="btn btn-danger small"
                  onClick={() => {
                    dispatch({ type: 'deleteHabit', id: h.id });
                    setConfirm(null);
                  }}
                >
                  Delete forever
                </button>
              ) : (
                <>
                  <button className="icon-btn plain" aria-label={`Delete ${h.name}`} onClick={() => setConfirm(h.id)}>
                    <Trash2 size={18} />
                  </button>
                  <button className="btn btn-soft small" onClick={() => dispatch({ type: 'restore', id: h.id })}>
                    <ArchiveRestore size={16} /> Restore
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
