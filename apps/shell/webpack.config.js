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
        // CSS Modules: class names are local to the file and prefixed with the app name, so
        // `.button` in catalog and `.button` in cart become different classes on one page.
        {
          test: /\.module\.css$/,
          use: [
            styleLoader,
            {
              loader: 'css-loader',
              options: {
                modules: { localIdentName: 'shell__[local]__[hash:base64:5]', namedExport: false },
              },
            },
          ],
        },
        // Global CSS: design tokens and the reset.
        {
          test: /\.css$/,
          exclude: /\.module\.css$/,
          use: [styleLoader, { loader: 'css-loader', options: { modules: false } }],
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
          // One service container context: the shell's <ServicesProvider> must reach every remote.
          // A workspace package, shared only because its module holds the React context identity.
          '@mf/services': {
            singleton: true,
            requiredVersion: `^${servicesVersion}`,
            strictVersion: false,
          },
        },
      }),
      new HtmlWebpackPlugin({ template: './public/index.html' }),
      ...(isProduction ? [new MiniCssExtractPlugin()] : []),
    ],
    devServer: {
      port: 3000,
      historyApiFallback: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  };
};
