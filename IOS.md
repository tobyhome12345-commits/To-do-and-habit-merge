# 🍏 Doable for iPhone

This is the **swift-ios** copy of Doable: the same app as on Android (habits, to-dos, Today, reminders,
backups, Tick 🌱) inside a native **Swift** wrapper for iPhone.

## Install it on your iPhone (Mac + your Apple developer account)

You need a Mac with **Xcode** (free from the Mac App Store) and an iPhone with a cable.

1. Download **Doable-iOS-Xcode.zip** from the newest **"Doable for iPhone"** release and unzip it.
2. Double-click **`ios/App/App.xcodeproj`** to open it in Xcode. Wait a minute while Xcode downloads
   Capacitor (bottom-left shows "Resolving packages").
3. Click **App** at the top of the left sidebar → the **App** target → **Signing & Capabilities**:
   - tick **Automatically manage signing**;
   - **Team** → choose your developer account;
   - if Xcode says the **Bundle Identifier** `com.tickday.app` is taken, change it to something only
     you use, e.g. `com.yourname.doable`.
4. Plug in your iPhone and pick it at the top of the window (next to ▶).
   First time only: on the iPhone, turn on **Settings → Privacy & Security → Developer Mode** and restart.
5. Press **▶ Run**. Doable appears on your home screen 🎉
6. When it first asks, tap **Allow** for notifications, so reminders can pop up.

**TestFlight instead?** Product → **Archive** → **Distribute App** → **App Store Connect** → Upload.
Then install it with the TestFlight app (and share it with friends).

## No Mac?

Use **Doable-unsigned.ipa** from the same release with a signing tool such as **Sideloadly**
(Windows or Mac): sign in with your Apple ID and it installs Doable on your iPhone.

## Good to know

- **Reminders** work even when Doable is closed or swiped away: iPhone delivers them itself.
  Settings shows "Runs in the background ✓"; tap it to open Doable's iPhone settings.
  iPhone keeps up to 64 waiting reminders, so Doable hands over the soonest 60 and tops them up every
  time you open it.
- **Moving your habits and tasks** between phones (Android ↔ iPhone): Settings → **Export backup** on the old
  phone, send yourself the file, then Settings → **Import backup** on the new one.
- **Android / Samsung** use the normal Doable app:
  https://github.com/tobyhome12345-commits/To-do-and-habit-merge/releases/latest/download/Doable.apk

## Changing the app

The screens are a web app (`src/`, React + TypeScript). The Swift wrapper lives in `ios/App/App/`:

- `DoableViewController.swift`: the Swift view controller that hosts Doable and registers its plugin.
- `ReminderHelperPlugin.swift`: Doable's own Swift plugin (background status + opening Settings).
- `AppDelegate.swift` / `SceneDelegate.swift`: app start-up.

After changing anything in `src/`, rebuild and copy it into the iPhone project (needs Node.js):

```sh
npm install
npm run build
npx cap sync ios
```

Then press ▶ Run in Xcode again. Pushing to the `swift-ios` branch also builds a new release on GitHub.
