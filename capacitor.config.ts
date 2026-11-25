import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // ⚠️ Keep this id: the app was first released as "Tickday" with it, and Android only installs an
  // update over the existing app (keeping your data) when the id and signing key stay the same.
  appId: 'com.tickday.app',
  appName: 'Doable',
  webDir: 'dist',
  android: {
    backgroundColor: '#FBF6EE',
  },
  // iPhone: the native Swift shell (ios/App) shows the same app. Safe areas come from env(safe-area-inset-*).
  ios: {
    backgroundColor: '#FBF6EE',
    contentInset: 'never',
  },
  plugins: {
    SystemBars: {
      // Injects --safe-area-inset-* CSS variables so content never hides under the status/nav bars.
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      showSpinner: false,
    },
    Keyboard: {
      // iPhone: shrink the app above the keyboard (like Android does), so sheets and inputs stay visible.
      resize: 'native',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_tick',
      iconColor: '#F5A524',
    },
  },
};

export default config;
