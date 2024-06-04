const path = require("path");
const {CleanWebpackPlugin} = require("clean-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

const htmlFile = "./src/index.html";
const tsFile = "./src/index.ts";

module.exports = {
    entry: tsFile,
    plugins: [
        new CleanWebpackPlugin(),
        new MiniCssExtractPlugin({filename: "[name].css"}),
/*        new HtmlWebpackPlugin({
            title: "Video Overlay View",
            template: htmlFile,
            filename: "video_overlay.html",
        }),*/
        new HtmlWebpackPlugin({
            title: "Video Component View",
            template: htmlFile,
            filename: "video_component.html",
        }),
/*        new HtmlWebpackPlugin({
            title: "Panel View",
            template: htmlFile,
            filename: "panel.html",
        }),*/
        new HtmlWebpackPlugin({
            title: "Mobile View",
            template: htmlFile,
            filename: "mobile.html",
        }),
/*        new HtmlWebpackPlugin({
            title: "Broadcaster Configuration View",
            template: htmlFile,
            filename: "config.html",
        }),*/
/*        new HtmlWebpackPlugin({
            title: "Live Configuration View",
            template: htmlFile,
            filename: "live_config.html",
        }),*/
    ],
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, "css-loader"],
            },
            {
                test: /\.(png|svg|jpg|gif)$/,
                use: ["file-loader"],
            },
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            }
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"]
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
