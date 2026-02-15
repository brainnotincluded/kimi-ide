/**
 * Kimi Signature Help Provider
 * 
 * Provides AI-powered signature help including:
 * - Function signature information
 * - Parameter descriptions
 * - Active parameter highlighting
 * - Usage examples
 */

import {
    SignatureHelp,
    SignatureInformation,
    ParameterInformation,
    Position,
    MarkupKind,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';

interface KimiSettings {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
    model: string;
}

interface SignatureContext {
    functionName: string;
    currentParams: string;
    paramIndex: number;
    lineText: string;
    surroundingCode: string;
    language: string;
}

interface ParsedSignature {
    label: string;
    documentation?: string;
    parameters: ParameterInformation[];
}

export class KimiSignatureHelpProvider {
    private signatureCache: Map<string, { help: SignatureHelp; timestamp: number }> = new Map();
    private cacheTimeout: number = 300000; // 5 minutes

    constructor(private settings: KimiSettings) {}

    /**
     * Provide signature help for the given position
     */
    async provideSignatureHelp(
        document: TextDocument,
        position: Position,
        settings: KimiSettings
    ): Promise<SignatureHelp | null> {
        if (!settings.apiKey) {
            return null;
        }

        const context = this.extractSignatureContext(document, position);
        if (!context.functionName) {
            return null;
        }

        const cacheKey = this.getCacheKey(document.uri, context.functionName);
        
        // Check cache
        const cached = this.signatureCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            return this.updateActiveParameter(cached.help, context.paramIndex);
        }

        try {
            const signatureHelp = await this.generateSignatureHelp(context, settings);
            if (signatureHelp) {
                this.signatureCache.set(cacheKey, { 
                    help: signatureHelp, 
                    timestamp: Date.now() 
                });
            }
            return signatureHelp;
        } catch (error) {
            console.error('Signature help error:', error);
            return null;
        }
    }

    /**
     * Extract signature context from document
     */
    private extractSignatureContext(
        document: TextDocument,
        position: Position
    ): SignatureContext {
        const text = document.getText();
        const lines = text.split('\n');
        const lineText = lines[position.line] || '';

        // Get text up to cursor
        const textBeforeCursor = lineText.substring(0, position.character);

        // Find function name and current parameter index
        const { functionName, paramIndex } = this.parseFunctionCall(textBeforeCursor);

        // Get surrounding code for context
        const startLine = Math.max(0, position.line - 10);
        const endLine = Math.min(lines.length - 1, position.line + 5);
        const surroundingCode = lines.slice(startLine, endLine + 1).join('\n');

        // Extract current parameters being typed
        const currentParams = this.extractCurrentParams(textBeforeCursor);

        // Detect language
        const language = this.detectLanguage(document.uri);

        return {
            functionName,
            currentParams,
            paramIndex,
            lineText,
            surroundingCode,
            language,
        };
    }

    /**
     * Parse function call to extract name and parameter index
     */
    private parseFunctionCall(textBeforeCursor: string): { functionName: string; paramIndex: number } {
        // Match patterns like: functionName(, obj.method(, Class.method(
        const functionCallRegex = /(\w+(?:\.\w+)*)\s*\(([^)]*)$/;
        const match = textBeforeCursor.match(functionCallRegex);

        if (!match) {
            return { functionName: '', paramIndex: 0 };
        }

        const functionName = match[1];
        const paramsText = match[2];

        // Count parameters (handling nested parentheses and quotes)
        let paramIndex = 0;
        let parenDepth = 0;
        let inString = false;
        let stringChar = '';

        for (const char of paramsText) {
            if (!inString) {
                if (char === '(' || char === '[' || char === '{') {
                    parenDepth++;
                } else if (char === ')' || char === ']' || char === '}') {
                    parenDepth--;
                } else if (char === '"' || char === "'" || char === '`') {
                    inString = true;
                    stringChar = char;
                } else if (char === ',' && parenDepth === 0) {
                    paramIndex++;
                }
            } else {
                if (char === stringChar && paramsText[paramsText.indexOf(char) - 1] !== '\\') {
                    inString = false;
                }
            }
        }

        return { functionName, paramIndex };
    }

    /**
     * Extract current parameters from text
     */
    private extractCurrentParams(textBeforeCursor: string): string {
        const match = textBeforeCursor.match(/\(([^)]*)$/);
        return match ? match[1].trim() : '';
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
     * Generate signature help using AI
     */
    private async generateSignatureHelp(
        context: SignatureContext,
        settings: KimiSettings
    ): Promise<SignatureHelp | null> {
        const prompt = this.buildSignaturePrompt(context);

        try {
            const response = await this.callKimiAPI(prompt, settings);
            if (!response || response.error || !response.content) {
                return null;
            }

            const parsedSignature = this.parseSignatureResponse(response.content, context);
            if (!parsedSignature) {
                return null;
            }

            const signatureInfo: SignatureInformation = {
                label: parsedSignature.label,
                documentation: parsedSignature.documentation ? {
                    kind: MarkupKind.Markdown,
                    value: parsedSignature.documentation,
                } : undefined,
                parameters: parsedSignature.parameters,
            };

            return {
                signatures: [signatureInfo],
                activeSignature: 0,
                activeParameter: context.paramIndex,
            };
        } catch (error) {
            console.error('AI signature help error:', error);
            return null;
        }
    }

    /**
     * Build prompt for signature help
     */
    private buildSignaturePrompt(context: SignatureContext): string {
        return `Provide signature help for the function "${context.functionName}" in ${context.language}.

Context:
\`\`\`${context.language}
${context.surroundingCode}
\`\`\`

Current call: ${context.functionName}(${context.currentParams})
Parameter index: ${context.paramIndex}

Provide the following in JSON format:
{
  "label": "function signature (e.g., functionName(param1: Type1, param2: Type2): ReturnType)",
  "documentation": "Brief description of what the function does",
  "parameters": [
    { "label": "param1: Type1", "documentation": "Description of param1" },
    { "label": "param2: Type2", "documentation": "Description of param2" }
  ],
  "returnDescription": "Description of return value"
}

Be concise but informative. Use Markdown in documentation fields.`;
    }

    /**
     * Parse AI response into signature information
     */
    private parseSignatureResponse(content: string, context: SignatureContext): ParsedSignature | null {
        try {
            // Try to extract JSON from the response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return null;
            }

            const data = JSON.parse(jsonMatch[0]);

            // Build the signature label
            let label = data.label || `${context.functionName}()`;
            
            // Ensure parameters array exists
            const parameters: ParameterInformation[] = [];
            if (Array.isArray(data.parameters)) {
                for (const param of data.parameters) {
                    parameters.push({
                        label: param.label || 'param',
                        documentation: param.documentation ? {
                            kind: MarkupKind.Markdown,
                            value: param.documentation,
                        } : undefined,
                    });
                }
            }

            // Build documentation
            let documentation = data.documentation || '';
            if (data.returnDescription) {
                documentation += `\n\n**Returns:** ${data.returnDescription}`;
            }

            // Add usage example
            documentation += this.generateUsageExample(context, parameters);

            return {
                label,
                documentation,
                parameters,
            };
        } catch (error) {
            // If JSON parsing fails, try to create a simple signature
            return this.createSimpleSignature(content, context);
        }
    }

    /**
     * Create a simple signature from plain text
     */
    private createSimpleSignature(content: string, context: SignatureContext): ParsedSignature | null {
        const lines = content.split('\n').filter(line => line.trim());
        
        // First line is likely the signature
        const label = lines[0]?.trim() || `${context.functionName}()`;
        
        // Rest is documentation
        const documentation = lines.slice(1).join('\n').trim();

        // Try to extract parameters from the label
        const paramMatch = label.match(/\((.*?)\)/);
        const parameters: ParameterInformation[] = [];
        
        if (paramMatch) {
            const paramList = paramMatch[1].split(',').map(p => p.trim()).filter(p => p);
            for (const param of paramList) {
                parameters.push({
                    label: param,
                });
            }
        }

        return {
            label,
            documentation: documentation || undefined,
            parameters,
        };
    }

    /**
     * Generate usage example for the signature
     */
    private generateUsageExample(
        context: SignatureContext,
        parameters: ParameterInformation[]
    ): string {
        const exampleParams = parameters.map((p, i) => {
            const label = typeof p.label === 'string' ? p.label : '';
            const paramName = label.split(':')[0].split('=')[0].trim();
            return `<${paramName}>`;
        }).join(', ');

        return `\n\n**Example:**\n\`\`\`${context.language}\n` +
               `${context.functionName}(${exampleParams});\n` +
               `\`\`\``;
    }

    /**
     * Update active parameter in cached signature help
     */
    private updateActiveParameter(help: SignatureHelp, paramIndex: number): SignatureHelp {
        const maxParam = (help.signatures[0]?.parameters?.length ?? 1) - 1;
        return {
            ...help,
            activeParameter: Math.min(paramIndex, Math.max(0, maxParam)),
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
                            content: 'You are a code documentation assistant. Provide function signatures in JSON format.',
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
     * Generate cache key
     */
    private getCacheKey(uri: string, functionName: string): string {
        return `${uri}:${functionName}`;
    }

    /**
     * Clear expired cache entries
     */
    clearCache(): void {
        const now = Date.now();
        const entriesToDelete: string[] = [];
        this.signatureCache.forEach((entry, key) => {
            if (now - entry.timestamp > this.cacheTimeout) {
                entriesToDelete.push(key);
            }
        });
        entriesToDelete.forEach(key => this.signatureCache.delete(key));
    }
}
