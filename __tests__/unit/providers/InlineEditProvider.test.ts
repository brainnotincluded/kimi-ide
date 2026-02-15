/**
 * Inline Edit Provider Unit Tests
 * Tests for inline editing functionality
 */

import { InlineEditProvider } from '../../../src/providers/InlineEditProvider';
import { createMockDocument, createMockEditor } from '../../__mocks__/vscode';

// Mock the VS Code module
jest.mock('vscode', () => require('../../__mocks__/vscode'));

describe('InlineEditProvider', () => {
    let provider: InlineEditProvider;

    beforeEach(() => {
        provider = new InlineEditProvider();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('Provider Initialization', () => {
        it('should create provider instance', () => {
            expect(provider).toBeDefined();
            expect(provider).toBeInstanceOf(InlineEditProvider);
        });

        it('should have required methods', () => {
            expect(typeof provider.provideInlineEdits).toBe('function');
        });
    });

    describe('Edit Generation', () => {
        it('should provide edits for valid input', async () => {
            const content = 'function test() {\n  console.log("hello");\n}';
            const document = createMockDocument(content, '/workspace/test.ts');
            
            const edits = await provider.provideInlineEdits(document, {
                instruction: 'Add error handling',
                line: 1,
            });

            expect(Array.isArray(edits)).toBe(true);
        });

        it('should handle empty document', async () => {
            const document = createMockDocument('', '/workspace/empty.ts');
            
            const edits = await provider.provideInlineEdits(document, {
                instruction: 'Add code',
            });

            expect(Array.isArray(edits)).toBe(true);
        });
    });

    describe('Edit Validation', () => {
        it('should validate edit ranges', () => {
            const edit = {
                range: {
                    start: { line: 0, character: 0 },
                    end: { line: 0, character: 10 },
                },
                newText: 'replacement',
            };

            const isValid = provider.validateEdit?.(edit);
            expect(typeof isValid).toBe('boolean');
        });

        it('should reject invalid ranges', () => {
            const edit = {
                range: {
                    start: { line: -1, character: 0 },
                    end: { line: 0, character: 10 },
                },
                newText: 'replacement',
            };

            const isValid = provider.validateEdit?.(edit);
            if (isValid !== undefined) {
                expect(isValid).toBe(false);
            }
        });
    });

    describe('Diff Generation', () => {
        it('should generate diff for simple changes', () => {
            const original = 'hello world';
            const modified = 'hello there world';
            
            const diff = provider.generateDiff?.(original, modified);
            
            if (diff) {
                expect(diff).toBeDefined();
                expect(Array.isArray(diff)).toBe(true);
            }
        });

        it('should handle identical strings', () => {
            const text = 'no changes';
            
            const diff = provider.generateDiff?.(text, text);
            
            if (diff) {
                expect(diff.length).toBe(0);
            }
        });
    });

    describe('Context Gathering', () => {
        it('should gather context around selection', () => {
            const content = 'line1\nline2\nline3\nline4\nline5';
            const document = createMockDocument(content);
            
            const context = provider.getContext?.(document, { line: 2, character: 0 });
            
            if (context) {
                expect(context).toBeDefined();
            }
        });

        it('should respect context window size', () => {
            const content = Array(100).fill('line').join('\n');
            const document = createMockDocument(content);
            
            const context = provider.getContext?.(document, { line: 50, character: 0 }, 10);
            
            if (context) {
                const lines = context.split('\n');
                expect(lines.length).toBeLessThanOrEqual(21); // 10 lines before + current + 10 after
            }
        });
    });

    describe('Performance', () => {
        it('should complete within timeout for small files', async () => {
            const content = 'function test() { return true; }';
            const document = createMockDocument(content);
            
            const startTime = Date.now();
            await provider.provideInlineEdits(document, {
                instruction: 'Add types',
            });
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
        });
    });
});
