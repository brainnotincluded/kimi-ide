/**
 * Kimi Completion Provider
 * 
 * Provides AI-powered code completions through LSP.
 * Supports both traditional completions and inline completions (ghost text).
 */

import {
    CompletionItem,
    CompletionItemKind,
    InsertTextFormat,
    TextEdit,
    Position,
    Range,
    InlineCompletionItem,
    InlineCompletionTriggerKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

interface KimiSettings {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
    model: string;
    enableInlineCompletions: boolean;
    completionDebounceMs: number;
    maxCompletions: number;
}

interface CompletionContext {
    prefix: string;
    suffix: string;
    language: string;
    linePrefix: string;
    lineSuffix: string;
    cursorLine: number;
    cursorCharacter: number;
}

/**
 * Debounce utility for reducing API call frequency
 */
function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => Promise<any> {
    let timeoutId: NodeJS.Timeout | undefined;
    return (...args: Parameters<T>): Promise<any> => {
        return new Promise((resolve) => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                resolve(fn(...args));
            }, delay);
        });
    };
}

export class KimiCompletionProvider {
    private debouncedGenerateCompletion: (
        context: CompletionContext,
        settings: KimiSettings
    ) => Promise<any>;
    private requestCache: Map<string, CompletionItem[]> = new Map();
    private cacheTimeout: number = 60000; // 1 minute cache

    constructor(private settings: KimiSettings) {
        this.debouncedGenerateCompletion = debounce(
            this.generateInlineCompletion.bind(this),
            settings.completionDebounceMs
        );
    }

    /**
     * Provide completion items for the given position
     */
    async provideCompletions(
        document: TextDocument,
        position: Position,
        settings: KimiSettings
    ): Promise<CompletionItem[]> {
        const context = this.extractContext(document, position);
        const cacheKey = this.getCacheKey(document.uri, position, context.prefix);

        // Check cache
        const cached = this.requestCache.get(cacheKey);
        if (cached) {
            return cached;
        }

        // Check trigger conditions
        if (!this.shouldTriggerCompletion(context)) {
            return [];
        }

        try {
            const completions = await this.getAICompletions(context, settings);
            
            // Cache results
            this.requestCache.set(cacheKey, completions);
            setTimeout(() => this.requestCache.delete(cacheKey), this.cacheTimeout);

            return completions;
        } catch (error) {
            console.error('Error getting AI completions:', error);
            return [];
        }
    }

    /**
     * Provide inline completions (ghost text)
     */
    async provideInlineCompletions(
        document: TextDocument,
        position: Position,
        triggerKind: InlineCompletionTriggerKind,
        settings: KimiSettings
    ): Promise<InlineCompletionItem[]> {
        if (!settings.enableInlineCompletions) {
            return [];
        }

        const context = this.extractContext(document, position);

        // Only trigger inline completion on specific conditions
        if (triggerKind === InlineCompletionTriggerKind.Automatic) {
            if (!this.shouldTriggerInlineCompletion(context)) {
                return [];
            }
        }

        try {
            const completion = await this.generateInlineCompletion(context, settings);
            if (!completion) {
                return [];
            }

            return [
                {
                    insertText: completion,
                    range: {
                        start: position,
                        end: position,
                    },
                },
            ];
        } catch (error) {
            console.error('Error getting inline completion:', error);
            return [];
        }
    }

    /**
     * Extract context around cursor position
     */
    private extractContext(document: TextDocument, position: Position): CompletionContext {
        const text = document.getText();
        const offset = document.offsetAt(position);

        // Get context window (1000 chars before and after)
        const contextBefore = text.substring(Math.max(0, offset - 1000), offset);
        const contextAfter = text.substring(offset, Math.min(text.length, offset + 1000));

        // Get current line context
        const lines = text.split('\n');
        const currentLine = lines[position.line] || '';
        const linePrefix = currentLine.substring(0, position.character);
        const lineSuffix = currentLine.substring(position.character);

        // Detect language from file extension or URI
        const language = this.detectLanguage(document.uri);

        return {
            prefix: contextBefore,
            suffix: contextAfter,
            language,
            linePrefix,
            lineSuffix,
            cursorLine: position.line,
            cursorCharacter: position.character,
        };
    }

    /**
     * Detect programming language from file URI
     */
    private detectLanguage(uri: string): string {
        const extension = uri.split('.').pop()?.toLowerCase();
        const languageMap: Record<string, string> = {
            'ts': 'typescript',
            'tsx': 'typescriptreact',
            'js': 'javascript',
            'jsx': 'javascriptreact',
            'py': 'python',
            'java': 'java',
            'go': 'go',
            'rs': 'rust',
            'cpp': 'cpp',
            'c': 'c',
            'h': 'c',
            'hpp': 'cpp',
            'cs': 'csharp',
            'rb': 'ruby',
            'php': 'php',
            'swift': 'swift',
            'kt': 'kotlin',
            'scala': 'scala',
            'r': 'r',
            'm': 'objective-c',
            'mm': 'objective-cpp',
            'sh': 'shellscript',
            'bash': 'shellscript',
            'ps1': 'powershell',
            'sql': 'sql',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
            'less': 'less',
            'json': 'json',
            'xml': 'xml',
            'yaml': 'yaml',
            'yml': 'yaml',
            'md': 'markdown',
            'dockerfile': 'dockerfile',
        };

        return languageMap[extension || ''] || 'plaintext';
    }

    /**
     * Check if completion should be triggered
     */
    private shouldTriggerCompletion(context: CompletionContext): boolean {
        // Trigger on specific patterns
        const triggerPatterns = [
            /\.\w*$/,           // After dot
            /\w+\($/,           // After opening parenthesis
            /\w+\[$/,           // After opening bracket
            /[\"\']$/,          // After quote
            /\/\/$/,            // After //
            /\/$/,              // After /
            /\s+\w{2,}$/,       // After 2+ chars of a word
            /^\s*\w{2,}$/,      // At start of line with 2+ chars
        ];

        return triggerPatterns.some(pattern => pattern.test(context.linePrefix));
    }

    /**
     * Check if inline completion should be triggered
     */
    private shouldTriggerInlineCompletion(context: CompletionContext): boolean {
        // Only trigger on specific patterns for inline completions
        const inlineTriggers = [
            /\/\/\s*AI:\s*$/,      // // AI:
            /#\s*AI:\s*$/,          // # AI:
            /\/\*\s*AI:\s*$/,       // /* AI:
            /\*\s*AI:\s*$/,         // * AI:
            /<!--\s*AI:\s*$/,       // <!-- AI:
            /\{\/\*\s*AI:\s*$/,     // {/* AI:
            /\{\s*\/\/\s*AI:\s*$/,  // { // AI:
        ];

        return inlineTriggers.some(pattern => pattern.test(context.linePrefix)) ||
               // Or trigger after a delay when typing
               (context.linePrefix.length > 3 && /\w{3,}$/.test(context.linePrefix));
    }

    /**
     * Get AI-generated completions
     */
    private async getAICompletions(
        context: CompletionContext,
        settings: KimiSettings
    ): Promise<CompletionItem[]> {
        if (!settings.apiKey) {
            // Return placeholder if no API key
            return [
                {
                    label: '⚠️ Configure Kimi API Key',
                    kind: CompletionItemKind.Text,
                    detail: 'Click to configure API key',
                    documentation: {
                        kind: 'markdown',
                        value: 'Please configure your Kimi API key in VS Code settings (kimi.apiKey)',
                    },
                    data: { aiGenerated: false },
                },
            ];
        }

        try {
            const prompt = this.buildCompletionPrompt(context);
            const response = await this.callKimiAPI(prompt, settings);
            
            if (!response || response.error) {
                return [];
            }

            return this.parseCompletions(response.content, context);
        } catch (error) {
            console.error('AI completion error:', error);
            return [];
        }
    }

    /**
     * Generate inline completion (ghost text)
     */
    private async generateInlineCompletion(
        context: CompletionContext,
        settings: KimiSettings
    ): Promise<string | null> {
        if (!settings.apiKey) {
            return null;
        }

        try {
            const prompt = this.buildInlineCompletionPrompt(context);
            const response = await this.callKimiAPI(prompt, settings);
            
            if (!response || response.error) {
                return null;
            }

            return this.formatInlineCompletion(response.content);
        } catch (error) {
            console.error('Inline completion error:', error);
            return null;
        }
    }

    /**
     * Build prompt for completion request
     */
    private buildCompletionPrompt(context: CompletionContext): string {
        return `Complete the following ${context.language} code. Provide 3-5 relevant completion suggestions.

Current context:
\`\`\`${context.language}
${context.prefix}<cursor>${context.suffix}
\`\`\`

Line being edited:
\`\`\`
${context.linePrefix}<cursor>${context.lineSuffix}
\`\`\`

Provide completions in this format:
- Each completion on a new line starting with "- "
- Only the code to insert, no explanations
- Keep completions concise (1-3 lines each)
- Ensure completions are syntactically correct ${context.language}

Completions:`;
    }

    /**
     * Build prompt for inline completion
     */
    private buildInlineCompletionPrompt(context: CompletionContext): string {
        return `Continue the following ${context.language} code from the cursor position.

Context before cursor:
\`\`\`${context.language}
${context.prefix}
\`\`\`

Context after cursor:
\`\`\`${context.language}
${context.suffix}
\`\`\`

Provide ONLY the code continuation, no explanations. The continuation should:
- Complete the current statement or expression
- Be syntactically correct ${context.language}
- Match the style of the existing code
- Be 1-5 lines maximum

Continuation:`;
    }

    /**
     * Call Kimi API for completion
     */
    private async callKimiAPI(
        prompt: string,
        settings: KimiSettings
    ): Promise<{ content: string; error?: string } | null> {
        try {
            const response = await fetch(`${settings.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.apiKey}`,
                },
                body: JSON.stringify({
                    model: settings.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert code completion engine. Provide concise, accurate code completions.',
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    temperature: 0.2,
                    max_tokens: 512,
                    stream: false,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as any;
                return {
                    content: '',
                    error: errorData.error?.message || `HTTP error: ${response.status}`,
                };
            }

            const data = await response.json() as any;
            return {
                content: data.choices?.[0]?.message?.content || '',
            };
        } catch (error) {
            return {
                content: '',
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Parse AI response into completion items
     */
    private parseCompletions(content: string, context: CompletionContext): CompletionItem[] {
        const completions: CompletionItem[] = [];
        
        // Parse lines starting with "- "
        const lines = content.split('\n');
        let currentIndex = 1;

        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('- ')) {
                const completionText = trimmed.substring(2).trim();
                if (completionText) {
                    completions.push({
                        label: completionText.length > 50 
                            ? completionText.substring(0, 50) + '...' 
                            : completionText,
                        kind: CompletionItemKind.Snippet,
                        insertText: completionText,
                        insertTextFormat: InsertTextFormat.PlainText,
                        detail: '(AI Suggested)',
                        documentation: {
                            kind: 'markdown',
                            value: `\`\`\`${context.language}\n${completionText}\n\`\`\``,
                        },
                        sortText: `0${currentIndex}`,
                        data: { aiGenerated: true },
                    });
                    currentIndex++;
                }
            }
        }

        // If no bullet points found, treat entire content as single completion
        if (completions.length === 0 && content.trim()) {
            const cleanContent = this.extractCodeFromMarkdown(content.trim());
            completions.push({
                label: cleanContent.length > 50 
                    ? cleanContent.substring(0, 50) + '...' 
                    : cleanContent,
                kind: CompletionItemKind.Snippet,
                insertText: cleanContent,
                insertTextFormat: InsertTextFormat.PlainText,
                detail: '(AI Suggested)',
                documentation: {
                    kind: 'markdown',
                    value: `\`\`\`${context.language}\n${cleanContent}\n\`\`\``,
                },
                sortText: '01',
                data: { aiGenerated: true },
            });
        }

        return completions.slice(0, this.settings.maxCompletions);
    }

    /**
     * Format inline completion text
     */
    private formatInlineCompletion(content: string): string {
        // Remove markdown code blocks if present
        const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/;
        const match = content.match(codeBlockRegex);
        if (match) {
            return match[1].trim();
        }
        return content.trim();
    }

    /**
     * Extract code from markdown
     */
    private extractCodeFromMarkdown(content: string): string {
        const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/;
        const match = content.match(codeBlockRegex);
        if (match) {
            return match[1].trim();
        }
        return content;
    }

    /**
     * Generate cache key for request caching
     */
    private getCacheKey(uri: string, position: Position, prefix: string): string {
        // Create a key based on document, position, and last 50 chars of prefix
        const prefixHash = prefix.slice(-50);
        return `${uri}:${position.line}:${position.character}:${prefixHash}`;
    }
}
