/**
 * Language Client - LSP (Language Server Protocol) client implementation
 * IDE Kimi IDE - Language Support Framework
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter, Disposable } from './types';

// ============================================================================
// JSON-RPC Types
// ============================================================================

interface JsonRpcMessage {
    jsonrpc: '2.0';
}

interface JsonRpcRequest extends JsonRpcMessage {
    id: number | string;
    method: string;
    params?: any;
}

interface JsonRpcNotification extends JsonRpcMessage {
    method: string;
    params?: any;
}

interface JsonRpcResponse extends JsonRpcMessage {
    id: number | string | null;
    result?: any;
    error?: JsonRpcError;
}

interface JsonRpcError {
    code: number;
    message: string;
    data?: any;
}

// ============================================================================
// LSP Connection Events
// ============================================================================

export interface ConnectionStateChangedEvent {
    state: ConnectionState;
    previousState: ConnectionState;
    error?: Error;
}

export interface MessageReceivedEvent {
    message: JsonRpcMessage;
}

export interface NotificationReceivedEvent {
    method: string;
    params: any;
}

export enum ConnectionState {
    Disconnected = 'disconnected',
    Connecting = 'connecting',
    Connected = 'connected',
    Error = 'error',
    Closing = 'closing'
}

// ============================================================================
// LSP Connection Options
// ============================================================================

export interface LanguageClientOptions {
    /** Command to start the language server */
    command: string;
    /** Arguments for the command */
    args?: string[];
    /** Working directory for the server process */
    cwd?: string;
    /** Environment variables for the server process */
    env?: NodeJS.ProcessEnv;
    /** Timeout for initialization in milliseconds */
    initializationTimeout?: number;
    /** Reconnection attempts */
    reconnectionAttempts?: number;
    /** Reconnection delay in milliseconds */
    reconnectionDelay?: number;
    /** Additional initialization options */
    initializationOptions?: any;
}

export interface InitializeParams {
    processId: number | null;
    clientInfo?: {
        name: string;
        version?: string;
    };
    locale?: string;
    rootPath?: string | null;
    rootUri: string | null;
    capabilities: ClientCapabilities;
    workspaceFolders?: WorkspaceFolder[] | null;
    initializationOptions?: any;
}

export interface ClientCapabilities {
    [key: string]: any;
}

export interface WorkspaceFolder {
    uri: string;
    name: string;
}

export interface InitializeResult {
    capabilities: ServerCapabilities;
    serverInfo?: {
        name: string;
        version?: string;
    };
}

export interface ServerCapabilities {
    [key: string]: any;
}

// ============================================================================
// Language Client
// ============================================================================

/**
 * Language Client for LSP (Language Server Protocol) communication
 * 
 * This class manages the connection to a language server process and provides
 * methods to send requests and receive notifications.
 * 
 * @example
 * ```typescript
 * const client = new LanguageClient({
 *   command: 'typescript-language-server',
 *   args: ['--stdio']
 * });
 * 
 * await client.connect('/path/to/project');
 * 
 * // Send a request
 * const result = await client.sendRequest('textDocument/hover', {
 *   textDocument: { uri: 'file:///path/to/file.ts' },
 *   position: { line: 10, character: 5 }
 * });
 * 
 * // Listen for notifications
 * client.onNotification('textDocument/publishDiagnostics', (params) => {
 *   console.log('Diagnostics:', params);
 * });
 * ```
 */
export class LanguageClient implements Disposable {
    private process: ChildProcess | null = null;
    private state: ConnectionState = ConnectionState.Disconnected;
    private messageId = 0;
    private pendingRequests: Map<number | string, { resolve: Function; reject: Function }> = new Map();
    private notificationHandlers: Map<string, ((params: any) => void)[]> = new Map();
    private buffer: string = '';
    
    private options: LanguageClientOptions;
    private initializeParams: InitializeParams | null = null;
    private serverCapabilities: ServerCapabilities | null = null;

    // Event emitters
    private onStateChangedEmitter = new EventEmitter<ConnectionStateChangedEvent>();
    private onMessageReceivedEmitter = new EventEmitter<MessageReceivedEvent>();
    private onNotificationReceivedEmitter = new EventEmitter<NotificationReceivedEvent>();
    private onErrorEmitter = new EventEmitter<Error>();
    private onCloseEmitter = new EventEmitter<void>();

    /**
     * Create a new LanguageClient
     * @param options - Configuration options for the language server
     */
    constructor(options: LanguageClientOptions) {
        this.options = {
            initializationTimeout: 30000,
            reconnectionAttempts: 3,
            reconnectionDelay: 1000,
            ...options
        };
    }

    // ============================================================================
    // Connection Management
    // ============================================================================

    /**
     * Connect to the language server and initialize
     * @param rootUri - Root URI of the project (file://)
     * @param capabilities - Client capabilities
     * @returns Promise resolving to initialize result
     */
    async connect(
        rootUri: string | null,
        capabilities: ClientCapabilities = {}
    ): Promise<InitializeResult> {
        if (this.state !== ConnectionState.Disconnected) {
            throw new Error(`Cannot connect: current state is ${this.state}`);
        }

        this.setState(ConnectionState.Connecting);

        try {
            await this.startProcess();
            
            const result = await this.initialize(rootUri, capabilities);
            this.serverCapabilities = result.capabilities;
            
            this.setState(ConnectionState.Connected);
            
            return result;
        } catch (error) {
            this.setState(ConnectionState.Error, error as Error);
            throw error;
        }
    }

    /**
     * Disconnect from the language server
     */
    async disconnect(): Promise<void> {
        if (this.state === ConnectionState.Disconnected) {
            return;
        }

        this.setState(ConnectionState.Closing);

        // Send shutdown request if connected
        if (this.state === ConnectionState.Connected) {
            try {
                await this.sendRequest('shutdown');
                this.sendNotification('exit');
            } catch (error) {
                // Ignore errors during shutdown
            }
        }

        this.cleanup();
        this.setState(ConnectionState.Disconnected);
    }

    /**
     * Check if the client is connected
     */
    get connected(): boolean {
        return this.state === ConnectionState.Connected;
    }

    /**
     * Get the current connection state
     */
    get connectionState(): ConnectionState {
        return this.state;
    }

    /**
     * Get server capabilities (available after initialization)
     */
    get capabilities(): ServerCapabilities | null {
        return this.serverCapabilities;
    }

    // ============================================================================
    // Request/Notification Handling
    // ============================================================================

    /**
     * Send a request to the language server
     * @param method - LSP method name
     * @param params - Method parameters
     * @returns Promise resolving to the result
     * 
     * @example
     * ```typescript
     * const result = await client.sendRequest('textDocument/hover', {
     *   textDocument: { uri: 'file:///path/to/file.ts' },
     *   position: { line: 10, character: 5 }
     * });
     * ```
     */
    sendRequest<T = any>(method: string, params?: any): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!this.process || this.state !== ConnectionState.Connected) {
                reject(new Error('Not connected to language server'));
                return;
            }

            const id = ++this.messageId;
            const request: JsonRpcRequest = {
                jsonrpc: '2.0',
                id,
                method,
                params
            };

            this.pendingRequests.set(id, { resolve, reject });
            this.sendMessage(request);

            // Set timeout for request
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`Request '${method}' timed out`));
                }
            }, this.options.initializationTimeout);
        });
    }

    /**
     * Send a notification to the language server
     * @param method - LSP method name
     * @param params - Method parameters
     * 
     * @example
     * ```typescript
     * client.sendNotification('textDocument/didOpen', {
     *   textDocument: {
     *     uri: 'file:///path/to/file.ts',
     *     languageId: 'typescript',
     *     version: 1,
     *     text: fileContent
     *   }
     * });
     * ```
     */
    sendNotification(method: string, params?: any): void {
        if (!this.process) {
            throw new Error('Not connected to language server');
        }

        const notification: JsonRpcNotification = {
            jsonrpc: '2.0',
            method,
            params
        };

        this.sendMessage(notification);
    }

    /**
     * Register a handler for notifications from the server
     * @param method - LSP method name to listen for
     * @param handler - Handler function
     * @returns Disposable to remove the handler
     * 
     * @example
     * ```typescript
     * client.onNotification('textDocument/publishDiagnostics', (params) => {
     *   console.log('Received diagnostics:', params.diagnostics);
     * });
     * ```
     */
    onNotification(method: string, handler: (params: any) => void): Disposable {
        if (!this.notificationHandlers.has(method)) {
            this.notificationHandlers.set(method, []);
        }
        
        const handlers = this.notificationHandlers.get(method)!;
        handlers.push(handler);

        return {
            dispose: () => {
                const index = handlers.indexOf(handler);
                if (index !== -1) {
                    handlers.splice(index, 1);
                }
            }
        };
    }

    // ============================================================================
    // Events
    // ============================================================================

    /**
     * Event fired when connection state changes
     */
    get onStateChanged(): EventEmitter<ConnectionStateChangedEvent> {
        return this.onStateChangedEmitter;
    }

    /**
     * Event fired when any message is received
     */
    get onMessageReceived(): EventEmitter<MessageReceivedEvent> {
        return this.onMessageReceivedEmitter;
    }

    /**
     * Event fired when a notification is received
     */
    get onNotificationReceived(): EventEmitter<NotificationReceivedEvent> {
        return this.onNotificationReceivedEmitter;
    }

    /**
     * Event fired on error
     */
    get onError(): EventEmitter<Error> {
        return this.onErrorEmitter;
    }

    /**
     * Event fired when connection closes
     */
    get onClose(): EventEmitter<void> {
        return this.onCloseEmitter;
    }

    // ============================================================================
    // LSP-specific Helpers
    // ============================================================================

    /**
     * Send textDocument/didOpen notification
     */
    didOpenTextDocument(uri: string, languageId: string, version: number, text: string): void {
        this.sendNotification('textDocument/didOpen', {
            textDocument: { uri, languageId, version, text }
        });
    }

    /**
     * Send textDocument/didChange notification
     */
    didChangeTextDocument(uri: string, version: number, changes: TextDocumentContentChangeEvent[]): void {
        this.sendNotification('textDocument/didChange', {
            textDocument: { uri, version },
            contentChanges: changes
        });
    }

    /**
     * Send textDocument/didClose notification
     */
    didCloseTextDocument(uri: string): void {
        this.sendNotification('textDocument/didClose', {
            textDocument: { uri }
        });
    }

    /**
     * Send textDocument/didSave notification
     */
    didSaveTextDocument(uri: string, text?: string): void {
        const params: { textDocument: { uri: string }; text?: string } = {
            textDocument: { uri }
        };
        if (text !== undefined) {
            params.text = text;
        }
        this.sendNotification('textDocument/didSave', params);
    }

    /**
     * Send workspace/didChangeConfiguration notification
     */
    didChangeConfiguration(settings: any): void {
        this.sendNotification('workspace/didChangeConfiguration', {
            settings
        });
    }

    /**
     * Send workspace/didChangeWorkspaceFolders notification
     */
    didChangeWorkspaceFolders(added: WorkspaceFolder[], removed: WorkspaceFolder[]): void {
        this.sendNotification('workspace/didChangeWorkspaceFolders', {
            event: { added, removed }
        });
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private async startProcess(): Promise<void> {
        return new Promise((resolve, reject) => {
            const { command, args = [], cwd, env } = this.options;

            this.process = spawn(command, args, {
                cwd,
                env: { ...process.env, ...env },
                stdio: ['pipe', 'pipe', 'pipe']
            });

            this.process.stdout?.on('data', (data: Buffer) => {
                this.handleData(data);
            });

            this.process.stderr?.on('data', (data: Buffer) => {
                const message = data.toString();
                console.error(`[Language Server ${command}] ${message}`);
            });

            this.process.on('error', (error) => {
                this.onErrorEmitter.emit(error);
                reject(error);
            });

            this.process.on('close', (code) => {
                this.onCloseEmitter.emit();
                if (this.state !== ConnectionState.Closing) {
                    this.cleanup();
                    this.setState(ConnectionState.Disconnected);
                }
            });

            // Give the process a moment to start
            setTimeout(resolve, 100);
        });
    }

    private async initialize(
        rootUri: string | null,
        capabilities: ClientCapabilities
    ): Promise<InitializeResult> {
        this.initializeParams = {
            processId: process.pid,
            clientInfo: {
                name: 'IDE Kimi IDE',
                version: '1.0.0'
            },
            rootUri,
            capabilities,
            workspaceFolders: rootUri ? [{ uri: rootUri, name: 'root' }] : null,
            initializationOptions: this.options.initializationOptions
        };

        return this.sendRequest('initialize', this.initializeParams);
    }

    private sendMessage(message: JsonRpcRequest | JsonRpcNotification): void {
        if (!this.process?.stdin) {
            throw new Error('Language server process not available');
        }

        const json = JSON.stringify(message);
        const data = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n${json}`;
        
        this.process.stdin.write(data);
    }

    private handleData(data: Buffer): void {
        this.buffer += data.toString();
        
        while (true) {
            // Parse Content-Length header
            const headerMatch = this.buffer.match(/^Content-Length: (\d+)\r\n/);
            if (!headerMatch) {
                break;
            }

            const contentLength = parseInt(headerMatch[1], 10);
            const headerEnd = this.buffer.indexOf('\r\n\r\n');
            
            if (headerEnd === -1) {
                break; // Header not complete
            }

            const messageStart = headerEnd + 4;
            const messageEnd = messageStart + contentLength;

            if (this.buffer.length < messageEnd) {
                break; // Message not complete
            }

            // Extract and parse the JSON message
            const jsonMessage = this.buffer.substring(messageStart, messageEnd);
            this.buffer = this.buffer.substring(messageEnd);

            try {
                const message = JSON.parse(jsonMessage) as JsonRpcMessage;
                this.handleMessage(message);
            } catch (error) {
                console.error('Failed to parse LSP message:', error);
            }
        }
    }

    private handleMessage(message: JsonRpcMessage): void {
        this.onMessageReceivedEmitter.emit({ message });

        if ('id' in message) {
            // This is a response
            const response = message as JsonRpcResponse;
            this.handleResponse(response);
        } else {
            // This is a notification
            const notification = message as JsonRpcNotification;
            this.handleNotification(notification);
        }
    }

    private handleResponse(response: JsonRpcResponse): void {
        if (response.id === null) return;

        const pending = this.pendingRequests.get(response.id);
        if (!pending) {
            console.warn(`Received response for unknown request ID: ${response.id}`);
            return;
        }

        this.pendingRequests.delete(response.id);

        if (response.error) {
            const error = new Error(
                `LSP Error (${response.error.code}): ${response.error.message}`
            );
            (error as any).code = response.error.code;
            (error as any).data = response.error.data;
            pending.reject(error);
        } else {
            pending.resolve(response.result);
        }
    }

    private handleNotification(notification: JsonRpcNotification): void {
        this.onNotificationReceivedEmitter.emit({
            method: notification.method,
            params: notification.params
        });

        const handlers = this.notificationHandlers.get(notification.method);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(notification.params);
                } catch (error) {
                    console.error(`Error in notification handler for ${notification.method}:`, error);
                }
            });
        }
    }

    private setState(newState: ConnectionState, error?: Error): void {
        const previousState = this.state;
        this.state = newState;
        
        this.onStateChangedEmitter.emit({
            state: newState,
            previousState,
            error
        });
    }

    private cleanup(): void {
        // Reject all pending requests
        for (const [id, { reject }] of this.pendingRequests) {
            reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();

        // Kill the process
        if (this.process) {
            this.process.kill();
            this.process = null;
        }

        this.buffer = '';
    }

    /**
     * Dispose of the client and clean up resources
     */
    dispose(): void {
        this.disconnect().catch(console.error);
        this.onStateChangedEmitter.dispose();
        this.onMessageReceivedEmitter.dispose();
        this.onNotificationReceivedEmitter.dispose();
        this.onErrorEmitter.dispose();
        this.onCloseEmitter.dispose();
    }
}

// ============================================================================
// Helper Types
// ============================================================================

export interface TextDocumentContentChangeEvent {
    range?: {
        start: { line: number; character: number };
        end: { line: number; character: number };
    };
    rangeLength?: number;
    text: string;
}

/**
 * Create a basic client capabilities object
 */
export function createClientCapabilities(): ClientCapabilities {
    return {
        textDocument: {
            synchronization: {
                dynamicRegistration: false,
                willSave: true,
                willSaveWaitUntil: true,
                didSave: true
            },
            completion: {
                dynamicRegistration: false,
                completionItem: {
                    snippetSupport: true,
                    commitCharactersSupport: true,
                    documentationFormat: ['markdown', 'plaintext'],
                    deprecatedSupport: true,
                    preselectSupport: true
                }
            },
            hover: {
                dynamicRegistration: false,
                contentFormat: ['markdown', 'plaintext']
            },
            definition: {
                dynamicRegistration: false,
                linkSupport: true
            },
            documentSymbol: {
                dynamicRegistration: false,
                hierarchicalDocumentSymbolSupport: true
            },
            codeAction: {
                dynamicRegistration: false
            },
            formatting: {
                dynamicRegistration: false
            },
            rename: {
                dynamicRegistration: false
            },
            publishDiagnostics: {
                relatedInformation: true,
                versionSupport: true
            }
        },
        workspace: {
            applyEdit: true,
            workspaceEdit: {
                documentChanges: true
            },
            didChangeConfiguration: {
                dynamicRegistration: false
            },
            didChangeWorkspaceFolders: {
                dynamicRegistration: false
            },
            workspaceFolders: true,
            configuration: true
        }
    };
}
