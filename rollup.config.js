/*
 * Copyright (c) 1986-2023 Ecmel Ercan <ecmel.ercan@gmail.com>
 * Licensed under the MIT License
 */

const nodeResolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const typescript = require("@rollup/plugin-typescript");
const terser = require("@rollup/plugin-terser");

const debug = process.env.ROLLUP_WATCH === "true";
process.env.NODE_ENV = debug ? "development" : "production";

/**
 * @type {import('rollup').RollupOptions}
 */
module.exports = {
  input: "src/extension.ts",
  output: {
    dir: "dist",
    format: "commonjs",
    sourcemap: debug,
  },
  external: (module) => module === "vscode",
  plugins: [
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    typescript({ noEmit: true }),
    !debug && terser(),
  ],
};
