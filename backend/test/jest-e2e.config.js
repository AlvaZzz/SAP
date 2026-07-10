/**
 * Pruebas end-to-end del flujo crítico de la tesis. Corren por HTTP contra el
 * stack real de Docker (API + PostgreSQL sembrados):  docker compose up -d
 * Ejecutar:  npm run test:e2e   (usa --runInBand: el flujo es secuencial)
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/*.e2e-spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { diagnostics: false }] },
  testTimeout: 30000,
};
