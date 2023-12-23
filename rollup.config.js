const nodeResolve = require("@rollup/plugin-node-resolve");
const commonjs = require("@rollup/plugin-commonjs");
const typescript = require("@rollup/plugin-typescript");
const terser = require("@rollup/plugin-terser");

/**
 * @type {import('rollup').RollupOptions}
 */
module.exports = {
  input: "src/extension.ts",
  output: {
    dir: "dist",
    format: "commonjs",
  },
  external: (module) => module === "vscode",
  plugins: [
    nodeResolve({ preferBuiltins: true, browser: true }),
    commonjs(),
    typescript(),
    terser(),
  ],
};
