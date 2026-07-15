/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'import', 'react-hooks'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  rules: {
    // TypeScript hygiene
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

    // Code smells
    'no-console': 'error',
    'no-unused-vars': 'off', // handled by @typescript-eslint
    // Underscore-prefixed args/vars are intentionally unused — e.g. Express
    // error-handler middleware requires all 4 params even when some go unused.
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    complexity: ['error', 10],

    // React hooks — applies to app workspace only, no-op elsewhere
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // Architecture boundaries — core/ cannot import from app/
    'import/no-restricted-paths': [
      'error',
      {
        zones: [
          {
            target: './app/core',
            from: './app/app',
            message: 'core/ must not import from app/. Keep core/ navigation-agnostic.',
          },
        ],
      },
    ],
  },
  overrides: [
    // Backend — add security plugin
    {
      files: ['backend/**/*.ts'],
      plugins: ['security'],
      rules: {
        // eslint-plugin-security v3 only ships flat config, so its
        // recommended ruleset is reproduced here instead of extended.
        'security/detect-buffer-noassert': 'warn',
        'security/detect-child-process': 'warn',
        'security/detect-disable-mustache-escape': 'warn',
        'security/detect-eval-with-expression': 'warn',
        'security/detect-new-buffer': 'warn',
        'security/detect-no-csrf-before-method-override': 'warn',
        'security/detect-non-literal-fs-filename': 'warn',
        'security/detect-non-literal-regexp': 'warn',
        'security/detect-non-literal-require': 'warn',
        'security/detect-object-injection': 'warn',
        'security/detect-possible-timing-attacks': 'warn',
        'security/detect-pseudoRandomBytes': 'warn',
        'security/detect-unsafe-regex': 'warn',
        'security/detect-bidi-characters': 'warn',

        // Cross-domain imports forbidden in backend services
        'import/no-restricted-paths': [
          'error',
          {
            zones: [
              {
                target: './backend/src/domains/jobs',
                from: './backend/src/domains/auth',
                message: 'Cross-domain imports are not allowed. Use dependency injection.',
              },
              {
                target: './backend/src/domains/applications',
                from: './backend/src/domains/auth',
                message: 'Cross-domain imports are not allowed. Use dependency injection.',
              },
            ],
          },
        ],
      },
    },
    // App — components must consume design tokens through the composed
    // `Theme` (useTheme()), never by importing the raw `tokens.ts` directly.
    // Only `core/theme/` itself (theme.ts, index.ts) may touch tokens.
    {
      files: ['app/**/*.ts', 'app/**/*.tsx'],
      excludedFiles: ['app/core/theme/**'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['**/theme/tokens', '**/tokens'],
                message:
                  'Do not import tokens.ts directly — consume the composed Theme via useTheme() (core/theme is the only place allowed to read raw tokens).',
              },
            ],
          },
        ],
      },
    },
    // App — accessibility rules (A4 Decision 8): missing roles/labels on
    // touchables, a11y state on toggles, touch-target hints. RN components
    // only, so scoped to .tsx under app/.
    {
      files: ['app/**/*.tsx'],
      plugins: ['react-native-a11y'],
      extends: ['plugin:react-native-a11y/all'],
    },
    // Test files — relax some rules
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    '.expo/',
    'coverage/',
    '*.js', // ignore JS config files from linting
  ],
}
