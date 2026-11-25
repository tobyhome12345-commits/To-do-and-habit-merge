/**
 * Renders every native image for Tickday from Tick's SVG (src/mascot/tick.ts) plus a little checklist card.
 *
 *   npm run assets
 *
 * - assets/*.png                → fed to @capacitor/assets (launcher icons + splash screens)
 * - mipmap-* monochrome layer   → Android 13+ themed icons
 * - public/icon.svg             → browser favicon
 *
 * The Tickday icon is Tick in front of a to-do card on a leaf-green background, so it's easy to tell
 * apart from the Habit Tracker icon (Tick on dark ink) and Doable (a violet tick) on your home screen.
 * Based on the Habit Tracker's asset script.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { tickKnockoutSvg, tickSvg } from '../src/mascot/tick.ts';

const ROOT = join(import.meta.dirname, '..');
const RES = join(ROOT, 'android/app/src/main/res');
const INK = '#221c2e';
const PAPER = '#fbf6ee';
const NIGHT = '#14111c';
const RIM_DARK = '#4a4062';
const LEAF = '#3dbe7e';
const LAGOON = '#22b8b0';

/** Strip the outer <svg> wrapper so Tick can be nested at any position/size. */
function inner(svg: string): string {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

function place(svg: string, x: number, y: number, size: number): string {
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="0 0 200 200" overflow="visible">${inner(svg)}</svg>`;
}

async function png(svg: string, out: string, size: number) {
  await sharp(Buffer.from(svg), { density: 72 }).resize(size, size).png().toFile(out);
  console.log('  wrote', out.replace(ROOT + '/', ''));
}

const glow = (cx: number, cy: number, r: number, color: string, opacity: number, id = 'g') =>
  `<defs><radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse">
     <stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
   </radialGradient></defs><rect width="100%" height="100%" fill="url(#${id})"/>`;

/**
 * A paper to-do card with three rows (two ticked), drawn in a 200-unit box.
 * Thick strokes and few details so it still reads at launcher size.
 */
function card(ink: string, paper: string, done: string, lines: string): string {
  const row = (y: number, checked: boolean) =>
    `<circle cx="52" cy="${y}" r="11" fill="${checked ? done : paper}" stroke="${checked ? done : lines}" stroke-width="5"/>` +
    (checked ? `<path d="M46.5 ${y}.5l4 4 7.5-8.5" fill="none" stroke="#fff" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>` : '') +
    `<rect x="74" y="${y - 6}" width="${checked ? 60 : 78}" height="12" rx="6" fill="${lines}"/>`;
  return `<g transform="rotate(-8 100 100)">
    <rect x="26" y="34" width="148" height="132" rx="26" fill="${paper}" stroke="${ink}" stroke-width="7"/>
    ${row(72, true)}${row(102, true)}${row(132, false)}
  </g>`;
}

async function main() {
  mkdirSync(join(ROOT, 'assets'), { recursive: true });
  // Just the checkmark + face: the silhouette stays obvious even at 24px.
  const iconTick = tickSvg({ mood: 'happy', stage: 2, id: 'icon', shadow: false, limbs: false, extras: false, rim: false });
  const cardSvg = card(INK, '#ffffff', LEAF, '#d9d2c4');

  // ---- Launcher icon layers (1024²). The safe circle is 66% of the frame, so keep everything inside ~0.6.
  const S = 1024;
  const bg = `<defs><linearGradient id="bgg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${LEAF}"/><stop offset="1" stop-color="${LAGOON}"/></linearGradient></defs>
    <rect width="${S}" height="${S}" fill="url(#bgg)"/>${glow(600, 560, 420, '#ffe38a', 0.35)}`;
  const art = (tick: string, cardPart: string) =>
    `<svg x="${S * 0.2}" y="${S * 0.25}" width="${S * 0.42}" height="${S * 0.42}" viewBox="0 0 200 200">${cardPart}</svg>${place(tick, S * 0.39, S * 0.31, S * 0.44)}`;
  const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${bg}</svg>`;
  const foreground = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${art(iconTick, cardSvg)}</svg>`;
  const full = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${bg}${art(iconTick, cardSvg)}</svg>`;
  // Themed icon: one colour, so cut a gap around Tick where he overlaps the card (a dilated Tick as a mask).
  const gapTick = place(tickKnockoutSvg('happy', 200, '#000000'), S * 0.39, S * 0.31, S * 0.44);
  const mono = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <defs><filter id="dil" x="-20%" y="-20%" width="140%" height="140%"><feMorphology operator="dilate" radius="22"/></filter>
    <mask id="gap" maskUnits="userSpaceOnUse" x="0" y="0" width="${S}" height="${S}"><rect width="${S}" height="${S}" fill="#fff"/><g filter="url(#dil)">${gapTick}</g></mask></defs>
    <g mask="url(#gap)"><svg x="${S * 0.2}" y="${S * 0.25}" width="${S * 0.42}" height="${S * 0.42}" viewBox="0 0 200 200">${card('#ffffff', 'none', '#ffffff', '#ffffff')}</svg></g>
    ${place(tickKnockoutSvg('happy', 200, '#ffffff'), S * 0.39, S * 0.31, S * 0.44)}</svg>`;
  await png(background, join(ROOT, 'assets/icon-background.png'), S);
  await png(foreground, join(ROOT, 'assets/icon-foreground.png'), S);
  await png(full, join(ROOT, 'assets/icon-only.png'), S);
  await png(mono, join(ROOT, 'assets/icon-monochrome.png'), S);

  // ---- Splash screens (2732²): Tick waving next to his checklist, on paper / night.
  const SP = 2732;
  const splash = (bgColor: string, glowOpacity: number, rim: string, paper: string, ink: string, lines: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SP}" height="${SP}"><rect width="${SP}" height="${SP}" fill="${bgColor}"/>${glow(1366, 1330, 760, '#ffc845', glowOpacity)}
      <svg x="${1366 - 640}" y="${1366 - 430}" width="640" height="640" viewBox="0 0 200 200">${card(ink, paper, LEAF, lines)}</svg>
      ${place(tickSvg({ mood: 'happy', stage: 2, id: 'splash', extras: false }).replace('color="transparent"', `color="${rim}"`), 1366 - 330, 1366 - 470, 900)}</svg>`;
  await png(splash(PAPER, 0.28, 'transparent', '#ffffff', INK, '#e6dfd2'), join(ROOT, 'assets/splash.png'), SP);
  await png(splash(NIGHT, 0.18, RIM_DARK, '#2b2538', RIM_DARK, '#4a4062'), join(ROOT, 'assets/splash-dark.png'), SP);

  // ---- Let @capacitor/assets slice the launcher icons + splash for every density.
  console.log('Running @capacitor/assets…');
  execSync('npx capacitor-assets generate --android', { cwd: ROOT, stdio: 'ignore' });

  // ---- Adaptive layers at their true size. The XML insets each layer by 16.7%, so the image
  // fills the 72dp visible area: 72dp × density (sharper than the tool's default sizes).
  const DENSITY: Record<string, number> = { ldpi: 0.75, mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const dir of readdirSync(RES).filter((d) => d.startsWith('mipmap-') && !d.includes('anydpi'))) {
    const fg = join(RES, dir, 'ic_launcher_foreground.png');
    if (!existsSync(fg)) continue;
    const w = Math.round(72 * (DENSITY[dir.replace('mipmap-', '')] ?? 1));
    await sharp(join(ROOT, 'assets/icon-foreground.png')).resize(w, w).png().toFile(fg);
    await sharp(join(ROOT, 'assets/icon-background.png')).resize(w, w).png().toFile(join(RES, dir, 'ic_launcher_background.png'));
    await sharp(join(ROOT, 'assets/icon-monochrome.png')).resize(w, w).png().toFile(join(RES, dir, 'ic_launcher_monochrome.png'));
  }
  for (const xml of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const p = join(RES, 'mipmap-anydpi-v26', xml);
    let s = readFileSync(p, 'utf8');
    if (!s.includes('<monochrome>')) {
      s = s.replace(
        '</adaptive-icon>',
        '    <monochrome>\n        <inset android:drawable="@mipmap/ic_launcher_monochrome" android:inset="16.7%" />\n    </monochrome>\n</adaptive-icon>',
      );
      writeFileSync(p, s);
    }
  }
  console.log('  added monochrome (themed) icon layer');

  // ---- Favicon
  writeFileSync(
    join(ROOT, 'public/icon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="bgg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${LEAF}"/><stop offset="1" stop-color="${LAGOON}"/></linearGradient></defs><rect width="200" height="200" rx="46" fill="url(#bgg)"/>` +
      `<svg x="18" y="30" width="96" height="96" viewBox="0 0 200 200">${cardSvg}</svg>${place(
        tickSvg({ mood: 'happy', stage: 2, id: 'fav', shadow: false, limbs: false, extras: false, rim: false }),
        62,
        44,
        112,
      )}</svg>`,
  );
  console.log('  wrote public/icon.svg\nDone ✨');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
