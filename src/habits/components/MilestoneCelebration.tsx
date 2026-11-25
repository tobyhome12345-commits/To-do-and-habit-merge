import { useEffect } from 'react';
import { Tick } from '../../shared/Tick';
import { Confetti } from '../../shared/Confetti';
import { LEVEL_UP } from '../../mascot/mood';
import { streakLabel } from '../lib/streaks';
import type { Milestone } from './MilestoneToast';

const TITLES: Record<number, string> = { 7: 'One whole week!', 30: 'A month strong!', 100: '100 in a row!!', 365: 'ONE. WHOLE. YEAR.' };

/** The big one: 7, 30, 100 (and 365). Tap anywhere to close; it also leaves by itself. */
export function MilestoneCelebration({ m, onDone }: { m: Milestone; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [m.key, onDone]);
  return (
    <div className="celebrate-layer" onClick={onDone} role="dialog" aria-label={`${streakLabel(m.streak, m.unit)} streak on ${m.habit.name}. Tap to close.`}>
      <div className="celebrate-card" key={m.key}>
        <Confetti />
        <div className="celebrate-tick">
          <Tick mood="proud" stage={m.stage} size={150} />
        </div>
        <p className="celebrate-kicker">
          {m.habit.emoji} {m.habit.name}
        </p>
        <h2>{TITLES[m.streak] ?? `${m.streak} in a row!`}</h2>
        <p className="celebrate-sub">
          {streakLabel(m.streak, m.unit)} streak 🔥{m.grew ? ` · Tick ${LEVEL_UP[m.stage]}!` : ' · Tick is SO proud'}
        </p>
        <span className="celebrate-tap">Tap to keep going</span>
      </div>
    </div>
  );
}
