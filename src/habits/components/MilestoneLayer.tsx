import { useCallback } from 'react';
import { useUI } from '../../data/ui';
import { BIG_MILESTONES } from '../../mascot/mood';
import { MilestoneCelebration } from './MilestoneCelebration';
import { MilestoneToast } from './MilestoneToast';

/** Streak milestones: a full-screen party at 7, 30, 100 and 365 days, a toast for the others. */
export function MilestoneLayer() {
  const m = useUI((s) => s.milestone);
  const setMilestone = useUI((s) => s.setMilestone);
  const done = useCallback(() => setMilestone(null), [setMilestone]);
  if (!m) return null;
  return BIG_MILESTONES.includes(m.streak) ? <MilestoneCelebration m={m} onDone={done} /> : <MilestoneToast m={m} onDone={done} />;
}
