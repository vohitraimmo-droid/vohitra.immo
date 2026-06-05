import { defineConfig } from "@tanstack/react-start/config";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  server: {
    preset: process.env.NITRO_PRESET ?? "vercel",
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
