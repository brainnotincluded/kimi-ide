/**
 * Kimi Hover Provider
 * 
 * Provides AI-powered hover information including:
 * - Enhanced documentation for functions and symbols
 * - Type information with AI explanations
 * - Code examples and usage patterns
 */

import {
    Hover,
    MarkupKind,
    Position,
    Range,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

interface KimiSettings {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
    model: string;
}

interface HoverContext {
    word: string;
    lineText: string;
    surroundingCode: string;
    language: string;
    lineNumber: number;
}

/**
 * Cache for hover results
 */
interface CacheEntry {
    hover: Hover;
    timestamp: number;
}

export class KimiHoverProvider {
    private hoverCache: Map<string, CacheEntry> = new Map();
    private cacheTimeout: number = 300000; // 5 minutes
    private pendingRequests: Map<string, Promise<Hover | null>> = new Map();

    constructor(private settings: KimiSettings) {}

    /**
     * Provide hover information for the given position
     */
    async provideHover(
        document: TextDocument,
        position: Position,
        settings: KimiSettings
    ): Promise<Hover | null> {
        if (!settings.apiKey) {
            return this.getNoApiKeyHover();
        }

        const context = this.extractContext(document, position);
        const cacheKey = this.getCacheKey(document.uri, context.word);

        // Check cache
        const cached = this.hoverCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return cached.hover;
        }

        // Check for pending request
        const pending = this.pendingRequests.get(cacheKey);
        if (pending) {
            return pending;
        }

        // Create new request
        const requestPromise = this.generateHover(context, settings);
        this.pendingRequests.set(cacheKey, requestPromise);

        try {
            const hover = await requestPromise;
            if (hover) {
                this.hoverCache.set(cacheKey, { hover, timestamp: Date.now() });
            }
            return hover;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    /**
     * Extract context around the hover position
     */
    private extractContext(document: TextDocument, position: Position): HoverContext {
        const text = document.getText();
        const lines = text.split('\n');
        const lineText = lines[position.line] || '';

        // Extract word at position
        const word = this.extractWordAtPosition(lineText, position.character);

        // Get surrounding code (50 lines before and after)
        const startLine = Math.max(0, position.line - 10);
        const endLine = Math.min(lines.length - 1, position.line + 10);
        const surroundingCode = lines.slice(startLine, endLine + 1).join('\n');

        // Detect language
        const language = this.detectLanguage(document.uri);

        return {
            word,
            lineText,
            surroundingCode,
            language,
            lineNumber: position.line,
        };
    }

    /**
     * Extract word at cursor position
     */
    private extractWordAtPosition(lineText: string, character: number): string {
        // Find word boundaries
        const wordRegex = /[\w$]+/g;
        let match;
        while ((match = wordRegex.exec(lineText)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (start <= character && character <= end) {
                return match[0];
            }
        }
        return '';
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
            'cs': 'csharp',
            'rb': 'ruby',
            'php': 'php',
            'swift': 'swift',
            'kt': 'kotlin',
        };
        return languageMap[extension || ''] || 'plaintext';
    }

    /**
     * Generate hover content using AI
     */
    private async generateHover(
        context: HoverContext,
        settings: KimiSettings
    ): Promise<Hover | null> {
        if (!context.word) {
            return null;
        }

        try {
            // First, try to get local documentation
            const localDoc = this.getLocalDocumentation(context);
            
            // If we have a function call or complex expression, get AI enhancement
            if (this.shouldEnhanceWithAI(context)) {
                const aiEnhancement = await this.getAIEnhancement(context, settings);
                if (aiEnhancement) {
                    return {
                        contents: {
                            kind: MarkupKind.Markdown,
                            value: this.combineDocumentation(localDoc, aiEnhancement),
                        },
                    };
                }
            }

            // Return local documentation if available
            if (localDoc) {
                return {
                    contents: {
                        kind: MarkupKind.Markdown,
                        value: localDoc,
                    },
                };
            }

            return null;
        } catch (error) {
            console.error('Hover generation error:', error);
            return null;
        }
    }

    /**
     * Get local documentation from code analysis
     */
    private getLocalDocumentation(context: HoverContext): string | null {
        // Extract JSDoc/docstring comments
        const docRegex = /\/\*\*[\s\S]*?\*\/|("""[\s\S]*?""")|('''[\s\S]*?''')/;
        const match = context.surroundingCode.match(docRegex);
        
        if (match) {
            // Clean up the documentation
            let doc = match[0]
                .replace(/\/\*\*|\*\//g, '')
                .replace(/\*\s?/g, '')
                .replace(/"""|'''/g, '')
                .trim();
            return doc;
        }

        return null;
    }

    /**
     * Check if we should enhance with AI
     */
    private shouldEnhanceWithAI(context: HoverContext): boolean {
        // Enhance function calls, method invocations, etc.
        const patterns = [
            /\w+\s*\(/,           // Function call
            /\w+\s*:\s*\w+/,      // Type annotation
            /class\s+\w+/,        // Class definition
            /function\s+\w+/,     // Function definition
            /def\s+\w+/,          // Python function
            /import\s+\w+/,       // Import statement
            /from\s+\w+/,         // From import
        ];

        return patterns.some(pattern => 
            pattern.test(context.lineText) || 
            context.surroundingCode.includes(context.word)
        );
    }

    /**
     * Get AI-enhanced documentation
     */
    private async getAIEnhancement(
        context: HoverContext,
        settings: KimiSettings
    ): Promise<string | null> {
        const prompt = this.buildHoverPrompt(context);

        try {
            const response = await this.callKimiAPI(prompt, settings);
            if (!response || response.error) {
                return null;
            }

            return this.formatHoverContent(response.content, context);
        } catch (error) {
            console.error('AI hover error:', error);
            return null;
        }
    }

    /**
     * Build prompt for hover request
     */
    private buildHoverPrompt(context: HoverContext): string {
        return `Explain the symbol "${context.word}" in the following ${context.language} code context:

\`\`\`${context.language}
${context.surroundingCode}
\`\`\`

Provide a concise explanation including:
1. What "${context.word}" does (1-2 sentences)
2. Its type/signature if applicable
3. A brief code example showing usage
4. Any important notes or caveats

Format the response in Markdown. Be concise but informative.`;
    }

    /**
     * Format hover content from AI response
     */
    private formatHoverContent(content: string, context: HoverContext): string {
        // Remove any markdown code block wrapper if the AI added one
        let formatted = content.replace(/^```[\w]*\n?|\n?```$/g, '');
        
        // Add header
        const header = `### ${context.word} \`${context.language}\`\n\n`;
        
        return header + formatted;
    }

    /**
     * Combine local and AI documentation
     */
    private combineDocumentation(localDoc: string | null, aiDoc: string): string {
        const parts: string[] = [];

        if (aiDoc) {
            parts.push(aiDoc);
        }

        if (localDoc) {
            if (parts.length > 0) {
                parts.push('\n---\n');
                parts.push('**Documentation from source:**\n');
            }
            parts.push(localDoc);
        }

        // Add footer
        parts.push('\n\n---\n*Powered by Kimi AI* 🤖');

        return parts.join('\n');
    }

    /**
     * Get hover when no API key is configured
     */
    private getNoApiKeyHover(): Hover {
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: `### Kimi AI Hover\n\n` +
                       `⚠️ **API Key Not Configured**\n\n` +
                       `To enable AI-powered hover information:\n` +
                       `1. Open VS Code settings\n` +
                       `2. Search for "kimi.apiKey"\n` +
                       `3. Add your Moonshot AI API key`,
            },
        };
    }

    /**
     * Call Kimi API
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
                            content: 'You are a code documentation assistant. Provide clear, concise explanations.',
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    temperature: 0.3,
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
     * Generate cache key
     */
    private getCacheKey(uri: string, word: string): string {
        return `${uri}:${word}`;
    }

    /**
     * Clear expired cache entries
     */
    private clearExpiredCache(): void {
        const now = Date.now();
        const entriesToDelete: string[] = [];
        this.hoverCache.forEach((entry, key) => {
            if (now - entry.timestamp > this.cacheTimeout) {
                entriesToDelete.push(key);
            }
        });
        entriesToDelete.forEach(key => this.hoverCache.delete(key));
    }
}
