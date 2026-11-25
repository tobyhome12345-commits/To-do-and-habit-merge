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
    LocalNotifications: {
      smallIcon: 'ic_stat_tick',
      iconColor: '#F5A524',
    },
  },
};

export default config;
