import { CircleCheckBig, ListTodo, Sprout } from 'lucide-react';
import { useUI, type Tab } from '../data/ui';
import { haptic } from '../core/haptics';

const TABS: { id: Tab; label: string; Icon: typeof CircleCheckBig }[] = [
  { id: 'today', label: 'Today', Icon: CircleCheckBig },
  { id: 'habits', label: 'Habits', Icon: Sprout },
  { id: 'todo', label: 'To-Do', Icon: ListTodo },
];

/** Floating pill tab bar (Garden design) with a sliding indicator. */
export function TabBar({ badges }: { badges?: Partial<Record<Tab, number>> }) {
  const tab = useUI((s) => s.tab);
  const stack = useUI((s) => s.stack);
  const setTab = useUI((s) => s.setTab);
  const index = TABS.findIndex((t) => t.id === tab);
  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-inner">
        <span className="tab-indicator" style={{ transform: `translateX(${index * 100}%)` }} aria-hidden="true" />
        {TABS.map(({ id, label, Icon }) => {
          const badge = badges?.[id];
          return (
            <button
              key={id}
              className={`tab${tab === id ? ' active' : ''}`}
              onClick={() => {
                if (tab !== id || stack.length) haptic('light');
                setTab(id);
                window.scrollTo({ top: 0 });
              }}
              aria-current={tab === id && !stack.length ? 'page' : undefined}
            >
              <span className="tab-icon">
                <Icon size={20} strokeWidth={2.4} />
                {badge ? <span className="tab-badge">{badge > 99 ? '99+' : badge}</span> : null}
              </span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
