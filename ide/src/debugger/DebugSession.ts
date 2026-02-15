/**
 * Debug Session
 * IDE Kimi IDE - Debugger Framework
 */

import { DebugAdapterClient, ConnectionState } from './DebugAdapterClient';
import {
    DebugConfiguration,
    DebugSessionState,
    Thread,
    StackFrame,
    Scope,
    Variable,
    Breakpoint,
    SourceBreakpoint,
    StoppedEventBody,
    Source,
    EvaluateResult,
    EventEmitter,
    Disposable
} from './types';
import { ConfigurationValidator } from './DebugConfiguration';

// ============================================================================
// Events
// ============================================================================

export interface DebugSessionStateChangedEvent {
    state: DebugSessionState;
    previousState: DebugSessionState;
}

export interface StoppedEvent {
    body: StoppedEventBody;
}

export interface ContinuedEvent {
    threadId: number;
    allThreadsContinued?: boolean;
}

export interface ThreadEvent {
    reason: 'started' | 'exited';
    threadId: number;
}

export interface BreakpointEvent {
    reason: 'changed' | 'new' | 'removed';
    breakpoint: Breakpoint;
}

export interface OutputEvent {
    category?: 'console' | 'stdout' | 'stderr' | 'telemetry';
    output: string;
    variablesReference?: number;
    source?: Source;
    line?: number;
    column?: number;
}

export interface TerminatedEvent {
    restart?: any;
}

export interface ModuleEvent {
    reason: 'new' | 'changed' | 'removed';
    module: any;
}

// ============================================================================
// Launch Arguments
// ============================================================================

export interface LaunchRequestArguments {
    /** Нет стандартных полей - зависит от debug adapter */
    [key: string]: any;
}

export interface AttachRequestArguments {
    /** Нет стандартных полей - зависит от debug adapter */
    [key: string]: any;
}

// ============================================================================
// Debug Session
// ============================================================================

/**
 * Debug Session - управление сессией отладки
 * 
 * @example
 * ```typescript
 * const session = new DebugSession('session-1', config);
 * await session.start();
 * 
 * // Установить breakpoint
 * await session.setBreakpoints('/path/to/file.py', [{ line: 10 }]);
 * 
 * // Запустить
 * await session.continue();
 * 
 * // Получить стек вызовов
 * const frames = await session.getStackTrace();
 * ```
 */
export class DebugSession implements Disposable {
    private client: DebugAdapterClient;
    private state: DebugSessionState = DebugSessionState.Terminated;
    private threads: Map<number, Thread> = new Map();
    private activeThreadId: number | null = null;
    private breakpoints: Map<string, Breakpoint[]> = new Map();
    private disposables: Disposable[] = [];

    // Event emitters
    private onStateChangedEmitter = new EventEmitter<DebugSessionStateChangedEvent>();
    private onStoppedEmitter = new EventEmitter<StoppedEvent>();
    private onContinuedEmitter = new EventEmitter<ContinuedEvent>();
    private onThreadEmitter = new EventEmitter<ThreadEvent>();
    private onBreakpointEmitter = new EventEmitter<BreakpointEvent>();
    private onOutputEmitter = new EventEmitter<OutputEvent>();
    private onTerminatedEmitter = new EventEmitter<TerminatedEvent>();
    private onModuleEmitter = new EventEmitter<ModuleEvent>();

    constructor(
        public readonly id: string,
        public readonly configuration: DebugConfiguration
    ) {
        // Создаём client на основе конфигурации
        const adapterPath = ConfigurationValidator.getDebugAdapterPath(configuration.type);
        const adapterArgs = ConfigurationValidator.getDebugAdapterArgs(configuration.type);

        this.client = new DebugAdapterClient({
            connectionType: 'stdio',
            command: adapterPath,
            args: adapterArgs,
            cwd: configuration.cwd
        });

        this.setupEventHandlers();
    }

    // ============================================================================
    // Properties
    // ============================================================================

    get currentState(): DebugSessionState {
        return this.state;
    }

    get isRunning(): boolean {
        return this.state === DebugSessionState.Running;
    }

    get isStopped(): boolean {
        return this.state === DebugSessionState.Stopped;
    }

    get isTerminated(): boolean {
        return this.state === DebugSessionState.Terminated;
    }

    get clientCapabilities() {
        return this.client.adapterCapabilities;
    }

    get activeThread(): Thread | null {
        if (this.activeThreadId === null) return null;
        return this.threads.get(this.activeThreadId) || null;
    }

    // ============================================================================
    // Events
    // ============================================================================

    get onStateChanged(): EventEmitter<DebugSessionStateChangedEvent> {
        return this.onStateChangedEmitter;
    }

    get onStopped(): EventEmitter<StoppedEvent> {
        return this.onStoppedEmitter;
    }

    get onContinued(): EventEmitter<ContinuedEvent> {
        return this.onContinuedEmitter;
    }

    get onThread(): EventEmitter<ThreadEvent> {
        return this.onThreadEmitter;
    }

    get onBreakpoint(): EventEmitter<BreakpointEvent> {
        return this.onBreakpointEmitter;
    }

    get onOutput(): EventEmitter<OutputEvent> {
        return this.onOutputEmitter;
    }

    get onTerminated(): EventEmitter<TerminatedEvent> {
        return this.onTerminatedEmitter;
    }

    get onModule(): EventEmitter<ModuleEvent> {
        return this.onModuleEmitter;
    }

    // ============================================================================
    // Session Control
    // ============================================================================

    /**
     * Запустить debug сессию
     */
    async start(): Promise<void> {
        if (this.state !== DebugSessionState.Terminated) {
            throw new Error(`Cannot start: current state is ${this.state}`);
        }

        this.setState(DebugSessionState.Initializing);

        try {
            await this.client.connect();

            if (this.configuration.request === 'launch') {
                await this.launch();
            } else {
                await this.attach();
            }

            this.setState(DebugSessionState.Running);
        } catch (error) {
            this.setState(DebugSessionState.Terminated);
            throw error;
        }
    }

    /**
     * Остановить debug сессию
     */
    async stop(): Promise<void> {
        if (this.state === DebugSessionState.Terminated) {
            return;
        }

        this.setState(DebugSessionState.Terminating);

        try {
            await this.client.sendRequest('terminate', { restart: false });
        } catch {
            // Fallback to disconnect
            try {
                await this.client.disconnect();
            } catch {
                // Ignore
            }
        }

        this.setState(DebugSessionState.Terminated);
    }

    /**
     * Пауза выполнения
     */
    async pause(threadId?: number): Promise<void> {
        this.ensureRunning();
        
        await this.client.sendRequest('pause', {
            threadId: threadId ?? this.activeThreadId ?? 1
        });
        
        this.setState(DebugSessionState.Stopped);
    }

    /**
     * Продолжить выполнение
     */
    async continue(threadId?: number): Promise<void> {
        this.ensureStopped();

        await this.client.sendRequest('continue', {
            threadId: threadId ?? this.activeThreadId ?? 1,
            singleThread: false
        });

        this.setState(DebugSessionState.Running);
    }

    /**
     * Step over
     */
    async stepOver(threadId?: number): Promise<void> {
        this.ensureStopped();
        this.setState(DebugSessionState.Stepping);

        await this.client.sendRequest('next', {
            threadId: threadId ?? this.activeThreadId ?? 1,
            granularity: 'statement'
        });
    }

    /**
     * Step into
     */
    async stepInto(threadId?: number): Promise<void> {
        this.ensureStopped();
        this.setState(DebugSessionState.Stepping);

        await this.client.sendRequest('stepIn', {
            threadId: threadId ?? this.activeThreadId ?? 1,
            targetId: 0,
            granularity: 'statement'
        });
    }

    /**
     * Step out
     */
    async stepOut(threadId?: number): Promise<void> {
        this.ensureStopped();
        this.setState(DebugSessionState.Stepping);

        await this.client.sendRequest('stepOut', {
            threadId: threadId ?? this.activeThreadId ?? 1,
            granularity: 'statement'
        });
    }

    /**
     * Restart
     */
    async restart(): Promise<void> {
        await this.client.sendRequest('restart');
        this.setState(DebugSessionState.Running);
    }

    // ============================================================================
    // Breakpoints
    // ============================================================================

    /**
     * Установить breakpoints для файла
     */
    async setBreakpoints(
        sourcePath: string,
        breakpoints: SourceBreakpoint[]
    ): Promise<Breakpoint[]> {
        const result = await this.client.sendRequest<{
            breakpoints: Breakpoint[]
        }>('setBreakpoints', {
            source: { path: sourcePath },
            breakpoints,
            lines: breakpoints.map(b => b.line)
        });

        this.breakpoints.set(sourcePath, result.breakpoints);
        return result.breakpoints;
    }

    /**
     * Установить function breakpoints
     */
    async setFunctionBreakpoints(
        breakpoints: { name: string; condition?: string; hitCondition?: string }[]
    ): Promise<Breakpoint[]> {
        const result = await this.client.sendRequest<{
            breakpoints: Breakpoint[]
        }>('setFunctionBreakpoints', {
            breakpoints
        });

        return result.breakpoints;
    }

    /**
     * Удалить все breakpoints
     */
    async clearBreakpoints(sourcePath?: string): Promise<void> {
        if (sourcePath) {
            await this.setBreakpoints(sourcePath, []);
            this.breakpoints.delete(sourcePath);
        } else {
            // Очистить все
            for (const path of this.breakpoints.keys()) {
                await this.setBreakpoints(path, []);
            }
            this.breakpoints.clear();
        }
    }

    /**
     * Получить все breakpoints
     */
    getBreakpoints(): Map<string, Breakpoint[]> {
        return new Map(this.breakpoints);
    }

    // ============================================================================
    // Stack Trace & Variables
    // ============================================================================

    /**
     * Получить стек вызовов
     */
    async getStackTrace(
        threadId?: number,
        startFrame?: number,
        levels?: number
    ): Promise<StackFrame[]> {
        this.ensureStopped();

        const result = await this.client.sendRequest<{
            stackFrames: StackFrame[];
            totalFrames?: number;
        }>('stackTrace', {
            threadId: threadId ?? this.activeThreadId ?? 1,
            startFrame: startFrame ?? 0,
            levels: levels ?? 20
        });

        return result.stackFrames;
    }

    /**
     * Получить scopes для фрейма
     */
    async getScopes(frameId: number): Promise<Scope[]> {
        this.ensureStopped();

        const result = await this.client.sendRequest<{
            scopes: Scope[]
        }>('scopes', {
            frameId
        });

        return result.scopes;
    }

    /**
     * Получить переменные
     */
    async getVariables(variablesReference: number): Promise<Variable[]> {
        const result = await this.client.sendRequest<{
            variables: Variable[]
        }>('variables', {
            variablesReference,
            filter: 'named',
            start: 0,
            count: 100
        });

        return result.variables;
    }

    /**
     * Установить значение переменной
     */
    async setVariable(
        variablesReference: number,
        name: string,
        value: string
    ): Promise<Variable> {
        const result = await this.client.sendRequest<{
            value: string;
            type?: string;
            variablesReference?: number;
            namedVariables?: number;
            indexedVariables?: number;
        }>('setVariable', {
            variablesReference,
            name,
            value
        });

        return {
            name,
            value: result.value,
            type: result.type,
            variablesReference: result.variablesReference ?? 0
        };
    }

    // ============================================================================
    // Threads
    // ============================================================================

    /**
     * Получить список потоков
     */
    async getThreads(): Promise<Thread[]> {
        const result = await this.client.sendRequest<{
            threads: Thread[]
        }>('threads');

        this.threads.clear();
        for (const thread of result.threads) {
            this.threads.set(thread.id, thread);
        }

        return result.threads;
    }

    /**
     * Установить активный поток
     */
    setActiveThread(threadId: number): void {
        if (!this.threads.has(threadId)) {
            throw new Error(`Thread ${threadId} not found`);
        }
        this.activeThreadId = threadId;
    }

    // ============================================================================
    // Evaluation
    // ============================================================================

    /**
     * Вычислить выражение
     */
    async evaluate(
        expression: string,
        context: 'watch' | 'repl' | 'hover' | 'clipboard' = 'repl',
        frameId?: number
    ): Promise<EvaluateResult> {
        const result = await this.client.sendRequest<{
            result: string;
            type?: string;
            presentationHint?: any;
            variablesReference: number;
            namedVariables?: number;
            indexedVariables?: number;
            memoryReference?: string;
        }>('evaluate', {
            expression,
            frameId,
            context,
            format: { hex: false }
        });

        return {
            result: result.result,
            type: result.type,
            variablesReference: result.variablesReference
        };
    }

    // ============================================================================
    // Source
    // ============================================================================

    /**
     * Получить содержимое source
     */
    async getSource(sourceReference: number): Promise<Source> {
        const result = await this.client.sendRequest<{
            content: string;
            mimeType?: string;
        }>('source', {
            sourceReference
        });

        return {
            sourceReference,
            origin: result.mimeType
        };
    }

    // ============================================================================
    // Raw Requests
    // ============================================================================

    /**
     * Отправить произвольный request
     */
    async sendRequest<T = any>(command: string, args?: any): Promise<T> {
        return this.client.sendRequest<T>(command, args);
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private async launch(): Promise<void> {
        const args: LaunchRequestArguments = {
            program: this.configuration.program,
            args: this.configuration.args,
            env: this.configuration.env,
            cwd: this.configuration.cwd,
            stopOnEntry: this.configuration.stopOnEntry,
            console: 'integratedTerminal'
        };

        await this.client.sendRequest('launch', args);
    }

    private async attach(): Promise<void> {
        const args: AttachRequestArguments = {
            host: this.configuration.host,
            port: this.configuration.port,
            cwd: this.configuration.cwd
        };

        await this.client.sendRequest('attach', args);
    }

    private setupEventHandlers(): void {
        // Обработка DAP events
        this.disposables.push(
            this.client.onEventReceived.on(({ event, body }) => {
                this.handleDAPEvent(event, body);
            })
        );

        this.disposables.push(
            this.client.onClose.on(() => {
                this.setState(DebugSessionState.Terminated);
            })
        );
    }

    private handleDAPEvent(event: string, body: any): void {
        switch (event) {
            case 'stopped':
                this.handleStoppedEvent(body);
                break;
            case 'continued':
                this.handleContinuedEvent(body);
                break;
            case 'thread':
                this.handleThreadEvent(body);
                break;
            case 'breakpoint':
                this.handleBreakpointEvent(body);
                break;
            case 'output':
                this.handleOutputEvent(body);
                break;
            case 'terminated':
                this.handleTerminatedEvent(body);
                break;
            case 'module':
                this.handleModuleEvent(body);
                break;
            case 'exited':
                this.setState(DebugSessionState.Terminated);
                break;
        }
    }

    private handleStoppedEvent(body: StoppedEventBody): void {
        this.setState(DebugSessionState.Stopped);
        
        if (body.threadId) {
            this.activeThreadId = body.threadId;
        }

        this.onStoppedEmitter.emit({ body });
    }

    private handleContinuedEvent(body: { threadId: number; allThreadsContinued?: boolean }): void {
        this.setState(DebugSessionState.Running);
        this.onContinuedEmitter.emit(body);
    }

    private handleThreadEvent(body: { reason: 'started' | 'exited'; threadId: number }): void {
        if (body.reason === 'started') {
            this.getThreads();
        } else {
            this.threads.delete(body.threadId);
        }
        this.onThreadEmitter.emit(body);
    }

    private handleBreakpointEvent(body: { reason: 'changed' | 'new' | 'removed'; breakpoint: Breakpoint }): void {
        this.onBreakpointEmitter.emit(body);
    }

    private handleOutputEvent(body: OutputEvent): void {
        this.onOutputEmitter.emit(body);
    }

    private handleTerminatedEvent(body: { restart?: any }): void {
        this.setState(DebugSessionState.Terminated);
        this.onTerminatedEmitter.emit(body);
    }

    private handleModuleEvent(body: { reason: 'new' | 'changed' | 'removed'; module: any }): void {
        this.onModuleEmitter.emit(body);
    }

    private setState(newState: DebugSessionState): void {
        const previousState = this.state;
        this.state = newState;

        this.onStateChangedEmitter.emit({
            state: newState,
            previousState
        });
    }

    private ensureRunning(): void {
        if (!this.isRunning) {
            throw new Error(`Session is not running: ${this.state}`);
        }
    }

    private ensureStopped(): void {
        if (!this.isStopped) {
            throw new Error(`Session is not stopped: ${this.state}`);
        }
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.stop().catch(console.error);
        this.client.dispose();
        this.disposables.forEach(d => d.dispose());
        this.onStateChangedEmitter.dispose();
        this.onStoppedEmitter.dispose();
        this.onContinuedEmitter.dispose();
        this.onThreadEmitter.dispose();
        this.onBreakpointEmitter.dispose();
        this.onOutputEmitter.dispose();
        this.onTerminatedEmitter.dispose();
        this.onModuleEmitter.dispose();
    }
}
