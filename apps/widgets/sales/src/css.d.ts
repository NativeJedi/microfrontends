// css-loader with `modules.namedExport: false`: the default export maps the local class names
// of a CSS Module to the generated, app-prefixed ones.
declare module '*.module.css' {
  const classNames: Readonly<Record<string, string>>;
  export default classNames;
}

// Global CSS (design tokens, the shell's reset) is imported only for its side effect.
declare module '*.css';
