import { describe, expect, it } from 'vitest';
import { MOODS, tickKnockoutSvg, tickSvg, type TickStage } from '../../src/mascot/tick';

const stages: TickStage[] = [0, 1, 2, 3, 4];

describe('Tick artwork', () => {
  it('draws every pose differently', () => {
    const svgs = MOODS.map((mood) => tickSvg({ mood, id: 'x' }));
    expect(new Set(svgs).size).toBe(MOODS.length);
  });

  it('levels up: outline → filling → colour → glow + sparkles → crown', () => {
    const [faint, fresh, bold, golden, legend] = stages.map((stage) => tickSvg({ stage, id: 'x' }));
    expect(faint).toContain('#fff8e7');
    expect(faint).not.toContain('#ffc845');
    expect(fresh).toContain('x-fill'); // half-filled mask
    expect(bold).toContain('#ffc845');
    expect(bold).not.toContain('tick-glow');
    expect(golden).toContain('tick-glow');
    expect(golden).toContain('tick-sparkle');
    expect(golden).not.toContain('tick-crown');
    expect(legend).toContain('tick-crown');
  });

  it('uses no gradients (flat style) and prefixes every id', () => {
    for (const mood of MOODS)
      for (const stage of stages) {
        const svg = tickSvg({ mood, stage, id: 'abc' });
        expect(svg).toContain(`tick--${mood}`);
        expect(svg).not.toMatch(/Gradient/);
        expect(svg).not.toMatch(/url\(#(?!abc-)/);
      }
  });

  it('only shows confetti when celebrating and zzz when sleepy', () => {
    expect(tickSvg({ mood: 'celebrate' })).toContain('tick-confetti');
    expect(tickSvg({ mood: 'happy' })).not.toContain('tick-confetti');
    expect(tickSvg({ mood: 'sleepy' })).toContain('tick-z');
  });

  it('makes a one-colour knockout for Android icons', () => {
    const svg = tickKnockoutSvg('happy');
    expect(svg).toContain('<mask');
    expect(svg).not.toContain('#ffc845');
  });
});
