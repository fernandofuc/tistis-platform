// =====================================================
// TIS TIS PLATFORM - Jest Configuration
// =====================================================

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
});

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    // Handle module aliases (matching tsconfig.json paths)
    // IMPORTANT: Order matters - more specific paths MUST come first
    //
    // 1. Most specific paths first (src/shared, src/features)
    '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/features/(.*)$': '<rootDir>/src/features/$1',
    '^@/src/shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/src/features/(.*)$': '<rootDir>/src/features/$1',
    '^@/src/(.*)$': '<rootDir>/src/$1',
    // 2. Root-level directories
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/hooks/(.*)$': '<rootDir>/src/hooks/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@/types/(.*)$': '<rootDir>/src/types/$1',
    // 3. Fallback to root for unmatched paths (MUST be last)
    '^@/(.*)$': '<rootDir>/$1',
  },
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/.next/',
    '\\.d\\.ts$', // Ignore TypeScript declaration files
    '<rootDir>/lib/voice-agent/', // Vitest tests - run with `npm run test:vitest`
    '<rootDir>/lib/feature-flags/__tests__/', // Vitest tests
    // Voice agent tests converted to Vitest
    '<rootDir>/__tests__/voice-agent/webhooks/',
    '<rootDir>/__tests__/voice-agent/tools/',
    '<rootDir>/__tests__/voice-agent/rag/',
    '<rootDir>/__tests__/voice-agent/langgraph/',
    '<rootDir>/__tests__/voice-agent/security/',
    '<rootDir>/__tests__/voice-agent/performance/',
    '<rootDir>/__tests__/voice-agent/types/',
    // Shared lib tests converted to Vitest
    '<rootDir>/__tests__/shared/lib/admin-auth.test.ts',
    '<rootDir>/__tests__/shared/lib/rate-limit-unified.test.ts',
    '<rootDir>/__tests__/shared/lib/rate-limit-migration.test.ts',
    '<rootDir>/__tests__/shared/lib/structured-logger.test.ts',
    // Component tests migrated to Vitest
    '<rootDir>/__tests__/components/',
    // Voice agent wizard tests migrated to Vitest
    '<rootDir>/__tests__/voice-agent/wizard/',
  ],
  transform: {
    // Use babel-jest to transpile tests
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  transformIgnorePatterns: [
    '/node_modules/',
    '^.+\\.module\\.(css|sass|scss)$',
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig);
