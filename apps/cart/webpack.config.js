const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

// pnpm catalogs leave "catalog:" in package.json, which is not a semver range, so webpack
// cannot infer requiredVersion from it. Take the installed version instead.
const reactVersion = require('react/package.json').version;
const reactDomVersion = require('react-dom/package.json').version;
const reactRouterVersion = require('react-router/package.json').version;
const reactQueryVersion = require('@tanstack/react-query/package.json').version;
const i18nextVersion = require('i18next/package.json').version;
const reactI18nextVersion = require('react-i18next/package.json').version;
const servicesVersion = require('@mf/services/package.json').version;

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  // Dev: <style> tags injected by JS (fast reloads). Production: real .css files loaded with
  // <link>, for the shell and for remote chunks alike (from the remote's own publicPath).
  const styleLoader = isProduction ? MiniCssExtractPlugin.loader : 'style-loader';

  return {
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
        // CSS Modules: class names are local to the file and prefixed with the app name, so
        // `.button` in catalog and `.button` in cart become different classes on one page.
        {
          test: /\.module\.css$/,
          use: [
            styleLoader,
            {
              loader: 'css-loader',
              options: {
                modules: { localIdentName: 'cart__[local]__[hash:base64:5]', namedExport: false },
              },
            },
          ],
        },
        // Global CSS: design tokens, imported only by the standalone bootstrap.
        {
          test: /\.css$/,
          exclude: /\.module\.css$/,
          use: [styleLoader, { loader: 'css-loader', options: { modules: false } }],
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
          // Cart state for other micro-frontends: one instance per page, owned by cart (ADR 0009).
          './store': './src/exposed/store.ts',
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
          // One QueryClient context and one cache: the shell's provider must reach every remote.
          '@tanstack/react-query': {
            singleton: true,
            requiredVersion: `^${reactQueryVersion}`,
            strictVersion: false,
          },
          // One i18n instance: the shell owns it, and every remote adds its namespace to it.
          i18next: { singleton: true, requiredVersion: `^${i18nextVersion}`, strictVersion: false },
          'react-i18next': {
            singleton: true,
            requiredVersion: `^${reactI18nextVersion}`,
            strictVersion: false,
          },
          // One service container context: the shell's <ServicesProvider> must reach this remote.
          '@mf/services': {
            singleton: true,
            requiredVersion: `^${servicesVersion}`,
            strictVersion: false,
          },
        },
      }),
      // Standalone page only: an absolute script URL keeps nested URLs working
      // after a refresh. Chunks still use publicPath 'auto' when the shell loads this remote.
      new HtmlWebpackPlugin({ template: './public/index.html', publicPath: '/' }),
      ...(isProduction ? [new MiniCssExtractPlugin()] : []),
    ],
    devServer: {
      port: 3002,
      historyApiFallback: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  };
};
