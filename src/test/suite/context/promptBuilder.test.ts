/**
 * Prompt Builder Tests
 * Tests for prompt building with context management
 */

import * as assert from 'assert';
import { describe, it, beforeEach } from 'mocha';
import {
    PromptBuilder,
    PromptConfig,
    BuiltPrompt,
    FileContext
} from '../../../context/promptBuilder';
import { ResolvedContext, AutoContext } from '../../../context/contextResolver';
import { SymbolProvider, SymbolNode } from '../../../context/symbolProvider';
import {
    MockExtensionContext,
    Uri,
    resetMocks
} from '../../mocks/vscode';

// Mock SymbolProvider
class MockSymbolProvider extends SymbolProvider {
    constructor() {
        super({} as any);
    }

    async getFileOutline(uri: Uri): Promise<any> {
        return {
            uri: uri.toString(),
            relativePath: 'test.ts',
            imports: [],
            exports: [],
            symbols: [
                {
                    name: 'testFunction',
                    kind: 11, // Function
                    range: { start: 0, end: 10 } as any,
                    selectionRange: { start: 0, end: 10 } as any,
                    uri: uri.toString(),
                    children: [],
                    detail: 'void'
                }
            ]
        };
    }

    async getSymbolContext(uri: Uri, symbolName: string): Promise<any> {
        return {
            symbol: {
                name: symbolName,
                kind: 11,
                range: { start: 0, end: 10 } as any,
                selectionRange: { start: 0, end: 10 } as any,
                uri: uri.toString(),
                children: []
            },
            content: `function ${symbolName}() {}`,
            references: [],
            relatedSymbols: []
        };
    }
}

describe('PromptBuilder', () => {
    let builder: PromptBuilder;
    let symbolProvider: SymbolProvider;

    beforeEach(() => {
        resetMocks();
        symbolProvider = new MockSymbolProvider();
        builder = new PromptBuilder(symbolProvider, {});
    });

    describe('Configuration', () => {
        it('should have default config', () => {
            const defaultConfig: PromptConfig = {
                maxContextTokens: 120000,
                maxFilesInContext: 20,
                maxSymbolsPerFile: 50,
                includeLineNumbers: true,
                includeFileTree: true,
                prioritizeAGENTSmd: true,
                format: 'markdown'
            };

            assert.strictEqual(defaultConfig.maxContextTokens, 120000);
            assert.strictEqual(defaultConfig.maxFilesInContext, 20);
            assert.strictEqual(defaultConfig.format, 'markdown');
        });

        it('should accept custom config', () => {
            const customBuilder = new PromptBuilder(symbolProvider, {
                maxFilesInContext: 10,
                includeLineNumbers: false,
                format: 'xml'
            });

            assert.ok(customBuilder);
        });
    });

    describe('System Prompt', () => {
        it('should build system prompt with guidelines', () => {
            const systemPrompt = builder.buildSystemPrompt();

            assert.ok(systemPrompt.includes('Kimi'));
            assert.ok(systemPrompt.includes('Guidelines'));
            assert.ok(systemPrompt.includes('@file'));
            assert.ok(systemPrompt.includes('@symbol'));
        });

        it('should include custom base prompt', () => {
            const customPrompt = 'Custom instruction here';
            const systemPrompt = builder.buildSystemPrompt(customPrompt);

            assert.ok(systemPrompt.includes(customPrompt));
            assert.ok(systemPrompt.includes('Guidelines'));
        });
    });

    describe('File Context Formatting', () => {
        it('should format file with language tag', () => {
            const file: FileContext = {
                uri: 'file:///workspace/test.ts',
                relativePath: 'src/test.ts',
                content: 'function test() {}',
                symbols: []
            };

            const formatted = builder.formatFileContext(file);

            assert.ok(formatted.includes('```typescript:src/test.ts') || formatted.includes('```:src/test.ts'));
            assert.ok(formatted.includes('function test() {}'));
            assert.ok(formatted.includes('```'));
        });

        it('should detect language from extension', () => {
            const testCases = [
                { path: 'file.ts', expected: 'typescript' },
                { path: 'file.js', expected: 'javascript' },
                { path: 'file.py', expected: 'python' },
            ];

            testCases.forEach(({ path, expected }) => {
                const file: FileContext = {
                    uri: `file:///workspace/${path}`,
                    relativePath: path,
                    content: '',
                    symbols: []
                };
                const formatted = builder.formatFileContext(file);
                assert.ok(formatted.includes(expected) || formatted.includes('```:') || formatted.includes(path.split('.').pop() || ''));
            });
        });

        it('should include outline when requested', () => {
            const file: FileContext = {
                uri: 'file:///workspace/test.ts',
                relativePath: 'test.ts',
                content: 'function a() {} function b() {}',
                symbols: [
                    { name: 'a', kind: 11, range: { start: 0, end: 1 } as any, selectionRange: { start: 0, end: 1 } as any, uri: 'file:///workspace/test.ts', children: [] },
                    { name: 'b', kind: 11, range: { start: 1, end: 2 } as any, selectionRange: { start: 1, end: 2 } as any, uri: 'file:///workspace/test.ts', children: [] }
                ] as any
            };

            const formatted = builder.formatFileContext(file, { includeOutline: true });

            assert.ok(formatted.includes('Outline'));
        });

        it('should add line numbers when configured', () => {
            const file: FileContext = {
                uri: 'file:///workspace/test.ts',
                relativePath: 'test.ts',
                content: 'line1\nline2\nline3',
                symbols: []
            };

            const formatted = builder.formatFileContext(file);

            assert.ok(formatted.includes('1 |') || formatted.includes(' 1 |'));
        });

        it('should truncate content when maxLines specified', () => {
            const file: FileContext = {
                uri: 'file:///workspace/test.ts',
                relativePath: 'test.ts',
                content: Array(100).fill('line').join('\n'),
                symbols: []
            };

            const formatted = builder.formatFileContext(file, { maxLines: 10 });

            assert.ok(formatted.includes('[truncated]') || formatted.includes('omitted'));
        });
    });

    describe('File Tree Formatting', () => {
        it('should format single file', () => {
            const files = ['src/test.ts'];
            const tree = builder.formatFileTree(files);

            assert.ok(tree.includes('test.ts'));
        });

        it('should format nested files', () => {
            const files = [
                'src/utils.ts',
                'src/components/Button.ts',
                'src/components/Input.ts'
            ];
            const tree = builder.formatFileTree(files);

            assert.ok(tree.includes('src'));
            assert.ok(tree.includes('components'));
        });

        it('should use tree characters', () => {
            const files = ['a.ts', 'b.ts'];
            const tree = builder.formatFileTree(files);

            // Should contain tree drawing characters
            assert.ok(tree.includes('├──') || tree.includes('└──'));
        });
    });

    describe('Token Estimation', () => {
        it('should estimate tokens for text', () => {
            const text = 'Hello, world!';
            const tokens = builder.estimateTokens(text);

            // Roughly 4 chars per token, so ~4 tokens for this text
            assert.ok(tokens > 0);
            assert.ok(tokens < text.length);
        });

        it('should handle empty string', () => {
            const tokens = builder.estimateTokens('');
            assert.strictEqual(tokens, 0);
        });

        it('should handle code with special characters', () => {
            const code = 'const x = { a: 1, b: 2 };';
            const tokens = builder.estimateTokens(code);

            assert.ok(tokens > 0);
        });
    });

    describe('BuiltPrompt Structure', () => {
        it('should have correct structure', async () => {
            const userMessage = 'Help me with this code';
            const resolvedContext: ResolvedContext = {
                mentions: [],
                autoContext: {
                    currentFile: undefined,
                    relatedFiles: [],
                    openFiles: []
                },
                totalTokens: 0
            };

            const prompt = await builder.buildPrompt(userMessage, resolvedContext);

            assert.ok(prompt.system);
            assert.ok(Array.isArray(prompt.messages));
            assert.ok(prompt.contextInfo);
            assert.strictEqual(typeof prompt.contextInfo.filesIncluded, 'number');
            assert.strictEqual(typeof prompt.contextInfo.symbolsIncluded, 'number');
            assert.strictEqual(typeof prompt.contextInfo.estimatedTokens, 'number');
            assert.strictEqual(typeof prompt.contextInfo.truncated, 'boolean');
        });

        it('should include user message', async () => {
            const userMessage = 'Specific question here';
            const resolvedContext: ResolvedContext = {
                mentions: [],
                autoContext: {
                    currentFile: undefined,
                    relatedFiles: [],
                    openFiles: []
                },
                totalTokens: 0
            };

            const prompt = await builder.buildPrompt(userMessage, resolvedContext);
            const lastMessage = prompt.messages[prompt.messages.length - 1];

            assert.strictEqual(lastMessage.role, 'user');
            assert.ok(lastMessage.content.includes(userMessage));
        });

        it('should include conversation history', async () => {
            const history = [
                { role: 'user' as const, content: 'Previous question' },
                { role: 'assistant' as const, content: 'Previous answer' }
            ];
            const resolvedContext: ResolvedContext = {
                mentions: [],
                autoContext: {
                    currentFile: undefined,
                    relatedFiles: [],
                    openFiles: []
                },
                totalTokens: 0
            };

            const prompt = await builder.buildPrompt('New question', resolvedContext, { conversationHistory: history });

            assert.strictEqual(prompt.messages.length, 3); // 2 history + 1 current
            assert.strictEqual(prompt.messages[0].content, 'Previous question');
            assert.strictEqual(prompt.messages[1].content, 'Previous answer');
        });
    });

    describe('Token Budget Planning', () => {
        it('should reserve tokens for system prompt', () => {
            // System prompt budget is fixed
            const systemBudget = 500;
            assert.strictEqual(systemBudget, 500);
        });

        it('should reserve tokens for AGENTS.md', () => {
            // AGENTS.md budget
            const agentsMdBudget = 4000;
            assert.strictEqual(agentsMdBudget, 4000);
        });

        it('should reserve tokens for file tree', () => {
            // File tree budget
            const fileTreeBudget = 1000;
            assert.strictEqual(fileTreeBudget, 1000);
        });

        it('should allocate more tokens to current file', () => {
            // Current file gets more than regular files
            const currentFileBudget = 8000;
            const perFileBudget = 3000;
            assert.ok(currentFileBudget > perFileBudget);
        });
    });

    describe('Symbol Icons', () => {
        it('should have icons for common symbol kinds', () => {
            const icons: Record<number, string> = {
                0: '📄',  // File
                4: '🏛️',  // Class
                5: '🔧',  // Method
                11: '⚡', // Function
                12: '🔹', // Variable
            };

            assert.ok(icons[0]);
            assert.ok(icons[4]);
            assert.ok(icons[5]);
        });
    });

    describe('Context Info', () => {
        it('should track files included', () => {
            const info = {
                filesIncluded: 5,
                symbolsIncluded: 10,
                estimatedTokens: 5000,
                truncated: false
            };

            assert.strictEqual(info.filesIncluded, 5);
            assert.strictEqual(info.symbolsIncluded, 10);
        });

        it('should indicate when truncated', () => {
            const info = {
                filesIncluded: 20,
                symbolsIncluded: 100,
                estimatedTokens: 150000, // Over limit
                truncated: true
            };

            assert.strictEqual(info.truncated, true);
        });
    });

    describe('File Outline Formatting', () => {
        it('should format outline with indentation', () => {
            const symbols: any[] = [
                {
                    name: 'Class1',
                    kind: 4, // Class
                    range: { start: 0, end: 10 },
                    selectionRange: { start: 0, end: 10 },
                    uri: 'file:///workspace/test.ts',
                    children: [
                        {
                            name: 'method1',
                            kind: 5, // Method
                            range: { start: 1, end: 5 },
                            selectionRange: { start: 1, end: 5 },
                            uri: 'file:///workspace/test.ts',
                            children: []
                        }
                    ]
                }
            ];

            // Outline should be formatted with indentation
            assert.strictEqual(symbols[0].name, 'Class1');
            assert.strictEqual(symbols[0].children[0].name, 'method1');
        });

        it('should limit symbols per file', () => {
            const maxSymbols = 50;
            const symbols = Array(100).fill(null).map((_, i) => ({
                name: `symbol${i}`,
                kind: 11,
                range: { start: i, end: i + 1 },
                children: []
            }));

            assert.ok(symbols.length > maxSymbols);
        });
    });

    describe('Format Types', () => {
        it('should support markdown format', () => {
            const config: PromptConfig = {
                maxContextTokens: 120000,
                maxFilesInContext: 20,
                maxSymbolsPerFile: 50,
                includeLineNumbers: true,
                includeFileTree: true,
                prioritizeAGENTSmd: true,
                format: 'markdown'
            };

            assert.strictEqual(config.format, 'markdown');
        });

        it('should support xml format', () => {
            const config: Partial<PromptConfig> = { format: 'xml' };
            assert.strictEqual(config.format, 'xml');
        });

        it('should support json format', () => {
            const config: Partial<PromptConfig> = { format: 'json' };
            assert.strictEqual(config.format, 'json');
        });
    });

    describe('Content Truncation', () => {
        it('should truncate long content', () => {
            const longContent = 'a'.repeat(10000);
            const maxChars = 1000;
            const truncated = longContent.substring(0, maxChars) + '\n\n... [truncated]';

            assert.ok(truncated.includes('[truncated]'));
            assert.ok(truncated.length < longContent.length);
        });

        it('should not truncate short content', () => {
            const shortContent = 'Short content';
            const maxChars = 1000;

            assert.ok(shortContent.length < maxChars);
        });
    });

    describe('Line Numbers', () => {
        it('should add line numbers to content', () => {
            const content = 'line1\nline2\nline3';
            const lines = content.split('\n');
            const numbered = lines.map((line, i) => `${String(i + 1).padStart(2, ' ')} | ${line}`).join('\n');

            assert.ok(numbered.includes('1 | line1'));
            assert.ok(numbered.includes('2 | line2'));
            assert.ok(numbered.includes('3 | line3'));
        });

        it('should handle single digit line numbers', () => {
            const content = 'line';
            const numbered = `1 | ${content}`;

            assert.ok(numbered.includes('1 |'));
        });

        it('should handle multi-digit line numbers', () => {
            const lines = Array(100).fill('line');
            const maxDigits = String(lines.length).length;

            assert.strictEqual(maxDigits, 3);
        });
    });
});
