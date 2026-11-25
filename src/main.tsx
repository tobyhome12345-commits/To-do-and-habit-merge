import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import './styles/global.css';
import './styles/components.css';
import './styles/today.css';
import './styles/calendar.css';
import './styles/stats.css';
import './styles/tick.css';
import './styles/tasks.css';
import './styles/browse.css';
import './styles/sheets.css';
import './styles/shell.css';
import { App } from './App';
import { applyTheme } from './core/theme';
import { setHapticsEnabled } from './core/haptics';
import { isNative } from './core/platform';
import { useData } from './data/store';
import { loadData, startAutosave } from './data/persistence';
import type { AppData } from './data/types';

async function boot() {
  const params = new URLSearchParams(location.search);
  // ?demo=1 (browser preview only): sample habits + tasks, never saved.
  const demo = !isNative && params.has('demo');
  let data: AppData;
  if (demo) data = (await import('./data/demo')).demoData(params.get('demo') ?? '');
  else data = (await loadData()).data;
  if (params.has('dark')) data = { ...data, settings: { ...data.settings, theme: 'dark' } };
  if (params.has('light')) data = { ...data, settings: { ...data.settings, theme: 'light' } };
  if (params.get('accent')) data = { ...data, settings: { ...data.settings, accent: '#' + params.get('accent') } };
  useData.getState().init(data);

  // Theme + haptics follow settings.
  const s0 = data.settings;
  applyTheme(s0.theme, s0.accent, s0.reduceMotion);
  setHapticsEnabled(s0.haptics);
  useData.subscribe((s, prev) => {
    const a = s.data.settings;
    const b = prev.data.settings;
    if (a === b) return;
    if (a.theme !== b.theme || a.accent !== b.accent || a.reduceMotion !== b.reduceMotion) applyTheme(a.theme, a.accent, a.reduceMotion);
    if (a.haptics !== b.haptics) setHapticsEnabled(a.haptics);
  });

  if (!demo) startAutosave();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  if (isNative) {
    const { initNative } = await import('./platform/nativeInit');
    await initNative();
  }
}

void boot();
