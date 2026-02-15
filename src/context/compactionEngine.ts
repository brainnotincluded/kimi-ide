/**
 * Compaction Engine - умное сжатие контекста
 * 
 * Стратегия compaction:
 * - Сохраняем 10-20 последних раундов полностью (non-lossy)
 * - Старые раунды → summarized
 * - Сохраняем critical information (user requirements, key decisions)
 * - Deterministic strategy для воспроизводимости
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { RelevanceScorer, RelevanceScore } from './relevanceScorer';
import { TokenBudget } from './tokenBudget';

export interface ConversationRound {
    /** Уникальный ID раунда */
    id: string;
    /** Номер раунда */
    index: number;
    /** User message */
    userMessage: string;
    /** Assistant response */
    assistantResponse: string;
    /** Tool calls */
    toolCalls?: ToolCallInfo[];
    /** Timestamp */
    timestamp: number;
    /** Флаги важности */
    importance: RoundImportance;
    /** Сжатая версия (если есть) */
    summary?: RoundSummary;
}

export interface ToolCallInfo {
    id: string;
    name: string;
    arguments: Record<string, any>;
    result?: any;
    isError?: boolean;
}

export interface RoundImportance {
    /** Содержит user requirement */
    hasRequirements: boolean;
    /** Содержит key decision */
    hasDecisions: boolean;
    /** Содержит код/конфигурацию */
    hasCode: boolean;
    /** Пользователь явно отметил как важное */
    isMarkedImportant: boolean;
    /** Автоматический score важности (0-1) */
    autoScore: number;
}

export interface RoundSummary {
    /** Краткое описание */
    brief: string;
    /** Ключевые решения */
    keyDecisions: string[];
    /** User requirements из раунда */
    requirements: string[];
    /** Code changes */
    codeChanges: CodeChangeInfo[];
    /** Original token count */
    originalTokens: number;
    /** Summary token count */
    summaryTokens: number;
    /** Когда создан summary */
    summarizedAt: number;
}

export interface CodeChangeInfo {
    filePath: string;
    changeType: 'create' | 'modify' | 'delete';
    description: string;
}

export interface CompactionConfig {
    /** Сколько последних раундов сохранять полностью */
    fullRoundsRetention: number;
    /** Максимальное количество раундов */
    maxRounds: number;
    /** Триггер compaction (токенов) */
    compactionThreshold: number;
    /** Минимальная длина для summary */
    minSummaryLength: number;
    /** Максимальная длина summary */
    maxSummaryLength: number;
    /** Включать ли code context в summary */
    includeCodeInSummary: boolean;
}

export interface CompactionResult {
    /** ID compaction операции */
    id: string;
    /** Timestamp */
    timestamp: number;
    /** Сколько раундов сжато */
    roundsCompacted: number;
    /** Сколько токенов сэкономлено */
    tokensSaved: number;
    /** Раунды до compaction */
    roundsBefore: number;
    /** Раунды после compaction */
    roundsAfter: number;
    /** Список сжатых раундов */
    compactedRounds: string[];
    /** Critical information extracted */
    criticalInfo: CriticalInformation;
}

export interface CriticalInformation {
    /** User requirements */
    requirements: string[];
    /** Key decisions */
    decisions: string[];
    /** Code changes */
    codeChanges: CodeChangeInfo[];
    /** Important facts */
    facts: string[];
}

const DEFAULT_CONFIG: CompactionConfig = {
    fullRoundsRetention: 15,
    maxRounds: 100,
    compactionThreshold: 80000,
    minSummaryLength: 100,
    maxSummaryLength: 500,
    includeCodeInSummary: true,
};

/** Keywords для определения важности */
const IMPORTANT_KEYWORDS = [
    'requirement', 'requirements', 'must', 'should', 'need to', 'important',
    'critical', 'essential', 'key', 'main', 'primary', 'crucial', 'vital',
    'decision', 'decided', 'choose', 'choice', 'option', 'approach',
    'architecture', 'design', 'pattern', 'strategy', 'plan',
    'bug', 'fix', 'error', 'issue', 'problem', 'broken', 'not working',
    'implement', 'create', 'add', 'build', 'develop', 'write',
    'change', 'modify', 'update', 'refactor', 'rewrite', 'migrate',
    'config', 'configuration', 'setting', 'settings', 'env', 'environment',
];

/** Keywords для определения решений */
const DECISION_KEYWORDS = [
    'decide', 'decided', 'decision', 'choose', 'chose', 'chosen',
    'go with', 'going with', 'use', 'using', 'will use', 'let\'s use',
    'approach', 'solution', 'way to', 'method', 'strategy',
    'instead of', 'rather than', 'prefer', 'opt for',
];

export class CompactionEngine extends EventEmitter {
    private config: CompactionConfig;
    private rounds: Map<string, ConversationRound> = new Map();
    private roundOrder: string[] = [];
    private relevanceScorer: RelevanceScorer;
    private criticalInfo: CriticalInformation = {
        requirements: [],
        decisions: [],
        codeChanges: [],
        facts: [],
    };
    private compactionHistory: CompactionResult[] = [];
    private isCompacting = false;

    constructor(
        relevanceScorer: RelevanceScorer,
        config?: Partial<CompactionConfig>
    ) {
        super();
        this.relevanceScorer = relevanceScorer;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Добавляет новый раунд в историю
     */
    addRound(
        userMessage: string,
        assistantResponse: string,
        toolCalls?: ToolCallInfo[]
    ): ConversationRound {
        const id = `round_${Date.now()}_${this.rounds.size}`;
        const index = this.rounds.size;

        // Определяем важность
        const importance = this.analyzeImportance(userMessage, assistantResponse);

        const round: ConversationRound = {
            id,
            index,
            userMessage,
            assistantResponse,
            toolCalls,
            timestamp: Date.now(),
            importance,
        };

        this.rounds.set(id, round);
        this.roundOrder.push(id);

        // Трекаем в relevance scorer
        const content = `${userMessage}\n${assistantResponse}`;
        this.relevanceScorer.trackItem(id, 'message', content, {
            index,
            hasRequirements: importance.hasRequirements,
            hasDecisions: importance.hasDecisions,
        });

        // Извлекаем critical information
        this.extractCriticalInfo(round);

        logger.debug(`CompactionEngine: added round ${index} (importance: ${importance.autoScore.toFixed(2)})`);
        this.emit('roundAdded', round);

        // Проверяем необходимость compaction
        this.checkCompactionNeed();

        return round;
    }

    /**
     * Анализирует важность раунда
     */
    private analyzeImportance(userMsg: string, assistantMsg: string): RoundImportance {
        const text = `${userMsg} ${assistantMsg}`.toLowerCase();
        const userLower = userMsg.toLowerCase();

        // Считаем keywords
        let keywordScore = 0;
        for (const keyword of IMPORTANT_KEYWORDS) {
            const regex = new RegExp(`\\b${keyword}\\b`, 'g');
            const matches = text.match(regex);
            if (matches) {
                keywordScore += matches.length;
            }
        }

        // Проверяем решения
        let hasDecisions = false;
        for (const keyword of DECISION_KEYWORDS) {
            if (text.includes(keyword)) {
                hasDecisions = true;
                break;
            }
        }

        // Проверяем код
        const hasCode = /```[\s\S]*?```/.test(assistantMsg) ||
            /(?:function|class|interface|const|let|var)\s+\w+/.test(assistantMsg);

        // Проверяем явное выделение важности (!!, IMPORTANT, etc.)
        const isMarkedImportant = /!!|IMPORTANT|CRITICAL|ATTENTION/i.test(userMsg);

        // Вычисляем auto score
        const autoScore = Math.min(1, keywordScore / 5 + (hasCode ? 0.3 : 0));

        return {
            hasRequirements: /(?:requirement|requirements|need to|must|should)\b/i.test(userMsg),
            hasDecisions,
            hasCode,
            isMarkedImportant,
            autoScore,
        };
    }

    /**
     * Извлекает critical information из раунда
     */
    private extractCriticalInfo(round: ConversationRound): void {
        // User requirements
        if (round.importance.hasRequirements) {
            const requirements = this.extractRequirements(round.userMessage);
            this.criticalInfo.requirements.push(...requirements);
        }

        // Decisions
        if (round.importance.hasDecisions) {
            const decisions = this.extractDecisions(round.assistantResponse);
            this.criticalInfo.decisions.push(...decisions);
        }

        // Code changes из tool calls
        if (round.toolCalls) {
            for (const toolCall of round.toolCalls) {
                if (toolCall.name.includes('write') || toolCall.name.includes('edit')) {
                    const change: CodeChangeInfo = {
                        filePath: toolCall.arguments.path || toolCall.arguments.file || 'unknown',
                        changeType: 'modify',
                        description: `Tool call: ${toolCall.name}`,
                    };
                    this.criticalInfo.codeChanges.push(change);
                }
            }
        }

        // Факты (если assistant явно что-то подчёркивает)
        const facts = this.extractFacts(round.assistantResponse);
        this.criticalInfo.facts.push(...facts);
    }

    /**
     * Извлекает requirements из текста
     */
    private extractRequirements(text: string): string[] {
        const requirements: string[] = [];
        
        // Ищем паттерны типа "I need...", "We should...", "It must..."
        const patterns = [
            /(?:i|we)\s+(?:need|want|should|must)\s+([^,.]+)/gi,
            /(?:the|it)\s+(?:should|must|needs? to)\s+([^,.]+)/gi,
            /requirement(?:s)?:\s*([^,.]+)/gi,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const req = match[1].trim();
                if (req.length > 10) {
                    requirements.push(req);
                }
            }
        }

        return requirements;
    }

    /**
     * Извлекает decisions из текста
     */
    private extractDecisions(text: string): string[] {
        const decisions: string[] = [];
        
        // Ищем предложения с decision keywords
        const sentences = text.split(/[.!?]+/);
        
        for (const sentence of sentences) {
            const trimmed = sentence.trim().toLowerCase();
            for (const keyword of DECISION_KEYWORDS) {
                if (trimmed.includes(keyword)) {
                    const clean = sentence.trim();
                    if (clean.length > 15 && clean.length < 200) {
                        decisions.push(clean);
                    }
                    break;
                }
            }
        }

        return decisions;
    }

    /**
     * Извлекает факты из текста
     */
    private extractFacts(text: string): string[] {
        const facts: string[] = [];
        
        // Ищем предложения с "Note:", "Important:", "Remember:"
        const patterns = [
            /(?:note|important|remember|key point):\s*([^,.]+)/gi,
            /(?:the\s+key\s+(?:thing|point)\s+is\s+that)\s+([^,.]+)/gi,
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                const fact = match[1].trim();
                if (fact.length > 10) {
                    facts.push(fact);
                }
            }
        }

        return facts;
    }

    /**
     * Проверяет необходимость compaction
     */
    private checkCompactionNeed(): void {
        if (this.isCompacting) return;

        const totalTokens = this.estimateTotalTokens();
        
        if (totalTokens > this.config.compactionThreshold) {
            logger.info(`CompactionEngine: token threshold exceeded (${totalTokens}), starting compaction`);
            this.performCompaction();
        }
    }

    /**
     * Оценивает общее количество токенов
     */
    private estimateTotalTokens(): number {
        let total = 0;
        for (const round of this.rounds.values()) {
            if (round.summary) {
                total += round.summary.summaryTokens;
            } else {
                // ~4 chars per token
                total += Math.ceil((round.userMessage.length + round.assistantResponse.length) / 4);
            }
        }
        return total;
    }

    /**
     * Выполняет compaction
     */
    async performCompaction(): Promise<CompactionResult> {
        if (this.isCompacting) {
            throw new Error('Compaction already in progress');
        }

        this.isCompacting = true;
        this.emit('compactionStarted');

        try {
            const roundsBefore = this.rounds.size;
            const compactedIds: string[] = [];
            let tokensSaved = 0;

            // Определяем раунды для compaction
            const candidates = this.getCompactionCandidates();

            for (const round of candidates) {
                if (round.summary) continue; // Уже сжат

                // Создаём summary
                const summary = await this.createSummary(round);
                round.summary = summary;
                tokensSaved += summary.originalTokens - summary.summaryTokens;
                compactedIds.push(round.id);

                logger.debug(`CompactionEngine: compacted round ${round.index}`);
            }

            // Удаляем старые сжатые раунды если превышен maxRounds
            const removedIds = this.removeOldCompactedRounds();

            const result: CompactionResult = {
                id: `compaction_${Date.now()}`,
                timestamp: Date.now(),
                roundsCompacted: compactedIds.length,
                tokensSaved,
                roundsBefore,
                roundsAfter: this.rounds.size,
                compactedRounds: compactedIds,
                criticalInfo: { ...this.criticalInfo },
            };

            this.compactionHistory.push(result);
            
            logger.info(
                `CompactionEngine: completed. ` +
                `Compacted ${result.roundsCompacted} rounds, saved ${result.tokensSaved} tokens`
            );

            this.emit('compactionCompleted', result);
            return result;
        } finally {
            this.isCompacting = false;
        }
    }

    /**
     * Получает кандидатов для compaction
     */
    private getCompactionCandidates(): ConversationRound[] {
        const rounds = this.getRoundsInOrder();
        const candidates: ConversationRound[] = [];

        // Сохраняем полные последние N раундов
        const fullRetentionCount = Math.min(
            this.config.fullRoundsRetention,
            Math.floor(rounds.length * 0.2) // Минимум 20%
        );

        for (let i = 0; i < rounds.length - fullRetentionCount; i++) {
            const round = rounds[i];
            
            // Не сжимаем очень важные раунды
            if (round.importance.isMarkedImportant) continue;
            if (round.importance.autoScore > 0.8) continue;

            candidates.push(round);
        }

        return candidates;
    }

    /**
     * Создаёт summary для раунда
     */
    private async createSummary(round: ConversationRound): Promise<RoundSummary> {
        const originalText = `${round.userMessage}\n${round.assistantResponse}`;
        const originalTokens = Math.ceil(originalText.length / 4);

        // Создаём summary
        const brief = this.createBrief(round);
        const keyDecisions = this.extractDecisions(round.assistantResponse);
        const requirements = round.importance.hasRequirements
            ? this.extractRequirements(round.userMessage)
            : [];
        
        const codeChanges: CodeChangeInfo[] = [];
        if (this.config.includeCodeInSummary && round.importance.hasCode) {
            const codeBlocks = this.extractCodeChanges(round);
            codeChanges.push(...codeBlocks);
        }

        const summaryText = [
            brief,
            ...keyDecisions.map(d => `Decision: ${d}`),
            ...requirements.map(r => `Requirement: ${r}`),
            ...codeChanges.map(c => `Code: ${c.filePath} (${c.changeType})`),
        ].join('\n');

        const summaryTokens = Math.ceil(summaryText.length / 4);

        return {
            brief,
            keyDecisions,
            requirements,
            codeChanges,
            originalTokens,
            summaryTokens: Math.max(summaryTokens, this.config.minSummaryLength),
            summarizedAt: Date.now(),
        };
    }

    /**
     * Создаёт краткое описание раунда
     */
    private createBrief(round: ConversationRound): string {
        // Берём первое предложение user message
        const firstSentence = round.userMessage.split(/[.!?]+/)[0].trim();
        const truncated = firstSentence.length > 100
            ? firstSentence.substring(0, 100) + '...'
            : firstSentence;
        return `Q: ${truncated}`;
    }

    /**
     * Извлекает code changes из раунда
     */
    private extractCodeChanges(round: ConversationRound): CodeChangeInfo[] {
        const changes: CodeChangeInfo[] = [];
        
        // Ищем code blocks
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        let match;
        
        while ((match = codeBlockRegex.exec(round.assistantResponse)) !== null) {
            const language = match[1] || 'text';
            const code = match[2];
            
            // Определяем файл из context
            const fileMatch = round.assistantResponse.substring(
                Math.max(0, match.index - 200),
                match.index
            ).match(/(?:file|path)[:\s]+(['"]?)([\w/.-]+)\1/i);
            
            changes.push({
                filePath: fileMatch ? fileMatch[2] : `code.${language}`,
                changeType: 'modify',
                description: `Code block (${language}, ${code.length} chars)`,
            });
        }

        return changes;
    }

    /**
     * Удаляет старые сжатые раунды
     */
    private removeOldCompactedRounds(): string[] {
        if (this.rounds.size <= this.config.maxRounds) return [];

        const toRemove = this.rounds.size - this.config.maxRounds;
        const rounds = this.getRoundsInOrder();
        const removed: string[] = [];

        // Удаляем старые сжатые раунды
        for (let i = 0; i < toRemove && i < rounds.length; i++) {
            const round = rounds[i];
            if (round.summary && !round.importance.isMarkedImportant) {
                this.rounds.delete(round.id);
                this.roundOrder = this.roundOrder.filter(id => id !== round.id);
                this.relevanceScorer.removeItem(round.id);
                removed.push(round.id);
            }
        }

        return removed;
    }

    /**
     * Получает раунды в порядке их создания
     */
    getRoundsInOrder(): ConversationRound[] {
        return this.roundOrder
            .map(id => this.rounds.get(id))
            .filter((r): r is ConversationRound => r !== undefined);
    }

    /**
     * Получает полные раунды (не сжатые)
     */
    getFullRounds(): ConversationRound[] {
        return this.getRoundsInOrder().filter(r => !r.summary);
    }

    /**
     * Получает последние N раундов
     */
    getRecentRounds(count: number): ConversationRound[] {
        const all = this.getRoundsInOrder();
        return all.slice(-count);
    }

    /**
     * Получает раунд по ID
     */
    getRound(id: string): ConversationRound | undefined {
        return this.rounds.get(id);
    }

    /**
     * Получает critical information
     */
    getCriticalInfo(): CriticalInformation {
        return { ...this.criticalInfo };
    }

    /**
     * Получает историю compaction
     */
    getCompactionHistory(): CompactionResult[] {
        return [...this.compactionHistory];
    }

    /**
     * Проверяет, выполняется ли compaction
     */
    isCompactionInProgress(): boolean {
        return this.isCompacting;
    }

    /**
     * Получает статистику
     */
    getStats(): {
        totalRounds: number;
        fullRounds: number;
        compactedRounds: number;
        totalTokens: number;
        compactionCount: number;
    } {
        const rounds = this.getRoundsInOrder();
        return {
            totalRounds: rounds.length,
            fullRounds: rounds.filter(r => !r.summary).length,
            compactedRounds: rounds.filter(r => r.summary).length,
            totalTokens: this.estimateTotalTokens(),
            compactionCount: this.compactionHistory.length,
        };
    }

    /**
     * Сброс всех данных
     */
    reset(): void {
        this.rounds.clear();
        this.roundOrder = [];
        this.criticalInfo = {
            requirements: [],
            decisions: [],
            codeChanges: [],
            facts: [],
        };
        this.compactionHistory = [];
        this.isCompacting = false;
        logger.debug('CompactionEngine: reset');
        this.emit('reset');
    }

    /**
     * Обновление конфигурации
     */
    updateConfig(config: Partial<CompactionConfig>): void {
        this.config = { ...this.config, ...config };
        logger.debug('CompactionEngine: config updated', config);
        this.emit('configUpdated', this.config);
    }

    /**
     * Освобождение ресурсов
     */
    dispose(): void {
        this.reset();
        this.removeAllListeners();
    }
}
