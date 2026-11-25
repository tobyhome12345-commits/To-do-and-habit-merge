import { useEffect, useState } from 'react';
import { App as CapApp } from '@capacitor/app';
import { Bell, BellRing, Calendar, CheckSquare, Download, Heart, History, ListTodo, Moon, Smartphone, Sparkles, Sprout, Timer, Trash2, Upload, Vibrate, Zap } from 'lucide-react';
import { useData } from '../data/store';
import { useUI } from '../data/ui';
import { Header } from '../shared/Header';
import { Row, Segmented, Toggle } from '../shared/Controls';
import { Tick } from '../shared/Tick';
import { AccentPicker } from './AccentPicker';
import { HabitSettings } from './HabitSettings';
import { REMINDER_OPTIONS } from '../todo/model/types';
import { formatTime } from '../core/dates';
import { isNative } from '../core/platform';
import { exportBackup, pickBackupFile } from '../data/backupIO';
import { PRE_IMPORT, kv, saveNow } from '../data/persistence';
import { migrate } from '../data/migrate';
import { getReminderStatus, openExactAlarmSettings, requestReminderPermission, sendTestNotification, type ReminderStatus } from '../notifications/native';
import type { ThemeMode } from '../data/types';

/*
 * One Settings page for the whole app (it replaces the Habit Tracker's settings sheet and Doable's
 * Settings tab). Opened from the gear in any header.
 */

const ICON = {
  sun: { background: 'var(--sun-soft)', color: 'var(--sun-deep)' },
  leaf: { background: 'var(--leaf-soft)', color: 'var(--leaf)' },
  ink: { background: 'var(--primary-soft)', color: 'var(--text)' },
  coral: { background: 'rgba(255, 122, 89, 0.16)', color: 'var(--coral)' },
  danger: { background: 'var(--danger-soft)', color: 'var(--danger)' },
};

function Icon({ tone, children }: { tone: keyof typeof ICON; children: React.ReactNode }) {
  return (
    <span className="row__icon" style={ICON[tone]}>
      {children}
    </span>
  );
}

export default function SettingsScreen() {
  const settings = useData((s) => s.data.settings);
  const data = useData((s) => s.data);
  const update = useData((s) => s.updateSettings);
  const replaceData = useData((s) => s.replaceData);
  const showSnack = useData((s) => s.showSnack);
  const openSheet = useUI((s) => s.openSheet);
  const [status, setStatus] = useState<ReminderStatus | null>(null);
  const [version, setVersion] = useState(__APP_VERSION__);
  const [safetyCopy, setSafetyCopy] = useState<string | null>(null);

  const refreshStatus = () => void getReminderStatus().then(setStatus);
  useEffect(() => {
    refreshStatus();
    const onVis = () => document.visibilityState === 'visible' && refreshStatus();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [data.todo.tasks, data.habits.habits, settings.notify]);

  useEffect(() => {
    if (isNative) void CapApp.getInfo().then((i) => setVersion(i.version));
    void kv.get(PRE_IMPORT).then(setSafetyCopy);
  }, [data.meta]);

  const nHabits = data.habits.habits.filter((h) => !h.archivedAt).length;
  const open = data.todo.tasks.filter((t) => t.completedAt == null).length;
  const withReminders = data.habits.habits.filter((h) => h.reminder && !h.archivedAt).length;

  return (
    <main className="screen settings-page">
      <Header back eyebrow="Tickday" title="Settings" />

      {/* -------- Appearance -------- */}
      <p className="section-title">🎨 Appearance</p>
      <div className="group">
        <div className="row row--stack">
          <span className="row__title">
            <Moon size={18} /> Theme
          </span>
          <Segmented<ThemeMode>
            label="Theme"
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: 'system', label: '📱 Auto' },
              { value: 'light', label: '☀️ Light' },
              { value: 'dark', label: '🌙 Dark' },
            ]}
          />
        </div>
        <div className="row row--stack">
          <span className="row__title">
            <Sparkles size={18} /> Accent colour
          </span>
          <AccentPicker />
        </div>
        <div className="row">
          <Icon tone="sun">
            <Calendar size={18} />
          </Icon>
          <span className="row__label">Week starts on</span>
          <div style={{ width: 150 }}>
            <Segmented<0 | 1>
              label="Week starts on"
              value={settings.weekStart}
              onChange={(weekStart) => update({ weekStart })}
              options={[
                { value: 1, label: 'Mon' },
                { value: 0, label: 'Sun' },
              ]}
            />
          </div>
        </div>
        <Row icon={<Icon tone="ink"><Sparkles size={18} /></Icon>} label="Reduce motion" sub="Calmer animations everywhere">
          <Toggle checked={settings.reduceMotion} onChange={(v) => update({ reduceMotion: v })} label="Reduce motion" />
        </Row>
        <Row icon={<Icon tone="ink"><Vibrate size={18} /></Icon>} label="Haptics" sub="Little buzzes when you tick things off">
          <Toggle checked={settings.haptics} onChange={(v) => update({ haptics: v })} label="Haptics" />
        </Row>
      </div>

      {/* -------- Notifications -------- */}
      <p className="section-title">🔔 Notifications</p>
      {status?.platform === 'native' && status.permission !== 'granted' && (
        <div className="banner banner--warn">
          <BellRing size={20} />
          <div>
            <b>Notifications are off.</b> Reminders can't pop up until you allow them.
            <button
              className="banner__btn"
              onClick={async () => {
                const ok = await requestReminderPermission(true);
                refreshStatus();
                if (!ok) showSnack('Turn them on in Android Settings → Apps → Tickday → Notifications', undefined, '⚙️');
              }}
            >
              Allow notifications
            </button>
          </div>
        </div>
      )}
      {status?.platform === 'native' && status.permission === 'granted' && status.exact !== 'granted' && (
        <div className="banner banner--warn">
          <Timer size={20} />
          <div>
            <b>Reminders may be a few minutes late.</b> Allow "Alarms & reminders" so they ring on the exact minute.
            <button className="banner__btn" onClick={() => void openExactAlarmSettings().then(refreshStatus)}>
              Allow exact alarms
            </button>
          </div>
        </div>
      )}
      <div className="group">
        <Row icon={<Icon tone="leaf"><Sprout size={18} /></Icon>} label="Habit reminders" sub={withReminders ? `${withReminders} habit${withReminders === 1 ? '' : 's'} with a reminder time · set it in each habit` : 'Give a habit a reminder time in its edit sheet'}>
          <Toggle checked={settings.notify.habits} onChange={(v) => update({ notify: { ...settings.notify, habits: v } })} label="Habit reminders" />
        </Row>
        <Row icon={<Icon tone="sun"><ListTodo size={18} /></Icon>} label="Task reminders" sub="At the time you pick on each task">
          <Toggle checked={settings.notify.tasks} onChange={(v) => update({ notify: { ...settings.notify, tasks: v } })} label="Task reminders" />
        </Row>
        <div className="row">
          <Icon tone="sun">
            <Bell size={18} />
          </Icon>
          <span className="row__label">
            Default task reminder
            <span className="row__sub">For new tasks with a due date</span>
          </span>
          <label className="select-pill">
            {REMINDER_OPTIONS.find((o) => o.value === settings.defaultReminder)?.label ?? 'Custom'}
            <select
              value={settings.defaultReminder == null ? '' : String(settings.defaultReminder)}
              onChange={(e) => update({ defaultReminder: e.target.value === '' ? null : Number(e.target.value) })}
              aria-label="Default task reminder"
            >
              {REMINDER_OPTIONS.map((o) => (
                <option key={String(o.value)} value={o.value == null ? '' : String(o.value)}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row">
          <Icon tone="sun">
            <Timer size={18} />
          </Icon>
          <span className="row__label">
            All-day tasks remind at
            <span className="row__sub">When a task has a date but no time</span>
          </span>
          <label className="select-pill">
            {formatTime(settings.allDayReminderTime)}
            <input type="time" value={settings.allDayReminderTime} onChange={(e) => e.target.value && update({ allDayReminderTime: e.target.value })} aria-label="All-day reminder time" />
          </label>
        </div>
        {status?.platform === 'native' ? (
          <Row
            icon={<Icon tone="coral"><Zap size={18} /></Icon>}
            label="Send a test notification"
            sub={`${status.scheduled} reminder${status.scheduled === 1 ? '' : 's'} scheduled · ${status.exact === 'granted' ? 'exact timing on' : 'may be slightly late'}`}
            onClick={async () => {
              const ok = await sendTestNotification();
              showSnack(ok ? 'Test notification coming in 5 seconds…' : 'Allow notifications first', undefined, ok ? '🔔' : '⚠️');
            }}
          />
        ) : (
          <Row icon={<Icon tone="coral"><Smartphone size={18} /></Icon>} label="Reminders run in the Android app" sub="Real notifications at the right time, even when Tickday is closed" />
        )}
      </div>

      {/* -------- Habits -------- */}
      <p className="section-title">🌱 Habits</p>
      <HabitSettings />

      {/* -------- Tasks -------- */}
      <p className="section-title">✅ Tasks</p>
      <div className="group">
        <Row icon={<Icon tone="sun"><CheckSquare size={18} /></Icon>} label="Show completed in lists" sub="Open lists with done tasks expanded">
          <Toggle checked={settings.showCompletedInLists} onChange={(v) => update({ showCompletedInLists: v })} label="Show completed in lists" />
        </Row>
      </div>

      {/* -------- Your data -------- */}
      <p className="section-title">💾 Your data</p>
      <div className="group">
        <Row
          icon={<Icon tone="leaf"><Upload size={18} /></Icon>}
          label="Export backup"
          sub={`${nHabits} habit${nHabits === 1 ? '' : 's'}, ${data.todo.tasks.length} tasks & ${data.todo.lists.length} lists in one .json file`}
          onClick={async () => {
            try {
              const how = await exportBackup(data);
              if (how === 'downloaded') showSnack('Backup downloaded', undefined, '💾');
            } catch (e) {
              if (!String(e).toLowerCase().includes('cancel')) showSnack('Export failed. Try again?', undefined, '⚠️');
            }
          }}
        />
        <Row icon={<Icon tone="leaf"><Download size={18} /></Icon>} label="Import backup" sub="Tickday, Habit Tracker or Doable backup files" onClick={pickBackupFile} />
        {safetyCopy && (
          <Row
            icon={<Icon tone="ink"><History size={18} /></Icon>}
            label="Undo last import or reset"
            sub="Go back to how things were just before it"
            onClick={async () => {
              try {
                const before = migrate(JSON.parse(safetyCopy));
                await kv.set(PRE_IMPORT, JSON.stringify(data)); // so this can be undone too
                replaceData(before);
                await saveNow();
                showSnack('Restored your data from before the last import', undefined, '↩️');
              } catch {
                showSnack('That safety copy can’t be read', undefined, '⚠️');
              }
            }}
          />
        )}
        <Row icon={<Icon tone="danger"><Trash2 size={18} /></Icon>} label="Reset…" sub="Start over with habits, tasks or both" onClick={() => openSheet({ kind: 'reset' })} />
      </div>
      <p className="settings-note">
        Everything is saved <b>only on this phone</b>: no account, no cloud, no tracking. Export a backup now and then (e.g. to Google Drive) so you never lose your streaks or tasks.
      </p>

      {/* -------- About -------- */}
      <div className="about">
        <Tick mood="proud" stage={4} size={56} still />
        <p>
          <b>Tickday</b> {isNative ? `v${version}` : 'web preview'} · {nHabits} habits · {open} open tasks
          <br />
          Habit Tracker + Doable, cheered on by Tick ✓
          <br />
          <Heart size={12} fill="currentColor" /> Free forever. No ads, no account, no subscription.
        </p>
      </div>
    </main>
  );
}
