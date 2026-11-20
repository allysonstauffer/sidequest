import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Use Vite's supported file restrictions instead of the missing plugin.
    fs: {
      strict: true,
      deny: [
        ".env",
        ".env.*",
        "*.{crt,pem,key,p12,pfx,cer,der}",
        ".npmrc",
        ".yarnrc.yml",
        "**/.git/**"
      ]
    },
    proxy: {
      "/api": "http://127.0.0.1:8000"
    }
  }
});
