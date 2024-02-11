/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

import { defineConfig } from "rollup";
import { cleandir } from "rollup-plugin-cleandir";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import terser from "@rollup/plugin-terser";

const debug = process.env.ROLLUP_WATCH === "true";
process.env.NODE_ENV = debug ? "development" : "production";

export default defineConfig({
  input: "src/extension.ts",
  output: {
    dir: "dist",
    format: "commonjs",
    sourcemap: debug,
  },
  external: ["vscode"],
  plugins: [
    cleandir(),
    resolve({ preferBuiltins: true }),
    commonjs(),
    typescript({ noEmit: true }),
    !debug && terser(),
  ],
});
