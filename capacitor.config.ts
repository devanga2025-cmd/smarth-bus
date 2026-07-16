import type { CapacitorConfig } from "@capacitor/cli";

// Smart Bus — Driver mobile app configuration.
// See DRIVER_APP_BUILD.md for the full build & signing workflow.
const config: CapacitorConfig = {
  appId: "com.smartbus.driver",
  appName: "Smart Bus Driver",
  webDir: ".output/public", // built by `bun run build`
  // For local dev over the network, uncomment `server.url` and point it to
  // your dev server. Leave commented for release APKs (must bundle assets).
  server: {
    androidScheme: "https",
    // url: "http://192.168.1.10:8080",
    // cleartext: true,
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    BackgroundGeolocation: {
      // Community plugin config lives in the Android manifest; see docs.
    },
  },
};

export default config;
