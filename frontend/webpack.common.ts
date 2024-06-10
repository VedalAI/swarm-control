import path from "path";
import { CleanWebpackPlugin } from "clean-webpack-plugin";
import ZipWebpackPlugin from "zip-webpack-plugin";
import CopyWebpackPlugin from "copy-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import { Configuration } from "webpack";

const htmlFile = "./www/html/index.html";
const tsFile = "./www/src/index.ts";

const config: Configuration = {
    entry: tsFile,
    plugins: [
        new CleanWebpackPlugin(),
        new MiniCssExtractPlugin({
            filename: "[name].css",
        }),
        new HtmlWebpackPlugin({
            title: "Video Component View",
            template: htmlFile,
            filename: "video_component.html",
        }),
        new HtmlWebpackPlugin({
            title: "Panel View",
            template: htmlFile,
            filename: "panel.html",
        }),
        new HtmlWebpackPlugin({
            title: "Mobile View",
            template: htmlFile,
            filename: "mobile.html",
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
