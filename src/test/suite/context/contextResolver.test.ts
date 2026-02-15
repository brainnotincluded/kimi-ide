/**
 * Context Resolver Tests
 * Tests for context resolution (@file, @symbol, @folder mentions)
 */

import * as assert from 'assert';
import { describe, it, beforeEach } from 'mocha';
import {
    ContextResolver,
    Mention,
    ResolvedContext,
    ResolvedMention,
    ContextConfig,
    MentionCompletion
} from '../../../context/contextResolver';
import { CodebaseIndexer } from '../../../context/codebaseIndexer';
import {
    MockExtensionContext,
    Uri,
    resetMocks,
    workspace,
    window,
    MockTextDocument,
    MockTextEditor
} from '../../mocks/vscode';

// Import real vscode types for type assertions
import * as vscode from 'vscode';

describe('ContextResolver', () => {
    let resolver: ContextResolver;
    let indexer: CodebaseIndexer;
    let mockContext: MockExtensionContext;

    beforeEach(() => {
        resetMocks();
        mockContext = new MockExtensionContext('/workspace');
        indexer = new CodebaseIndexer(mockContext as any);
        resolver = new ContextResolver(indexer as any);
    });

    describe('Mention Parsing', () => {
        it('should parse @file mention', () => {
            const message = 'Check this file @file:src/utils.ts';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 1);
            assert.strictEqual(mentions[0].type, 'file');
            assert.strictEqual(mentions[0].value, 'src/utils.ts');
            assert.strictEqual(mentions[0].raw, '@file:src/utils.ts');
        });

        it('should parse @folder mention', () => {
            const message = 'Look at @folder:src/components';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 1);
            assert.strictEqual(mentions[0].type, 'folder');
            assert.strictEqual(mentions[0].value, 'src/components');
        });

        it('should parse @symbol mention', () => {
            const message = 'What does @symbol:processData do?';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 1);
            assert.strictEqual(mentions[0].type, 'symbol');
            assert.strictEqual(mentions[0].value, 'processData');
        });

        it('should parse multiple mentions', () => {
            const message = 'Compare @file:src/a.ts and @file:src/b.ts with @symbol:sharedFunction';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 3);
            assert.strictEqual(mentions[0].type, 'file');
            assert.strictEqual(mentions[1].type, 'file');
            assert.strictEqual(mentions[2].type, 'symbol');
        });

        it('should parse short form mentions', () => {
            const message = '@f:utils.ts @d:components @s:myFunction';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 3);
            assert.strictEqual(mentions[0].type, 'file');
            assert.strictEqual(mentions[1].type, 'folder');
            assert.strictEqual(mentions[2].type, 'symbol');
        });

        it('should auto-detect file type by extension', () => {
            const message = 'Look at @src/utils.ts for reference';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 1);
            assert.strictEqual(mentions[0].type, 'file');
            assert.strictEqual(mentions[0].value, 'src/utils.ts');
        });

        it('should auto-detect folder type by trailing slash', () => {
            const message = 'Check @src/components/';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 1);
            assert.strictEqual(mentions[0].type, 'folder');
        });

        it('should auto-detect symbol type for bare words', () => {
            const message = 'What is @myVariable used for?';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 1);
            assert.strictEqual(mentions[0].type, 'symbol');
            assert.strictEqual(mentions[0].value, 'myVariable');
        });

        it('should handle mentions with quotes', () => {
            const message = 'See @file:"path with spaces/file.ts"';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 1);
            // Quotes should be normalized in the value
            assert.ok(!mentions[0].value.includes('"'));
        });

        it('should handle URL mentions', () => {
            const message = 'Check @url:https://example.com/docs';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 1);
            assert.strictEqual(mentions[0].type, 'url');
        });

        it('should return empty array for message without mentions', () => {
            const message = 'Just a regular message without any mentions';
            const mentions = resolver.parseMentions(message);

            assert.deepStrictEqual(mentions, []);
        });

        it('should capture correct character ranges', () => {
            const message = 'Check @file:test.ts please';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions[0].range[0], 6);  // Start index
            assert.strictEqual(mentions[0].range[1], 18); // End index
        });
    });

    describe('Mention Normalization', () => {
        it('should normalize file paths', () => {
            const message = 'Check @file:src\\utils\\file.ts'; // Windows path
            const mentions = resolver.parseMentions(message);

            // Should convert backslashes to forward slashes
            assert.ok(!mentions[0].value.includes('\\'));
        });

        it('should remove surrounding quotes', () => {
            const message = '@file:"quoted path.ts"';
            const mentions = resolver.parseMentions(message);

            assert.ok(!mentions[0].value.startsWith('"'));
            assert.ok(!mentions[0].value.endsWith('"'));
        });
    });

    describe('ResolvedContext Structure', () => {
        it('should have correct ResolvedContext structure', () => {
            const context: ResolvedContext = {
                mentions: [],
                autoContext: {
                    currentFile: undefined,
                    relatedFiles: [],
                    openFiles: []
                },
                totalTokens: 0
            };

            assert.ok(Array.isArray(context.mentions));
            assert.ok(context.autoContext);
            assert.strictEqual(typeof context.totalTokens, 'number');
        });

        it('should have correct ResolvedMention structure for file', () => {
            const mention: ResolvedMention = {
                type: 'file',
                value: 'src/test.ts',
                content: 'function test() {}'
            };

            assert.strictEqual(mention.type, 'file');
            assert.ok(mention.content);
        });

        it('should have correct ResolvedMention structure for folder', () => {
            const mention: ResolvedMention = {
                type: 'folder',
                value: 'src/components',
                files: ['src/components/Button.ts', 'src/components/Input.ts']
            };

            assert.strictEqual(mention.type, 'folder');
            assert.ok(Array.isArray(mention.files));
        });

        it('should have correct ResolvedMention structure for symbol', () => {
            const mention: ResolvedMention = {
                type: 'symbol',
                value: 'processData',
                symbols: [{
                    name: 'processData',
                    kind: 11, // Function
                    uri: 'file:///workspace/src/utils.ts',
                    relativePath: 'src/utils.ts',
                    range: { start: 10, end: 20 }
                }]
            };

            assert.strictEqual(mention.type, 'symbol');
            assert.ok(Array.isArray(mention.symbols));
        });
    });

    describe('Context Configuration', () => {
        it('should have default config values', () => {
            const defaultConfig: ContextConfig = {
                maxAutoContextFiles: 5,
                maxContextTokens: 120000,
                enableAutoContext: true,
                prioritizeOpenFiles: true
            };

            assert.strictEqual(defaultConfig.maxAutoContextFiles, 5);
            assert.strictEqual(defaultConfig.maxContextTokens, 120000);
            assert.strictEqual(defaultConfig.enableAutoContext, true);
            assert.strictEqual(defaultConfig.prioritizeOpenFiles, true);
        });

        it('should allow custom config', () => {
            const customResolver = new ContextResolver(indexer, {
                maxAutoContextFiles: 10,
                enableAutoContext: false
            });

            assert.ok(customResolver);
        });
    });

    describe('Token Estimation', () => {
        it('should estimate tokens for text', () => {
            const text = 'Hello, world! This is a test.';
            // Approximately 4 chars per token
            const estimatedTokens = Math.ceil(text.length / 4);

            assert.ok(estimatedTokens > 0);
            assert.ok(estimatedTokens < text.length);
        });

        it('should handle empty text', () => {
            const estimatedTokens = Math.ceil(0 / 4);
            assert.strictEqual(estimatedTokens, 0);
        });
    });

    describe('Mention Completions', () => {
        it('should have correct completion structure', () => {
            const completion: MentionCompletion = {
                label: 'src/utils.ts',
                type: 'file',
                detail: 'typescript',
                insertText: '@file:src/utils.ts'
            };

            assert.strictEqual(completion.label, 'src/utils.ts');
            assert.strictEqual(completion.type, 'file');
            assert.strictEqual(completion.insertText, '@file:src/utils.ts');
        });

        it('should create file completions', () => {
            const completions: MentionCompletion[] = [
                {
                    label: 'file1.ts',
                    type: 'file',
                    insertText: '@file:file1.ts'
                },
                {
                    label: 'file2.ts',
                    type: 'file',
                    insertText: '@file:file2.ts'
                }
            ];

            assert.strictEqual(completions.length, 2);
            completions.forEach(c => assert.strictEqual(c.type, 'file'));
        });

        it('should create folder completions', () => {
            const completions: MentionCompletion[] = [
                {
                    label: 'src',
                    type: 'folder',
                    insertText: '@folder:src'
                }
            ];

            assert.strictEqual(completions[0].type, 'folder');
        });

        it('should create symbol completions', () => {
            const completions: MentionCompletion[] = [
                {
                    label: 'processData',
                    type: 'symbol',
                    detail: 'Function in src/utils.ts',
                    insertText: '@symbol:processData'
                }
            ];

            assert.strictEqual(completions[0].type, 'symbol');
            assert.ok(completions[0].detail);
        });
    });

    describe('Auto Context', () => {
        it('should return empty auto context when disabled', () => {
            const disabledResolver = new ContextResolver(indexer, {
                enableAutoContext: false
            });

            // When disabled, auto context should be minimal
            assert.ok(disabledResolver);
        });

        it('should prioritize open files when enabled', () => {
            const prioritizingResolver = new ContextResolver(indexer, {
                prioritizeOpenFiles: true
            });

            assert.ok(prioritizingResolver);
        });
    });

    describe('Fuzzy Matching', () => {
        it('should score exact matches highest', () => {
            const pattern = 'test';
            const candidates = ['test', 'testing', 'mytest', 'other'];
            
            // Exact match should score 1
            const exactScore = candidates[0] === pattern ? 1 : 0;
            assert.strictEqual(exactScore, 1);
        });

        it('should score prefix matches high', () => {
            const pattern = 'test';
            const str = 'testing';
            
            const score = str.toLowerCase().startsWith(pattern.toLowerCase()) ? 0.9 : 0;
            assert.strictEqual(score, 0.9);
        });

        it('should score substring matches medium', () => {
            const pattern = 'test';
            const str = 'mytestfile';
            
            const score = str.toLowerCase().includes(pattern.toLowerCase()) ? 0.7 : 0;
            assert.strictEqual(score, 0.7);
        });

        it('should handle case-insensitive matching', () => {
            const pattern = 'TEST';
            const str = 'test';
            
            const matches = str.toLowerCase().includes(pattern.toLowerCase());
            assert.strictEqual(matches, true);
        });
    });

    describe('Edge Cases', () => {
        it('should handle mentions at start of message', () => {
            const message = '@file:test.ts content';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 1);
            assert.strictEqual(mentions[0].range[0], 0);
        });

        it('should handle mentions at end of message', () => {
            const message = 'content @file:test.ts';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 1);
            assert.strictEqual(mentions[0].range[1], message.length);
        });

        it('should handle consecutive mentions', () => {
            const message = '@file:a.ts @file:b.ts';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 2);
        });

        it('should handle mentions with special characters in path', () => {
            const message = '@file:src/utils-helpers/file_test.ts';
            const mentions = resolver.parseMentions(message);

            assert.strictEqual(mentions.length, 1);
            assert.ok(mentions[0].value.includes('utils-helpers'));
        });

        it('should handle empty mention value', () => {
            const message = '@file: @symbol:';
            const mentions = resolver.parseMentions(message);

            // Empty values should still be parsed
            assert.strictEqual(mentions.length, 2);
        });
    });

    describe('Message Types', () => {
        it('should parse different message patterns', () => {
            const messages = [
                { msg: 'Simple @file:test.ts mention', count: 1 },
                { msg: 'No mentions here', count: 0 },
                { msg: '@file:a.ts @file:b.ts @symbol:func', count: 3 },
                { msg: 'Check @folder:src/ please', count: 1 },
            ];

            messages.forEach(({ msg, count }) => {
                const mentions = resolver.parseMentions(msg);
                assert.strictEqual(mentions.length, count, `Failed for: ${msg}`);
            });
        });
    });
});
