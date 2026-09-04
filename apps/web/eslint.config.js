// Reuses the monorepo's shared flat config. Kept intentionally simple per the project's own
// convention (see ../../eslint.config.js) rather than bolting on a separate React lint stack.
import rootConfig from '../../eslint.config.js';

export default [
  ...rootConfig,
  {
    rules: {
      // JSX files intentionally export components alongside small local helpers/constants.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
];
