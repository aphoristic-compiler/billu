import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.billu.hub",
  appName: "BILLU HUB",
  webDir: "public",
  bundledWebRuntime: false,
  server: {
    url: "https://billu-zeta.vercel.app",
    cleartext: true
  }
};

export default config;
