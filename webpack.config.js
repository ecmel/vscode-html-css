//@ts-check

"use strict";

const path = require("path");
const webpack = require("webpack");

/**@type {import('webpack').Configuration}*/
module.exports = {
    mode: "none",
    target: "webworker",
    entry: "./src/extension.ts",
    devtool: "nosources-source-map",
    externals: {
        vscode: "commonjs vscode"
    },
    resolve: {
        extensions: [".ts", ".js"],
        fallback: {
            "path": require.resolve("path-browserify")
        }
    },
    plugins: [
		new webpack.ProvidePlugin({
			process: "process/browser",
		})
	],
    module: {
        rules: [
            {
                test: /\.ts$/,
                exclude: /node_modules/,
                use: [
                    {
                        loader: "ts-loader"
                    }
                ]
            }
        ]
    },
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "extension.js",
        libraryTarget: "commonjs2"
    }
};