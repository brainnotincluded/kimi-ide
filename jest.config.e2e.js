/**
 * Jest Configuration for E2E Tests
 * End-to-end tests for Kimi IDE
 */

module.exports = {
    ...require('./jest.config.js'),
    
    // E2E test setup
    testMatch: [
        '**/__tests__/e2e/**/*.test.ts'
    ],
    
    // Longer timeout for E2E tests
    testTimeout: 60000,
    
    // Setup for E2E tests
    setupFilesAfterEnv: [
        '<rootDir>/__tests__/setup/jest.setup.e2e.ts'
    ],
    
    // Don't run E2E tests in parallel
    maxWorkers: 1,
    
    // No coverage for E2E tests
    collectCoverage: false,
    
    // Verbose for debugging
    verbose: true
};
