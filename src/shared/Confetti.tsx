import { useMemo } from 'react';
const COLORS = ['#ffc845', '#ff7a59', '#3dbe7e', '#ff8fa3', '#3aa5f2', '#a970f0'];

/** One-shot confetti burst. Re-mount (change `key`) to fire again. */
export function Confetti() {
  const bits = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const angle = (i / 28) * Math.PI * 2 + Math.random() * 0.4;
        const dist = 70 + Math.random() * 90;
        return {
          color: COLORS[i % COLORS.length],
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 30,
          r: Math.random() * 540 - 270,
          delay: Math.random() * 80,
          round: i % 3 === 0,
        };
      }),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          style={
            {
              background: b.color,
              borderRadius: b.round ? '50%' : '2px',
              '--x': `${b.x}px`,
              '--y': `${b.y}px`,
              '--r': `${b.r}deg`,
              animationDelay: `${b.delay}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
