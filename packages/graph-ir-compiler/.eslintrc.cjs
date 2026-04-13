module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { project: false, sourceType: 'module', ecmaVersion: 2022 },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: { node: true, es2022: true },
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/consistent-type-imports': 'error',
    'no-console': 'warn',
  },
  ignorePatterns: ['dist', 'node_modules'],
};
