/**
 * Renders every native image for Doable from Tick's SVG (src/mascot/tick.ts) and the app's progress ring.
 *
 *   npm run assets
 *
 * - assets/*.png                → fed to @capacitor/assets (launcher icons + splash screens)
 * - mipmap-* monochrome layer   → Android 13+ themed icons
 * - public/icon.svg             → browser favicon
 *
 * The Doable icon is Tick inside the app's own progress ring (the look of the Today card): a sunflower
 * frame, a warm paper disc and a leaf-green arc. It's easy to tell apart from the Habit Tracker icon (Tick
 * on dark ink) and the old to-do app (a violet tick).
 * Based on the Habit Tracker's asset script.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { tickKnockoutSvg, tickSvg } from '../src/mascot/tick.ts';

const ROOT = join(import.meta.dirname, '..');
const RES = join(ROOT, 'android/app/src/main/res');
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

/** Tick's checkmark spans x 16–188, y 10–175 of his 200-unit artboard; centre and reach used for placing him. */
const TICK_CENTER: [number, number] = [102, 92.5];
const TICK_REACH = 108;

/** Place Tick so his checkmark is centred on (cx, cy) and reaches `reach` units at most. */
function placeTick(svg: string, cx: number, cy: number, reach: number): string {
  const size = (reach / TICK_REACH) * 200;
  return place(svg, cx - (size * TICK_CENTER[0]) / 200, cy - (size * TICK_CENTER[1]) / 200, size);
}

/** A progress arc starting at 12 o'clock, going clockwise for `frac` of the circle. */
function arc(cx: number, cy: number, r: number, frac: number): string {
  const a0 = -Math.PI / 2;
  const a1 = a0 + frac * 2 * Math.PI;
  const p = (a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  return `M ${p(a0)} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${p(a1)}`;
}

const SUN = '#ffd668';
const SUN_DEEP = '#ffb02e';
const PROGRESS = 0.74;

/** The ring around Tick: a soft track and a leaf → lagoon progress arc (like the Today card). */
function ring(cx: number, cy: number, r: number, width: number, track: string, id: string): string {
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${LEAF}"/><stop offset="1" stop-color="${LAGOON}"/></linearGradient></defs>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${track}" stroke-width="${width}"/>
    <path d="${arc(cx, cy, r, PROGRESS)}" fill="none" stroke="url(#${id})" stroke-width="${width}" stroke-linecap="round"/>`;
}

async function main() {
  mkdirSync(join(ROOT, 'assets'), { recursive: true });
  // Just the checkmark + face: the silhouette stays obvious even at 24px.
  const iconTick = tickSvg({ mood: 'happy', stage: 2, id: 'icon', shadow: false, limbs: false, extras: false, rim: false });

  // ---- Launcher icon layers (1024²). The whole image shows inside the launcher's mask (circle, squircle…).
  const S = 1024;
  const C = S / 2;
  const bg = `<defs><linearGradient id="bgg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${SUN}"/><stop offset="1" stop-color="${SUN_DEEP}"/></linearGradient></defs>
    <rect width="${S}" height="${S}" fill="url(#bgg)"/>`;
  const art = `<circle cx="${C}" cy="${C}" r="362" fill="#fffaf0"/>${ring(C, C, 362, 54, '#f3e6c8', 'arcg')}${placeTick(iconTick, C + 10, C + 10, 282)}`;
  const background = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${bg}</svg>`;
  const foreground = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${art}</svg>`;
  const full = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">${bg}${art}</svg>`;
  // Themed icon (Android 13+): one colour, so just the progress arc and Tick's silhouette.
  const mono = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
    <path d="${arc(C, C, 362, PROGRESS)}" fill="none" stroke="#fff" stroke-width="58" stroke-linecap="round"/>
    ${placeTick(tickKnockoutSvg('happy', 200, '#ffffff'), C + 10, C + 10, 282)}</svg>`;
  await png(background, join(ROOT, 'assets/icon-background.png'), S);
  await png(foreground, join(ROOT, 'assets/icon-foreground.png'), S);
  await png(full, join(ROOT, 'assets/icon-only.png'), S);
  await png(mono, join(ROOT, 'assets/icon-monochrome.png'), S);

  // ---- Splash screens (2732²): Tick waving inside his progress ring, on paper / night.
  const SP = 2732;
  const M = SP / 2;
  const splash = (bgColor: string, glowOpacity: number, rim: string, track: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SP}" height="${SP}"><rect width="${SP}" height="${SP}" fill="${bgColor}"/>${glow(M, M, 760, '#ffc845', glowOpacity)}
      ${ring(M, M, 560, 70, track, 'sarc')}
      ${place(tickSvg({ mood: 'happy', stage: 2, id: 'splash', extras: false }).replace('color="transparent"', `color="${rim}"`), M - 460, M - 440, 900)}</svg>`;
  await png(splash(PAPER, 0.28, 'transparent', '#efe6d6'), join(ROOT, 'assets/splash.png'), SP);
  await png(splash(NIGHT, 0.18, RIM_DARK, '#2b2538'), join(ROOT, 'assets/splash-dark.png'), SP);

  // ---- Let @capacitor/assets slice the launcher icons + splash for every density.
  console.log('Running @capacitor/assets…');
  execSync('npx capacitor-assets generate --android', { cwd: ROOT, stdio: 'ignore' });

  // ---- iPhone (the Swift app in ios/): the same icon + light/dark splash. Apple refuses app icons
  // with an alpha channel, so the 1024² icon is flattened onto paper.
  const XCASSETS = join(ROOT, 'ios/App/App/Assets.xcassets');
  if (existsSync(XCASSETS)) {
    execSync('npx capacitor-assets generate --ios', { cwd: ROOT, stdio: 'ignore' });
    const icon = join(XCASSETS, 'AppIcon.appiconset/AppIcon-512@2x.png');
    const flat = await sharp(join(ROOT, 'assets/icon-only.png')).flatten({ background: PAPER }).removeAlpha().png().toBuffer();
    writeFileSync(icon, flat);
    console.log('  wrote iOS icon + splash');
  }

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

  // ---- Favicon (same design, in a 200-unit box)
  writeFileSync(
    join(ROOT, 'public/icon.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="bgg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${SUN}"/><stop offset="1" stop-color="${SUN_DEEP}"/></linearGradient></defs><rect width="200" height="200" rx="46" fill="url(#bgg)"/>` +
      `<circle cx="100" cy="100" r="74" fill="#fffaf0"/>${ring(100, 100, 74, 11, '#f3e6c8', 'farc')}${placeTick(
        tickSvg({ mood: 'happy', stage: 2, id: 'fav', shadow: false, limbs: false, extras: false, rim: false }),
        101.5,
        101.5,
        52,
      )}</svg>`,
  );
  console.log('  wrote public/icon.svg\nDone ✨');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
