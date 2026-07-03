import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.neurodoom.app',
  appName: 'NEURODOOM',
  webDir: 'dist',
  android: {
    // Keep the WebView opaque; the game renders its own dark background.
    backgroundColor: '#050608',
  },
};

export default config;
