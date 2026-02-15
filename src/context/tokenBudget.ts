/**
 * Token Budget Management System
 * 
 * Распределяет токены между различными компонентами контекста:
 * - System prompt
 * - File contents
 * - Conversation history
 * - Tool results
 * 
 * Поддерживает динамическое перераспределение и warnings при приближении к лимиту.
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface TokenAllocation {
    /** Назначение токенов */
    component: ContextComponent;
    /** Выделенный бюджет */
    allocated: number;
    /** Фактическое использование */
    used: number;
    /** Приоритет (0-100, выше = важнее) */
    priority: number;
    /** Можно ли сократить */
    compressible: boolean;
}

export type ContextComponent =
    | 'system'
    | 'agentsMd'
    | 'fileTree'
    | 'currentFile'
    | 'mentionedFiles'
    | 'conversation'
    | 'toolResults'
    | 'workingSet'
    | 'reserve';

export interface TokenBudgetConfig {
    /** Максимальный контекст модели */
    maxContextTokens: number;
    /** Запас на непредвиденное */
    safetyMargin: number;
    /** Порог warning (0-1) */
    warningThreshold: number;
    /** Порог critical (0-1) */
    criticalThreshold: number;
    /** Минимум для conversation */
    minConversationTokens: number;
    /** Минимум для system prompt */
    minSystemTokens: number;
}

export interface BudgetWarning {
    level: 'info' | 'warning' | 'critical';
    message: string;
    usage: number;
    limit: number;
    percentage: number;
}

export interface BudgetSnapshot {
    timestamp: number;
    totalAllocated: number;
    totalUsed: number;
    available: number;
    allocations: TokenAllocation[];
    warning?: BudgetWarning;
}

const DEFAULT_CONFIG: TokenBudgetConfig = {
    maxContextTokens: 128000,
    safetyMargin: 4000,
    warningThreshold: 0.75,
    criticalThreshold: 0.90,
    minConversationTokens: 2000,
    minSystemTokens: 500,
};

/** Примерное количество токенов на символ */
const AVG_TOKENS_PER_CHAR = 0.25;

/** Базовые приоритеты компонентов */
const BASE_PRIORITIES: Record<ContextComponent, number> = {
    system: 100,
    agentsMd: 95,
    currentFile: 90,
    toolResults: 85,
    mentionedFiles: 70,
    workingSet: 60,
    conversation: 50,
    fileTree: 30,
    reserve: 20,
};

/** Базовые размеры для компонентов */
const BASE_ALLOCATIONS: Record<ContextComponent, number> = {
    system: 500,
    agentsMd: 4000,
    currentFile: 8000,
    toolResults: 3000,
    mentionedFiles: 15000,
    workingSet: 10000,
    conversation: 20000,
    fileTree: 1000,
    reserve: 4000,
};

export class TokenBudget extends EventEmitter {
    private config: TokenBudgetConfig;
    private allocations: Map<ContextComponent, TokenAllocation> = new Map();
    private snapshots: BudgetSnapshot[] = [];
    private maxSnapshots = 10;

    constructor(config?: Partial<TokenBudgetConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.initializeAllocations();
    }

    /**
     * Инициализация начальных аллокаций
     */
    private initializeAllocations(): void {
        const effectiveLimit = this.config.maxContextTokens - this.config.safetyMargin;
        
        for (const component of Object.keys(BASE_PRIORITIES) as ContextComponent[]) {
            this.allocations.set(component, {
                component,
                allocated: Math.min(BASE_ALLOCATIONS[component], effectiveLimit * 0.1),
                used: 0,
                priority: BASE_PRIORITIES[component],
                compressible: component !== 'system' && component !== 'toolResults',
            });
        }
    }

    /**
     * Получает эффективный лимит токенов (с учётом safety margin)
     */
    getEffectiveLimit(): number {
        return this.config.maxContextTokens - this.config.safetyMargin;
    }

    /**
     * Оценивает количество токенов для текста
     */
    estimateTokens(text: string): number {
        // Простая эвристика: ~4 chars per token on average
        return Math.ceil(text.length / 4);
    }

    /**
     * Оценивает токены для массива сообщений
     */
    estimateConversationTokens(messages: Array<{ role: string; content: string }>): number {
        // Учитываем overhead формата сообщений (~4 токена на сообщение)
        const messageOverhead = messages.length * 4;
        const contentTokens = messages.reduce(
            (sum, msg) => sum + this.estimateTokens(msg.content),
            0
        );
        return messageOverhead + contentTokens;
    }

    /**
     * Запрашивает бюджет для компонента
     */
    requestBudget(component: ContextComponent, requested: number): number {
        const allocation = this.allocations.get(component);
        if (!allocation) {
            logger.warn(`Unknown context component: ${component}`);
            return 0;
        }

        // Проверяем общий бюджет
        const effectiveLimit = this.getEffectiveLimit();
        const currentlyUsed = this.getTotalUsed();
        const available = effectiveLimit - currentlyUsed + allocation.allocated - allocation.used;

        // Выделяем минимум из запрошенного и доступного
        const granted = Math.min(requested, available, allocation.allocated);
        
        allocation.used = granted;
        
        logger.debug(`TokenBudget: ${component} requested ${requested}, granted ${granted}`);
        
        return granted;
    }

    /**
     * Обновляет использование для компонента
     */
    updateUsage(component: ContextComponent, used: number): void {
        const allocation = this.allocations.get(component);
        if (allocation) {
            const oldUsed = allocation.used;
            allocation.used = used;
            
            // Если превысили аллокацию, логируем
            if (used > allocation.allocated) {
                logger.warn(
                    `TokenBudget: ${component} exceeded allocation ` +
                    `(${used} > ${allocation.allocated})`
                );
            }
            
            // Emit event если значительное изменение
            if (Math.abs(used - oldUsed) > 100) {
                this.emit('usageChanged', component, used, allocation.allocated);
            }
        }
    }

    /**
     * Динамическое перераспределение бюджета
     */
    rebalance(focusComponents?: ContextComponent[]): void {
        const effectiveLimit = this.getEffectiveLimit();
        const totalUsed = this.getTotalUsed();
        const available = effectiveLimit - totalUsed;

        // Если есть свободные токены, перераспределяем
        if (available > 1000 && focusComponents && focusComponents.length > 0) {
            const bonusPerComponent = Math.floor(available * 0.5 / focusComponents.length);
            
            for (const component of focusComponents) {
                const allocation = this.allocations.get(component);
                if (allocation && allocation.compressible) {
                    allocation.allocated += bonusPerComponent;
                    logger.debug(`TokenBudget: reallocated ${bonusPerComponent} to ${component}`);
                }
            }
        }

        // Если не хватает, сжимаем compressible компоненты
        if (totalUsed > effectiveLimit * 0.95) {
            this.compressBudget();
        }

        this.emit('rebalanced', this.getSnapshot());
    }

    /**
     * Сжатие бюджета compressible компонентов
     */
    private compressBudget(): void {
        const effectiveLimit = this.getEffectiveLimit();
        const totalUsed = this.getTotalUsed();
        const overflow = totalUsed - effectiveLimit * 0.9;

        if (overflow <= 0) return;

        // Собираем compressible компоненты по приоритету (низкий приоритет = первыми сжимаем)
        const compressible = Array.from(this.allocations.values())
            .filter(a => a.compressible && a.used > 0)
            .sort((a, b) => a.priority - b.priority);

        let remainingToCompress = overflow;

        for (const allocation of compressible) {
            if (remainingToCompress <= 0) break;

            const currentUsed = allocation.used;
            const minRequired = this.getMinRequired(allocation.component);
            const canReduce = currentUsed - minRequired;

            if (canReduce > 0) {
                const reduction = Math.min(canReduce, remainingToCompress);
                allocation.allocated = Math.max(allocation.allocated - reduction, minRequired);
                remainingToCompress -= reduction;

                logger.debug(
                    `TokenBudget: compressed ${allocation.component} by ${reduction} tokens`
                );
                this.emit('compressed', allocation.component, reduction);
            }
        }

        if (remainingToCompress > 0) {
            logger.warn('TokenBudget: unable to fully compress budget, critical limit reached');
            this.emit('criticalLimit');
        }
    }

    /**
     * Получает минимально необходимый бюджет для компонента
     */
    private getMinRequired(component: ContextComponent): number {
        switch (component) {
            case 'system':
                return this.config.minSystemTokens;
            case 'conversation':
                return this.config.minConversationTokens;
            case 'agentsMd':
                return 500;
            case 'currentFile':
                return 1000;
            default:
                return 0;
        }
    }

    /**
     * Проверяет состояние бюджета и генерирует предупреждения
     */
    checkBudget(): BudgetWarning | undefined {
        const effectiveLimit = this.getEffectiveLimit();
        const totalUsed = this.getTotalUsed();
        const percentage = totalUsed / effectiveLimit;

        let warning: BudgetWarning | undefined;

        if (percentage >= this.config.criticalThreshold) {
            warning = {
                level: 'critical',
                message: `Context limit critical: ${Math.round(percentage * 100)}% used. ` +
                    'Consider clearing conversation history or removing files from context.',
                usage: totalUsed,
                limit: effectiveLimit,
                percentage,
            };
        } else if (percentage >= this.config.warningThreshold) {
            warning = {
                level: 'warning',
                message: `Context usage high: ${Math.round(percentage * 100)}% used`,
                usage: totalUsed,
                limit: effectiveLimit,
                percentage,
            };
        }

        if (warning) {
            logger.warn(`TokenBudget: ${warning.message}`);
            this.emit('warning', warning);
        }

        return warning;
    }

    /**
     * Получает текущий snapshot бюджета
     */
    getSnapshot(): BudgetSnapshot {
        const effectiveLimit = this.getEffectiveLimit();
        const totalUsed = this.getTotalUsed();
        const totalAllocated = this.getTotalAllocated();

        const snapshot: BudgetSnapshot = {
            timestamp: Date.now(),
            totalAllocated,
            totalUsed,
            available: effectiveLimit - totalUsed,
            allocations: Array.from(this.allocations.values()),
            warning: this.checkBudget(),
        };

        // Сохраняем snapshot
        this.snapshots.push(snapshot);
        if (this.snapshots.length > this.maxSnapshots) {
            this.snapshots.shift();
        }

        return snapshot;
    }

    /**
     * Получает историю snapshots
     */
    getSnapshots(): BudgetSnapshot[] {
        return [...this.snapshots];
    }

    /**
     * Получает аллокацию для компонента
     */
    getAllocation(component: ContextComponent): TokenAllocation | undefined {
        return this.allocations.get(component);
    }

    /**
     * Общее использование токенов
     */
    getTotalUsed(): number {
        return Array.from(this.allocations.values()).reduce((sum, a) => sum + a.used, 0);
    }

    /**
     * Общий выделенный бюджет
     */
    getTotalAllocated(): number {
        return Array.from(this.allocations.values()).reduce((sum, a) => sum + a.allocated, 0);
    }

    /**
     * Доступные токены
     */
    getAvailable(): number {
        return this.getEffectiveLimit() - this.getTotalUsed();
    }

    /**
     * Использование в процентах
     */
    getUsagePercentage(): number {
        return (this.getTotalUsed() / this.getEffectiveLimit()) * 100;
    }

    /**
     * Сброс использования
     */
    resetUsage(): void {
        for (const allocation of this.allocations.values()) {
            allocation.used = 0;
        }
        logger.debug('TokenBudget: usage reset');
        this.emit('reset');
    }

    /**
     * Полный сброс к начальному состоянию
     */
    reset(): void {
        this.allocations.clear();
        this.initializeAllocations();
        this.snapshots = [];
        logger.debug('TokenBudget: full reset');
        this.emit('reset');
    }

    /**
     * Обновление конфигурации
     */
    updateConfig(config: Partial<TokenBudgetConfig>): void {
        this.config = { ...this.config, ...config };
        logger.debug('TokenBudget: config updated', config);
        this.emit('configUpdated', this.config);
    }

    /**
     * Освобождение ресурсов
     */
    dispose(): void {
        this.removeAllListeners();
        this.snapshots = [];
        this.allocations.clear();
    }
}

// Singleton instance
let defaultBudget: TokenBudget | null = null;

export function getDefaultTokenBudget(): TokenBudget {
    if (!defaultBudget) {
        defaultBudget = new TokenBudget();
    }
    return defaultBudget;
}

export function resetDefaultTokenBudget(): void {
    if (defaultBudget) {
        defaultBudget.dispose();
        defaultBudget = null;
    }
}
