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
      // 'auto' since the shell became a remote too: its `remoteEntry.js` and the chunks behind it are
      // loaded by widgets running on another origin, and those chunks must come from :3000, not from the
      // widget's own page. The absolute "/main.js" that a refresh of /catalog/p1 needs is set on
      // HtmlWebpackPlugin instead (see docs/notes/10-nested.md).
      publicPath: 'auto',
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
        // The shell is a host *and* a remote: it publishes the dashboard filter it owns. The container
        // graph is therefore circular — shell → dashboard → widget_orders → shell (ADR 0016).
        filename: 'remoteEntry.js',
        exposes: {
          './store': './src/exposed/store.ts',
        },
        // Static remote URLs for now; they become runtime config in iteration 09.
        remotes: {
          // The shell's own container. Its main bundle and its remoteEntry.js are two webpack runtimes
          // with two module caches, so the only way for the shell's own components to share one store
          // instance with the widgets is to go through the container as everybody else does.
          shell: 'shell@http://localhost:3000/remoteEntry.js',
          catalog: 'catalog@http://localhost:3001/remoteEntry.js',
          cart: 'cart@http://localhost:3002/remoteEntry.js',
          account: 'account@http://localhost:3003/remoteEntry.js',
          // A remote that is itself a host: it loads the widgets with the share scope it gets here.
          dashboard: 'dashboard@http://localhost:3004/remoteEntry.js',
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
      // publicPath '/' only for the page: a refresh of /catalog/p1 must load /main.js, not ./main.js.
      // excludeChunks: the container entry must NOT be a <script> on this page. It is loaded on demand under
      // its absolute URL (`shell@http://localhost:3000/remoteEntry.js`), and webpack dedupes script tags by
      // their exact `src`: a tag with `/remoteEntry.js` would not match, so the file would execute twice and
      // the page would end up with two `shell` containers — two module caches, two stores (ADR 0016).
      new HtmlWebpackPlugin({
        template: './public/index.html',
        publicPath: '/',
        excludeChunks: ['shell'],
      }),
      ...(isProduction ? [new MiniCssExtractPlugin()] : []),
    ],
    devServer: {
      port: 3000,
      historyApiFallback: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  };
};
