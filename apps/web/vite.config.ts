// Vite for the web app: React, and in development the API calls passed on to the server running
// next to it (pnpm dev starts both).

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER = process.env.GLADE_SERVER ?? "http://127.0.0.1:3000";

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": SERVER } },
});
