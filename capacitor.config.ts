import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maahhha.formatforge',
  appName: 'FormatForge Pro',
  webDir: 'dist',
  plugins: {
    BackgroundRemover: {
      // No config needed – presence ensures inclusion
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      showSpinner: false
    }
  }
};

export default config;
