/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint',
    'import',
    'react-hooks',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    // TypeScript hygiene
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

    // Code smells
    'no-console': 'error',
    'no-unused-vars': 'off', // handled by @typescript-eslint
    '@typescript-eslint/no-unused-vars': 'error',
    'complexity': ['error', 10],

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
      extends: ['plugin:security/recommended'],
      rules: {
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
