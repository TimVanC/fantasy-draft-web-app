import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Dev stand-in for the Vercel function api/adp.ts (FFC has no CORS).
      "/api/adp": {
        target: "https://fantasyfootballcalculator.com",
        changeOrigin: true,
        rewrite: (path: string) => {
          const url = new URL(path, "http://localhost");
          const format = url.searchParams.get("format") ?? "ppr";
          const teams = url.searchParams.get("teams") ?? "12";
          const year = url.searchParams.get("year") ?? String(new Date().getFullYear());
          return `/api/v1/adp/${format}?teams=${teams}&year=${year}`;
        },
      },
      // Dev stand-in for api/players.ts: the untrimmed ~15MB map (the client
      // reads only the fields the trimmed production response carries).
      "/api/players": {
        target: "https://api.sleeper.app",
        changeOrigin: true,
        rewrite: () => "/v1/players/nfl",
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
} as Parameters<typeof defineConfig>[0]);
