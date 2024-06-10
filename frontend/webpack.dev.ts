import { merge } from "webpack-merge";
import common from "./webpack.common";
import { Configuration } from "webpack";
import "webpack-dev-server";

const config = merge<Configuration>(common, {
    mode: "development",
    devtool: "inline-source-map",
    devServer: {
        static: "./dist",
        port: 8080,
    },
});

// noinspection JSUnusedGlobalSymbols
export default config;
