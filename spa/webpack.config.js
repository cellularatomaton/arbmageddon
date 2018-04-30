var path = require("path");
var webpack = require("webpack");

module.exports = {
	entry: "./src/main.ts",
	output: {
		path: path.resolve(__dirname, "./dist"),
		publicPath: "/dist/",
		filename: "build.js"
	},
	module: {
		rules: [
			{
				test: /\.css$/,
				use: ["vue-style-loader", "css-loader"]
			},
			{
				test: /\.tsx?$/,
				use: [
					{
						loader: "ts-loader",
						options: {
							transpileOnly: true,
							appendTsSuffixTo: [/\.vue$/]
						}
					}
				]
			},
			{
				test: /\.vue$/,
				loader: "vue-loader",
				options: {
					esModule: true
				}
			},
			{
				test: /\.js$/,
				loader: "babel-loader",
				exclude: /node_modules/
			},
			// {
			// 	test: /\.(eot|woff|woff2|svg|ttf)([\?]?.*)$/,
			// 	loader: "file-loader"
			// },
			{
				test: /\.(png|jpg|gif|svg)$/,
				loader: "file-loader",
				options: {
					name: "[name].[ext]?[hash]"
				}
			}
		]
	},
	resolve: {
		alias: {
			vue$: "vue/dist/vue.esm.js",
			icons: path.resolve(__dirname, "node_modules/vue-ionicons"),
			vuechartjs: path.resolve(__dirname, "node_modules/vue-chartjs")
		},
		extensions: ["*", ".ts", ".js", ".vue", ".json"]
	},
	devServer: {
		historyApiFallback: true,
		noInfo: true,
		overlay: true
	},
	performance: {
		hints: false
	},
	devtool: "#eval-source-map"
};

if (process.env.NODE_ENV === "production") {
	module.exports.devtool = "#source-map";
	// http://vue-loader.vuejs.org/en/workflow/production.html
	module.exports.plugins = (module.exports.plugins || []).concat([
		new webpack.DefinePlugin({
			"process.env": {
				NODE_ENV: '"production"'
			}
		}),
		new webpack.optimize.UglifyJsPlugin({
			sourceMap: true,
			compress: {
				warnings: false
			}
		}),
		new webpack.LoaderOptionsPlugin({
			minimize: true
		})
	]);
}
