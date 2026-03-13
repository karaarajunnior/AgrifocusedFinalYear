import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agrifocused.app',
  appName: 'AgriFocused',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
