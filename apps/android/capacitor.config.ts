import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV === 'development';

const config: CapacitorConfig = {
  appId: 'com.kebabpos.terminal',
  appName: 'KebabPOS',
  webDir: 'dist',
  // Only use dev server in development mode
  ...(isDev ? {
    server: {
      url: 'http://192.168.0.14:5173',
      cleartext: true
    }
  } : {}),
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#1a1a1a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#1a1a1a',
    },
    // Self-hosted live updates. Only the web bundle travels this way - anything in
    // android/ is compiled into the APK and still needs a real install.
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl: 'https://kebab-posbackend-production.up.railway.app/api/app/updates',
      // Empty so the plugin never reports to Capgo's cloud. We host the whole thing.
      statsUrl: '',
      // channelUrl is left at its default deliberately: channels are a cloud feature
      // we never call, so the endpoint is never reached.
      // A bundle that never calls notifyAppReady() is rolled back to the previous
      // one. That handshake is the only thing standing between a bad release and a
      // till that will not open, so the window is generous - the T2s is not fast.
      appReadyTimeout: 20000,
      autoDeleteFailed: true,
      // Installing a newer APK drops any older OTA bundle rather than letting it
      // shadow the build that was just put on the device by hand
      resetWhenUpdate: true,
    },
  },
  android: {
    // Allow mixed content for local assets
    allowMixedContent: true,
    // Fullscreen mode for POS
    // backgroundColor: '#1a1a1a',
  },
};

export default config;
