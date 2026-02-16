/**
 * Enhanced Inline Completion Provider
 * Cursor-style predictive tab completions
 */

import * as vscode from 'vscode';
import { KimiApi } from '../kimi/apiAdapter';

interface CompletionCache {
    key: string;
    completion: string;
    timestamp: number;
}

export class EnhancedInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
    private kimiApi: KimiApi;
    private cache: Map<string, CompletionCache> = new Map();
    private cacheTimeout = 5 * 60 * 1000; // 5 minutes
    private debounceTimer: NodeJS.Timeout | null = null;
    private readonly debounceDelay = 150; // ms
    private recentCompletions: string[] = [];
    private maxRecentCompletions = 10;

    // Trigger patterns for automatic completion
    private readonly autoTriggerPatterns = [
        // After typing a word (3+ chars)
        /\w{3,}$/,
        // After specific keywords
        /\b(if|for|while|return|await|async|const|let|var|function|class|import|from)\s*$/,
        // After opening brackets/parens
        /[\(\{\[]\s*$/,
        // After dots (method/property access)
        /\.\w*$/,
        // After arrow functions
        /=>\s*$/,
        // After assignment
        /=\s*$/,
    ];

    // Patterns that should NOT trigger completion
    private readonly ignorePatterns = [
        // In comments (except AI: triggers)
        /\/\/[^A].*$/,
        /\/\*.*$/,
        /#.*$/,
        // In strings
        /"[^"]*$/,
        /'[^']*$/,
        /`[^`]*$/,
        // After closing brackets
        /[\)\}\]]\s*$/,
    ];

    constructor(kimiApi: KimiApi) {
        this.kimiApi = kimiApi;
        this.startCacheCleanup();
    }

    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
        
        // Check if we should provide completion
        if (!this.shouldProvideCompletion(document, position, context)) {
            return null;
        }

        // Debounce to avoid too many API calls
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        return new Promise((resolve) => {
            this.debounceTimer = setTimeout(async () => {
                if (token.isCancellationRequested) {
                    resolve(null);
                    return;
                }

                const completion = await this.getCompletion(document, position, token);
                resolve(completion);
            }, this.debounceDelay);
        });
    }

    private shouldProvideCompletion(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext
    ): boolean {
        const lineText = document.lineAt(position).text;
        const prefix = lineText.substring(0, position.character);

        // Always provide on explicit invoke (Ctrl+Space)
        if (context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke) {
            return true;
        }

        // Check ignore patterns
        if (this.ignorePatterns.some(pattern => pattern.test(prefix))) {
            return false;
        }

        // Check auto-trigger patterns
        return this.autoTriggerPatterns.some(pattern => pattern.test(prefix));
    }

    private async getCompletion(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | null> {
        
        const cacheKey = this.getCacheKey(document, position);
        
        // Check cache
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return [new vscode.InlineCompletionItem(cached.completion)];
        }

        try {
            const prompt = this.buildPrompt(document, position);
            
            const response = await this.kimiApi.generateResponse(prompt, {
                maxTokens: 150,
                temperature: 0.2, // Lower temperature for more predictable completions
            });

            if (token.isCancellationRequested || response.error || !response.content) {
                return null;
            }

            const completion = this.processCompletion(response.content, document, position);
            
            if (!completion || this.isDuplicate(completion)) {
                return null;
            }

            // Cache the result
            this.cache.set(cacheKey, {
                key: cacheKey,
                completion,
                timestamp: Date.now(),
            });

            // Track recent completions
            this.recentCompletions.push(completion);
            if (this.recentCompletions.length > this.maxRecentCompletions) {
                this.recentCompletions.shift();
            }

            // Create inline completion with range
            const range = this.getCompletionRange(document, position, completion);
            const item = new vscode.InlineCompletionItem(completion, range);
            
            // Add command to track acceptance
            item.command = {
                command: 'kimi.completionAccepted',
                title: 'Completion Accepted',
                arguments: [completion],
            };

            return [item];

        } catch (error) {
            console.error('Inline completion error:', error);
            return null;
        }
    }

    private buildPrompt(document: vscode.TextDocument, position: vscode.Position): string {
        // Get context before cursor
        const contextLines = 30;
        const startLine = Math.max(0, position.line - contextLines);
        const contextRange = new vscode.Range(
            new vscode.Position(startLine, 0),
            position
        );
        const beforeCursor = document.getText(contextRange);

        // Get a bit of context after cursor (if any)
        const afterRange = new vscode.Range(
            position,
            new vscode.Position(
                Math.min(document.lineCount - 1, position.line + 5),
                document.lineAt(Math.min(document.lineCount - 1, position.line + 5)).text.length
            )
        );
        const afterCursor = document.getText(afterRange);

        const language = document.languageId;
        const fileName = document.fileName.split('/').pop() || '';

        return `You are an expert ${language} programmer. Provide a code completion at the cursor position (<|CURSOR|>).

File: ${fileName}
Language: ${language}

Code before cursor:
\`\`\`${language}
${beforeCursor}<|CURSOR|>
\`\`\`

Code after cursor:
\`\`\`${language}
${afterCursor}
\`\`\`

Continue the code from the cursor position. Provide ONLY the code that should be inserted, without explanations or markdown. The completion should:
1. Be syntactically correct
2. Follow the existing code style
3. Be a natural continuation
4. Not repeat existing code

Completion:`;
    }

    private processCompletion(
        completion: string,
        document: vscode.TextDocument,
        position: vscode.Position
    ): string | null {
        // Clean up the completion
        let cleaned = completion.trim();
        
        // Remove markdown code blocks if present
        const codeBlockMatch = cleaned.match(/```[\w]*\n?([\s\S]*?)```/);
        if (codeBlockMatch) {
            cleaned = codeBlockMatch[1].trim();
        }

        // Remove common prefixes that shouldn't be there
        const linePrefix = document.lineAt(position).text.substring(0, position.character);
        
        // If completion starts with what's already typed, remove it
        if (cleaned.startsWith(linePrefix)) {
            cleaned = cleaned.substring(linePrefix.length).trimStart();
        }

        // Don't return empty or very short completions
        if (cleaned.length < 3) {
            return null;
        }

        return cleaned;
    }

    private getCompletionRange(
        document: vscode.TextDocument,
        position: vscode.Position,
        completion: string
    ): vscode.Range {
        // Check if we should replace some existing text
        const line = document.lineAt(position);
        const remainingLine = line.text.substring(position.character);
        
        // If completion starts with the remaining line content, extend range
        const trimmedRemaining = remainingLine.trimStart();
        if (trimmedRemaining && completion.startsWith(trimmedRemaining)) {
            const endPos = new vscode.Position(
                position.line,
                line.text.length
            );
            return new vscode.Range(position, endPos);
        }

        return new vscode.Range(position, position);
    }

    private getCacheKey(document: vscode.TextDocument, position: vscode.Position): string {
        const contextRange = new vscode.Range(
            new vscode.Position(Math.max(0, position.line - 10), 0),
            position
        );
        const context = document.getText(contextRange);
        return `${document.fileName}:${position.line}:${position.character}:${context}`;
    }

    private isDuplicate(completion: string): boolean {
        return this.recentCompletions.some(
            recent => recent.trim() === completion.trim()
        );
    }

    private startCacheCleanup(): void {
        setInterval(() => {
            const now = Date.now();
            for (const [key, value] of this.cache.entries()) {
                if (now - value.timestamp > this.cacheTimeout) {
                    this.cache.delete(key);
                }
            }
        }, this.cacheTimeout);
    }

    /**
     * Accept a partial completion (word by word)
     */
    acceptPartialCompletion(document: vscode.TextDocument, position: vscode.Position): string | null {
        // This would be called when user presses Ctrl+Right to accept word-by-word
        // Implementation depends on VS Code API capabilities
        return null;
    }

    dispose(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.cache.clear();
    }
}
