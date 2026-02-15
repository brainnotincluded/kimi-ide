/**
 * Jest Setup File for E2E Tests
 */

import './jest.setup';

// E2E specific setup
beforeAll(async () => {
    // Wait for any async initialization
    await new Promise(resolve => setTimeout(resolve, 1000));
});

afterAll(async () => {
    // Cleanup E2E resources
});
