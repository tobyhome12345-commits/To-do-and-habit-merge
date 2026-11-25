import type { ReactNode } from 'react';
import { Tick } from './Tick';
import type { TickMood } from '../mascot/tick';

/** Empty state with Tick (or an emoji) in the Garden style. Used by habits and tasks. */
export function EmptyState({ art, mood, title, text, children }: { art?: string; mood?: TickMood; title: string; text?: ReactNode; children?: ReactNode }) {
  return (
    <div className="empty">
      {mood ? (
        <div className="empty-art tick-art">
          <Tick mood={mood} stage={2} size={104} />
        </div>
      ) : (
        <div className="empty-art" aria-hidden>
          {art}
        </div>
      )}
      <h2>{title}</h2>
      {text && <p>{text}</p>}
      {children}
    </div>
  );
}
