const path = require("path");

module.exports = {
    target: "node",
    mode: "development",
    entry: "./src/app.ts",
    devtool: 'inline-source-map',
    output: {
        path: path.resolve(__dirname, "bin"),
        filename: "index.js"
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/
            },
        ],
    },
    resolve: {
        extensions: [ '.tsx', '.ts', '.js' ],
    }
}