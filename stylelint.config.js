// Remotes may not ship global CSS: on one page it would restyle the shell and the other remotes,
// and the result would depend on which chunk loaded last. Global styles live in the shell
// (reset) and in @mf/tokens (custom properties). Dashboard widgets are remotes too — of the
// dashboard rather than of the shell, but they land on the same page, so the same rules apply.
const REMOTES = ['apps/{catalog,cart,account,dashboard}', 'apps/widgets/*'];
const GLOBAL_IN_REMOTE = 'is global; remotes style only their own CSS Module classes';

const moduleCss = REMOTES.map((remote) => `${remote}/**/*.module.css`);
const plainCss = REMOTES.map((remote) => `${remote}/**/!(*.module).css`);

module.exports = {
  rules: {
    'block-no-empty': true,
    'color-no-invalid-hex': true,
    'declaration-block-no-duplicate-properties': true,
  },
  overrides: [
    {
      files: moduleCss,
      rules: {
        'selector-max-type': [0, { message: `Type selector ${GLOBAL_IN_REMOTE}` }],
        'selector-max-universal': [0, { message: `Universal selector ${GLOBAL_IN_REMOTE}` }],
        'selector-max-id': [0, { message: `Id selector ${GLOBAL_IN_REMOTE}` }],
        'selector-pseudo-class-disallowed-list': [
          ['global', 'root'],
          { message: (pseudo) => `"${pseudo}" ${GLOBAL_IN_REMOTE}` },
        ],
        // @font-face is page-wide; @import would pull global CSS (e.g. the tokens) into a module.
        'at-rule-disallowed-list': [
          ['font-face', 'import'],
          { message: (atRule) => `"${atRule}" ${GLOBAL_IN_REMOTE}` },
        ],
      },
    },
    {
      // Without the .module.css suffix css-loader does not scope class names at all.
      files: plainCss,
      rules: {
        'selector-disallowed-list': [
          ['/./'],
          { message: 'Remote CSS must be a CSS Module (*.module.css), plain .css is global' },
        ],
      },
    },
  ],
};
