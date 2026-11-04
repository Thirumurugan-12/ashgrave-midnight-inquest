import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The game window. In dev, Vite serves it and proxies the live socket to the game
// process (npm start). `npm run ui:build` outputs ui/dist, which npm start serves.
export default defineConfig({
  root: "ui",
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5173, proxy: { "/ws": { target: "ws://localhost:5180", ws: true } } },
});
