/**
 * Base Agent Class
 * Базовый класс для всех агентов с Wire Protocol интеграцией
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import {
    AgentConfig,
    AgentStatus,
    AgentType,
    AgentResult,
    AgentError,
    AgentMessage,
    AgentMessageType,
    AgentEventMap,
} from './types';

/**
 * Опции для создания агента
 */
export interface BaseAgentOptions {
    type: AgentType;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    timeoutMs?: number;
    maxRetries?: number;
    parallel?: boolean;
    model?: string;
}

/**
 * Базовый класс агента
 */
export abstract class BaseAgent extends EventEmitter implements BaseAgent {
    public readonly id: string;
    public readonly type: AgentType;
    public readonly config: AgentConfig;
    public status: AgentStatus = 'idle';
    
    protected messageQueue: AgentMessage[] = [];
    protected abortController?: AbortController;
    protected startTime?: number;
    
    constructor(options: BaseAgentOptions) {
        super();
        
        this.id = this.generateId();
        this.type = options.type;
        this.config = {
            id: this.id,
            type: options.type,
            priority: options.priority ?? 'normal',
            timeoutMs: options.timeoutMs ?? 60000,
            maxRetries: options.maxRetries ?? 3,
            parallel: options.parallel ?? false,
            model: options.model,
        };
    }
    
    /**
     * Инициализация агента
     */
    public async initialize(): Promise<void> {
        this.log('Initializing...');
        await this.onInitialize();
        this.setStatus('idle');
        this.log('Initialized');
    }
    
    /**
     * Выполнение задачи агента
     */
    public async execute<TInput, TOutput>(input: TInput): Promise<AgentResult<TOutput>> {
        this.startTime = Date.now();
        this.setStatus('running');
        
        // Create abort controller for timeout
        this.abortController = new AbortController();
        const timeoutId = setTimeout(() => {
            this.abortController?.abort('timeout');
        }, this.config.timeoutMs);
        
        try {
            this.log('Executing with input:', input);
            
            // Pre-execution hook
            await this.onBeforeExecute(input);
            
            // Execute main logic
            const result = await this.onExecute<TInput, TOutput>(input, this.abortController.signal);
            
            // Clear timeout
            clearTimeout(timeoutId);
            
            // Post-execution hook
            await this.onAfterExecute(result);
            
            const agentResult: AgentResult<TOutput> = {
                success: true,
                agentId: this.id,
                agentType: this.type,
                data: result,
                executionTimeMs: Date.now() - this.startTime,
            };
            
            this.setStatus('completed');
            this.emit('complete', agentResult);
            
            return agentResult;
            
        } catch (error) {
            clearTimeout(timeoutId);
            
            const agentError = this.createError(error);
            const agentResult: AgentResult<TOutput> = {
                success: false,
                agentId: this.id,
                agentType: this.type,
                error: agentError,
                executionTimeMs: Date.now() - (this.startTime ?? Date.now()),
            };
            
            this.setStatus('error');
            this.emit('error', agentError);
            
            // Retry logic
            if (this.shouldRetry(agentError)) {
                this.log('Retrying...');
                return this.execute(input);
            }
            
            return agentResult;
        }
    }
    
    /**
     * Отмена выполнения
     */
    public async cancel(): Promise<void> {
        this.log('Cancelling...');
        this.abortController?.abort('cancelled');
        this.setStatus('cancelled');
        await this.onCancel();
        this.log('Cancelled');
    }
    
    /**
     * Освобождение ресурсов
     */
    public async dispose(): Promise<void> {
        this.log('Disposing...');
        await this.cancel();
        await this.onDispose();
        this.removeAllListeners();
        this.log('Disposed');
    }
    
    /**
     * Отправка сообщения другому агенту
     */
    public sendMessage<T>(
        to: string,
        type: AgentMessageType,
        payload: T,
        correlationId?: string
    ): void {
        const message: AgentMessage<T> = {
            id: this.generateId(),
            type,
            from: this.id,
            to,
            timestamp: Date.now(),
            payload,
            correlationId,
        };
        
        this.emit('message:sent', message);
        this.log('Sent message:', message);
    }
    
    /**
     * Обработка входящего сообщения
     */
    public receiveMessage<T>(message: AgentMessage<T>): void {
        this.log('Received message:', message);
        this.messageQueue.push(message);
        this.emit('message:received', message);
        this.onMessage(message);
    }
    
    /**
     * Изменение статуса
     */
    protected setStatus(newStatus: AgentStatus): void {
        const previous = this.status;
        this.status = newStatus;
        this.emit('status:change', { status: newStatus, previous });
    }
    
    /**
     * Генерация уникального ID
     */
    protected generateId(): string {
        return `${this.type}_${crypto.randomUUID().slice(0, 8)}_${Date.now().toString(36)}`;
    }
    
    /**
     * Создание ошибки агента
     */
    protected createError(error: unknown): AgentError {
        if (error instanceof Error) {
            return {
                code: error.name,
                message: error.message,
                stack: error.stack,
            };
        }
        return {
            code: 'UNKNOWN_ERROR',
            message: String(error),
        };
    }
    
    /**
     * Проверка необходимости повторной попытки
     */
    protected shouldRetry(error: AgentError): boolean {
        // Override in subclasses for custom retry logic
        return false;
    }
    
    /**
     * Логирование
     */
    protected log(...args: unknown[]): void {
        console.log(`[${this.type}:${this.id.slice(0, 8)}]`, ...args);
    }
    
    // ============================================================================
    // Abstract Methods (must be implemented by subclasses)
    // ============================================================================
    
    /**
     * Инициализация агента (специфичная логика)
     */
    protected abstract onInitialize(): Promise<void>;
    
    /**
     * Основная логика выполнения
     */
    protected abstract onExecute<TInput, TOutput>(
        input: TInput,
        signal: AbortSignal
    ): Promise<TOutput>;
    
    /**
     * Обработка сообщения
     */
    protected abstract onMessage<T>(message: AgentMessage<T>): void;
    
    /**
     * Отмена выполнения
     */
    protected abstract onCancel(): Promise<void>;
    
    /**
     * Освобождение ресурсов
     */
    protected abstract onDispose(): Promise<void>;
    
    // ============================================================================
    // Optional Hooks
    // ============================================================================
    
    /**
     * Hook перед выполнением
     */
    protected async onBeforeExecute<T>(input: T): Promise<void> {
        // Override in subclasses
    }
    
    /**
     * Hook после выполнения
     */
    protected async onAfterExecute<T>(result: T): Promise<void> {
        // Override in subclasses
    }

    // ============================================================================
    // Typed EventEmitter Methods
    // ============================================================================

    /**
     * Подписка на событие агента
     */
    public on<K extends keyof AgentEventMap>(
        event: K,
        listener: (payload: AgentEventMap[K]) => void
    ): this {
        return super.on(event as any, listener);
    }

    /**
     * Генерация события агента
     */
    public emit<K extends keyof AgentEventMap>(
        event: K,
        payload: AgentEventMap[K]
    ): boolean {
        return super.emit(event as any, payload);
    }
}

/**
 * Agent registry для управления агентами
 */
export class AgentRegistry {
    private agents = new Map<string, BaseAgent>();
    private messageBus = new EventEmitter();
    
    /**
     * Регистрация агента
     */
    register(agent: BaseAgent): void {
        this.agents.set(agent.id, agent);
        
        // Setup message forwarding
        agent.on('message:sent', (message: AgentMessage) => {
            this.routeMessage(message);
        });
        
        console.log(`[AgentRegistry] Registered agent: ${agent.type}:${agent.id}`);
    }
    
    /**
     * Удаление агента
     */
    unregister(agentId: string): void {
        const agent = this.agents.get(agentId);
        if (agent) {
            agent.dispose();
            this.agents.delete(agentId);
            console.log(`[AgentRegistry] Unregistered agent: ${agent.type}:${agentId}`);
        }
    }
    
    /**
     * Получение агента по ID
     */
    get(agentId: string): BaseAgent | undefined {
        return this.agents.get(agentId);
    }
    
    /**
     * Получение всех агентов определенного типа
     */
    getByType(type: AgentType): BaseAgent[] {
        return Array.from(this.agents.values()).filter(a => a.type === type);
    }
    
    /**
     * Маршрутизация сообщений
     */
    private routeMessage(message: AgentMessage): void {
        const target = this.agents.get(message.to);
        if (target) {
            target.receiveMessage(message);
        } else {
            console.warn(`[AgentRegistry] Target agent not found: ${message.to}`);
        }
    }
    
    /**
     * Broadcast сообщение всем агентам
     */
    broadcast<T>(from: string, type: AgentMessageType, payload: T): void {
        for (const agent of Array.from(this.agents.values())) {
            if (agent.id !== from) {
                agent.receiveMessage({
                    id: crypto.randomUUID(),
                    type,
                    from,
                    to: agent.id,
                    timestamp: Date.now(),
                    payload,
                });
            }
        }
    }
    
    /**
     * Получение всех агентов
     */
    getAll(): BaseAgent[] {
        return Array.from(this.agents.values());
    }
    
    /**
     * Очистка всех агентов
     */
    async clear(): Promise<void> {
        for (const agent of this.agents.values()) {
            await agent.dispose();
        }
        this.agents.clear();
    }
}
