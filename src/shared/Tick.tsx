import { memo, useEffect, useId, useMemo, useRef } from 'react';
import { tickSvg, type TickMood, type TickStage } from '../mascot/tick';

interface Props {
  mood?: TickMood;
  stage?: TickStage;
  size?: number;
  /** Accessible description; omit when nearby text already says what Tick is doing. */
  label?: string;
  className?: string;
  /** Freeze animations (e.g. tiny avatars). */
  still?: boolean;
  /** Bump this number to make Tick do one happy hop (e.g. when a habit is checked off). */
  hop?: number;
}

/** Tick the living checkmark. Pure SVG, memoised, never intercepts taps. */
export const Tick = memo(function Tick({ mood = 'happy', stage = 2, size = 96, label, className, still, hop = 0 }: Props) {
  const rid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const html = useMemo(() => tickSvg({ mood, stage, id: `tk${rid}` }), [mood, stage, rid]);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!hop || !el) return;
    el.classList.remove('hop');
    void el.offsetWidth; // restart the animation if he's mid-hop
    el.classList.add('hop');
    const t = setTimeout(() => el.classList.remove('hop'), 700);
    return () => clearTimeout(t);
  }, [hop]);

  return (
    <span
      ref={ref}
      className={`tick-wrap${still ? ' still' : ''}${className ? ` ${className}` : ''}`}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
});
