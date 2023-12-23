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
  external: (module) => module === "vscode" || module === "css-tree",
  plugins: [
    nodeResolve({ preferBuiltins: true }),
    commonjs(),
    typescript(),
    terser(),
  ],
};
