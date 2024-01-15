/*
 * Copyright (c) 1986-2024 Ecmel Ercan (https://ecmel.dev/)
 * Licensed under the MIT License
 */

const nodeResolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const typescript = require("@rollup/plugin-typescript");
const terser = require("@rollup/plugin-terser");
const { cleandir } = require("rollup-plugin-cleandir");

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
  external: ["vscode"],
  plugins: [
    cleandir(),
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    typescript({ noEmit: true }),
    !debug && terser(),
  ],
};
