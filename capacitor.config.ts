import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pulse.app',
  appName: 'Pulse',

  // 🔥 CRITICAL: correct build path
  webDir: 'frontend/dist',

  // 🔥 DEV + GPS support
  server: {
    androidScheme: 'https',
    cleartext: true
  },

  // 🔥 Android stability
  android: {
    allowMixedContent: true
  }
};

export default config;