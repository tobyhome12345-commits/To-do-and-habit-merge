/**
 * Tick ✓, the app's mascot: a living checkmark.
 *
 * His body is a chunky, rounded checkmark with a little face on the thick bend,
 * plus stubby arms and feet so he can pose. Flat vector style: solid colours and
 * one consistent thick outline (made by drawing every shape twice, an ink layer
 * then a colour layer on top), no gradients.
 *
 * He levels up with your best current streak:
 *   0 Faint (just an outline) → 1 Fresh (filling with colour) → 2 Bold (full colour)
 *   → 3 Golden (gold, glow + sparkles) → 4 Legend (all that + a crown).
 * Six poses: happy (waving), celebrate, sleepy, encourage (thumbs-up), proud, shrug.
 *
 * Plain SVG markup (no React) so the same artwork powers the in-app component,
 * the app icon and the splash screen.
 * Only erasable TypeScript syntax here: Node can run this file directly.
 */

export type TickMood = 'happy' | 'celebrate' | 'sleepy' | 'encourage' | 'proud' | 'shrug';
/** 0 Faint · 1 Fresh · 2 Bold · 3 Golden · 4 Legend */
export type TickStage = 0 | 1 | 2 | 3 | 4;

export const MOODS: TickMood[] = ['happy', 'celebrate', 'sleepy', 'encourage', 'proud', 'shrug'];
export const STAGE_NAMES = ['Faint', 'Fresh', 'Bold', 'Golden', 'Legend'] as const;

export interface TickOptions {
  mood?: TickMood;
  stage?: TickStage;
  /** Unique prefix for mask ids when several Ticks share a page. */
  id?: string;
  /** Ground shadow (off for icons). */
  shadow?: boolean;
  /** Arms and feet (off for the app icon, so the checkmark reads at tiny sizes). */
  limbs?: boolean;
  /** Confetti, zzz, glow and sparkles. */
  extras?: boolean;
  /**
   * Sticker rim behind the outline. Its colour comes from CSS (--tick-rim), so
   * the dark ink outline still shows on dark backgrounds. Off for native assets.
   */
  rim?: boolean;
}

type Pt = [number, number];

const INK = '#221c2e';
const CREAM = '#fff8e7';
const BLUSH = '#ff8a7a';
const TONGUE = '#ff6f7d';
/** Outline thickness, the same on every shape. */
const O = 6;
const BODY_W = 44;
const ARM_W = 13;

// Skeleton (200×200 artboard, feet on y≈192)
const BODY = 'M44 100 L84 142 L160 38';
/** Sleepy: the long stroke slumps over at the top. */
const BODY_SLUMP = 'M46 104 L84 142 L118 92 Q134 66 154 74 Q168 82 166 102';
const BELLY = { x: 86, y: 136, r: 33 };
const SH_L: Pt = [61, 157];
const SH_R: Pt = [111, 157];
const FACE: Pt = [86, 127];

interface Look {
  fill: string;
  feet: string;
  shine: string | null;
  /** Fresh: only the bottom half is coloured, like it's filling up. */
  filling: boolean;
  glow: 0 | 1 | 2;
  sparkles: number;
  crown: boolean;
}

const LOOKS: Look[] = [
  { fill: CREAM, feet: CREAM, shine: null, filling: false, glow: 0, sparkles: 0, crown: false },
  { fill: '#ffc845', feet: '#f5a524', shine: null, filling: true, glow: 0, sparkles: 0, crown: false },
  { fill: '#ffc845', feet: '#f5a524', shine: '#ffe596', filling: false, glow: 0, sparkles: 0, crown: false },
  { fill: '#ffb31f', feet: '#e8870c', shine: '#ffd978', filling: false, glow: 1, sparkles: 3, crown: false },
  { fill: '#ffb31f', feet: '#e8870c', shine: '#ffd978', filling: false, glow: 2, sparkles: 5, crown: true },
];

const f = (n: number) => +n.toFixed(1);
const pts = (list: Pt[]) => list.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');

function go(from: Pt, deg: number, len: number): Pt {
  const r = (deg * Math.PI) / 180;
  return [from[0] + Math.cos(r) * len, from[1] + Math.sin(r) * len];
}

interface Arm {
  path: Pt[];
  /** Animation hook; transform-origin is set at the shoulder. */
  cls?: string;
  fist?: boolean;
}

function arms(mood: TickMood): Arm[] {
  switch (mood) {
    case 'happy':
      return [{ path: [SH_L, go(SH_L, 150, 15)] }, { path: [SH_R, go(SH_R, -24, 26)], cls: 'tick-wave' }];
    case 'celebrate':
      return [
        { path: [SH_L, go(SH_L, -158, 21)], cls: 'tick-cheer-l' },
        { path: [SH_R, go(SH_R, -28, 22)], cls: 'tick-cheer-r' },
      ];
    case 'sleepy':
      return [{ path: [SH_L, go(SH_L, 112, 14)] }, { path: [SH_R, go(SH_R, 70, 14)] }];
    case 'encourage': {
      const elbow = go(SH_R, 2, 19);
      return [{ path: [SH_L, go(SH_L, 150, 15)] }, { path: [SH_R, elbow, go(elbow, -58, 9)], cls: 'tick-pump', fist: true }];
    }
    case 'proud': {
      // Hands on hips
      const el = go(SH_L, -170, 15);
      const er = go(SH_R, -10, 15);
      return [{ path: [SH_L, el, go(el, 62, 12)] }, { path: [SH_R, er, go(er, 118, 12)] }];
    }
    case 'shrug': {
      // Palms up, elbows out
      const el = go(SH_L, 172, 14);
      const er = go(SH_R, 8, 14);
      return [
        { path: [SH_L, el, go(el, -112, 11)], cls: 'tick-shrug' },
        { path: [SH_R, er, go(er, -68, 11)], cls: 'tick-shrug' },
      ];
    }
  }
}

/**
 * The body silhouette (check + belly + arms) at a given extra width.
 * Drawn once wide in ink and once normal in colour, so arms fuse into the body
 * with a clean outline and no seams.
 */
function silhouette(color: string, grow: number, mood: TickMood, limbs: boolean): string {
  const line = (d: string, w: number, cls = '', origin?: Pt) =>
    `<path${cls ? ` class="${cls}"` : ''}${origin ? ` style="transform-origin:${f(origin[0])}px ${f(origin[1])}px"` : ''} d="${d}" fill="none" stroke="${color}" stroke-width="${w + grow}" stroke-linecap="round" stroke-linejoin="round"/>`;
  let s = '';
  if (limbs) {
    for (const a of arms(mood)) {
      const end = a.path[a.path.length - 1];
      let g = `<polyline points="${pts(a.path)}" fill="none" stroke="${color}" stroke-width="${ARM_W + grow}" stroke-linecap="round" stroke-linejoin="round"/>`;
      if (a.fist) {
        // Fist with the thumb pointing up
        g += `<circle cx="${f(end[0])}" cy="${f(end[1])}" r="${9.5 + grow / 2}" fill="${color}"/>`;
        g += `<path d="M${f(end[0] - 2)} ${f(end[1] - 6)} L${f(end[0] - 2)} ${f(end[1] - 18)}" stroke="${color}" stroke-width="${8 + grow}" stroke-linecap="round"/>`;
      }
      s += a.cls ? `<g class="${a.cls}" style="transform-origin:${f(a.path[0][0])}px ${f(a.path[0][1])}px">${g}</g>` : g;
    }
  }
  s += line(mood === 'sleepy' ? BODY_SLUMP : BODY, BODY_W);
  s += `<circle cx="${BELLY.x}" cy="${BELLY.y}" r="${BELLY.r + grow / 2}" fill="${color}"/>`;
  return s;
}

function feet(look: Look, mood: TickMood, rim?: string, extra = 0): string {
  const lift = mood === 'celebrate' ? 3 : 0;
  const foot = (x: number, rot: number) =>
    rim
      ? `<ellipse cx="${x}" cy="${184 - lift}" rx="13" ry="7.5" transform="rotate(${rot} ${x} ${184 - lift})" fill="${rim}" stroke="${rim}" stroke-width="${O + extra}"/>`
      : // Sneakers: currentColor so the app's accent colour can restyle them
        `<ellipse class="tick-feet" color="${look.feet}" cx="${x}" cy="${184 - lift}" rx="13" ry="7.5" transform="rotate(${rot} ${x} ${184 - lift})" fill="currentColor" stroke="${INK}" stroke-width="${O}"/>`;
  return mood === 'celebrate' ? foot(70, 18) + foot(104, -18) : foot(70, -4) + foot(103, 4);
}

interface FacePaint {
  ink: string;
  hi: string | null;
  blush: string | null;
  tongue: string;
}

function eye(x: number, y: number, p: FacePaint, kind: 'open' | 'happy' | 'sleepy' | 'wink'): string {
  if (kind === 'happy' || kind === 'wink')
    return `<path d="M${x - 6} ${y + 2.5} Q${x} ${y - 6} ${x + 6} ${y + 2.5}" fill="none" stroke="${p.ink}" stroke-width="4.6" stroke-linecap="round"/>`;
  if (kind === 'sleepy')
    return `<path d="M${x - 6} ${y - 1} Q${x} ${y + 5} ${x + 6} ${y - 1}" fill="none" stroke="${p.ink}" stroke-width="4.4" stroke-linecap="round"/>`;
  return `<g class="tick-eye"><ellipse cx="${x}" cy="${y}" rx="5.4" ry="7.4" fill="${p.ink}"/>${p.hi ? `<circle cx="${x + 1.8}" cy="${y - 2.8}" r="2.1" fill="${p.hi}"/>` : ''}</g>`;
}

function face(mood: TickMood, p: FacePaint, id: string): string {
  const [cx, cy] = FACE;
  const ex = 11;
  const my = cy + 14;
  let s = '';
  if (p.blush) s += `<ellipse cx="${cx - 20}" cy="${cy + 11}" rx="6.5" ry="3.8" fill="${p.blush}" opacity=".6"/><ellipse cx="${cx + 20}" cy="${cy + 11}" rx="6.5" ry="3.8" fill="${p.blush}" opacity=".6"/>`;

  const open = (w: number, h: number) => {
    const d = `M${cx - w} ${my - 2} Q${cx} ${my + h} ${cx + w} ${my - 2} Z`;
    return `<clipPath id="${id}-m"><path d="${d}"/></clipPath><path d="${d}" fill="${p.ink}" stroke="${p.ink}" stroke-width="2.4" stroke-linejoin="round"/><ellipse clip-path="url(#${id}-m)" cx="${cx}" cy="${my + h / 2 + 1}" rx="${w * 0.55}" ry="${h * 0.32}" fill="${p.tongue}"/>`;
  };
  const smile = (w: number) => `<path d="M${cx - w} ${my - 1} Q${cx} ${my + 7} ${cx + w} ${my - 1}" fill="none" stroke="${p.ink}" stroke-width="4.4" stroke-linecap="round"/>`;

  switch (mood) {
    case 'happy':
      s += eye(cx - ex, cy, p, 'open') + eye(cx + ex, cy, p, 'open') + smile(7);
      break;
    case 'celebrate':
      s += eye(cx - ex, cy, p, 'happy') + eye(cx + ex, cy, p, 'happy') + open(10, 16);
      break;
    case 'sleepy':
      s += eye(cx - ex, cy + 1, p, 'sleepy') + eye(cx + ex, cy + 1, p, 'sleepy');
      s += `<ellipse cx="${cx}" cy="${my + 2}" rx="5" ry="6.6" fill="${p.ink}"/><ellipse cx="${cx}" cy="${my + 4.6}" rx="3" ry="2.4" fill="${p.tongue}"/>`;
      break;
    case 'encourage':
      s += eye(cx - ex, cy, p, 'open') + eye(cx + ex, cy, p, 'wink') + open(8, 12);
      // Determined brow over the open eye
      s += `<path d="M${cx - ex - 6} ${cy - 12} L${cx - ex + 5} ${cy - 10}" stroke="${p.ink}" stroke-width="3.6" stroke-linecap="round"/>`;
      break;
    case 'proud':
      s += eye(cx - ex, cy - 1, p, 'happy') + eye(cx + ex, cy - 1, p, 'happy');
      s += `<path d="M${cx - 8} ${my - 3} Q${cx + 1} ${my + 8} ${cx + 9} ${my - 4}" fill="none" stroke="${p.ink}" stroke-width="4.4" stroke-linecap="round"/>`;
      break;
    case 'shrug':
      s += eye(cx - ex, cy + 1, p, 'open') + eye(cx + ex, cy + 1, p, 'open');
      s += `<path d="M${cx - ex - 5} ${cy - 12} Q${cx - ex} ${cy - 16} ${cx - ex + 5} ${cy - 13}" fill="none" stroke="${p.ink}" stroke-width="3.4" stroke-linecap="round"/>`;
      s += `<path d="M${cx + ex - 5} ${cy - 13} Q${cx + ex} ${cy - 16} ${cx + ex + 5} ${cy - 12}" fill="none" stroke="${p.ink}" stroke-width="3.4" stroke-linecap="round"/>`;
      s += `<path d="M${cx - 7} ${my + 1} q3.5 -4 7 0 t7 0" fill="none" stroke="${p.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`;
      break;
  }
  return s;
}

function shine(color: string, mood: TickMood): string {
  if (mood === 'sleepy') return `<path d="M98 110 L112 90" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/>`;
  return `<path d="M98 104 L134 55" fill="none" stroke="${color}" stroke-width="7" stroke-linecap="round"/><circle cx="145" cy="40.5" r="3.6" fill="${color}"/>`;
}

function crown(): string {
  return `<g class="tick-crown" transform="rotate(-10 88 99)">
    <path d="M71 101 L68 80 L79 89 L88 74 L97 89 L108 80 L105 101 Z" fill="#ffd84a" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="68" cy="79" r="3.6" fill="#ff7a59" stroke="${INK}" stroke-width="3"/>
    <circle cx="88" cy="73" r="3.8" fill="#ff7a59" stroke="${INK}" stroke-width="3"/>
    <circle cx="108" cy="79" r="3.6" fill="#ff7a59" stroke="${INK}" stroke-width="3"/>
    <circle cx="88" cy="93" r="3.2" fill="#3aa5f2" stroke="${INK}" stroke-width="2.6"/>
  </g>`;
}

const SPARKLE_SPOTS: [number, number, number][] = [
  [26, 50, 1],
  [184, 110, 0.85],
  [20, 152, 0.7],
  [180, 168, 0.65],
  [112, 18, 0.7],
];

function sparkles(n: number): string {
  return SPARKLE_SPOTS.slice(0, n)
    .map(
      ([x, y, s], i) =>
        `<g transform="translate(${x} ${y}) scale(${s})"><path class="tick-sparkle" style="animation-delay:${i * 280}ms" d="M0 -11 Q2.2 -2.2 11 0 Q2.2 2.2 0 11 Q-2.2 2.2 -11 0 Q-2.2 -2.2 0 -11 Z" color="#ffe066" fill="currentColor" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/></g>`,
    )
    .join('');
}

function confetti(): string {
  const bits: [number, number, string, number, 'r' | 'c'][] = [
    [22, 40, '#ff7a59', 20, 'r'],
    [54, 18, '#3dbe7e', -30, 'c'],
    [124, 12, '#3aa5f2', 40, 'r'],
    [182, 28, '#a970f0', -15, 'r'],
    [190, 92, '#ff7a59', 0, 'c'],
    [14, 104, '#3aa5f2', 0, 'c'],
    [176, 140, '#3dbe7e', 30, 'r'],
    [26, 166, '#f25c9a', -40, 'r'],
  ];
  return bits
    .map(([x, y, c, r, k], i) => {
      const shape = k === 'r' ? `<rect x="-4" y="-7" width="8" height="14" rx="2.5" fill="${c}"/>` : `<circle r="4.6" fill="${c}"/>`;
      return `<g transform="translate(${x} ${y}) rotate(${r})"><g class="tick-confetti" style="animation-delay:${i * 170}ms">${shape}</g></g>`;
    })
    .join('');
}

function zzz(): string {
  const z = (x: number, y: number, s: number, d: number) =>
    `<g transform="translate(${x} ${y}) scale(${s})"><path class="tick-z" style="animation-delay:${d}ms" d="M-6 -6 H6 L-6 6 H6" fill="none" stroke="#9d92bb" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  return z(178, 44, 1, 0) + z(190, 20, 0.75, 900);
}

/** Whole-figure pose: celebrate jumps, sleepy slumps, proud leans back. */
function poseTransform(mood: TickMood): string {
  if (mood === 'celebrate') return 'translate(0 -10)';
  if (mood === 'sleepy') return 'rotate(5 88 190)';
  if (mood === 'proud') return 'rotate(-4 88 190)';
  return '';
}

export function tickSvg(opts: TickOptions = {}): string {
  const mood = opts.mood ?? 'happy';
  const stage = opts.stage ?? 2;
  const id = opts.id ?? 'tick';
  const limbs = opts.limbs !== false;
  const extras = opts.extras !== false;
  const look = LOOKS[stage];

  let fill = silhouette(look.fill === CREAM || look.filling ? CREAM : look.fill, 0, mood, limbs);
  let defs = '';
  if (look.filling) {
    defs += `<mask id="${id}-fill" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200"><path class="tick-level" d="M-40 116 q15 -7 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 t30 0 V210 H-40 Z" fill="#fff"/></mask>`;
    fill += `<g mask="url(#${id}-fill)">${silhouette(look.fill, 0, mood, limbs)}</g>`;
  }

  const paint: FacePaint = { ink: INK, hi: '#fff', blush: BLUSH, tongue: TONGUE };
  const glow = extras && look.glow > 0;
  if (glow) defs += `<filter id="${id}-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${look.glow === 2 ? 9 : 7}"/></filter>`;
  const [fx0, fy0] = FACE;
  const body =
    (glow ? `<g class="tick-glow" color="#ffcf4d" filter="url(#${id}-glow)" opacity="${look.glow === 2 ? 0.95 : 0.75}">${silhouette('currentColor', look.glow === 2 ? 36 : 28, mood, limbs)}</g>` : '') +
    (opts.rim !== false ? `<g class="tick-rim" color="transparent">${silhouette('currentColor', O * 2 + 9, mood, limbs)}${limbs ? feet(look, mood, 'currentColor', 9) : ''}</g>` : '') +
    (limbs ? feet(look, mood) : '') +
    `<g>${silhouette(INK, O * 2, mood, limbs)}</g><g>${fill}</g>` +
    (look.shine ? shine(look.shine, mood) : '') +
    `<g class="tick-face" transform="translate(${fx0} ${fy0 + 2}) scale(1.14) translate(${-fx0} ${-fy0})">${face(mood, paint, id)}</g>` +
    (look.crown ? crown() : '');

  const shadow = opts.shadow === false ? '' : `<ellipse class="tick-shadow" cx="88" cy="193" rx="${mood === 'celebrate' ? 28 : 38}" ry="5.5" fill="${INK}" opacity=".13"/>`;
  const fx = extras ? (look.sparkles ? sparkles(look.sparkles) : '') + (mood === 'celebrate' ? confetti() : '') + (mood === 'sleepy' ? zzz() : '') : '';
  const t = poseTransform(mood);

  return `<svg class="tick tick--${mood} tick--stage-${stage}" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${defs ? `<defs>${defs}</defs>` : ''}
  ${shadow}
  <g class="tick-jump"><g class="tick-bounce"><g${t ? ` transform="${t}"` : ''}>${body}</g></g></g>
  ${fx}
</svg>`;
}

/**
 * One-colour Tick with the face cut out (transparent), for Android's monochrome
 * themed icon.
 */
export function tickKnockoutSvg(mood: TickMood = 'happy', size = 200, color = '#ffffff', limbs = false): string {
  const holes: FacePaint = { ink: '#000', hi: null, blush: null, tongue: '#000' };
  return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs><mask id="k" maskUnits="userSpaceOnUse" x="0" y="0" width="200" height="200">
    <g transform="${poseTransform(mood)}">${silhouette('#fff', O * 2, mood, limbs)}${face(mood, holes, 'k')}</g>
  </mask></defs>
  <rect width="200" height="200" fill="${color}" mask="url(#k)"/>
</svg>`;
}

/** Level from the best current streak across all habits. */
export function tickStage(bestCurrentStreak: number): TickStage {
  if (bestCurrentStreak >= 30) return 4;
  if (bestCurrentStreak >= 14) return 3;
  if (bestCurrentStreak >= 7) return 2;
  if (bestCurrentStreak >= 3) return 1;
  return 0;
}
