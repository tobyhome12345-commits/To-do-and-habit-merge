import { useEffect } from 'react';
import { PencilLine, Undo2 } from 'lucide-react';
import { useData } from '../data/store';
import { haptic } from '../core/haptics';

/*
 * One snackbar for the whole app: "Completed ‘Essay’ · UNDO" for tasks and
 * "✓ 💧 Drink water · Note · Undo" for habits. Slides up above the tab bar and leaves on its own.
 */
export function SnackHost() {
  const snack = useData((s) => s.snack);
  const dismiss = useData((s) => s.dismissSnack);
  const undo = useData((s) => s.undo);

  useEffect(() => {
    if (!snack) return;
    const t = setTimeout(dismiss, 5000);
    return () => clearTimeout(t);
  }, [snack, dismiss]);

  if (!snack) return null;
  return (
    <div className="snack-layer" aria-live="polite">
      <div className="snack" key={snack.id} role="status">
        {snack.emoji && (
          <span className="snack-emoji" aria-hidden>
            {snack.emoji}
          </span>
        )}
        <span className="snack-text" onClick={dismiss}>
          {snack.text}
        </span>
        {snack.actions?.map((a) => (
          <button
            key={a.label}
            className="snack-btn"
            onClick={() => {
              haptic('light');
              dismiss();
              a.run();
            }}
          >
            {a.icon === 'note' ? <PencilLine size={16} /> : a.icon === 'undo' ? <Undo2 size={16} /> : null} {a.label}
          </button>
        ))}
        {snack.undoId != null && (
          <button
            className="snack-btn"
            onClick={() => {
              haptic('medium');
              undo(snack.undoId);
            }}
          >
            <Undo2 size={16} /> Undo
          </button>
        )}
        <span className="snack-timer" />
      </div>
    </div>
  );
}
