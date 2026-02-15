import * as vscode from 'vscode';
import { KimiClient } from './kimiClient';

/**
 * Response from Kimi API
 */
export interface KimiApiResponse {
    content: string;
    error?: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * Options for API requests
 */
export interface KimiApiOptions {
    signal?: AbortSignal;
    temperature?: number;
    maxTokens?: number;
}

/**
 * Adapter for Kimi API operations
 * Can work with both HTTP API and Wire Protocol client
 */
export class KimiApi {
    private apiKey: string;
    private baseUrl: string;
    private model: string;
    private client?: KimiClient;

    constructor(client?: KimiClient) {
        this.client = client;
        
        const config = vscode.workspace.getConfiguration('kimi');
        this.apiKey = config.get<string>('apiKey') || '';
        this.baseUrl = config.get<string>('baseUrl') || 'https://api.moonshot.cn/v1';
        this.model = config.get<string>('model') || 'moonshot-v1-8k';

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration('kimi')) {
                const newConfig = vscode.workspace.getConfiguration('kimi');
                this.apiKey = newConfig.get<string>('apiKey') || '';
                this.baseUrl = newConfig.get<string>('baseUrl') || 'https://api.moonshot.cn/v1';
                this.model = newConfig.get<string>('model') || 'moonshot-v1-8k';
            }
        });
    }

    /**
     * Generate a response from Kimi API
     */
    public async generateResponse(
        prompt: string,
        options: KimiApiOptions = {}
    ): Promise<KimiApiResponse> {
        // If we have a wire client and it's active, use it
        if (this.client?.isActive()) {
            return this.generateWithClient(prompt);
        }

        // Otherwise use HTTP API
        return this.generateWithHttp(prompt, options);
    }

    /**
     * Generate an edit/continuation (optimized for code editing)
     */
    public async generateEdit(
        prompt: string,
        options: KimiApiOptions = {}
    ): Promise<KimiApiResponse> {
        // If we have a wire client and it's active, use it
        if (this.client?.isActive()) {
            return this.generateWithClient(prompt);
        }

        // Otherwise use HTTP API with lower temperature for edits
        return this.generateWithHttp(prompt, {
            ...options,
            temperature: options.temperature ?? 0.2,
        });
    }

    /**
     * Generate using HTTP API
     */
    private async generateWithHttp(
        prompt: string,
        options: KimiApiOptions
    ): Promise<KimiApiResponse> {
        if (!this.apiKey) {
            return {
                content: '',
                error: 'Kimi API key not configured. Please set it in settings (kimi.apiKey).',
            };
        }

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert code editor. Provide only code without explanations unless asked. Ensure code is properly formatted and syntactically correct.',
                        },
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                    temperature: options.temperature ?? 0.3,
                    max_tokens: options.maxTokens ?? 4096,
                    stream: false,
                }),
                signal: options.signal,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as any;
                throw new Error(
                    errorData.error?.message || `HTTP error! status: ${response.status}`
                );
            }

            const data = await response.json() as any;
            let content = data.choices?.[0]?.message?.content || '';

            // Clean up markdown code blocks if present
            content = this.extractCodeFromMarkdown(content);

            return {
                content,
                usage: data.usage ? {
                    promptTokens: data.usage.prompt_tokens,
                    completionTokens: data.usage.completion_tokens,
                    totalTokens: data.usage.total_tokens,
                } : undefined,
            };
        } catch (error) {
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    return { content: '', error: 'Request cancelled' };
                }
                return { content: '', error: error.message };
            }
            return { content: '', error: 'Unknown error occurred' };
        }
    }

    /**
     * Generate using Wire Protocol client
     */
    private async generateWithClient(prompt: string): Promise<KimiApiResponse> {
        if (!this.client) {
            return { content: '', error: 'Kimi client not available' };
        }

        return new Promise((resolve) => {
            let fullContent = '';
            let error: string | undefined;

            const timeout = setTimeout(() => {
                resolve({
                    content: fullContent || '',
                    error: error || (fullContent ? undefined : 'Request timeout'),
                });
            }, 60000);

            // Send message to client
            this.client!.sendMessage(prompt).catch((err) => {
                clearTimeout(timeout);
                resolve({ content: '', error: err.message });
            });

            // Listen for text responses
            const disposable = this.client!.on('text', (text: string) => {
                fullContent += text;
            });

            // Listen for turn end
            this.client!.on('turnEnd', (result: { error?: string }) => {
                clearTimeout(timeout);
                disposable.dispose();
                resolve({
                    content: this.extractCodeFromMarkdown(fullContent),
                    error: result.error,
                });
            });
        });
    }

    /**
     * Stream a response from Kimi API
     */
    public async *streamResponse(
        prompt: string,
        options: KimiApiOptions = {}
    ): AsyncGenerator<string, void, unknown> {
        if (!this.apiKey) {
            throw new Error('Kimi API key not configured');
        }

        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({
                model: this.model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert programming assistant.',
                    },
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                temperature: options.temperature ?? 0.3,
                max_tokens: options.maxTokens ?? 2048,
                stream: true,
            }),
            signal: options.signal,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({})) as any;
            throw new Error(
                errorData.error?.message || `HTTP error! status: ${response.status}`
            );
        }

        const reader = response.body?.getReader();
        if (!reader) {
            throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (!trimmedLine || !trimmedLine.startsWith('data as any: ')) continue;

                    const data = trimmedLine.slice(6);
                    if (data === '[DONE]') return;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            yield content;
                        }
                    } catch {
                        // Ignore parse errors for malformed chunks
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }

    /**
     * Extract code from markdown code blocks
     */
    private extractCodeFromMarkdown(content: string): string {
        // Check if content is wrapped in markdown code blocks
        const codeBlockRegex = /```[\w]*\n?([\s\S]*?)```/;
        const match = content.match(codeBlockRegex);
        
        if (match) {
            return match[1].trim();
        }

        // Remove inline code backticks if entire content is wrapped
        if (content.startsWith('`') && content.endsWith('`')) {
            return content.slice(1, -1).trim();
        }

        return content.trim();
    }

    /**
     * Validate API key by making a test request
     */
    public async validateApiKey(): Promise<{ valid: boolean; message: string }> {
        if (!this.apiKey) {
            return { valid: false, message: 'API key not configured' };
        }

        try {
            const response = await fetch(`${this.baseUrl}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                },
            });

            if (response.ok) {
                return { valid: true, message: 'API key is valid' };
            } else {
                const errorData = await response.json().catch(() => ({})) as any;
                return {
                    valid: false,
                    message: errorData.error?.message || `HTTP error: ${response.status}`,
                };
            }
        } catch (error) {
            return {
                valid: false,
                message: error instanceof Error ? error.message : 'Connection failed',
            };
        }
    }

    /**
     * Set the wire protocol client
     */
    public setClient(client: KimiClient | undefined): void {
        this.client = client;
    }
}
