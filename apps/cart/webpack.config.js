const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

// pnpm catalogs leave "catalog:" in package.json, which is not a semver range, so webpack
// cannot infer requiredVersion from it. Take the installed version instead.
const reactVersion = require('react/package.json').version;
const reactDomVersion = require('react-dom/package.json').version;
const reactRouterVersion = require('react-router/package.json').version;

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
        './App': './src/exposed/App.tsx',
        './CartWidget': './src/exposed/CartWidget.tsx',
      },
      shared: {
        react: { singleton: true, requiredVersion: `^${reactVersion}`, strictVersion: false },
        'react-dom': {
          singleton: true,
          requiredVersion: `^${reactDomVersion}`,
          strictVersion: false,
        },
        // One router instance: the shell's <BrowserRouter> context must reach every remote.
        'react-router': {
          singleton: true,
          requiredVersion: `^${reactRouterVersion}`,
          strictVersion: false,
        },
      },
    }),
    // Standalone page only: an absolute script URL keeps nested URLs working
    // after a refresh. Chunks still use publicPath 'auto' when the shell loads this remote.
    new HtmlWebpackPlugin({ template: './public/index.html', publicPath: '/' }),
  ],
  devServer: {
    port: 3002,
    historyApiFallback: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
};
