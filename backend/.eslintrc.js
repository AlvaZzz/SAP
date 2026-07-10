// ESLint del backend (NestJS + TypeScript). Reglas de correctitud, no de estilo:
// el formato lo maneja Prettier (eslint-config-prettier desactiva reglas que
// chocarían). Se ejecuta sin type-checking del proyecto para ser rápido; la
// verificación estricta de tipos la da `npm run typecheck` (tsc).
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 2021, sourceType: 'module' },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: { node: true, jest: true },
  ignorePatterns: ['dist', 'node_modules', '*.js'],
  rules: {
    // Imports/variables sin usar: error, pero permitiendo el prefijo "_" para
    // parámetros deliberadamente ignorados.
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    // El código usa castings puntuales (`as never`) en tests y mocks; se avisa,
    // no se bloquea, para no forzar reescrituras que no aportan.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-empty-function': 'off',
  },
};
