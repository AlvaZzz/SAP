/** Pruebas unitarias (services y guards, con Prisma simulado — sin BD). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: 'src',
  testMatch: ['**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { diagnostics: false }] },
  clearMocks: true,
};
