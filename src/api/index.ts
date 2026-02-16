/**
 * Kimi IDE Extension - Public API
 * 
 * Этот модуль предоставляет публичный API для других VS Code extension,
 * которые хотят интегрироваться с Kimi IDE.
 * 
 * @example
 * ```typescript
 * const kimi = vscode.extensions.getExtension('kimi-ide').exports;
 * 
 * // Send a message to Kimi
 * const response = await kimi.sendMessage('Explain this code');
 * 
 * // Listen for responses
 * kimi.onDidReceiveMessage((message) => {
 *     console.log('Received:', message.content);
 * });
 * ```
 */

import * as vscode from 'vscode';
import { KimiApi, KimiApiOptions } from '../kimi/apiAdapter';
import { ContextResolver } from '../context/contextResolver';

// =============================================================================
// API Types
// =============================================================================

/**
 * API версии
 */
export const API_VERSION = '1.0.0';

/**
 * Статус расширения
 */
export type ExtensionStatus = 
    | 'initializing'
    | 'ready'
    | 'busy'
    | 'error'
    | 'disconnected';

/**
 * Тип сообщения
 */
export interface ChatMessage {
    /** Unique message ID */
    id: string;
    /** Message role */
    role: 'user' | 'assistant' | 'system';
    /** Message content */
    content: string;
    /** Timestamp */
    timestamp: number;
    /** Message status */
    status?: 'sending' | 'thinking' | 'complete' | 'error';
    /** Tool calls if any */
    toolCalls?: ToolCall[];
}

/**
 * Tool call information
 */
export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
    result?: any;
    status: 'pending' | 'running' | 'complete' | 'error';
}

/**
 * Context information
 */
export interface KimiContext {
    /** Current file path */
    currentFile?: string;
    /** Selected text */
    selectedText?: string;
    /** Programming language */
    language?: string;
    /** Open files */
    openFiles?: string[];
    /** Related files from indexer */
    relatedFiles?: string[];
    /** Terminal output */
    terminalOutput?: string;
    /** Custom context data */
    customData?: Record<string, any>;
}

/**
 * Response from API
 */
export interface ApiResponse {
    /** Response content */
    content: string;
    /** Error message if failed */
    error?: string;
    /** Token usage */
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
}

/**
 * Streaming response chunk
 */
export interface StreamChunk {
    /** Chunk content */
    content: string;
    /** Whether this is the final chunk */
    done: boolean;
}

/**
 * Configuration options
 */
export interface ApiConfiguration {
    /** API key */
    apiKey?: string;
    /** Base URL */
    baseUrl?: string;
    /** Model ID */
    model?: string;
    /** Temperature */
    temperature?: number;
    /** Max tokens */
    maxTokens?: number;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Event: Message received
 */
export interface MessageReceivedEvent {
    message: ChatMessage;
    conversationId: string;
}

/**
 * Event: Status changed
 */
export interface StatusChangedEvent {
    previousStatus: ExtensionStatus;
    currentStatus: ExtensionStatus;
    message?: string;
}

/**
 * Event: Context changed
 */
export interface ContextChangedEvent {
    previousContext: KimiContext;
    currentContext: KimiContext;
    changes: string[];
}

/**
 * Event: Tool execution
 */
export interface ToolExecutionEvent {
    toolCallId: string;
    toolName: string;
    status: 'started' | 'completed' | 'failed';
    result?: any;
    error?: string;
}

// =============================================================================
// Public API Interface
// =============================================================================

/**
 * Kimi Extension API
 * 
 * Основной интерфейс для взаимодействия с Kimi IDE из других extension.
 */
export interface KimiPublicApi {
    /** API version */
    readonly version: string;
    
    /** Current extension status */
    readonly status: ExtensionStatus;
    
    // -------------------------------------------------------------------------
    // Core Methods
    // -------------------------------------------------------------------------
    
    /**
     * Send a message to Kimi and get response
     * 
     * @param message - User message
     * @param options - API options
     * @returns Promise with response
     * 
     * @example
     * ```typescript
     * const response = await kimi.sendMessage('Explain async/await in Python');
     * console.log(response.content);
     * ```
     */
    sendMessage(message: string, options?: KimiApiOptions): Promise<ApiResponse>;
    
    /**
     * Send a message with streaming response
     * 
     * @param message - User message
     * @param options - API options
     * @returns Async generator yielding chunks
     * 
     * @example
     * ```typescript
     * for await (const chunk of kimi.streamMessage('Write a function')) {
     *     process.stdout.write(chunk.content);
     * }
     * ```
     */
    streamMessage(message: string, options?: KimiApiOptions): AsyncGenerator<StreamChunk, void, unknown>;
    
    /**
     * Generate code from description
     * 
     * @param description - Code description
     * @param language - Target language
     * @param options - Additional options
     * @returns Generated code
     */
    generateCode(
        description: string,
        language?: string,
        options?: KimiApiOptions
    ): Promise<ApiResponse>;
    
    /**
     * Explain code
     * 
     * @param code - Code to explain
     * @param language - Programming language
     * @returns Explanation
     */
    explainCode(
        code: string,
        language?: string,
        options?: KimiApiOptions
    ): Promise<ApiResponse>;
    
    /**
     * Fix code issues
     * 
     * @param code - Code to fix
     * @param language - Programming language
     * @returns Fixed code
     */
    fixCode(
        code: string,
        language?: string,
        options?: KimiApiOptions
    ): Promise<ApiResponse>;
    
    /**
     * Generate tests for code
     * 
     * @param code - Code to test
     * @param language - Programming language
     * @returns Generated tests
     */
    generateTests(
        code: string,
        language?: string,
        options?: KimiApiOptions
    ): Promise<ApiResponse>;
    
    // -------------------------------------------------------------------------
    // Context Methods
    // -------------------------------------------------------------------------
    
    /**
     * Get current context
     * 
     * @returns Current context
     */
    getContext(): KimiContext;
    
    /**
     * Set context data
     * 
     * @param context - Context to set
     */
    setContext(context: Partial<KimiContext>): void;
    
    /**
     * Add file to context
     * 
     * @param uri - File URI
     * @returns Success status
     */
    addFileToContext(uri: vscode.Uri): Promise<boolean>;
    
    /**
     * Add text to context
     * 
     * @param text - Text to add
     * @param label - Optional label
     */
    addTextToContext(text: string, label?: string): void;
    
    /**
     * Clear context
     */
    clearContext(): void;
    
    // -------------------------------------------------------------------------
    // Conversation Methods
    // -------------------------------------------------------------------------
    
    /**
     * Create new conversation
     * 
     * @returns Conversation ID
     */
    createConversation(): string;
    
    /**
     * Get conversation history
     * 
     * @param conversationId - Conversation ID
     * @returns Message history
     */
    getConversationHistory(conversationId?: string): ChatMessage[];
    
    /**
     * Clear conversation
     * 
     * @param conversationId - Conversation ID
     */
    clearConversation(conversationId?: string): void;
    
    // -------------------------------------------------------------------------
    // Configuration Methods
    // -------------------------------------------------------------------------
    
    /**
     * Update configuration
     * 
     * @param config - Configuration to update
     */
    configure(config: Partial<ApiConfiguration>): Promise<void>;
    
    /**
     * Get current configuration
     * 
     * @returns Current configuration
     */
    getConfiguration(): ApiConfiguration;
    
    /**
     * Check if API is ready
     * 
     * @returns Ready status
     */
    isReady(): boolean;
    
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------
    
    /** Event fired when message is received */
    readonly onDidReceiveMessage: vscode.Event<MessageReceivedEvent>;
    
    /** Event fired when status changes */
    readonly onDidChangeStatus: vscode.Event<StatusChangedEvent>;
    
    /** Event fired when context changes */
    readonly onDidChangeContext: vscode.Event<ContextChangedEvent>;
    
    /** Event fired when tool is executed */
    readonly onDidExecuteTool: vscode.Event<ToolExecutionEvent>;
}

// =============================================================================
// API Implementation
// =============================================================================

/**
 * Создать публичный API instance
 * 
 * @internal
 */
export function createPublicApi(
    kimiApi: KimiApi,
    contextResolver: ContextResolver
): KimiPublicApi {
    const messageEmitter = new vscode.EventEmitter<MessageReceivedEvent>();
    const statusEmitter = new vscode.EventEmitter<StatusChangedEvent>();
    const contextEmitter = new vscode.EventEmitter<ContextChangedEvent>();
    const toolEmitter = new vscode.EventEmitter<ToolExecutionEvent>();
    
    let currentStatus: ExtensionStatus = 'initializing';
    let currentContext: KimiContext = {};
    let conversationId = `conv-${Date.now()}`;
    const conversations = new Map<string, ChatMessage[]>();
    
    function setStatus(newStatus: ExtensionStatus, message?: string): void {
        const previousStatus = currentStatus;
        currentStatus = newStatus;
        statusEmitter.fire({ previousStatus, currentStatus, message });
    }
    
    function updateContext(changes: Partial<KimiContext>): void {
        const previousContext = { ...currentContext };
        currentContext = { ...currentContext, ...changes };
        
        const changedKeys = Object.keys(changes).filter(
            key => JSON.stringify(previousContext[key as keyof KimiContext]) !== 
                   JSON.stringify(changes[key as keyof KimiContext])
        );
        
        if (changedKeys.length > 0) {
            contextEmitter.fire({ previousContext, currentContext, changes: changedKeys });
        }
    }
    
    return {
        version: API_VERSION,
        
        get status() {
            return currentStatus;
        },
        
        // Core Methods
        async sendMessage(message: string, options?: KimiApiOptions): Promise<ApiResponse> {
            setStatus('busy', 'Processing message...');
            
            try {
                const response = await kimiApi.generateResponse(message, options);
                
                if (!response.error) {
                    const msg: ChatMessage = {
                        id: `msg-${Date.now()}`,
                        role: 'assistant',
                        content: response.content,
                        timestamp: Date.now(),
                        status: 'complete',
                    };
                    
                    // Store in conversation
                    const history = conversations.get(conversationId) || [];
                    history.push(msg);
                    conversations.set(conversationId, history);
                    
                    messageEmitter.fire({ message: msg, conversationId });
                }
                
                setStatus('ready');
                return response;
            } catch (error) {
                setStatus('error', error instanceof Error ? error.message : 'Unknown error');
                throw error;
            }
        },
        
        async *streamMessage(message: string, options?: KimiApiOptions): AsyncGenerator<StreamChunk, void, unknown> {
            setStatus('busy', 'Streaming response...');
            
            try {
                for await (const chunk of kimiApi.streamResponse(message, options)) {
                    yield { content: chunk, done: false };
                }
                
                yield { content: '', done: true };
                setStatus('ready');
            } catch (error) {
                setStatus('error', error instanceof Error ? error.message : 'Unknown error');
                throw error;
            }
        },
        
        async generateCode(description: string, language?: string, options?: KimiApiOptions): Promise<ApiResponse> {
            const prompt = `Generate ${language || ''} code for: ${description}`;
            return this.sendMessage(prompt, { ...options, temperature: 0.3 });
        },
        
        async explainCode(code: string, language?: string, options?: KimiApiOptions): Promise<ApiResponse> {
            const prompt = `Explain this ${language || ''} code:\n\n\`\`\`\n${code}\n\`\`\``;
            return this.sendMessage(prompt, options);
        },
        
        async fixCode(code: string, language?: string, options?: KimiApiOptions): Promise<ApiResponse> {
            const prompt = `Fix issues in this ${language || ''} code and return only the fixed code:\n\n\`\`\`\n${code}\n\`\`\``;
            return this.sendMessage(prompt, { ...options, temperature: 0.2 });
        },
        
        async generateTests(code: string, language?: string, options?: KimiApiOptions): Promise<ApiResponse> {
            const prompt = `Generate unit tests for this ${language || ''} code:\n\n\`\`\`\n${code}\n\`\`\``;
            return this.sendMessage(prompt, options);
        },
        
        // Context Methods
        getContext(): KimiContext {
            return { ...currentContext };
        },
        
        setContext(context: Partial<KimiContext>): void {
            updateContext(context);
        },
        
        async addFileToContext(uri: vscode.Uri): Promise<boolean> {
            try {
                const context = await contextResolver.resolveFileContext(uri.fsPath);
                if (context) {
                    updateContext({
                        customData: {
                            ...currentContext.customData,
                            [uri.fsPath]: context,
                        },
                    });
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        },
        
        addTextToContext(text: string, label?: string): void {
            const key = label || `text-${Date.now()}`;
            updateContext({
                customData: {
                    ...currentContext.customData,
                    [key]: text,
                },
            });
        },
        
        clearContext(): void {
            currentContext = {};
            contextEmitter.fire({ 
                previousContext: currentContext, 
                currentContext: {}, 
                changes: ['all'] 
            });
        },
        
        // Conversation Methods
        createConversation(): string {
            conversationId = `conv-${Date.now()}`;
            conversations.set(conversationId, []);
            return conversationId;
        },
        
        getConversationHistory(convId?: string): ChatMessage[] {
            const id = convId || conversationId;
            return [...(conversations.get(id) || [])];
        },
        
        clearConversation(convId?: string): void {
            const id = convId || conversationId;
            conversations.set(id, []);
        },
        
        // Configuration Methods
        async configure(config: Partial<ApiConfiguration>): Promise<void> {
            const vscodeConfig = vscode.workspace.getConfiguration('kimi');
            
            if (config.apiKey) {
                await vscodeConfig.update('apiKey', config.apiKey, true);
            }
            if (config.baseUrl) {
                await vscodeConfig.update('baseUrl', config.baseUrl, true);
            }
            if (config.model) {
                await vscodeConfig.update('model', config.model, true);
            }
            if (config.temperature !== undefined) {
                await vscodeConfig.update('temperature', config.temperature, true);
            }
            if (config.maxTokens) {
                await vscodeConfig.update('maxTokens', config.maxTokens, true);
            }
        },
        
        getConfiguration(): ApiConfiguration {
            const config = vscode.workspace.getConfiguration('kimi');
            return {
                apiKey: config.get<string>('apiKey') || '',
                baseUrl: config.get<string>('baseUrl') || 'https://api.moonshot.cn/v1',
                model: config.get<string>('model') || 'kimi-k2-5',
                temperature: config.get<number>('temperature') || 0.7,
                maxTokens: config.get<number>('maxTokens') || 4096,
            };
        },
        
        isReady(): boolean {
            return currentStatus === 'ready' || currentStatus === 'initializing';
        },
        
        // Events
        onDidReceiveMessage: messageEmitter.event,
        onDidChangeStatus: statusEmitter.event,
        onDidChangeContext: contextEmitter.event,
        onDidExecuteTool: toolEmitter.event,
    };
}

// =============================================================================
// Commands API
// =============================================================================

/**
 * Execute Kimi command programmatically
 * 
 * @param command - Command ID
 * @param args - Command arguments
 * @returns Command result
 */
export async function executeCommand<T>(command: string, ...args: any[]): Promise<T | undefined> {
    try {
        return await vscode.commands.executeCommand<T>(`kimi.${command}`, ...args);
    } catch (error) {
        console.error(`Failed to execute Kimi command: ${command}`, error);
        return undefined;
    }
}

/**
 * Available command IDs
 */
export const CommandIds = {
    OPEN_CHAT: 'openChat',
    EXPLAIN_CODE: 'explainCode',
    FIX_CODE: 'fixCode',
    GENERATE_CODE: 'generateCode',
    INLINE_EDIT: 'inlineEdit',
    CLEAR_CHAT: 'clearChat',
    STOP_GENERATION: 'stopGeneration',
    ADD_FILE_TO_CONTEXT: 'addFileToContext',
    CLEAR_CONTEXT: 'clearContext',
} as const;

// =============================================================================
// Utilities
// =============================================================================

/**
 * Check if Kimi IDE extension is installed and active
 * 
 * @returns Installation status
 */
export function isKimiInstalled(): boolean {
    const extension = vscode.extensions.getExtension('kimi-ide');
    return extension !== undefined;
}

/**
 * Get Kimi extension instance
 * 
 * @returns Extension instance or undefined
 */
export function getKimiExtension(): vscode.Extension<KimiPublicApi> | undefined {
    return vscode.extensions.getExtension<KimiPublicApi>('kimi-ide');
}

/**
 * Wait for Kimi extension to be ready
 * 
 * @param timeout - Timeout in milliseconds
 * @returns Promise resolving when ready
 */
export async function waitForKimi(timeout: number = 30000): Promise<KimiPublicApi | undefined> {
    const extension = getKimiExtension();
    
    if (!extension) {
        return undefined;
    }
    
    if (extension.isActive) {
        return extension.exports;
    }
    
    // Wait for activation
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (extension.isActive) {
            return extension.exports;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return undefined;
}
