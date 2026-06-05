import { defineConfig } from "@tanstack/react-start/config";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    preset: process.env.NITRO_PRESET ?? "vercel",
  },
  vite: {
    plugins: [viteTsConfigPaths({ root: "./" })],
    build: { chunkSizeWarningLimit: 5000 },
  },
});
