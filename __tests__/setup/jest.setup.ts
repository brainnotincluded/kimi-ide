/**
 * Jest Setup File
 * Runs after Jest is initialized but before tests
 */

import 'jest-extended/all';

// Set up test environment
beforeAll(() => {
    // Any global setup before all tests
    process.env.NODE_ENV = 'test';
});

afterAll(() => {
    // Any global cleanup after all tests
});

beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
});

afterEach(() => {
    // Clean up after each test
    jest.restoreAllMocks();
});

// Handle unhandled promises
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global test utilities
global.expect.extend({
    toBeWithinRange(received: number, floor: number, ceiling: number) {
        const pass = received >= floor && received <= ceiling;
        if (pass) {
            return {
                message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
                pass: true
            };
        } else {
            return {
                message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
                pass: false
            };
        }
    }
});
