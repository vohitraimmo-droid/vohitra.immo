import { createApp } from "vinxi";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default createApp({
  routers: [
    {
      name: "public",
      type: "static",
      dir: "./public",
    },
    {
      name: "client",
      type: "client",
      handler: "./src/entry-client.tsx",
      target: "browser",
      plugins: () => [
        TanStackRouterVite({ autoCodeSplitting: true }),
        react(),
        tailwindcss(),
        viteTsConfigPaths({ root: "./" }),
      ],
      base: "/_build",
    },
    {
      name: "ssr",
      type: "http",
      handler: "./src/entry-server.tsx",
      target: "server",
      plugins: () => [
        TanStackRouterVite({ autoCodeSplitting: true }),
        react(),
        tailwindcss(),
        viteTsConfigPaths({ root: "./" }),
      ],
    },
  ],
});
