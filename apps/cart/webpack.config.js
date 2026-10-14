const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

module.exports = {
  entry: './src/index.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    // Chunks and assets are resolved relative to the script that loaded them,
    // so a remote loaded by the shell still fetches its chunks from its own origin.
    publicPath: 'auto',
    uniqueName: 'cart',
    clean: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        loader: 'swc-loader',
        options: {
          jsc: {
            parser: { syntax: 'typescript', tsx: true },
            transform: { react: { runtime: 'automatic' } },
            target: 'es2022',
          },
        },
      },
    ],
  },
  plugins: [
    new ModuleFederationPlugin({
      name: 'cart',
      filename: 'remoteEntry.js',
      exposes: {
        './CartWidget': './src/exposed/CartWidget.tsx',
      },
      shared: { react: {}, 'react-dom': {} },
    }),
    new HtmlWebpackPlugin({ template: './public/index.html' }),
  ],
  devServer: {
    port: 3002,
    historyApiFallback: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
};
