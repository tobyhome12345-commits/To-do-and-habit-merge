# Tickday architecture

Tickday merges two apps that were already built the same way (React + TypeScript + Vite + Capacitor 8):

- **Habit Tracker** (`Habit-Tracker-App`, tag `v1.0.7`): the "Garden notebook" design, Tick, schedules, streaks, calendar, stats.
- **Doable** (`To-do-game`): lists, repeating tasks, smart views, quick-add, undo and a reminder engine that works.

The code from both was moved in, not rewritten. Anything duplicated now has a single shared copy.

## Folders

```
src/
  core/          shared helpers: dates (one module for both apps), colours + contrast, haptics,
                 useToday/useHour, back-button stack, theme, platform
  data/          the one saved document: types, migrate (versions + old app files), persistence,
                 backup (merge/replace/reset), backupIO (share/download/pick), store, notifIds,
                 habitView (adapter for the habit code), ui (navigation state), demo data
  shared/        one Sheet, SnackHost, TabBar, Header + SectionSwitch, Controls, EmptyState,
                 Tick, Confetti, ProgressRing, SheetHost
  mascot/        Tick's artwork and moods (Habit Tracker)
  habits/        Habit Tracker: lib (schedule, streaks, stats, reducer, normalize), components,
                 screens (Habits, Calendar, Stats), HabitsSection, useHabitCheck
  todo/          Doable: model (recurrence, quickAdd, views, reminderPlan, data), components,
                 screens, sheets, TodoSection, TodoHeader
  today/         the combined Today home screen
  settings/      the shared Settings page, AccentPicker, HabitSettings, Import + Reset sheets
  notifications/ habitPlan (habit reminders), plan (tasks + habits together), native (Android)
  platform/      nativeInit (back button, status bar, save on pause, reminders)
tests/
  habits/ todo/  the two old apps' test suites, ported
  data/ notifications/   new tests for the merged parts
```

## The saved document

```ts
AppData = {
  version: 1,                       // bumped when the shape changes
  settings: Settings,               // shared: theme, accent, weekStart, haptics, reduceMotion,
                                    // notify {habits, tasks}; tasks: allDayReminderTime,
                                    // defaultReminder, showCompletedInLists, viewPrefs
  habits: { habits, completions, notes, vacations },   // Habit Tracker data (model v2 + reminder fields)
  todo:   { lists, tasks },                            // Doable data (schema v1)
  meta:   { createdAt, nextNotifId, welcomeDone },
}
```

It's stored as one JSON string in Android's private app storage (Capacitor Preferences), using Doable's crash-safe persistence: a debounced autosave, an immediate save when the app goes to the background, a "last good" copy that's used if the main copy can't be read, and a safety copy before every import or reset.

**Migrations** (`data/migrate.ts`): `MIGRATIONS[n]` turns a version-n document into n+1, so older saves and backups are upgraded one step at a time. A file from a *newer* Tickday is refused with a friendly message. Each half is then cleaned by the old app's own validation code (`normalizeState` for habits, `cleanTodo` for tasks), so the repairs both apps already did still happen.

**One store** (`data/store.ts`, Zustand):
- Task actions are Doable's `transact()` functions, including the precise undo stack.
- Habit actions go through the Habit Tracker's pure `reducer` via `habitView()`, a memoised adapter that gives the habit code the shape it expects (`{ habits, completions, notes, settings: { weekStart, vacations } }`). That's why schedule, streak, stats and mood code (and their tests) are unchanged.
- Settings are shared.

## Backups

- **Export:** one file, `{ app: 'Tickday', format: 1, version, exportedAt, appVersion, data }`, through the share sheet (phone) or as a download (browser).
- **Import** (`detect()`) recognises:
  - Tickday backups, whether wrapped in that envelope or bare;
  - Doable backups (`{ app: 'Doable', format: 1, data }` or bare Doable data);
  - Habit Tracker backups (`{ app: 'habit-tracker', version: 1 | 2, … }`). For v1 files, the old per-habit reminder becomes a Tickday reminder time.
- **Merge or replace** (`applyImport`): an old single-app file only touches its own half and never changes the theme or accent.
  - Tasks merge Doable's way: matched by id, and the newest edit wins.
  - Habits are matched by id. Each day keeps the higher count, your notes win (the backup's fill the gaps), new habits are added, and vacations are combined.

## Notifications

`notifications/plan.ts` works out, from the data alone, every notification Android should have scheduled: task reminders (Doable's `planReminders`) plus habit reminders (`habitPlan.ts`). `notifications/native.ts` compares that with Android's pending list (`getPending`) and only cancels or schedules the difference. It runs after any change to habits, tasks or settings, on app start and on resume, so nothing can go stale.

- **Habit reminders** are one exact alarm per due day, planned 14 days ahead. Days that are paused, on vacation, archived, not scheduled or already done are skipped. "N times a week" habits stop for the week once the goal is met. Snooze moves today's reminder.
- **No id collisions:**

  | Range | Used for |
  |---|---|
  | 1 – 999,999,999 | tasks (`task.notifId`) |
  | 1,000,000,000 – 1,999,999,999 | habits: `HABIT_BASE + habit.notifId × 16 + (day mod 16)` |
  | 2,000,000,000 + | test notifications |

  Tasks and habits get their `notifId` from one shared counter (`meta.nextNotifId`), and `assignNotifIds()` repairs duplicates after loads and imports (your existing items keep their numbers).
- **Channels:** "Task reminders" and "Habit reminders", each with ✓ Done and Snooze 10 min actions.
- **Permissions** (`AndroidManifest.xml`): `POST_NOTIFICATIONS`, `USE_EXACT_ALARM` (on the minute), `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `VIBRATE`.
- **Caps:** at most 64 task and 150 habit reminders are pending at once, well under Android's 500-alarm limit.

## Design

The Habit Tracker's "Garden notebook" design system (`styles/global.css`) is the base. `styles/shell.css` maps the to-do styles' token names onto it and joins the two halves: one tab bar, header, sheet, snackbar, button set and accent system. Doable's styles (`tasks.css`, `browse.css`, `sheets.css`) were moved onto the Garden tokens, and classes that clashed between the two apps were renamed.

## Build and release

`.github/workflows/android.yml` runs on every push:

`npm ci` → `npm test` → `npm run build` → `npx cap sync android` → `gradlew assembleRelease` (versionCode = run number) → `apksigner verify` → GitHub Release `v1.0.N` with `Tickday.apk`, marked latest.

The release key (`android/app/tickday-release.jks` + `android/keystore.properties`) is committed so every build has the same signature.
