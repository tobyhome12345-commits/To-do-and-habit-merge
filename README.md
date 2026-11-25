# ✅ Tickday: habits + to-dos, with Tick

**One free, offline Android app for your habits AND your to-do list.** Tickday merges the **Habit Tracker** (with Tick the mascot) and **Doable** (the to-do app) into one app with one design, one place for your data, one backup file and reminders for both. No ads, no account, no subscription. Everything stays on your phone.

<img src="docs/screenshots/today.png" alt="Today: habits and tasks together, a task being ticked off, a perfect day, first run, the add chooser and dark mode">

## 📲 Install on your Android phone

**Download link (always the newest version):**
https://github.com/tobyhome12345-commits/To-do-and-habit-merge/releases/latest/download/Tickday.apk

1. Open the link above in **Chrome** on your phone. `Tickday.apk` downloads.
2. Tap the download notification, or open **Files → Downloads → Tickday.apk**.
3. If Android says *"For your security, your phone isn't allowed to install unknown apps from this source"*, tap **Settings**, turn on **Allow from this source**, then go back.
4. Tap **Install**. If Google Play Protect warns about an unknown app, tap **More details → Install anyway** (it says this for any app that isn't from the Play Store).
5. Open **Tickday** 🎉 When you set your first reminder, tap **Allow** so Tickday can send notifications.

Tickday has its own app id (`com.tickday.app`), so it installs **next to** Habit Tracker and Doable. It doesn't replace them.

**Updating:** open the same link again and install. It installs over the old version and **keeps all your habits and tasks**, because every build is signed with the same key.

### 🚚 Bring your old data across

Android keeps each app's data private, so Tickday can't read the old apps directly. Use backups instead:

1. In **Habit Tracker**: Settings → **Export**. Save the file (Drive, Files…).
2. In **Doable**: Settings → **Export backup**. Save that file too.
3. In **Tickday**: tap **Import a backup** on the welcome card (or ⚙️ Settings → **Import backup**), pick a file and choose **Merge**. Do it once for each file.

Habit Tracker files only touch your habits, and Doable files only touch your tasks. Your theme and colours stay as they are. Tickday keeps a safety copy before every import (Settings → **Undo last import or reset**).

## ✨ What's inside

**Today (home)**: today's habits and today's tasks together. Tick looks at your whole day (habits + tasks), with one progress ring, his mood, cheeky messages and confetti when everything's done. You also get quick-add for tasks, overdue tasks with **Move to today**, and a **+** button for a new habit or task.

**🌱 Habits** (everything from the Habit Tracker):
- Habits / Calendar / Stats switch
- Counted goals (💧 8 glasses), flexible schedules (every day, certain days, every X days, X times a week), time of day
- Streaks that understand schedules, 🏆 best streaks, milestone celebrations, Tick's five levels
- Notes, pause, 🏖️ vacation mode, archive, hold-and-drag to reorder, Note/Undo after a check-off
- **New:** a daily **reminder** per habit (the Habit Tracker's reminders were removed because they didn't work; Tickday uses the reliable reminder engine from Doable)

<img src="docs/screenshots/habits.png" alt="Habits, dark habits, calendar, stats and the habit sheet">

**✅ To-Do** (everything from Doable):
- Today / Upcoming / Lists switch, plus list pages, smart views (Overdue, Completed, All) and search with filters
- Quick-add that understands `tomorrow 5pm`, `fri`, `!high`, `#School`, `every mon`…
- Subtasks, notes, priorities, emoji, repeating tasks, real reminders with ✓ Done and Snooze
- The self-drawing checkmark with confetti, undo, drag to reorder, sort and filter

<img src="docs/screenshots/todo.png" alt="To-Do: today, upcoming, lists, a list, quick-add and the task sheet">

**⚙️ Settings** (one page for everything, behind the gear): theme (auto/light/dark), accent colour (Classic, presets including Doable's violet, or any custom colour, contrast-checked), week start, reduce motion, haptics, habit and task reminder switches, default task reminder, vacation mode, archived habits, export, import, undo last import, and reset (habits, tasks or both).

<img src="docs/screenshots/settings.png" alt="Settings and the import sheet">

<img src="docs/screenshots/dark.png" alt="Dark mode on every screen">

## 🔔 Reminders

Habit and task reminders are real Android notifications, scheduled by the system at the exact minute (even when Tickday is closed), with **✓ Done** and **Snooze 10 min** buttons. Habit reminders only fire on days the habit is due, and stay quiet once it's done, paused or on vacation. They survive restarts and reboots. Try **Settings → Send a test notification**.

<img src="docs/screenshots/reminders.png" width="600" alt="Reminder row in the habit sheet, notification settings and the planned reminders">

## 🏗️ How it's built

- **Web app** (React 19 + TypeScript + Vite) wrapped with **Capacitor 8** into a native Android app.
- **One design system** ("Garden notebook" from the Habit Tracker): Fredoka + Nunito fonts bundled offline, warm paper by day, night garden in dark mode, Tick everywhere.
- **One storage document** with a `version` field and step-by-step migrations. Habits and tasks are kept separately inside it, and settings are shared.
- **One reminder engine** for habits and tasks, with separate notification id ranges so they can never collide.
- **GitHub Actions** (`.github/workflows/android.yml`) runs the tests, builds and signs the APK, and publishes it to GitHub Releases on every push.

The details (data model, migrations, backups, reminders) are in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

### Working on it

```bash
npm install
npm run dev          # open http://localhost:5173/?demo=1 for sample data (?demo=done, ?demo=new)
npm test             # 174 unit tests (both old apps' tests + migrations, backups, reminders)
npm run build
npm run assets       # re-render the app icon, splash screens and favicon
npx cap sync android
```

### ⚠️ The signing key

`android/app/tickday-release.jks` and `android/keystore.properties` are committed **on purpose**, so GitHub Actions signs every build with the same key. **Never delete or regenerate them.** If the key changes, Android refuses to install updates over the existing app, and you'd have to uninstall it (export a backup first!). Also, don't rename the workflow file, because its run number is the app's version code.
