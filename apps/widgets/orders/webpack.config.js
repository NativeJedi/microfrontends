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
      // Chunks and assets are resolved relative to the script that loaded them, so this widget
      // still fetches its chunks from its own origin when the dashboard loads it.
      publicPath: 'auto',
      uniqueName: 'widget_orders',
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
        // `.card` in this widget and `.card` in a sibling widget become different classes on one page.
        {
          test: /\.module\.css$/,
          use: [
            styleLoader,
            {
              loader: 'css-loader',
              options: {
                modules: {
                  localIdentName: 'widget_orders__[local]__[hash:base64:5]',
                  namedExport: false,
                },
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
        name: 'widget_orders',
        filename: 'remoteEntry.js',
        // Two faces of one deployment: a card for the dashboard grid and a whole application with its
        // own routes for /dashboard/orders. Same bundle, same share scope, same team.
        exposes: {
          './Widget': './src/exposed/Widget.tsx',
          './App': './src/exposed/App.tsx',
        },
        // The widget is a host too — of the shell's own container. That closes the circle
        // shell → dashboard → widget_orders → shell, and it is how the shell's dashboard filter reaches
        // this widget without the dashboard forwarding anything (ADR 0016).
        remotes: {
          shell: 'shell@http://localhost:3000/remoteEntry.js',
        },
        // The same singletons the shell and the dashboard declare. The widget is the third level of
        // federation: the dashboard hands it the share scope it got from the shell, so a singleton
        // listed here resolves to the shell's instance instead of a second copy.
        shared: {
          react: { singleton: true, requiredVersion: `^${reactVersion}`, strictVersion: false },
          'react-dom': {
            singleton: true,
            requiredVersion: `^${reactDomVersion}`,
            strictVersion: false,
          },
          // Shared since this widget became an application: its `./App` renders descendant <Routes> and
          // must read the shell's location. The `./Widget` card still renders no router of its own.
          'react-router': {
            singleton: true,
            requiredVersion: `^${reactRouterVersion}`,
            strictVersion: false,
          },
          // One QueryClient context and one cache: two widgets asking for /orders make one request.
          '@tanstack/react-query': {
            singleton: true,
            requiredVersion: `^${reactQueryVersion}`,
            strictVersion: false,
          },
          // One i18n instance: the shell owns it, and every app adds its namespace to it.
          i18next: { singleton: true, requiredVersion: `^${i18nextVersion}`, strictVersion: false },
          'react-i18next': {
            singleton: true,
            requiredVersion: `^${reactI18nextVersion}`,
            strictVersion: false,
          },
          // One service container context: the shell's <ServicesProvider> must reach this widget.
          '@mf/services': {
            singleton: true,
            requiredVersion: `^${servicesVersion}`,
            strictVersion: false,
          },
        },
      }),
      new HtmlWebpackPlugin({ template: './public/index.html', publicPath: '/' }),
      ...(isProduction ? [new MiniCssExtractPlugin()] : []),
    ],
    devServer: {
      port: 3012,
      historyApiFallback: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  };
};
