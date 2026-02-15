/**
 * Kimi IDE Extension - Type Definitions
 * 
 * Централизованные TypeScript типы и интерфейсы для всего расширения.
 */

import * as vscode from 'vscode';

// =============================================================================
// Core API Types
// =============================================================================

/**
 * Kimi API response structure
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
 * Options for Kimi API requests
 */
export interface KimiApiOptions {
    signal?: AbortSignal;
    temperature?: number;
    maxTokens?: number;
    stream?: boolean;
}

/**
 * Streaming response chunk
 */
export interface StreamChunk {
    content: string;
    done: boolean;
}

// =============================================================================
// Chat Types
// =============================================================================

/**
 * Chat message role
 */
export type ChatMessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Chat message status
 */
export type ChatMessageStatus = 
    | 'sending' 
    | 'thinking' 
    | 'tool_executing' 
    | 'complete' 
    | 'error' 
    | 'cancelled';

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
 * Chat message structure
 */
export interface ChatMessage {
    id: string;
    role: ChatMessageRole;
    content: string;
    timestamp: number;
    status?: ChatMessageStatus;
    toolCalls?: ToolCall[];
    metadata?: Record<string, any>;
}

/**
 * Chat conversation
 */
export interface ChatConversation {
    id: string;
    title: string;
    messages: ChatMessage[];
    createdAt: number;
    updatedAt: number;
    context?: ChatContext;
}

/**
 * Chat context
 */
export interface ChatContext {
    files: ContextFile[];
    selection?: string;
    terminalOutput?: string;
    customData?: Record<string, any>;
}

/**
 * File in chat context
 */
export interface ContextFile {
    uri: vscode.Uri;
    path: string;
    content: string;
    language: string;
}

// =============================================================================
// Editor Types
// =============================================================================

/**
 * Inline edit session
 */
export interface InlineEditSession {
    id: string;
    editor: vscode.TextEditor;
    originalRange: vscode.Range;
    originalText: string;
    decorationType: vscode.TextEditorDecorationType;
    inputBox?: vscode.InputBox;
    webviewPanel?: vscode.WebviewPanel;
    suggestedEdit?: string;
}

/**
 * Diff view configuration
 */
export interface DiffViewConfig {
    originalUri: vscode.Uri;
    modifiedUri: vscode.Uri;
    title: string;
}

/**
 * Line diff result
 */
export interface LineDiffResult {
    type: 'added' | 'removed' | 'unchanged';
    content: string;
    oldLine?: number;
    newLine?: number;
}

/**
 * Code context for editing
 */
export interface CodeContext {
    before: string;
    after: string;
}

/**
 * Edit request payload
 */
export interface EditRequest {
    code: string;
    instruction: string;
    language: string;
    context: CodeContext;
}

// =============================================================================
// Code Action Types
// =============================================================================

/**
 * AI action types
 */
export type AiActionType =
    | 'explain'
    | 'fix'
    | 'optimize'
    | 'generateTests'
    | 'addDocs'
    | 'refactor'
    | 'generateCode'
    | 'inlineEdit';

/**
 * AI action metadata
 */
export interface AiAction {
    type: AiActionType;
    title: string;
    icon: string;
    description: string;
    kind: vscode.CodeActionKind;
}

// =============================================================================
// Terminal Types
// =============================================================================

/**
 * Terminal execution result
 */
export interface TerminalExecutionResult {
    exitCode: number | undefined;
    output: string;
    command: string;
}

/**
 * Terminal session
 */
export interface TerminalSession {
    terminal: vscode.Terminal;
    id: string;
    name: string;
    shellIntegration?: vscode.TerminalShellIntegration;
}

// =============================================================================
// Context/Indexer Types
// =============================================================================

/**
 * Symbol kinds (mirrors VS Code symbol kinds)
 */
export enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25,
}

/**
 * Code symbol
 */
export interface CodeSymbol {
    name: string;
    kind: SymbolKind;
    range: { start: number; end: number };
    children?: CodeSymbol[];
    documentation?: string;
}

/**
 * File index entry
 */
export interface FileIndex {
    uri: string;
    relativePath: string;
    content: string;
    contentHash: string;
    lastModified: number;
    size: number;
    language: string;
    vector: DocumentVector;
    symbols: CodeSymbol[];
    summary?: string;
}

/**
 * Document vector for TF-IDF
 */
export interface DocumentVector {
    terms: Map<string, number>;
    magnitude: number;
}

/**
 * Search result
 */
export interface SearchResult {
    uri: string;
    relativePath: string;
    similarity: number;
    size: number;
    language: string;
}

/**
 * Code symbol search result
 */
export interface CodeSymbolResult {
    name: string;
    kind: SymbolKind;
    uri: string;
    relativePath: string;
    range: { start: number; end: number };
}

/**
 * File context
 */
export interface FileContext {
    uri: string;
    relativePath: string;
    content: string;
    symbols: CodeSymbol[];
    summary?: string;
}

/**
 * Index statistics
 */
export interface IndexStats {
    totalFiles: number;
    totalSize: number;
    languages: Record<string, number>;
    isIndexing: boolean;
}

/**
 * Index configuration
 */
export interface IndexConfig {
    excludePatterns: string[];
    includePatterns: string[];
    maxFileSize: number;
    supportedLanguages: string[];
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Extension configuration
 */
export interface KimiExtensionConfig {
    // API Configuration
    apiKey: string;
    baseUrl: string;
    model: string;
    
    // Generation Configuration
    maxTokens: number;
    temperature: number;
    topP: number;
    
    // Feature Configuration
    enableCodeActions: boolean;
    enableInlineEdit: boolean;
    enableStatusBar: boolean;
    enableLSP: boolean;
    enableStreaming: boolean;
    enableTools: boolean;
    
    // UI Configuration
    theme: string;
    fontSize: number;
    showLineNumbers: boolean;
    wordWrap: boolean;
    
    // Behavior Configuration
    autoSave: boolean;
    confirmCodeExecution: boolean;
    includeGitContext: boolean;
    includeTerminalContext: boolean;
    
    // Debug Configuration
    debug: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    logToFile: boolean;
    
    // State
    hasSeenWelcome: boolean;
}

/**
 * API configuration
 */
export interface ApiConfig {
    apiKey: string;
    baseUrl: string;
    model: string;
    maxTokens: number;
    temperature: number;
}

// =============================================================================
// Wire Protocol Types
// =============================================================================

/**
 * Wire client status
 */
export type WireClientStatus = 
    | 'disconnected'
    | 'connecting'
    | 'connected'
    | 'error';

/**
 * Turn begin payload
 */
export interface TurnBeginPayload {
    turn_id: string;
    user_input: string;
    timestamp: string;
}

/**
 * Turn end payload
 */
export interface TurnEndPayload {
    turn_id: string;
    finish_reason: string;
    error?: string;
}

/**
 * Step begin payload
 */
export interface StepBeginPayload {
    step_id: string;
    type: string;
    description?: string;
}

/**
 * Step end payload
 */
export interface StepEndPayload {
    step_id: string;
    status: 'success' | 'error' | 'cancelled';
    error?: string;
}

/**
 * Content part types
 */
export type ContentPartType = 'text' | 'think' | 'tool_call' | 'tool_result' | 'error';

/**
 * Content part
 */
export interface ContentPart {
    type: ContentPartType;
    text?: string;
    content?: string;
    tool_call?: ToolCallInfo;
    message?: string;
}

/**
 * Tool call info
 */
export interface ToolCallInfo {
    id: string;
    name: string;
    arguments: Record<string, any>;
}

/**
 * Tool result
 */
export interface ToolResult {
    tool_call_id: string;
    output?: string;
    error?: string;
    is_error: boolean;
}

/**
 * Approval request payload
 */
export interface ApprovalRequestPayload {
    request_id: string;
    type: 'tool_call' | 'file_write' | 'command_execute' | 'external_request';
    description: string;
    details: unknown;
}

/**
 * Tool approval details
 */
export interface ToolApprovalDetails {
    tool_name: string;
    arguments: Record<string, any>;
}

/**
 * File write approval details
 */
export interface FileWriteApprovalDetails {
    file_path: string;
    content_preview: string;
    is_create: boolean;
    is_delete: boolean;
}

/**
 * Command approval details
 */
export interface CommandApprovalDetails {
    command: string;
    cwd: string;
    args: string[];
}

/**
 * External request details
 */
export interface ExternalRequestDetails {
    url: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
}

/**
 * Status update payload
 */
export interface StatusUpdatePayload {
    type: 'connected' | 'disconnected' | 'processing' | 'error' | 'busy' | 'idle';
    message?: string;
    progress?: {
        current: number;
        total: number;
        message?: string;
    };
}

// =============================================================================
// Status Bar Types
// =============================================================================

/**
 * Kimi status
 */
export type KimiStatus = 'idle' | 'thinking' | 'error' | 'ready' | 'busy';

/**
 * Status update event
 */
export interface StatusUpdateEvent {
    status: KimiStatus;
    previousStatus: KimiStatus;
    message?: string;
}

// =============================================================================
// Event Types
// =============================================================================

/**
 * Extension event map
 */
export interface ExtensionEvents {
    // Chat events
    'chat:message': { message: ChatMessage };
    'chat:typing': { isTyping: boolean };
    'chat:clear': void;
    
    // Status events
    'status:change': StatusUpdateEvent;
    
    // Context events
    'context:update': { context: ChatContext };
    'context:file:add': { file: ContextFile };
    'context:file:remove': { path: string };
    
    // Tool events
    'tool:execute': { toolCall: ToolCall };
    'tool:complete': { toolCall: ToolCall; result: any };
    'tool:error': { toolCall: ToolCall; error: string };
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Disposable with async cleanup
 */
export interface AsyncDisposable {
    dispose(): Promise<void>;
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> = 
    | { success: true; data: T }
    | { success: false; error: E };

/**
 * Optional promise type
 */
export type MaybePromise<T> = T | Promise<T>;

/**
 * Event listener type
 */
export type EventListener<T> = (event: T) => void | Promise<void>;

/**
 * Nullable type
 */
export type Nullable<T> = T | null | undefined;

// =============================================================================
// Provider Types
// =============================================================================

/**
 * Inline completion item with metadata
 */
export interface InlineCompletionItemWithMetadata extends vscode.InlineCompletionItem {
    metadata?: {
        source: 'lsp' | 'api' | 'cache';
        confidence: number;
        model?: string;
    };
}

/**
 * Code action with AI metadata
 */
export interface CodeActionWithAiMetadata extends vscode.CodeAction {
    aiMetadata?: {
        actionType: AiActionType;
        requiresApi: boolean;
        estimatedTokens?: number;
    };
}
