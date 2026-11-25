import { useEffect } from 'react';
import { Tick } from '../../shared/Tick';
import { LEVEL_UP } from '../../mascot/mood';
import type { TickStage } from '../../mascot/tick';
import type { Habit } from '../lib/types';
import { streakLabel, type StreakUnit } from '../lib/streaks';

export interface Milestone {
  key: string;
  habit: Habit;
  streak: number;
  unit: StreakUnit;
  stage: TickStage;
  grew: boolean;
}

function headline(streak: number, unit: StreakUnit): string {
  if (unit !== 'day') return `${streakLabel(streak, unit)} streak! 🔥`;
  if (streak === 3) return '3 in a row! Tick approves ✓';
  if (streak === 7) return 'A whole week! 🔥';
  if (streak === 14) return 'Two weeks strong! 💪';
  if (streak === 21) return '21 days. That’s a real habit now 🧠';
  if (streak === 30) return '30 days?! Legend status 👑';
  if (streak === 100) return '100 DAYS! Tick can’t even 😭';
  if (streak === 365) return 'ONE YEAR! Tick is speechless 🥹';
  return `${streak}-day streak! Unstoppable 🌟`;
}

/** Non-blocking celebration that slides in from the top and leaves on its own. */
export function MilestoneToast({ m, onDone }: { m: Milestone; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [m.key, onDone]);

  return (
    <div className="toast-layer" aria-live="polite">
      <button key={m.key} className="toast" onClick={onDone} aria-label={`${headline(m.streak, m.unit)} ${m.habit.name}. Tap to dismiss.`}>
        <span className="toast-tick">
          <Tick mood="proud" stage={m.stage} size={64} />
        </span>
        <span className="toast-text">
          <span className="toast-title">{headline(m.streak, m.unit)}</span>
          <span className="toast-sub">
            {m.habit.emoji} {m.habit.name}
            {m.grew ? ` · Tick ${LEVEL_UP[m.stage]}!` : ''}
          </span>
        </span>
      </button>
    </div>
  );
}
