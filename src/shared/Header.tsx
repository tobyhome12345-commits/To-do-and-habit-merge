import type { ReactNode } from 'react';
import { ChevronLeft, Search, Settings } from 'lucide-react';
import { useUI } from '../data/ui';

interface Props {
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Colour dot before the title (lists). */
  color?: string;
  /** Show a back arrow that pops the current screen. */
  back?: boolean;
  actions?: ReactNode;
  /** Search button (to-do screens). */
  search?: boolean;
  /** Gear button that opens Settings (top-level screens). */
  gear?: boolean;
}

/** Big Garden-style screen header used by every screen (habits, tasks, settings). */
export function Header({ eyebrow, title, color, back, actions, search = false, gear = false }: Props) {
  const pop = useUI((s) => s.pop);
  const push = useUI((s) => s.push);
  return (
    <header className="screen-header">
      <div className="screen-titles">
        {(back || eyebrow) && (
          <div className="screen-eyebrow">
            {back && (
              <button className="back-btn" onClick={pop} aria-label="Back">
                <ChevronLeft size={22} strokeWidth={2.6} />
              </button>
            )}
            {eyebrow && <p className="subtitle">{eyebrow}</p>}
          </div>
        )}
        <h1>
          {color && <span className="title-dot" style={{ background: color }} />}
          <span className="title-text">{title}</span>
        </h1>
      </div>
      <div className="header-actions">
        {actions}
        {search && (
          <button className="icon-btn" aria-label="Search" onClick={() => push({ kind: 'search' })}>
            <Search size={20} />
          </button>
        )}
        {gear && (
          <button className="icon-btn" aria-label="Settings" onClick={() => push({ kind: 'settings' })}>
            <Settings size={20} />
          </button>
        )}
      </div>
    </header>
  );
}

/** Segmented switch under a section header (Habits · Calendar · Stats, Today · Upcoming · Lists). */
export function SectionSwitch<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="section-switch segmented" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={o.value === value} className={o.value === value ? 'active' : undefined} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
