import { useState } from 'react';
import { Check } from 'lucide-react';
import { ACCENT_PRESETS, hexToHsl, hslToHex, onColor } from '../core/colors';
import { useHabits } from '../data/store';

/** Accent colour for the whole UI: Classic, presets, or a custom colour (hue + shade + hex). */
export function AccentPicker() {
  const { state, dispatch } = useHabits();
  const accent = state.settings.accent;
  const isCustom = accent !== null && !ACCENT_PRESETS.some((p) => p.value === accent);
  const [open, setOpen] = useState(isCustom);
  const [hsl, setHsl] = useState<[number, number, number]>(() => (isCustom ? hexToHsl(accent) : [174, 72, 45]));
  const [hexText, setHexText] = useState(isCustom ? accent : '');
  const set = (v: string | null) => dispatch({ type: 'settings', patch: { accent: v } });

  const applyHsl = (next: [number, number, number]) => {
    setHsl(next);
    const hex = hslToHex(...next);
    setHexText(hex);
    set(hex);
  };
  const [h, s, l] = hsl;
  const customHex = isCustom ? accent : hslToHex(h, s, l);

  return (
    <div className="accent-picker">
      <div className="accent-grid" role="radiogroup" aria-label="Accent colour">
        <button
          role="radio"
          aria-checked={accent === null}
          aria-label="Classic"
          className={`accent-opt classic${accent === null ? ' selected' : ''}`}
          onClick={() => {
            setOpen(false);
            set(null);
          }}
        >
          {accent === null && <Check size={18} strokeWidth={3} />}
        </button>
        {ACCENT_PRESETS.map((p) => (
          <button
            key={p.value}
            role="radio"
            aria-checked={accent === p.value}
            aria-label={p.name}
            className={`accent-opt${accent === p.value ? ' selected' : ''}`}
            style={{ background: p.value, color: p.value }}
            onClick={() => {
              setOpen(false);
              set(p.value);
            }}
          >
            {accent === p.value && <Check size={18} strokeWidth={3} color={onColor(p.value)} />}
          </button>
        ))}
        <button
          role="radio"
          aria-checked={isCustom}
          aria-label="Custom colour"
          aria-expanded={open}
          className={`accent-opt custom${isCustom ? ' selected' : ''}`}
          style={isCustom ? { color: accent } : undefined}
          onClick={() => {
            setOpen(true);
            if (!isCustom) applyHsl(hsl);
          }}
        >
          <span style={{ background: isCustom ? accent : undefined }} />
        </button>
      </div>

      {open && (
        <div className="accent-custom">
          <label className="slider-label">
            Hue
            <input
              type="range"
              className="slider hue"
              min={0}
              max={359}
              value={h}
              onChange={(e) => applyHsl([Number(e.target.value), s, l])}
              aria-label="Hue"
            />
          </label>
          <label className="slider-label">
            Shade
            <input
              type="range"
              className="slider"
              min={22}
              max={78}
              value={l}
              style={{ background: `linear-gradient(90deg, ${hslToHex(h, s, 22)}, ${hslToHex(h, s, 50)}, ${hslToHex(h, s, 78)})` }}
              onChange={(e) => applyHsl([h, s, Number(e.target.value)])}
              aria-label="Shade"
            />
          </label>
          <div className="accent-hex">
            <span className="accent-dot" style={{ background: customHex }} />
            <input
              className="text-input small"
              value={hexText}
              maxLength={7}
              placeholder="#22b8b0"
              aria-label="Hex colour"
              onChange={(e) => {
                const v = e.target.value.trim();
                setHexText(v);
                const hex = (v.startsWith('#') ? v : `#${v}`).toLowerCase();
                if (/^#[0-9a-f]{6}$/.test(hex)) {
                  setHsl(hexToHsl(hex));
                  set(hex);
                }
              }}
            />
          </div>
        </div>
      )}

      <div className="accent-preview" aria-hidden="true">
        <span className="accent-btn">Button</span>
        <span className="accent-chip">Selected</span>
        <span className="accent-bar">
          <i />
        </span>
      </div>
    </div>
  );
}
