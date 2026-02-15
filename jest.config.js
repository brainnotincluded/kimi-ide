/**
 * Jest Configuration for Kimi IDE
 * Comprehensive test setup for VS Code Extension with TypeScript
 */

module.exports = {
    // Use ts-jest for TypeScript support
    preset: 'ts-jest',
    
    // Test environment
    testEnvironment: 'node',
    
    // Root directories for test discovery
    roots: [
        '<rootDir>/src',
        '<rootDir>/__tests__'
    ],
    
    // Test file patterns
    testMatch: [
        '**/__tests__/**/*.test.ts',
        '**/?(*.)+(spec|test).ts',
        '!**/out/**',
        '!**/dist/**',
        '!**/node_modules/**'
    ],
    
    // TypeScript transformation
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: {
                    target: 'ES2022',
                    module: 'commonjs',
                    esModuleInterop: true,
                    strict: true,
                    skipLibCheck: true,
                    resolveJsonModule: true
                }
            }
        ]
    },
    
    // Module file extensions
    moduleFileExtensions: [
        'ts',
        'tsx',
        'js',
        'jsx',
        'json',
        'node'
    ],
    
    // Module path aliases (if any)
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@test/(.*)$': '<rootDir>/__tests__/$1',
        '^@mocks/(.*)$': '<rootDir>/__tests__/__mocks__/$1'
    },
    
    // Setup files to run after Jest is initialized
    setupFilesAfterEnv: [
        '<rootDir>/__tests__/setup/jest.setup.ts'
    ],
    
    // Coverage configuration
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/test/**',
        '!src/**/index.ts',
        '!src/**/types.ts',
        '!src/extension.ts', // Main entry point, tested via integration
        '!src/**/*.test.ts',
        '!src/**/__tests__/**',
        '!src/remix/**', // Separate CLI tool
        '!src/trench/**', // Separate CLI tool
        '!src/mcp/**', // External MCP servers
        '!src/review/**' // Separate tool
    ],
    
    // Coverage directory
    coverageDirectory: '<rootDir>/coverage',
    
    // Coverage reporters
    coverageReporters: [
        'text',
        'text-summary',
        'lcov',
        'html',
        'json'
    ],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 60,
            functions: 60,
            lines: 60,
            statements: 60
        },
        './src/utils/': {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        },
        './src/kimi/': {
            branches: 60,
            functions: 60,
            lines: 60,
            statements: 60
        }
    },
    
    // Paths to ignore
    testPathIgnorePatterns: [
        '/node_modules/',
        '/out/',
        '/dist/',
        '/.vscode-test/',
        '/src/remix/',
        '/src/trench/',
        '/src/mcp/',
        '/src/review/'
    ],
    
    // Transform ignore patterns
    transformIgnorePatterns: [
        'node_modules/(?!(vscode|@vscode)/)'
    ],
    
    // Verbose output
    verbose: true,
    
    // Clear mocks between tests
    clearMocks: true,
    
    // Restore mocks after each test
    restoreMocks: true,
    
    // Maximum workers
    maxWorkers: '50%',
    
    // Fail on console errors in CI
    errorOnDeprecated: true,
    
    // Test timeout
    testTimeout: 10000,
    
    // Display individual test results
    verbose: true,
    
    // Reporters
    reporters: [
        'default',
        [
            'jest-junit',
            {
                outputDirectory: './reports',
                outputName: 'junit.xml',
                classNameTemplate: '{classname}',
                titleTemplate: '{title}',
                ancestorSeparator: ' › '
            }
        ]
    ],
    
    // Global variables
    globals: {
        'ts-jest': {
            diagnostics: {
                ignoreCodes: [151001]
            }
        }
    }
};
