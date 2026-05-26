
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pulse.transit',
  appName: 'Pulse Transit',
  webDir: 'frontend/dist',

  server: {
    androidScheme: 'https',
    cleartext: true,
    hostname: 'pulse-transit.app',
    iosScheme: 'capacitor',
    allowNavigation: ['*.pulse-transit.app'],
  },

  android: {
    allowMixedContent: true,
    minWebViewVersion: 70,
    webContentsDebuggingEnabled: process.env.NODE_ENV === 'development',
  },

  ios: {
    scheme: 'Pulse Transit',
    contentInset: 'automatic',
    allowsLinkPreview: true,
    limitsNavigationsToAppBoundDomains: true,
    webContentsDebuggingEnabled: process.env.NODE_ENV === 'development',
  },

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
  resize: 'native',
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
};

export default config;
