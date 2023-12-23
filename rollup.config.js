const typescript = require("@rollup/plugin-typescript");
const commonjs = require("@rollup/plugin-commonjs");
const nodeResolve = require("@rollup/plugin-node-resolve");

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
  plugins: [nodeResolve({ preferBuiltins: true }), commonjs(), typescript()],
};
