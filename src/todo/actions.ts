import type { ID } from './model/types';
import { useData } from '../data/store';
import { useUI } from '../data/ui';
import { haptic } from '../core/haptics';
import { prefersReducedMotion } from '../core/theme';

/** Tick (or untick) with the celebration animation first, then commit the change. */
export function toggleWithAnimation(id: ID) {
  const ui = useUI.getState();
  if (ui.completing[id]) return;
  const t = useData.getState().data.todo.tasks.find((x) => x.id === id);
  if (!t) return;
  haptic(t.completedAt == null ? 'success' : 'light');
  if (t.completedAt == null) ui.bumpHop(); // Tick does a little hop for tasks too
  ui.setCompleting(id, true);
  setTimeout(
    () => {
      useData.getState().toggleComplete(id);
      useUI.getState().setCompleting(id, false);
    },
    prefersReducedMotion() ? 150 : 760,
  );
}

/** Time of the last drag drop, so the click that ends a drag doesn't also open the task. */
export const dragState = { lastEnd: 0 };
