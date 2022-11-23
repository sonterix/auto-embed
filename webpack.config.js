const path = require('path')

const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const CopyPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')

module.exports = {
  mode: 'production',
  entry: path.join(__dirname, 'src', 'v2.js'),
  output: {
    filename: '[name].[fullhash].min.js',
    path: path.join(__dirname, 'build')
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader'
        }
      }
    ]
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CopyPlugin({
      patterns: [{ from: path.join(__dirname, 'public', 'assets'), to: path.join(__dirname, 'build', 'assets') }]
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'public', 'index.html'),
      filename: 'index.html',
      inject: 'head',
      scriptLoading: 'defer'
    })
  ]
}
