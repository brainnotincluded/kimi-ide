/**
 * Common TypeScript types and interfaces for Kimi IDE extension
 */

import * as vscode from 'vscode';

// ============================================================================
// Message Types
// ============================================================================

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

export interface Message {
    id: string;
    role: MessageRole;
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

export interface ToolResult {
    toolCallId: string;
    output: string;
    isError?: boolean;
}

// ============================================================================
// Model Types
// ============================================================================

export interface ModelConfig {
    id: string;
    name: string;
    provider: string;
    maxTokens: number;
    contextWindow: number;
    supportsVision: boolean;
    supportsTools: boolean;
    temperature?: number;
    topP?: number;
}

export interface CompletionOptions {
    model?: string;
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    stream?: boolean;
    stopSequences?: string[];
}

export interface CompletionResponse {
    content: string;
    usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    finishReason?: string;
    toolCalls?: ToolCall[];
}

export interface StreamingChunk {
    content: string;
    isComplete: boolean;
    toolCalls?: ToolCall[];
}

// ============================================================================
// Context Types
// ============================================================================

export interface FileContext {
    uri: vscode.Uri;
    path: string;
    content: string;
    language: string;
    isActive: boolean;
    selection?: {
        text: string;
        startLine: number;
        endLine: number;
    };
}

export interface WorkspaceContext {
    files: FileContext[];
    openFiles: string[];
    activeFile?: string;
    terminalContent?: string;
}

export interface ContextProvider {
    id: string;
    name: string;
    getContext(): Promise<string>;
    isEnabled: boolean;
}

// ============================================================================
// Chat Types
// ============================================================================

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    model: string;
    createdAt: number;
    updatedAt: number;
    metadata?: Record<string, unknown>;
}

export interface ChatSettings {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt?: string;
    contextWindow: number;
}

// ============================================================================
// Command Types
// ============================================================================

export interface CommandDefinition {
    id: string;
    title: string;
    category?: string;
    icon?: string;
    when?: string;
    handler: (...args: unknown[]) => unknown;
}

export interface QuickAction {
    id: string;
    label: string;
    description?: string;
    icon?: string;
    shortcut?: string;
    handler: () => void | Promise<void>;
}

// ============================================================================
// Panel Types
// ============================================================================

export type PanelType = 'chat' | 'composer' | 'terminal' | 'settings';

export interface PanelState {
    isVisible: boolean;
    isLoading: boolean;
    error?: string;
}

export interface WebviewMessage {
    type: string;
    payload?: unknown;
}

// ============================================================================
// Settings Types
// ============================================================================

export interface ExtensionSettings {
    // API Settings
    apiKey: string;
    apiBaseUrl?: string;
    model: string;
    
    // Generation Settings
    temperature: number;
    maxTokens: number;
    topP: number;
    
    // UI Settings
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    showLineNumbers: boolean;
    wordWrap: boolean;
    
    // Behavior Settings
    autoSave: boolean;
    confirmCodeExecution: boolean;
    includeGitContext: boolean;
    includeTerminalContext: boolean;
    
    // Feature Flags
    enableStreaming: boolean;
    enableTools: boolean;
    enableVision: boolean;
    enableAutocomplete: boolean;
}

export type SettingsSection = 
    | 'api' 
    | 'generation' 
    | 'ui' 
    | 'behavior' 
    | 'features';

// ============================================================================
// Terminal Types
// ============================================================================

export interface TerminalCommand {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
}

export interface TerminalResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    duration: number;
}

export interface TerminalSession {
    id: string;
    name: string;
    shell: string;
    cwd: string;
    history: string[];
}

// ============================================================================
// Error Types
// ============================================================================

export class KimiError extends Error {
    constructor(
        message: string,
        public code: string,
        public isRetryable: boolean = false,
        public originalError?: unknown
    ) {
        super(message);
        this.name = 'KimiError';
    }
}

export enum ErrorCode {
    // API Errors
    API_KEY_MISSING = 'API_KEY_MISSING',
    API_REQUEST_FAILED = 'API_REQUEST_FAILED',
    API_RATE_LIMITED = 'API_RATE_LIMITED',
    API_TIMEOUT = 'API_TIMEOUT',
    
    // Model Errors
    MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
    MODEL_OVERLOADED = 'MODEL_OVERLOADED',
    CONTEXT_TOO_LONG = 'CONTEXT_TOO_LONG',
    
    // File Errors
    FILE_NOT_FOUND = 'FILE_NOT_FOUND',
    FILE_TOO_LARGE = 'FILE_TOO_LARGE',
    FILE_READ_ERROR = 'FILE_READ_ERROR',
    FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
    
    // Extension Errors
    EXTENSION_NOT_ACTIVATED = 'EXTENSION_NOT_ACTIVATED',
    COMMAND_NOT_FOUND = 'COMMAND_NOT_FOUND',
    INVALID_ARGUMENTS = 'INVALID_ARGUMENTS',
    OPERATION_CANCELLED = 'OPERATION_CANCELLED',
}

// ============================================================================
// Event Types
// ============================================================================

export interface EventHandlers {
    onMessageStart?: () => void;
    onMessageChunk?: (chunk: string) => void;
    onMessageComplete?: (message: Message) => void;
    onMessageError?: (error: KimiError) => void;
    onToolCall?: (toolCall: ToolCall) => void;
    onToolResult?: (result: ToolResult) => void;
}

// ============================================================================
// Utility Types
// ============================================================================

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type DeepPartial<T> = {
    [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type AsyncReturnType<T extends (...args: unknown[]) => Promise<unknown>> = 
    T extends (...args: unknown[]) => Promise<infer R> ? R : never;

export interface Disposable {
    dispose(): void;
}

export interface Cancellable {
    cancel(): void;
    isCancelled(): boolean;
}

// ============================================================================
// Status Types
// ============================================================================

export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

export interface StatusInfo {
    state: LoadingState;
    message?: string;
    progress?: number;
}

// ============================================================================
// Diff Types
// ============================================================================

export interface DiffBlock {
    type: 'context' | 'added' | 'removed';
    oldStartLine: number;
    oldEndLine: number;
    newStartLine: number;
    newEndLine: number;
    lines: string[];
}

export interface FileDiff {
    oldPath: string;
    newPath: string;
    isNewFile: boolean;
    isDeleted: boolean;
    blocks: DiffBlock[];
}

// ============================================================================
// Search Types
// ============================================================================

export interface SearchResult {
    uri: vscode.Uri;
    range: vscode.Range;
    preview: string;
    matches: vscode.Range[];
}

export interface SearchOptions {
    query: string;
    caseSensitive?: boolean;
    wholeWord?: boolean;
    regex?: boolean;
    include?: string[];
    exclude?: string[];
    maxResults?: number;
}

// ============================================================================
// Provider Types
// ============================================================================

export interface ProviderCapabilities {
    chat: boolean;
    completion: boolean;
    streaming: boolean;
    tools: boolean;
    vision: boolean;
    embeddings: boolean;
}

export interface ProviderConfig {
    id: string;
    name: string;
    apiKeyRequired: boolean;
    baseUrlConfigurable: boolean;
    capabilities: ProviderCapabilities;
    models: ModelConfig[];
}
