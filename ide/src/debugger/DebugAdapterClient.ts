/**
 * Debug Adapter Protocol (DAP) Client
 * IDE Kimi IDE - Debugger Framework
 */

import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import {
    DAPMessage,
    DAPRequest,
    DAPResponse,
    DAPEvent,
    DebugAdapterCapabilities,
    EventEmitter,
    Disposable
} from './types';

// ============================================================================
// Connection Types
// ============================================================================

export type ConnectionType = 'stdio' | 'socket';

export interface DebugAdapterClientOptions {
    /** Тип соединения */
    connectionType: ConnectionType;
    /** Команда для запуска adapter */
    command?: string;
    /** Аргументы для команды */
    args?: string[];
    /** Рабочая директория */
    cwd?: string;
    /** Переменные окружения */
    env?: NodeJS.ProcessEnv;
    /** Хост для socket соединения */
    host?: string;
    /** Порт для socket соединения */
    port?: number;
    /** Таймаут инициализации */
    initializationTimeout?: number;
}

// ============================================================================
// Connection State
// ============================================================================

export enum ConnectionState {
    Disconnected = 'disconnected',
    Connecting = 'connecting',
    Connected = 'connected',
    Error = 'error',
    Closing = 'closing'
}

// ============================================================================
// Events
// ============================================================================

export interface ConnectionStateChangedEvent {
    state: ConnectionState;
    previousState: ConnectionState;
    error?: Error;
}

export interface MessageReceivedEvent {
    message: DAPMessage;
}

export interface EventReceivedEvent {
    event: string;
    body?: any;
}

// ============================================================================
// Initialize Arguments
// ============================================================================

export interface InitializeRequestArguments {
    /** ID клиента */
    clientID?: string;
    /** Имя клиента */
    clientName?: string;
    /** Версия адаптера */
    adapterID: string;
    /** Версия языка */
    locale?: string;
    /** Поддержка строк для breakpoint lines */
    linesStartAt1?: boolean;
    /** Поддержка строк для breakpoint columns */
    columnsStartAt1?: boolean;
    /** Поддержка Unicode в Positions */
    pathFormat?: 'path' | 'uri';
    /** Поддержка variable paging */
    supportsVariablePaging?: boolean;
    /** Поддержка runInTerminal request */
    supportsRunInTerminalRequest?: boolean;
    /** Поддержка memory references */
    supportsMemoryReferences?: boolean;
    /** Поддержка progress reporting */
    supportsProgressReporting?: boolean;
    /** Поддержка invalidate event */
    supportsInvalidatedEvent?: boolean;
    /** Поддержка memory event */
    supportsMemoryEvent?: boolean;
}

// ============================================================================
// Debug Adapter Client
// ============================================================================

/**
 * Клиент для общения с Debug Adapter через DAP
 * 
 * @example
 * ```typescript
 * const client = new DebugAdapterClient({
 *   connectionType: 'stdio',
 *   command: 'python',
 *   args: ['-m', 'debugpy.adapter']
 * });
 * 
 * await client.connect();
 * 
 * const result = await client.sendRequest('initialize', {
 *   adapterID: 'python'
 * });
 * ```
 */
export class DebugAdapterClient implements Disposable {
    private process: ChildProcess | null = null;
    private socket: net.Socket | null = null;
    private state: ConnectionState = ConnectionState.Disconnected;
    private messageSeq = 0;
    private pendingRequests: Map<number, { resolve: Function; reject: Function }> = new Map();
    private buffer: string = '';
    private capabilities: DebugAdapterCapabilities | null = null;

    // Event emitters
    private onStateChangedEmitter = new EventEmitter<ConnectionStateChangedEvent>();
    private onMessageReceivedEmitter = new EventEmitter<MessageReceivedEvent>();
    private onEventReceivedEmitter = new EventEmitter<EventReceivedEvent>();
    private onErrorEmitter = new EventEmitter<Error>();
    private onCloseEmitter = new EventEmitter<void>();

    constructor(private options: DebugAdapterClientOptions) {
        this.options = {
            initializationTimeout: 30000,
            args: [],
            ...options
        };
    }

    // ============================================================================
    // Connection Management
    // ============================================================================

    /**
     * Подключиться к debug adapter
     */
    async connect(): Promise<DebugAdapterCapabilities> {
        if (this.state !== ConnectionState.Disconnected) {
            throw new Error(`Cannot connect: current state is ${this.state}`);
        }

        this.setState(ConnectionState.Connecting);

        try {
            if (this.options.connectionType === 'stdio') {
                await this.connectStdio();
            } else {
                await this.connectSocket();
            }

            // Initialize
            const initResult = await this.initialize({
                adapterID: 'ide-traitor',
                clientName: 'IDE Kimi IDE',
                clientID: 'ide-traitor',
                linesStartAt1: true,
                columnsStartAt1: true,
                pathFormat: 'path',
                supportsVariablePaging: true,
                supportsRunInTerminalRequest: false,
                supportsMemoryReferences: true,
                supportsProgressReporting: true,
                supportsInvalidatedEvent: true,
                supportsMemoryEvent: true
            });

            this.capabilities = initResult;
            this.setState(ConnectionState.Connected);

            return initResult;
        } catch (error) {
            this.setState(ConnectionState.Error, error as Error);
            throw error;
        }
    }

    /**
     * Отключиться от debug adapter
     */
    async disconnect(): Promise<void> {
        if (this.state === ConnectionState.Disconnected) {
            return;
        }

        this.setState(ConnectionState.Closing);

        try {
            // Try to send disconnect request
            if (this.state === ConnectionState.Connected) {
                await this.sendRequest('disconnect', { restart: false });
            }
        } catch {
            // Ignore errors during disconnect
        }

        this.cleanup();
        this.setState(ConnectionState.Disconnected);
    }

    /**
     * Проверка подключения
     */
    get connected(): boolean {
        return this.state === ConnectionState.Connected;
    }

    /**
     * Получить текущее состояние
     */
    get connectionState(): ConnectionState {
        return this.state;
    }

    /**
     * Получить capabilities адаптера
     */
    get adapterCapabilities(): DebugAdapterCapabilities | null {
        return this.capabilities;
    }

    // ============================================================================
    // Request Handling
    // ============================================================================

    /**
     * Отправить request к debug adapter
     */
    sendRequest<T = any>(command: string, args?: any): Promise<T> {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('Not connected to debug adapter'));
                return;
            }

            const seq = ++this.messageSeq;
            const request: DAPRequest = {
                seq,
                type: 'request',
                command,
                arguments: args
            };

            this.pendingRequests.set(seq, { resolve, reject });
            this.sendMessage(request);

            // Таймаут
            setTimeout(() => {
                if (this.pendingRequests.has(seq)) {
                    this.pendingRequests.delete(seq);
                    reject(new Error(`Request '${command}' timed out`));
                }
            }, this.options.initializationTimeout);
        });
    }

    // ============================================================================
    // Events
    // ============================================================================

    /**
     * Событие изменения состояния подключения
     */
    get onStateChanged(): EventEmitter<ConnectionStateChangedEvent> {
        return this.onStateChangedEmitter;
    }

    /**
     * Событие получения сообщения
     */
    get onMessageReceived(): EventEmitter<MessageReceivedEvent> {
        return this.onMessageReceivedEmitter;
    }

    /**
     * Событие получения event от адаптера
     */
    get onEventReceived(): EventEmitter<EventReceivedEvent> {
        return this.onEventReceivedEmitter;
    }

    /**
     * Событие ошибки
     */
    get onError(): EventEmitter<Error> {
        return this.onErrorEmitter;
    }

    /**
     * Событие закрытия подключения
     */
    get onClose(): EventEmitter<void> {
        return this.onCloseEmitter;
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private async connectStdio(): Promise<void> {
        return new Promise((resolve, reject) => {
            const { command, args = [], cwd, env } = this.options;

            if (!command) {
                reject(new Error('Command is required for stdio connection'));
                return;
            }

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
                console.error(`[Debug Adapter] ${message}`);
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

            setTimeout(resolve, 100);
        });
    }

    private async connectSocket(): Promise<void> {
        return new Promise((resolve, reject) => {
            const { host = '127.0.0.1', port } = this.options;

            if (!port) {
                reject(new Error('Port is required for socket connection'));
                return;
            }

            this.socket = new net.Socket();

            this.socket.on('data', (data: Buffer) => {
                this.handleData(data);
            });

            this.socket.on('error', (error) => {
                this.onErrorEmitter.emit(error);
                reject(error);
            });

            this.socket.on('close', () => {
                this.onCloseEmitter.emit();
                if (this.state !== ConnectionState.Closing) {
                    this.cleanup();
                    this.setState(ConnectionState.Disconnected);
                }
            });

            this.socket.connect(port, host, () => {
                resolve();
            });
        });
    }

    private async initialize(args: InitializeRequestArguments): Promise<DebugAdapterCapabilities> {
        const result = await this.sendRequest<{
            capabilities: DebugAdapterCapabilities
        }>('initialize', args);
        return result.capabilities;
    }

    private sendMessage(message: DAPRequest): void {
        const json = JSON.stringify(message);
        const data = `Content-Length: ${Buffer.byteLength(json, 'utf8')}\r\n\r\n${json}`;

        if (this.options.connectionType === 'stdio' && this.process?.stdin) {
            this.process.stdin.write(data);
        } else if (this.socket) {
            this.socket.write(data);
        } else {
            throw new Error('No connection available');
        }
    }

    private handleData(data: Buffer): void {
        this.buffer += data.toString('utf8');

        while (true) {
            // Парсинг Content-Length заголовка
            const headerMatch = this.buffer.match(/^Content-Length: (\d+)\r\n/);
            if (!headerMatch) {
                break;
            }

            const contentLength = parseInt(headerMatch[1], 10);
            const headerEnd = this.buffer.indexOf('\r\n\r\n');

            if (headerEnd === -1) {
                break;
            }

            const messageStart = headerEnd + 4;
            const messageEnd = messageStart + contentLength;

            if (this.buffer.length < messageEnd) {
                break;
            }

            const jsonMessage = this.buffer.substring(messageStart, messageEnd);
            this.buffer = this.buffer.substring(messageEnd);

            try {
                const message = JSON.parse(jsonMessage) as DAPMessage;
                this.handleMessage(message);
            } catch (error) {
                console.error('Failed to parse DAP message:', error);
            }
        }
    }

    private handleMessage(message: DAPMessage): void {
        this.onMessageReceivedEmitter.emit({ message });

        if (message.type === 'response') {
            this.handleResponse(message as DAPResponse);
        } else if (message.type === 'event') {
            this.handleEvent(message as DAPEvent);
        }
    }

    private handleResponse(response: DAPResponse): void {
        const pending = this.pendingRequests.get(response.request_seq);
        if (!pending) {
            console.warn(`Received response for unknown request seq: ${response.request_seq}`);
            return;
        }

        this.pendingRequests.delete(response.request_seq);

        if (!response.success) {
            const error = new Error(`DAP Error: ${response.message || 'Unknown error'}`);
            (error as any).command = response.command;
            pending.reject(error);
        } else {
            pending.resolve(response.body);
        }
    }

    private handleEvent(event: DAPEvent): void {
        this.onEventReceivedEmitter.emit({
            event: event.event,
            body: event.body
        });
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
        // Отклоняем все pending requests
        for (const [seq, { reject }] of this.pendingRequests) {
            reject(new Error('Connection closed'));
        }
        this.pendingRequests.clear();

        // Закрываем процесс
        if (this.process) {
            this.process.kill();
            this.process = null;
        }

        // Закрываем socket
        if (this.socket) {
            this.socket.destroy();
            this.socket = null;
        }

        this.buffer = '';
        this.capabilities = null;
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.disconnect().catch(console.error);
        this.onStateChangedEmitter.dispose();
        this.onMessageReceivedEmitter.dispose();
        this.onEventReceivedEmitter.dispose();
        this.onErrorEmitter.dispose();
        this.onCloseEmitter.dispose();
    }
}
