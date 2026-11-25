import { lazy, Suspense, useMemo, type ReactNode } from 'react';
import { useData } from './data/store';
import { useUI, type Route } from './data/ui';
import { counts } from './todo/model/views';
import { useToday } from './core/hooks';
import { TabBar } from './shared/TabBar';
import { SnackHost } from './shared/SnackHost';
import { SheetHost } from './shared/SheetHost';
import { TodayScreen } from './today/TodayScreen';
import { HabitsSection } from './habits/HabitsSection';
import { Fab, TodoSection } from './todo/TodoSection';
import { MilestoneLayer } from './habits/components/MilestoneLayer';

const SettingsScreen = lazy(() => import('./settings/SettingsScreen'));
const ListScreen = lazy(() => import('./todo/screens/ListScreen'));
const SmartScreen = lazy(() => import('./todo/screens/SmartScreen'));
const SearchScreen = lazy(() => import('./todo/screens/SearchScreen'));

function routeScreen(r: Route): ReactNode {
  switch (r.kind) {
    case 'settings':
      return <SettingsScreen />;
    case 'list':
      return <ListScreen key={r.listId} listId={r.listId} />;
    case 'smart':
      return <SmartScreen key={r.view} view={r.view} />;
    case 'search':
      return <SearchScreen />;
  }
}

export function App() {
  const tab = useUI((s) => s.tab);
  const stack = useUI((s) => s.stack);
  const tasks = useData((s) => s.data.todo.tasks);
  const today = useToday();
  const top = stack[stack.length - 1];
  const c = useMemo(() => counts(tasks, today), [tasks, today]);

  return (
    <div className={`app${top ? ` route-${top.kind}` : ''}`}>
      {top ? (
        <Suspense fallback={<main className="screen" />}>{routeScreen(top)}</Suspense>
      ) : tab === 'today' ? (
        <TodayScreen />
      ) : tab === 'habits' ? (
        <HabitsSection />
      ) : (
        <TodoSection />
      )}
      {top?.kind === 'list' && <Fab draft={{ listId: top.listId }} />}
      {top?.kind === 'smart' && <Fab draft={{}} />}
      <SnackHost />
      {top?.kind !== 'settings' && <TabBar badges={{ todo: c.today + c.overdue }} />}
      <SheetHost />
      <MilestoneLayer />
    </div>
  );
}
