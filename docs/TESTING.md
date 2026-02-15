# Kimi IDE Testing Guide

Comprehensive testing documentation for the Kimi IDE VS Code Extension.

## Table of Contents

- [Overview](#overview)
- [Test Infrastructure](#test-infrastructure)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Structure](#test-structure)
- [Mocking](#mocking)
- [Coverage](#coverage)
- [CI/CD Integration](#cicd-integration)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

## Overview

Kimi IDE uses a multi-layered testing approach:

1. **Unit Tests** - Fast, isolated tests for individual functions and classes
2. **Integration Tests** - Tests for component interactions and workflows
3. **E2E Tests** - Full workflow tests using VS Code extension testing framework
4. **VS Code Integration Tests** - Tests running within actual VS Code instance

### Testing Stack

- **Jest** - Primary test runner for unit and integration tests
- **TypeScript** - Full TypeScript support via ts-jest
- **VS Code Test Framework** - For extension integration tests
- **Custom VS Code Mocks** - Mock implementation of VS Code API

## Test Infrastructure

### Directory Structure

```
__tests__/
├── __mocks__/           # Mock implementations
│   └── vscode.ts       # VS Code API mock
├── setup/              # Test setup files
│   ├── jest.setup.ts   # Jest configuration
│   └── jest.setup.e2e.ts # E2E test setup
├── fixtures/           # Test fixtures and sample files
├── unit/               # Unit tests
│   ├── utils/
│   ├── providers/
│   ├── context/
│   ├── agents/
│   └── kimi/
├── integration/        # Integration tests
└── e2e/                # End-to-end tests

src/test/               # VS Code Extension tests (Mocha)
├── suite/
│   └── *.test.ts
└── mocks/
    └── vscode.ts
```

### Configuration Files

- `jest.config.js` - Main Jest configuration
- `jest.config.e2e.js` - E2E test configuration
- `package.json` - Test scripts and dependencies

## Running Tests

### Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e

# Run VS Code extension tests
npm run test:vscode

# Run all test suites
npm run test:all

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI (with reporters)
npm run test:ci
```

### Test Commands Reference

| Command | Description |
|---------|-------------|
| `npm test` | Run VS Code extension tests |
| `npm run test:unit` | Run Jest unit tests |
| `npm run test:integration` | Run Jest integration tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:vscode` | Run VS Code integration tests |
| `npm run test:all` | Run all test suites |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:ci` | Run tests with CI configuration |

## Writing Tests

### Unit Tests

Unit tests should be fast, isolated, and focused on a single unit of code.

```typescript
import { functionToTest } from '../../src/utils/fileUtils';

describe('functionToTest', () => {
    it('should do something specific', () => {
        const result = functionToTest('input');
        expect(result).toBe('expected output');
    });

    it('should handle edge cases', () => {
        expect(() => functionToTest(null)).toThrow();
    });
});
```

### Integration Tests

Integration tests verify that multiple components work together correctly.

```typescript
describe('Feature Integration', () => {
    let provider: MyProvider;
    let service: MyService;

    beforeEach(() => {
        provider = new MyProvider();
        service = new MyService();
    });

    it('should work together', async () => {
        const result = await service.process(
            await provider.provideSomething()
        );
        expect(result).toBeDefined();
    });
});
```

### Using VS Code Mocks

Import the VS Code mock for tests that need VS Code API:

```typescript
import { createMockDocument, createMockEditor } from '../__mocks__/vscode';

jest.mock('vscode', () => require('../__mocks__/vscode'));

describe('Provider Tests', () => {
    it('should work with mock document', () => {
        const document = createMockDocument('console.log("test");', '/workspace/test.ts');
        expect(document.getText()).toBe('console.log("test");');
    });
});
```

### Available Mock Utilities

```typescript
// Documents
const document = createMockDocument(content, path, languageId);

// Editors
const editor = createMockEditor(document);

// Reset all mocks
resetMocks();

// Access mock instances
import { workspace, window, commands } from '../__mocks__/vscode';
```

## Test Structure

### File Naming

- Unit tests: `*.test.ts`
- Integration tests: `*.integration.test.ts` or in `integration/` folder
- E2E tests: `*.e2e.test.ts` or in `e2e/` folder

### Test Organization

```typescript
describe('ModuleName', () => {           // Top-level: Module/class being tested
    describe('MethodName', () => {       // Group: Method/function
        it('should do X when Y', () => { // Individual test case
            // Test implementation
        });

        it('should handle Z', () => {
            // Test implementation
        });
    });

    describe('Error Handling', () => {   // Group: Error scenarios
        it('should throw on invalid input', () => {
            // Test implementation
        });
    });
});
```

### Hooks

```typescript
describe('Test Suite', () => {
    beforeAll(() => {
        // Run once before all tests
    });

    beforeEach(() => {
        // Run before each test
    });

    afterEach(() => {
        // Run after each test
        jest.clearAllMocks();
    });

    afterAll(() => {
        // Run once after all tests
    });
});
```

## Mocking

### Mocking External Modules

```typescript
// Mock a module
jest.mock('external-module', () => ({
    function1: jest.fn(),
    function2: jest.fn().mockReturnValue('mocked'),
}));

// Mock with implementation
jest.mock('fs', () => ({
    readFileSync: jest.fn().mockReturnValue('mocked content'),
    writeFileSync: jest.fn(),
}));
```

### Mocking VS Code API

The VS Code mock is automatically available when you import from the mocks directory:

```typescript
import { window, workspace, commands } from '../__mocks__/vscode';

describe('VS Code Integration', () => {
    it('should show message', async () => {
        const spy = jest.spyOn(window, 'showInformationMessage');
        await myFunction();
        expect(spy).toHaveBeenCalled();
    });
});
```

### Spy and Mock Functions

```typescript
// Spy on method
const spy = jest.spyOn(object, 'method');

// Mock implementation
jest.spyOn(object, 'method').mockImplementation(() => 'mocked');

// Mock return value
jest.spyOn(object, 'method').mockReturnValue('value');

// Mock resolved value for async
jest.spyOn(object, 'method').mockResolvedValue({ data: 'value' });

// Mock rejected value
jest.spyOn(object, 'method').mockRejectedValue(new Error('Failed'));
```

## Coverage

### Coverage Configuration

Coverage is configured in `jest.config.js`:

```javascript
coverageThreshold: {
    global: {
        branches: 60,
        functions: 60,
        lines: 60,
        statements: 60
    }
}
```

### Coverage Reports

After running `npm run test:coverage`, reports are generated in:

- `coverage/lcov-report/index.html` - HTML report
- `coverage/lcov.info` - LCOV format for CI integration
- `coverage/coverage-final.json` - JSON format

### Viewing Coverage

```bash
# Generate and open HTML report
npm run test:coverage
open coverage/lcov-report/index.html
```

## CI/CD Integration

### GitHub Actions

The project includes a GitHub Actions workflow (`.github/workflows/test.yml`):

```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:ci
```

### CI Environment Variables

| Variable | Description |
|----------|-------------|
| `CI` | Set to `true` in CI environment |
| `NODE_ENV` | Set to `test` during tests |
| `KIMI_API_KEY` | API key for integration tests (optional) |

### Test Reports

CI generates:
- JUnit XML report: `reports/junit.xml`
- Coverage report: `coverage/lcov.info`

## Best Practices

### 1. Keep Tests Independent

Each test should be able to run independently:

```typescript
// Good
beforeEach(() => {
    resetMocks();
});

// Bad - tests depend on previous state
let sharedValue = 0;
it('test 1', () => { sharedValue = 1; });
it('test 2', () => { expect(sharedValue).toBe(1); }); // Fragile!
```

### 2. Use Descriptive Names

```typescript
// Good
it('should return null when file does not exist', () => { });

// Bad
it('test file utils', () => { });
```

### 3. Test Edge Cases

```typescript
describe('parseInput', () => {
    it('should handle normal input', () => { });
    it('should handle empty string', () => { });
    it('should handle null', () => { });
    it('should handle very long input', () => { });
    it('should handle special characters', () => { });
});
```

### 4. Avoid Testing Implementation Details

Test behavior, not implementation:

```typescript
// Good - test the outcome
it('should save file content', async () => {
    await saveFile('/path', 'content');
    expect(fs.writeFile).toHaveBeenCalledWith('/path', 'content');
});

// Bad - testing internal calls
it('should call helper function', async () => {
    const spy = jest.spyOn(module, 'helper');
    await saveFile('/path', 'content');
    expect(spy).toHaveBeenCalled(); // Fragile - implementation detail
});
```

### 5. Use TypeScript Properly

```typescript
// Good - properly typed
describe('typed function', () => {
    it('should handle valid input', () => {
        const result: ResultType = functionUnderTest('valid');
        expect(result.success).toBe(true);
    });
});
```

## Troubleshooting

### Common Issues

#### 1. "Cannot find module 'vscode'"

Make sure you've added the mock at the top of your test:

```typescript
jest.mock('vscode', () => require('../__mocks__/vscode'));
```

#### 2. Tests Timing Out

Increase timeout for slow tests:

```typescript
it('slow test', async () => {
    // Test code
}, 30000); // 30 second timeout
```

#### 3. VS Code API Not Working

Ensure you're using the mock properly:

```typescript
import { workspace } from '../__mocks__/vscode';

// Don't import from 'vscode' directly in tests
// import * as vscode from 'vscode'; // Wrong!
```

#### 4. Coverage Not Including Files

Check `collectCoverageFrom` in `jest.config.js`:

```javascript
collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    // Add exclusions as needed
]
```

### Debug Mode

Run tests with debug output:

```bash
npm run test:unit -- --verbose
```

### VS Code Extension Tests

For debugging VS Code extension tests:

```bash
# Run extension in development host
F5 in VS Code

# Run tests
npm run test:vscode
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [VS Code Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [TypeScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

---

For questions or issues with testing, please open an issue in the project repository.
