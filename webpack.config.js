//@ts-check

"use strict";

const path = require("path");
const webpack = require("webpack");

/**@type {import('webpack').Configuration}*/
const baseConfig = {
    mode: "none",
    entry: "./src/extension.ts",
    devtool: "nosources-source-map",
    externals: {
        vscode: "commonjs vscode"
    },
    resolve: {
        extensions: [".ts", ".js"]
    },
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
    }
};

const nodeConfig = {
    ...baseConfig,
    target: "node",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "extension.js",
        libraryTarget: "commonjs2"
    }
};
/*
const webConfig = {
    ...baseConfig,
    target: "webworker",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "extension-web.js",
        libraryTarget: "commonjs2"
    },
    resolve: {
        fallback: {
            "path": require.resolve("path-browserify")
        }
    },
    plugins: [
		new webpack.ProvidePlugin({
			process: "process/browser",
		})
	]
};
*/
module.exports = [ nodeConfig/*, webConfig*/ ];
