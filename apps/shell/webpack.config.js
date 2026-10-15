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
    // The shell is always served from the site root. 'auto' would make index.html load
    // a relative "main.js", which breaks on refresh of a nested URL such as /catalog/p1.
    publicPath: '/',
    uniqueName: 'shell',
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
      name: 'shell',
      // Static remote URLs for now; they become runtime config in iteration 09.
      remotes: {
        catalog: 'catalog@http://localhost:3001/remoteEntry.js',
        cart: 'cart@http://localhost:3002/remoteEntry.js',
        account: 'account@http://localhost:3003/remoteEntry.js',
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
    new HtmlWebpackPlugin({ template: './public/index.html' }),
  ],
  devServer: {
    port: 3000,
    historyApiFallback: true,
    headers: { 'Access-Control-Allow-Origin': '*' },
  },
};
