import type { Config } from 'jest';

const moduleFileExtensions = ['ts', 'js', 'json'];

const transform = {
  '^.+\\.ts$': [
    'ts-jest',
    {
      tsconfig: 'tsconfig.spec.json',
      useESM: true,
    },
  ],
};

// Source files import each other with a `.js` extension, which is what Node's ESM loader
// needs; ts-jest resolves the TypeScript file behind it.
const moduleNameMapper = {
  '^(\\.{1,2}/.*)\\.js$': '$1',
};

const coverage = {
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/', '/test/', '.module.ts$', 'main.ts$'],
};

const config: Config = {
  extensionsToTreatAsEsm: ['.ts'],

  // Half the cores locally, two in CI where runners are small.
  maxWorkers: process.env.CI ? 2 : '50%',
  bail: process.env.CI ? 1 : 0,
  verbose: process.env.CI === 'true',

  projects: [
    {
      displayName: 'unit',
      preset: 'ts-jest/presets/default-esm',
      testEnvironment: 'node',
      moduleFileExtensions,
      rootDir: '.',
      testMatch: ['<rootDir>/test/unit/**/*.spec.ts'],
      testPathIgnorePatterns: ['<rootDir>/test/e2e/', '<rootDir>/dist/'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/unit.setup.ts'],
      transform,
      moduleNameMapper,
      testTimeout: 5000,
      ...coverage,
    },
    {
      displayName: 'e2e',
      preset: 'ts-jest/presets/default-esm',
      testEnvironment: 'node',
      moduleFileExtensions,
      rootDir: '.',
      testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
      setupFilesAfterEnv: ['<rootDir>/test/setup/e2e.setup.ts'],
      transform,
      moduleNameMapper,
      testTimeout: 30000,
      ...coverage,
    },
  ],
};

export default config;
