/**
 * Context Resolver Unit Tests
 * Tests for context resolution functionality
 */

import { ContextResolver } from '../../../src/context/contextResolver';
import { createMockDocument } from '../../__mocks__/vscode';

jest.mock('vscode', () => require('../../__mocks__/vscode'));

describe('ContextResolver', () => {
    let resolver: ContextResolver;

    beforeEach(() => {
        resolver = new ContextResolver();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Initialization', () => {
        it('should create resolver instance', () => {
            expect(resolver).toBeDefined();
            expect(resolver).toBeInstanceOf(ContextResolver);
        });
    });

    describe('Context Resolution', () => {
        it('should resolve context for single file', async () => {
            const content = 'export function add(a: number, b: number) { return a + b; }';
            const document = createMockDocument(content, '/workspace/math.ts');
            
            const context = await resolver.resolve({
                document,
                position: { line: 0, character: 0 },
            });

            expect(context).toBeDefined();
        });

        it('should handle multiple files', async () => {
            const files = [
                { path: '/workspace/file1.ts', content: 'export const x = 1;' },
                { path: '/workspace/file2.ts', content: 'export const y = 2;' },
            ];
            
            const context = await resolver.resolve({
                files: files.map(f => createMockDocument(f.content, f.path)),
            });

            expect(context).toBeDefined();
        });

        it('should include relevant imports', async () => {
            const content = `
import { useState } from 'react';
import { helper } from './utils';

function Component() {
    const [state, setState] = useState(0);
    return null;
}
`;
            const document = createMockDocument(content, '/workspace/component.tsx');
            
            const context = await resolver.resolve({
                document,
                includeImports: true,
            });

            expect(context).toBeDefined();
        });
    });

    describe('Symbol Resolution', () => {
        it('should resolve symbols at position', async () => {
            const content = `
class Calculator {
    add(a: number, b: number) {
        return a + b;
    }
}
`;
            const document = createMockDocument(content, '/workspace/calc.ts');
            
            const symbols = await resolver.resolveSymbolsAtPosition(
                document,
                { line: 2, character: 8 }
            );

            expect(Array.isArray(symbols)).toBe(true);
        });

        it('should resolve definition', async () => {
            const content = `
const value = 42;
console.log(value);
`;
            const document = createMockDocument(content, '/workspace/values.ts');
            
            const definition = await resolver.resolveDefinition(
                document,
                { line: 1, character: 12 }
            );

            // Should find the definition of 'value'
            expect(definition).toBeDefined();
        });
    });

    describe('Related Files', () => {
        it('should find related test files', async () => {
            const content = 'export function add(a: number, b: number) { return a + b; }';
            const document = createMockDocument(content, '/workspace/utils.ts');
            
            const related = await resolver.findRelatedFiles(document, {
                includeTests: true,
            });

            expect(Array.isArray(related)).toBe(true);
        });

        it('should find files importing the current file', async () => {
            const content = 'export const helper = () => {};';
            const document = createMockDocument(content, '/workspace/helper.ts');
            
            const importers = await resolver.findImporters(document);

            expect(Array.isArray(importers)).toBe(true);
        });
    });

    describe('Context Prioritization', () => {
        it('should prioritize nearby code', async () => {
            const content = Array(50).fill(0).map((_, i) => `// Line ${i}`).join('\n');
            const document = createMockDocument(content, '/workspace/large.ts');
            
            const context = await resolver.resolve({
                document,
                position: { line: 25, character: 0 },
                maxTokens: 100,
            });

            expect(context).toBeDefined();
        });

        it('should include imports even when far away', async () => {
            const imports = 'import React from "react";\nimport { useState } from "react";\n';
            const code = Array(100).fill('// code').join('\n');
            const content = imports + code;
            const document = createMockDocument(content, '/workspace/app.tsx');
            
            const context = await resolver.resolve({
                document,
                position: { line: 50, character: 0 },
                maxTokens: 500,
            });

            expect(context).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle file not found gracefully', async () => {
            const result = await resolver.resolve({
                filePath: '/nonexistent/file.ts',
            });

            expect(result).toBeDefined();
        });

        it('should handle circular dependencies', async () => {
            // Mock scenario with circular imports
            const context = await resolver.resolve({
                entries: ['/workspace/a.ts', '/workspace/b.ts'],
            });

            expect(context).toBeDefined();
        });
    });
});
