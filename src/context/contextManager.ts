/**
 * Context Manager - центральный менеджер контекста
 * 
 * Интегрирует все компоненты Smart Context Management:
 * - TokenBudget - управление токенами
 * - RelevanceScorer - оценка релевантности
 * - CompactionEngine - сжатие контекста
 * - IncrementalLoader - инкрементальная загрузка
 * 
 * Дополнительно:
 * - Интеграция с VS Code workspace state
 * - Persistence между сессиями
 * - Visual context usage indicator
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { TokenBudget, TokenAllocation, BudgetSnapshot, BudgetWarning } from './tokenBudget';
import { RelevanceScorer, RelevanceScore } from './relevanceScorer';
import { 
    CompactionEngine, 
    ConversationRound, 
    CompactionResult,
    CriticalInformation 
} from './compactionEngine';
import { IncrementalLoader, LoadedFile, FileLoadRequest, LoadPriority } from './incrementalLoader';

// =============================================================================
// Types
// =============================================================================

export interface ContextManagerConfig {
    /** Включить persistence */
    enablePersistence: boolean;
    /** Включить auto-compaction */
    enableAutoCompaction: boolean;
    /** Показывать UI индикатор */
    showUsageIndicator: boolean;
    /** Частота обновления UI (ms) */
    uiUpdateInterval: number;
    /** Максимальное время жизни сессии (ms) */
    maxSessionAge: number;
    /** Включить relevance tracking */
    enableRelevanceTracking: boolean;
    /** Включить lazy loading */
    enableLazyLoading: boolean;
}

export interface ContextSession {
    /** ID сессии */
    id: string;
    /** Название */
    title: string;
    /** Время создания */
    createdAt: number;
    /** Последнее обновление */
    updatedAt: number;
    /** Сериализованное состояние */
    state: SerializedContextState;
}

export interface SerializedContextState {
    version: number;
    rounds: SerializedRound[];
    criticalInfo: CriticalInformation;
    compactionHistory: CompactionResult[];
    metadata: {
        totalTokens: number;
        fileCount: number;
        messageCount: number;
    };
}

export interface SerializedRound {
    id: string;
    index: number;
    userMessage: string;
    assistantResponse: string;
    timestamp: number;
    importance: {
        hasRequirements: boolean;
        hasDecisions: boolean;
        hasCode: boolean;
        isMarkedImportant: boolean;
        autoScore: number;
    };
    summary?: {
        brief: string;
        keyDecisions: string[];
        requirements: string[];
        originalTokens: number;
        summaryTokens: number;
    };
}

export interface ContextStats {
    /** Общее использование токенов */
    totalTokens: number;
    /** Использование в процентах */
    usagePercentage: number;
    /** Количество раундов */
    roundCount: number;
    /** Количество полных раундов */
    fullRounds: number;
    /** Количество сжатых раундов */
    compactedRounds: number;
    /** Количество файлов в контексте */
    fileCount: number;
    /** Статус бюджета */
    budgetStatus: 'ok' | 'warning' | 'critical';
    /** Доступные токены */
    availableTokens: number;
}

export interface ContextFile {
    uri: vscode.Uri;
    path: string;
    content: string;
    language: string;
    size: number;
    estimatedTokens: number;
    relevanceScore?: number;
    loadedAt: number;
    isPartial?: boolean;
}

export interface ContextMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    relevanceScore?: number;
}

export type ContextManagerEvent =
    | { type: 'budgetWarning'; warning: BudgetWarning }
    | { type: 'compactionStarted' }
    | { type: 'compactionCompleted'; result: CompactionResult }
    | { type: 'fileLoaded'; file: ContextFile }
    | { type: 'relevanceUpdated'; scores: RelevanceScore[] }
    | { type: 'sessionSaved'; sessionId: string }
    | { type: 'sessionRestored'; sessionId: string }
    | { type: 'statsUpdated'; stats: ContextStats };

const DEFAULT_CONFIG: ContextManagerConfig = {
    enablePersistence: true,
    enableAutoCompaction: true,
    showUsageIndicator: true,
    uiUpdateInterval: 2000,
    maxSessionAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    enableRelevanceTracking: true,
    enableLazyLoading: true,
};

const STORAGE_KEY = 'kimiContextSessions';
const CURRENT_SESSION_KEY = 'kimiCurrentSession';
const CONTEXT_VERSION = 1;

// =============================================================================
// ContextManager Class
// =============================================================================

export class ContextManager extends EventEmitter {
    private config: ContextManagerConfig;
    private tokenBudget: TokenBudget;
    private relevanceScorer: RelevanceScorer;
    private compactionEngine: CompactionEngine;
    private incrementalLoader: IncrementalLoader;
    private context: vscode.ExtensionContext;
    
    private currentSessionId: string | null = null;
    private loadedFiles: Map<string, ContextFile> = new Map();
    private uiUpdateTimer: NodeJS.Timeout | null = null;
    private statusBarItem: vscode.StatusBarItem | null = null;

    constructor(
        extensionContext: vscode.ExtensionContext,
        config?: Partial<ContextManagerConfig>
    ) {
        super();
        this.context = extensionContext;
        this.config = { ...DEFAULT_CONFIG, ...config };
        
        // Initialize components
        this.tokenBudget = new TokenBudget();
        this.relevanceScorer = new RelevanceScorer();
        this.compactionEngine = new CompactionEngine(this.relevanceScorer);
        this.incrementalLoader = new IncrementalLoader();
        
        this.setupEventHandlers();
        this.initializeUI();
        
        logger.info('ContextManager: initialized');
    }

    // =========================================================================
    // Initialization & Event Handlers
    // =========================================================================

    private setupEventHandlers(): void {
        // Token budget events
        this.tokenBudget.on('warning', (warning: unknown) => {
            const budgetWarning = warning as BudgetWarning;
            this.emit('budgetWarning', budgetWarning);
            this.showBudgetWarning(budgetWarning);
        });

        this.tokenBudget.on('criticalLimit', () => {
            if (this.config.enableAutoCompaction) {
                this.triggerCompaction();
            }
        });

        // Compaction events
        this.compactionEngine.on('compactionStarted', () => {
            this.emit('compactionStarted');
            vscode.window.showInformationMessage('Kimi: Compressing conversation context...');
        });

        this.compactionEngine.on('compactionCompleted', (result: unknown) => {
            const compactionResult = result as CompactionResult;
            this.emit('compactionCompleted', compactionResult);
            this.updateStats();
            this.saveCurrentSession();
            
            vscode.window.showInformationMessage(
                `Kimi: Context compressed. Saved ${compactionResult.tokensSaved} tokens.`
            );
        });

        // Relevance events
        this.relevanceScorer.on('itemTracked', () => {
            this.updateRelevanceScores();
        });

        // Loader events
        this.incrementalLoader.on('fileLoaded', (file: unknown) => {
            const loadedFile = file as LoadedFile;
            const contextFile: ContextFile = {
                uri: loadedFile.uri,
                path: loadedFile.uri.fsPath,
                content: loadedFile.content,
                language: loadedFile.language,
                size: loadedFile.size,
                estimatedTokens: loadedFile.estimatedTokens,
                loadedAt: loadedFile.loadedAt,
                isPartial: loadedFile.isPartial,
            };
            this.loadedFiles.set(loadedFile.uri.toString(), contextFile);
            this.emit('fileLoaded', contextFile);
        });
    }

    private initializeUI(): void {
        if (this.config.showUsageIndicator) {
            this.statusBarItem = vscode.window.createStatusBarItem(
                vscode.StatusBarAlignment.Right,
                100
            );
            this.statusBarItem.command = 'kimi.showContextStats';
            this.statusBarItem.show();
            
            // Start periodic updates
            this.uiUpdateTimer = setInterval(() => {
                this.updateUI();
            }, this.config.uiUpdateInterval);
            
            this.updateUI();
        }
    }

    // =========================================================================
    // Core Context Operations
    // =========================================================================

    /**
     * Добавляет сообщение в контекст
     */
    addMessage(
        role: 'user' | 'assistant',
        content: string,
        toolCalls?: Array<{
            id: string;
            name: string;
            arguments: Record<string, any>;
            result?: any;
        }>
    ): void {
        if (role === 'user') {
            // Обновляем query context для relevance scoring
            this.relevanceScorer.updateQueryContext(content);
        }

        // Добавляем раунд (только когда есть оба сообщения)
        if (role === 'assistant') {
            // Находим последний user message без ответа
            const rounds = this.compactionEngine.getRoundsInOrder();
            const lastRound = rounds[rounds.length - 1];
            
            if (lastRound && lastRound.assistantResponse === '') {
                // Обновляем существующий раунд
                // Note: в реальном сценарии нужен другой подход
            }
        }

        this.updateStats();
        
        // Auto-save при каждом сообщении
        if (this.config.enablePersistence) {
            this.saveCurrentSession();
        }
    }

    /**
     * Добавляет полный раунд (user + assistant)
     */
    addRound(
        userMessage: string,
        assistantResponse: string,
        toolCalls?: Array<{
            id: string;
            name: string;
            arguments: Record<string, any>;
            result?: any;
        }>
    ): ConversationRound {
        // Обновляем query context
        this.relevanceScorer.updateQueryContext(userMessage);

        // Добавляем раунд
        const round = this.compactionEngine.addRound(
            userMessage,
            assistantResponse,
            toolCalls
        );

        // Трекаем в relevance scorer
        this.relevanceScorer.recordInteraction(round.id);

        this.updateStats();
        
        if (this.config.enablePersistence) {
            this.saveCurrentSession();
        }

        return round;
    }

    /**
     * Загружает файл в контекст
     */
    async loadFile(
        uri: vscode.Uri,
        priority: LoadPriority = 'normal',
        range?: { start: number; end: number }
    ): Promise<ContextFile | null> {
        const request: FileLoadRequest = {
            uri,
            priority,
            range,
        };

        const result = await this.incrementalLoader.loadFile(request);

        if (result.success && result.file) {
            const contextFile: ContextFile = {
                uri: result.file.uri,
                path: result.file.uri.fsPath,
                content: result.file.content,
                language: result.file.language,
                size: result.file.size,
                estimatedTokens: result.file.estimatedTokens,
                loadedAt: result.file.loadedAt,
                isPartial: result.file.isPartial,
            };

            this.loadedFiles.set(uri.toString(), contextFile);
            
            // Обновляем бюджет
            this.tokenBudget.updateUsage('mentionedFiles', this.calculateFilesTokens());
            
            // Трекаем relevance
            if (this.config.enableRelevanceTracking) {
                this.relevanceScorer.trackItem(
                    uri.toString(),
                    'file',
                    result.file.content,
                    { path: result.file.uri.fsPath }
                );
            }

            this.updateStats();
            return contextFile;
        }

        return null;
    }

    /**
     * Удаляет файл из контекста
     */
    unloadFile(uri: vscode.Uri): boolean {
        const key = uri.toString();
        const removed = this.loadedFiles.delete(key);
        
        if (removed) {
            this.incrementalLoader.invalidate(uri);
            this.relevanceScorer.removeItem(key);
            this.tokenBudget.updateUsage('mentionedFiles', this.calculateFilesTokens());
            this.updateStats();
        }

        return removed;
    }

    /**
     * Триггерит compaction вручную
     */
    async triggerCompaction(): Promise<CompactionResult | null> {
        if (this.compactionEngine.isCompactionInProgress()) {
            logger.warn('ContextManager: compaction already in progress');
            return null;
        }

        return this.compactionEngine.performCompaction();
    }

    // =========================================================================
    // Session Management
    // =========================================================================

    /**
     * Создаёт новую сессию
     */
    createSession(title?: string): string {
        const sessionId = `session_${Date.now()}`;
        this.currentSessionId = sessionId;
        
        // Очищаем текущий контекст
        this.clearContext(false);

        logger.info(`ContextManager: created session ${sessionId}`);
        this.emit('sessionCreated', sessionId);
        
        return sessionId;
    }

    /**
     * Сохраняет текущую сессию
     */
    async saveCurrentSession(): Promise<void> {
        if (!this.currentSessionId || !this.config.enablePersistence) return;

        const state = this.serializeState();
        const session: ContextSession = {
            id: this.currentSessionId,
            title: this.generateSessionTitle(),
            createdAt: Date.now(),
            updatedAt: Date.now(),
            state,
        };

        // Сохраняем в workspace state
        const sessions = this.getStoredSessions();
        sessions[session.id] = session;
        await this.context.workspaceState.update(STORAGE_KEY, sessions);
        await this.context.workspaceState.update(CURRENT_SESSION_KEY, session.id);

        logger.debug(`ContextManager: saved session ${session.id}`);
        this.emit('sessionSaved', session.id);
    }

    /**
     * Восстанавливает сессию
     */
    async restoreSession(sessionId: string): Promise<boolean> {
        const sessions = this.getStoredSessions();
        const session = sessions[sessionId];

        if (!session) {
            logger.warn(`ContextManager: session ${sessionId} not found`);
            return false;
        }

        // Проверяем возраст сессии
        const age = Date.now() - session.updatedAt;
        if (age > this.config.maxSessionAge) {
            logger.warn(`ContextManager: session ${sessionId} is too old`);
            return false;
        }

        // Загружаем состояние
        this.deserializeState(session.state);
        this.currentSessionId = sessionId;

        logger.info(`ContextManager: restored session ${sessionId}`);
        this.emit('sessionRestored', sessionId);
        this.updateStats();

        return true;
    }

    /**
     * Загружает последнюю сессию
     */
    async restoreLastSession(): Promise<boolean> {
        const lastSessionId = this.context.workspaceState.get<string>(CURRENT_SESSION_KEY);
        if (lastSessionId) {
            return this.restoreSession(lastSessionId);
        }
        return false;
    }

    /**
     * Получает список сохранённых сессий
     */
    getSavedSessions(): ContextSession[] {
        const sessions = this.getStoredSessions();
        return Object.values(sessions)
            .sort((a, b) => b.updatedAt - a.updatedAt);
    }

    /**
     * Удаляет сессию
     */
    async deleteSession(sessionId: string): Promise<void> {
        const sessions = this.getStoredSessions();
        delete sessions[sessionId];
        await this.context.workspaceState.update(STORAGE_KEY, sessions);
        
        if (this.currentSessionId === sessionId) {
            this.currentSessionId = null;
        }

        logger.debug(`ContextManager: deleted session ${sessionId}`);
    }

    private getStoredSessions(): Record<string, ContextSession> {
        return this.context.workspaceState.get<Record<string, ContextSession>>(STORAGE_KEY, {});
    }

    // =========================================================================
    // State Serialization
    // =========================================================================

    private serializeState(): SerializedContextState {
        const rounds = this.compactionEngine.getRoundsInOrder();
        const compactedRounds = rounds.filter(r => r.summary);

        return {
            version: CONTEXT_VERSION,
            rounds: rounds.map(r => ({
                id: r.id,
                index: r.index,
                userMessage: r.summary ? `[Summarized] ${r.summary.brief}` : r.userMessage,
                assistantResponse: r.summary ? '' : r.assistantResponse,
                timestamp: r.timestamp,
                importance: r.importance,
                summary: r.summary ? {
                    brief: r.summary.brief,
                    keyDecisions: r.summary.keyDecisions,
                    requirements: r.summary.requirements,
                    originalTokens: r.summary.originalTokens,
                    summaryTokens: r.summary.summaryTokens,
                } : undefined,
            })),
            criticalInfo: this.compactionEngine.getCriticalInfo(),
            compactionHistory: this.compactionEngine.getCompactionHistory(),
            metadata: {
                totalTokens: this.tokenBudget.getTotalUsed(),
                fileCount: this.loadedFiles.size,
                messageCount: rounds.length,
            },
        };
    }

    private deserializeState(state: SerializedContextState): void {
        // Версионирование для будущих изменений формата
        if (state.version !== CONTEXT_VERSION) {
            logger.warn(`ContextManager: state version mismatch (${state.version} vs ${CONTEXT_VERSION})`);
        }

        // Note: Полное восстановление состояния требует дополнительной логики
        // в CompactionEngine для добавления существующих раундов
        
        this.criticalInfo = state.criticalInfo;
        
        logger.debug('ContextManager: state deserialized');
    }

    // =========================================================================
    // UI & Stats
    // =========================================================================

    private updateUI(): void {
        if (!this.statusBarItem) return;

        const stats = this.getStats();
        const usage = Math.round(stats.usagePercentage);
        
        // Выбираем иконку в зависимости от usage
        let icon = '$(check)';
        if (stats.budgetStatus === 'warning') icon = '$(warning)';
        if (stats.budgetStatus === 'critical') icon = '$(error)';

        this.statusBarItem.text = `${icon} Context: ${usage}%`;
        this.statusBarItem.tooltip = this.formatTooltip(stats);
        
        // Цвет по статусу
        if (stats.budgetStatus === 'critical') {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else if (stats.budgetStatus === 'warning') {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
        } else {
            this.statusBarItem.backgroundColor = undefined;
        }
    }

    private formatTooltip(stats: ContextStats): string {
        const parts = [
            `Tokens: ${stats.totalTokens.toLocaleString()} / ${(stats.totalTokens + stats.availableTokens).toLocaleString()}`,
            `Rounds: ${stats.roundCount} (${stats.fullRounds} full, ${stats.compactedRounds} compacted)`,
            `Files: ${stats.fileCount}`,
            `Status: ${stats.budgetStatus}`,
            '',
            'Click for details',
        ];
        return parts.join('\n');
    }

    private showBudgetWarning(warning: BudgetWarning): void {
        if (warning.level === 'critical') {
            vscode.window.showWarningMessage(
                `Kimi: ${warning.message}`,
                'Compress Now',
                'Clear Context'
            ).then(selection => {
                if (selection === 'Compress Now') {
                    this.triggerCompaction();
                } else if (selection === 'Clear Context') {
                    this.clearContext();
                }
            });
        }
    }

    private updateStats(): void {
        const stats = this.getStats();
        this.emit('statsUpdated', stats);
    }

    private updateRelevanceScores(): void {
        const scores = this.relevanceScorer.getAllScores();
        
        // Обновляем relevance для файлов
        for (const file of this.loadedFiles.values()) {
            const score = this.relevanceScorer.getScore(file.uri.toString());
            if (score) {
                file.relevanceScore = score.finalScore;
            }
        }

        this.emit('relevanceUpdated', scores);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private calculateFilesTokens(): number {
        return Array.from(this.loadedFiles.values())
            .reduce((sum, f) => sum + f.estimatedTokens, 0);
    }

    private generateSessionTitle(): string {
        const rounds = this.compactionEngine.getRoundsInOrder();
        if (rounds.length === 0) return 'New Session';
        
        const firstUserMessage = rounds[0].userMessage;
        const title = firstUserMessage
            .split('\n')[0]
            .substring(0, 50)
            .replace(/[^\w\s-]/g, '');
        
        return title || 'Untitled Session';
    }

    private criticalInfo: CriticalInformation = {
        requirements: [],
        decisions: [],
        codeChanges: [],
        facts: [],
    };

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Получает статистику контекста
     */
    getStats(): ContextStats {
        const rounds = this.compactionEngine.getRoundsInOrder();
        const fullRounds = rounds.filter(r => !r.summary);
        const compactedRounds = rounds.filter(r => r.summary);
        
        const warning = this.tokenBudget.checkBudget();
        const budgetStatus = warning?.level === 'critical' ? 'critical' :
            warning?.level === 'warning' ? 'warning' : 'ok';

        return {
            totalTokens: this.tokenBudget.getTotalUsed(),
            usagePercentage: this.tokenBudget.getUsagePercentage(),
            roundCount: rounds.length,
            fullRounds: fullRounds.length,
            compactedRounds: compactedRounds.length,
            fileCount: this.loadedFiles.size,
            budgetStatus,
            availableTokens: this.tokenBudget.getAvailable(),
        };
    }

    /**
     * Получает текущие раунды
     */
    getRounds(): ConversationRound[] {
        return this.compactionEngine.getRoundsInOrder();
    }

    /**
     * Получает загруженные файлы
     */
    getLoadedFiles(): ContextFile[] {
        return Array.from(this.loadedFiles.values());
    }

    /**
     * Получает critical information
     */
    getCriticalInfo(): CriticalInformation {
        return {
            ...this.criticalInfo,
            ...this.compactionEngine.getCriticalInfo(),
        };
    }

    /**
     * Получает relevance scores
     */
    getRelevanceScores(): RelevanceScore[] {
        return this.relevanceScorer.getAllScores();
    }

    /**
     * Получает budget snapshot
     */
    getBudgetSnapshot(): BudgetSnapshot {
        return this.tokenBudget.getSnapshot();
    }

    /**
     * Получает compaction history
     */
    getCompactionHistory(): CompactionResult[] {
        return this.compactionEngine.getCompactionHistory();
    }

    /**
     * Очищает контекст
     */
    clearContext(saveSession: boolean = true): void {
        this.loadedFiles.clear();
        this.compactionEngine.reset();
        this.relevanceScorer.reset();
        this.tokenBudget.reset();
        this.incrementalLoader.clearCache();
        
        if (saveSession && this.config.enablePersistence) {
            this.saveCurrentSession();
        }

        this.updateStats();
        logger.info('ContextManager: context cleared');
    }

    /**
     * Обновляет конфигурацию
     */
    updateConfig(config: Partial<ContextManagerConfig>): void {
        this.config = { ...this.config, ...config };
        
        // Перезапускаем UI если изменились настройки
        if (this.config.showUsageIndicator && !this.uiUpdateTimer) {
            this.initializeUI();
        } else if (!this.config.showUsageIndicator && this.uiUpdateTimer) {
            if (this.uiUpdateTimer) {
                clearInterval(this.uiUpdateTimer);
                this.uiUpdateTimer = null;
            }
            if (this.statusBarItem) {
                this.statusBarItem.dispose();
                this.statusBarItem = null;
            }
        }

        logger.debug('ContextManager: config updated', config);
    }

    /**
     * Освобождение ресурсов
     */
    dispose(): void {
        if (this.uiUpdateTimer) {
            clearInterval(this.uiUpdateTimer);
        }
        if (this.statusBarItem) {
            this.statusBarItem.dispose();
        }

        this.tokenBudget.dispose();
        this.relevanceScorer.dispose();
        this.compactionEngine.dispose();
        this.incrementalLoader.dispose();

        this.removeAllListeners();
        logger.info('ContextManager: disposed');
    }
}
