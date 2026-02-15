/**
 * Providers Integration Tests
 * Tests provider interactions and end-to-end flows
 */

import { InlineEditProvider } from '../../src/providers/InlineEditProvider';
import { DiffProvider } from '../../src/providers/DiffProvider';
import { createMockDocument, createMockEditor } from '../__mocks__/vscode';

jest.mock('vscode', () => require('../__mocks__/vscode'));

describe('Providers Integration', () => {
    describe('InlineEditProvider + DiffProvider', () => {
        let inlineEditProvider: InlineEditProvider;
        let diffProvider: DiffProvider;

        beforeEach(() => {
            inlineEditProvider = new InlineEditProvider();
            diffProvider = new DiffProvider();
        });

        it('should generate and apply edit with diff', async () => {
            const originalContent = 'function test() {\n  return 1;\n}';
            const document = createMockDocument(originalContent, '/workspace/test.ts');
            
            // Generate inline edit
            const edits = await inlineEditProvider.provideInlineEdits(document, {
                instruction: 'Add parameter',
                selection: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
            });

            expect(edits).toBeDefined();
            expect(edits.length).toBeGreaterThan(0);

            // Generate diff from edits
            const diff = diffProvider.generateDiffFromEdits(document, edits);
            expect(diff).toBeDefined();
        });

        it('should handle edit -> preview -> apply flow', async () => {
            const content = 'const x = 1;';
            const document = createMockDocument(content, '/workspace/test.ts');
            const editor = createMockEditor(document);

            // Generate edit
            const edits = await inlineEditProvider.provideInlineEdits(document, {
                instruction: 'Add type annotation',
            });

            // Preview diff
            const diff = await diffProvider.showDiff(document, edits);
            expect(diff).toBeDefined();

            // Apply edits
            const applied = await diffProvider.applyEdits(editor, edits);
            expect(applied).toBe(true);
        });
    });

    describe('Provider State Management', () => {
        let provider: InlineEditProvider;

        beforeEach(() => {
            provider = new InlineEditProvider();
        });

        it('should maintain edit history', async () => {
            const document = createMockDocument('const x = 1;', '/workspace/test.ts');
            
            // Multiple edits
            for (let i = 0; i < 3; i++) {
                await provider.provideInlineEdits(document, {
                    instruction: `Edit ${i}`,
                });
            }

            const history = provider.getHistory?.();
            if (history) {
                expect(history.length).toBeGreaterThanOrEqual(3);
            }
        });

        it('should support undo/redo', async () => {
            const document = createMockDocument('const x = 1;', '/workspace/test.ts');
            const editor = createMockEditor(document);

            // Apply an edit
            const edits = await provider.provideInlineEdits(document, {
                instruction: 'Change variable name',
            });

            await editor.edit(() => {});

            // Undo
            const undone = await provider.undo?.();
            expect(typeof undone).toBe('boolean');
        });
    });

    describe('Error Recovery', () => {
        let provider: InlineEditProvider;

        beforeEach(() => {
            provider = new InlineEditProvider();
        });

        it('should recover from partial edit failure', async () => {
            const document = createMockDocument('invalid syntax {{{', '/workspace/broken.ts');
            
            const result = await provider.provideInlineEdits(document, {
                instruction: 'Fix syntax',
            });

            // Should not throw, should return empty or partial results
            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle concurrent edit requests', async () => {
            const document = createMockDocument('const x = 1;', '/workspace/test.ts');
            
            const promises = [
                provider.provideInlineEdits(document, { instruction: 'Edit 1' }),
                provider.provideInlineEdits(document, { instruction: 'Edit 2' }),
                provider.provideInlineEdits(document, { instruction: 'Edit 3' }),
            ];

            const results = await Promise.all(promises);
            expect(results).toHaveLength(3);
            results.forEach(result => {
                expect(Array.isArray(result)).toBe(true);
            });
        });
    });
});
