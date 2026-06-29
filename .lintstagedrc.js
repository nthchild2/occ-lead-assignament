module.exports = {
  '**/*.{ts,tsx}': [
    'eslint --fix',
    'prettier --write',
    () => 'tsc -p packages/shared/tsconfig.json --noEmit',
    () => 'tsc -p backend/tsconfig.json --noEmit',
    () => 'tsc -p app/tsconfig.json --noEmit',
  ],
  '**/*.{js,json,md}': ['prettier --write'],
}
