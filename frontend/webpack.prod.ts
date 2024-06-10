import { merge } from "webpack-merge";
import common from "./webpack.common";

const config = merge(common, {
    mode: "production",
});

// noinspection JSUnusedGlobalSymbols
export default config;
