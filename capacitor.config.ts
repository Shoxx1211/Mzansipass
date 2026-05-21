import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pulse.transit',
  appName: 'Pulse Transit',
  webDir: process.env.NODE_ENV === 'development' ? 'frontend/dist' : 'frontend/dist', // Points to frontend build

  // ======================================================
  // 🔥 SERVER CONFIGURATION
  // ======================================================
  server: {
    androidScheme: 'https',
    cleartext: true,
    hostname: 'pulse-transit.app',
    iosScheme: 'capacitor',
    allowNavigation: ['*.pulse-transit.app'],
    url: process.env.NODE_ENV === 'development' ? 'http://localhost:5173' : undefined,
  },

  // ======================================================
  // 📱 ANDROID SPECIFIC
  // ======================================================
  android: {
    allowMixedContent: true,
    minWebViewVersion: 70,
    webContentsDebuggingEnabled: process.env.NODE_ENV === 'development',
    buildOptions: {
      keystorePath: process.env.ANDROID_KEYSTORE_PATH,
      keystorePassword: process.env.ANDROID_KEYSTORE_PASSWORD,
      keystoreAlias: process.env.ANDROID_KEYSTORE_ALIAS,
      keystoreAliasPassword: process.env.ANDROID_KEYSTORE_ALIAS_PASSWORD,
    },
  },

  // ======================================================
  // 🍎 iOS SPECIFIC
  // ======================================================
  ios: {
    scheme: 'Pulse Transit',
    contentInset: 'automatic',
    allowsLinkPreview: true,
    limitsNavigationsToAppBoundDomains: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV === 'development',
  },

  // ======================================================
  // 🔋 PLUGIN CONFIGURATIONS
  // ======================================================
  plugins: {
    Geolocation: {
      permissions: {
        android: [
          'android.permission.ACCESS_COARSE_LOCATION',
          'android.permission.ACCESS_FINE_LOCATION',
          'android.permission.ACCESS_BACKGROUND_LOCATION',
        ],
        ios: {
          always: true,
          whenInUse: true,
        },
      },
    },
    Haptics: {
      enabled: true,
    },
    Keyboard: {
      resize: 'body',
      style: 'dark',
      resizeOnFullScreen: true,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#040816',
      overlaysWebView: false,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#040816',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },

  // ======================================================
  // 🔐 PACKAGE CONFIGURATION
  // ======================================================
  package: {
    android: {
      versionCode: 1,
      versionName: '3.0.0',
      minVersion: 24,
      targetVersion: 34,
    },
    ios: {
      version: '3.0.0',
      buildNumber: '1',
      minVersion: '13.0',
      targetVersion: '17.0',
    },
  },

  // ======================================================
  // 🚀 LOGGING & DEBUGGING
  // ======================================================
  logging: {
    android: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
    ios: process.env.NODE_ENV === 'development' ? 'debug' : 'error',
  },

  // ======================================================
  // 🧹 CLEANUP
  // ======================================================
  includePlugins: [
    '@capacitor-community/background-geolocation',
    '@capacitor/app',
    '@capacitor/geolocation',
    '@capacitor/haptics',
    '@capacitor/keyboard',
    '@capacitor/status-bar',
  ],
};

export default config;