import { defineConfig } from "@tanstack/react-start/config";
import viteTsConfigPaths from "vite-tsconfig-paths";

const nitroPreset = process.env.NITRO_PRESET ?? "vercel";

export default defineConfig({
  server: {
    preset: nitroPreset,
  },
  routers: {
    client: {
      vite: {
        plugins: [viteTsConfigPaths({ root: "./" })],
        build: { chunkSizeWarningLimit: 5000 },
      },
    },
    ssr: {
      vite: {
        plugins: [viteTsConfigPaths({ root: "./" })],
      },
    },
    server: {
      vite: {
        plugins: [viteTsConfigPaths({ root: "./" })],
      },
    },
  },
});
