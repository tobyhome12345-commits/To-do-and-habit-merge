import { useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Sheet } from '../../shared/Sheet';
import { alpha, onColor } from '../../core/colors';
import { formatDate } from '../../core/dates';
import { useHabits } from '../../data/store';
import type { DateKey, Habit } from '../lib/types';

/** Add or edit a short note for one habit on one day. */
export function NoteSheet({ habit, date, onClose }: { habit: Habit; date: DateKey; onClose: () => void }) {
  const { state, dispatch } = useHabits();
  const existing = state.notes[habit.id]?.[date] ?? '';
  const [text, setText] = useState(existing);
  const c = habit.color;
  return (
    <Sheet onClose={onClose} label={`Note for ${habit.name}`}>
      {(close) => {
        const save = (t: string) => {
          dispatch({ type: 'setNote', id: habit.id, date, text: t });
          close();
        };
        return (
          <>
            <div className="sheet-head">
              <h2>
                <span className="note-emoji" style={{ background: alpha(c, 0.2) }}>
                  {habit.emoji}
                </span>
                Note
              </h2>
              <button className="icon-btn plain" onClick={close} aria-label="Close">
                <X size={22} />
              </button>
            </div>
            <div className="sheet-body">
              <p className="note-for">
                {habit.name} · {formatDate(date, { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <textarea
                className="text-input note-input"
                placeholder="How did it go? (optional)"
                value={text}
                maxLength={280}
                autoFocus
                onChange={(e) => setText(e.target.value)}
                aria-label="Note"
              />
              <p className="note-count">{text.length}/280</p>
            </div>
            <div className="sheet-foot">
              {existing && (
                <button className="btn btn-danger" onClick={() => save('')} aria-label="Delete note">
                  <Trash2 size={18} />
                </button>
              )}
              <button className="btn btn-primary grow" onClick={() => save(text)} style={{ background: c, color: onColor(c) }}>
                Save note
              </button>
            </div>
          </>
        );
      }}
    </Sheet>
  );
}
