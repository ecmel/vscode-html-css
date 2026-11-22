/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const production = mode === "production";
  return {
    resolve: {
      conditions: ["node"],
    },
    ssr: {
      target: "node",
      // A packaged extension does not ship node_modules, so bundle everything
      // except the vscode API, which the host provides.
      noExternal: true,
    },
    build: {
      ssr: true,
      outDir: "dist",
      emptyOutDir: true,
      target: "node18",
      lib: {
        entry: {
          extension: resolve(import.meta.dirname, "src/extension.ts"),
        },
        formats: ["cjs"],
        fileName: (_format, entryName) => `${entryName}.js`,
      },
      rollupOptions: {
        external: ["vscode"],
      },
      sourcemap: !production,
      minify: production,
    },
  };
});
