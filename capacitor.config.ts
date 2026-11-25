import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tickday.app',
  appName: 'Tickday',
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
