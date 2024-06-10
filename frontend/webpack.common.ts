import path from "path";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import ZipWebpackPlugin from "zip-webpack-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { Configuration } from "webpack";

const config: Configuration = {
    entry: "./www/src/index.ts",
    plugins: [
        new CleanWebpackPlugin(),
        new MiniCssExtractPlugin({
            filename: "[name].css",
        }),
        new HtmlWebpackPlugin({
            title: "Video Component View",
            template: "./www/html/index.html",
            filename: "video_component.html",
        }),
        new HtmlWebpackPlugin({
            title: "Mobile View",
            template: "./www/html/index.html",
            filename: "mobile.html",
        }),
        new HtmlWebpackPlugin({
            title: "Config",
            template: "./www/html/index.html",
            filename: "config.html",
        }),
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: "./www/img",
                    to: "img",
                },
            ],
        }),
        new ZipWebpackPlugin({
            filename: "frontend.zip",
        }),
    ],
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, "css-loader"],
            },
            {
                test: /\.(png|svg|jpg|gif)$/,
                type: "asset/resource",
            },
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    optimization: {
        splitChunks: {
            cacheGroups: {
                commons: {
                    test: /[\\/]node_modules[\\/]/,
                    name: "vendors",
                    chunks: "all",
                },
                styles: {
                    name: "styles",
                    test: /\.css$/,
                    chunks: "all",
                    enforce: true,
                },
            },
        },
    },
    output: {
        filename: "[name].bundle.js",
        path: path.resolve(__dirname, "dist"),
    },
};

export default config;
