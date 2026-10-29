const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { ModuleFederationPlugin } = require('webpack').container;

// pnpm catalogs leave "catalog:" in package.json, which is not a semver range, so webpack
// cannot infer requiredVersion from it. Take the installed version instead.
const reactVersion = require('react/package.json').version;
const reactDomVersion = require('react-dom/package.json').version;
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
      // Chunks and assets are resolved relative to the script that loaded them, so this remote
      // still fetches its chunks from its own origin when the shell loads it.
      publicPath: 'auto',
      uniqueName: 'dashboard',
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
        // `.card` here and `.card` in a widget become different classes on one page.
        {
          test: /\.module\.css$/,
          use: [
            styleLoader,
            {
              loader: 'css-loader',
              options: {
                modules: {
                  localIdentName: 'dashboard__[local]__[hash:base64:5]',
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
      // The only app in the repo that is both: a remote for the shell (`exposes`) and a host for the
      // widgets (`remotes`). One ModuleFederationPlugin covers both roles — a container can expose and
      // consume at the same time, and a single `shared` block serves both directions.
      new ModuleFederationPlugin({
        name: 'dashboard',
        filename: 'remoteEntry.js',
        exposes: {
          './App': './src/exposed/App.tsx',
        },
        // Static widget URLs, as in iteration 00's shell: adding a widget to the API registry is not
        // enough, this list and a rebuild are needed too. Iteration 09's `loadRemote` is what removes
        // them from the build — see docs/notes/10-nested.md.
        remotes: {
          widget_sales: 'widget_sales@http://localhost:3011/remoteEntry.js',
          widget_orders: 'widget_orders@http://localhost:3012/remoteEntry.js',
          widget_reviews: 'widget_reviews@http://localhost:3013/remoteEntry.js',
        },
        // The same singletons the shell declares, with the same options. The dashboard does not create a
        // second share scope for its widgets: when the shell initializes this container it hands over its
        // own scope, and the widgets are initialized with that very object. One React for all three levels.
        shared: {
          react: { singleton: true, requiredVersion: `^${reactVersion}`, strictVersion: false },
          'react-dom': {
            singleton: true,
            requiredVersion: `^${reactDomVersion}`,
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
          // One service container context: the shell's <ServicesProvider> must reach the widgets through
          // this remote, so the dashboard shares it exactly like the shell does.
          '@mf/services': {
            singleton: true,
            requiredVersion: `^${servicesVersion}`,
            strictVersion: false,
          },
        },
      }),
      // Standalone page only: an absolute script URL keeps a refresh of /dashboard working.
      // Chunks still use publicPath 'auto' when the shell loads this remote.
      new HtmlWebpackPlugin({ template: './public/index.html', publicPath: '/' }),
      ...(isProduction ? [new MiniCssExtractPlugin()] : []),
    ],
    devServer: {
      port: 3004,
      historyApiFallback: true,
      headers: { 'Access-Control-Allow-Origin': '*' },
    },
  };
};
