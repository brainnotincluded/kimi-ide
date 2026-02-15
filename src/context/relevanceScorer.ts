/**
 * Relevance Scorer - оценка релевантности контента
 * 
 * Определяет, какие файлы и части контекста всё ещё актуальны
 * для текущего разговора. Используется для:
 * - Выявления least relevant content при compaction
 * - Semantic similarity scoring
 * - Отслеживания decay по времени
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface RelevanceScore {
    /** Идентификатор элемента (file path, message id, etc.) */
    id: string;
    /** Тип элемента */
    type: RelevanceItemType;
    /** Базовый score (0-1) */
    baseScore: number;
    /** Score по времени (decay) */
    temporalScore: number;
    /** Semantic similarity score */
    semanticScore: number;
    /** Interaction score (как часто упоминалось) */
    interactionScore: number;
    /** Финальный score (0-1) */
    finalScore: number;
    /** Веса, использованные для расчёта */
    weights: {
        temporal: number;
        semantic: number;
        interaction: number;
    };
    /** Timestamp последнего обновления */
    lastUpdated: number;
    /** Метаданные */
    metadata?: Record<string, any>;
}

export type RelevanceItemType = 
    | 'file'
    | 'message'
    | 'symbol'
    | 'toolResult'
    | 'decision'
    | 'requirement';

export interface RelevanceConfig {
    /** Вес временного decay */
    temporalWeight: number;
    /** Вес semantic similarity */
    semanticWeight: number;
    /** Вес взаимодействия */
    interactionWeight: number;
    /** Период half-life для temporal decay (ms) */
    temporalHalfLife: number;
    /** Минимальный score для сохранения */
    minRelevanceThreshold: number;
    /** Максимальное количество отслеживаемых элементов */
    maxTrackedItems: number;
}

export interface ScoringContext {
    /** Текущий user query */
    currentQuery?: string;
    /** Недавние сообщения (для semantic similarity) */
    recentMessages?: string[];
    /** Активные файлы в редакторе */
    activeFiles?: string[];
    /** Текущее время */
    timestamp: number;
}

export interface SemanticVector {
    terms: Map<string, number>;
    magnitude: number;
}

const DEFAULT_CONFIG: RelevanceConfig = {
    temporalWeight: 0.3,
    semanticWeight: 0.4,
    interactionWeight: 0.3,
    temporalHalfLife: 10 * 60 * 1000, // 10 минут
    minRelevanceThreshold: 0.1,
    maxTrackedItems: 1000,
};

/** Stop words для TF-IDF */
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
    'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
    'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'under', 'and', 'but', 'or', 'yet', 'so', 'if',
    'because', 'although', 'though', 'while', 'where', 'when', 'that',
    'which', 'who', 'whom', 'whose', 'what', 'this', 'these', 'those',
    'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
    'us', 'them', 'my', 'your', 'his', 'its', 'our', 'their', 'mine',
    'yours', 'hers', 'ours', 'theirs', 'myself', 'yourself', 'himself',
    'herself', 'itself', 'ourselves', 'themselves', 'what', 'which',
    'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
    'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because',
    'as', 'until', 'while', 'of', 'at', 'by', 'for', 'with', 'about',
    'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over',
    'under', 'again', 'further', 'then', 'once', 'here', 'there',
    'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
    'own', 'same', 'than', 'too', 'very', 'can', 'will', 'just',
    'should', 'now',
]);

export class RelevanceScorer extends EventEmitter {
    private config: RelevanceConfig;
    private scores: Map<string, RelevanceScore> = new Map();
    private interactions: Map<string, number> = new Map();
    private semanticCache: Map<string, SemanticVector> = new Map();
    private queryVector: SemanticVector | null = null;

    constructor(config?: Partial<RelevanceConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Добавляет элемент для отслеживания релевантности
     */
    trackItem(
        id: string,
        type: RelevanceItemType,
        content: string,
        metadata?: Record<string, any>
    ): RelevanceScore {
        // Удаляем старые элементы если превышен лимит
        if (this.scores.size >= this.config.maxTrackedItems) {
            this.evictLeastRelevant();
        }

        // Создаём semantic vector для контента
        const vector = this.computeSemanticVector(content);
        this.semanticCache.set(id, vector);

        // Инициализируем interaction count
        if (!this.interactions.has(id)) {
            this.interactions.set(id, 0);
        }

        const now = Date.now();
        const score: RelevanceScore = {
            id,
            type,
            baseScore: 1.0,
            temporalScore: 1.0,
            semanticScore: 0.5, // Neutral начальное значение
            interactionScore: 0,
            finalScore: 1.0,
            weights: {
                temporal: this.config.temporalWeight,
                semantic: this.config.semanticWeight,
                interaction: this.config.interactionWeight,
            },
            lastUpdated: now,
            metadata,
        };

        this.scores.set(id, score);
        this.recalculateScore(id);

        logger.debug(`RelevanceScorer: tracking ${type} ${id}`);
        this.emit('itemTracked', score);

        return score;
    }

    /**
     * Обновляет текущий query context
     */
    updateQueryContext(query: string, recentMessages?: string[]): void {
        // Вычисляем vector для текущего query
        this.queryVector = this.computeSemanticVector(query);

        // Обновляем semantic scores для всех элементов
        for (const id of this.scores.keys()) {
            this.recalculateScore(id);
        }

        logger.debug('RelevanceScorer: query context updated');
        this.emit('contextUpdated', { query, recentMessages });
    }

    /**
     * Регистрирует взаимодействие с элементом
     */
    recordInteraction(id: string, weight: number = 1): void {
        const current = this.interactions.get(id) || 0;
        this.interactions.set(id, current + weight);

        const score = this.scores.get(id);
        if (score) {
            this.recalculateScore(id);
            logger.debug(`RelevanceScorer: recorded interaction with ${id} (+${weight})`);
        }
    }

    /**
     * Обновляет temporal scores (decay)
     */
    updateTemporalDecay(): void {
        const now = Date.now();

        for (const [id, score] of this.scores.entries()) {
            const timeDiff = now - score.lastUpdated;
            const halfLives = timeDiff / this.config.temporalHalfLife;
            score.temporalScore = Math.pow(0.5, halfLives);
            
            this.recalculateScore(id);
        }

        logger.debug('RelevanceScorer: temporal decay updated');
        this.emit('temporalUpdated');
    }

    /**
     * Пересчитывает финальный score для элемента
     */
    private recalculateScore(id: string): void {
        const score = this.scores.get(id);
        if (!score) return;

        // Обновляем semantic score если есть query
        if (this.queryVector) {
            const itemVector = this.semanticCache.get(id);
            if (itemVector) {
                score.semanticScore = this.computeCosineSimilarity(
                    this.queryVector,
                    itemVector
                );
            }
        }

        // Обновляем interaction score
        const interactions = this.interactions.get(id) || 0;
        score.interactionScore = Math.min(interactions / 10, 1.0); // Normalize to 0-1

        // Вычисляем финальный score
        score.finalScore =
            score.weights.temporal * score.temporalScore +
            score.weights.semantic * score.semanticScore +
            score.weights.interaction * score.interactionScore;

        // Ensure 0-1 range
        score.finalScore = Math.max(0, Math.min(1, score.finalScore));
        score.lastUpdated = Date.now();
    }

    /**
     * Вычисляет semantic vector для текста
     */
    private computeSemanticVector(text: string): SemanticVector {
        const terms = new Map<string, number>();
        
        // Простая токенизация
        const words = text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !STOP_WORDS.has(w));

        // TF (term frequency)
        for (const word of words) {
            const current = terms.get(word) || 0;
            terms.set(word, current + 1);
        }

        // Normalize by max frequency
        let maxFreq = 0;
        for (const freq of terms.values()) {
            maxFreq = Math.max(maxFreq, freq);
        }

        if (maxFreq > 0) {
            for (const [term, freq] of terms.entries()) {
                terms.set(term, freq / maxFreq);
            }
        }

        // Calculate magnitude
        let magnitude = 0;
        for (const freq of terms.values()) {
            magnitude += freq * freq;
        }
        magnitude = Math.sqrt(magnitude);

        return { terms, magnitude };
    }

    /**
     * Вычисляет cosine similarity между двумя векторами
     */
    private computeCosineSimilarity(a: SemanticVector, b: SemanticVector): number {
        let dotProduct = 0;

        // Compute dot product
        for (const [term, freqA] of a.terms.entries()) {
            const freqB = b.terms.get(term);
            if (freqB) {
                dotProduct += freqA * freqB;
            }
        }

        // Normalize
        if (a.magnitude === 0 || b.magnitude === 0) {
            return 0;
        }

        return dotProduct / (a.magnitude * b.magnitude);
    }

    /**
     * Получает score для элемента
     */
    getScore(id: string): RelevanceScore | undefined {
        return this.scores.get(id);
    }

    /**
     * Получает все scores
     */
    getAllScores(): RelevanceScore[] {
        return Array.from(this.scores.values())
            .sort((a, b) => b.finalScore - a.finalScore);
    }

    /**
     * Получает элементы по типу
     */
    getScoresByType(type: RelevanceItemType): RelevanceScore[] {
        return this.getAllScores().filter(s => s.type === type);
    }

    /**
     * Получает наименее релевантные элементы
     */
    getLeastRelevant(limit: number = 10): RelevanceScore[] {
        return this.getAllScores()
            .sort((a, b) => a.finalScore - b.finalScore)
            .slice(0, limit);
    }

    /**
     * Получает наиболее релевантные элементы
     */
    getMostRelevant(limit: number = 10): RelevanceScore[] {
        return this.getAllScores()
            .sort((a, b) => b.finalScore - a.finalScore)
            .slice(0, limit);
    }

    /**
     * Получает элементы ниже threshold
     */
    getBelowThreshold(threshold?: number): RelevanceScore[] {
        const minThreshold = threshold ?? this.config.minRelevanceThreshold;
        return this.getAllScores().filter(s => s.finalScore < minThreshold);
    }

    /**
     * Удаляет элемент из отслеживания
     */
    removeItem(id: string): boolean {
        const removed = this.scores.delete(id);
        this.interactions.delete(id);
        this.semanticCache.delete(id);

        if (removed) {
            logger.debug(`RelevanceScorer: removed ${id}`);
            this.emit('itemRemoved', id);
        }

        return removed;
    }

    /**
     * Удаляет наименее релевантные элементы при превышении лимита
     */
    private evictLeastRelevant(): void {
        const toEvict = this.getLeastRelevant(Math.ceil(this.config.maxTrackedItems * 0.1));
        
        for (const score of toEvict) {
            if (score.finalScore < this.config.minRelevanceThreshold) {
                this.removeItem(score.id);
            }
        }

        logger.debug(`RelevanceScorer: evicted ${toEvict.length} items`);
    }

    /**
     * Вычисляет релевантность между двумя текстами
     */
    computeSimilarity(textA: string, textB: string): number {
        const vectorA = this.computeSemanticVector(textA);
        const vectorB = this.computeSemanticVector(textB);
        return this.computeCosineSimilarity(vectorA, vectorB);
    }

    /**
     * Обновление конфигурации
     */
    updateConfig(config: Partial<RelevanceConfig>): void {
        this.config = { ...this.config, ...config };
        
        // Пересчитываем все scores с новыми весами
        for (const id of this.scores.keys()) {
            const score = this.scores.get(id)!;
            score.weights = {
                temporal: this.config.temporalWeight,
                semantic: this.config.semanticWeight,
                interaction: this.config.interactionWeight,
            };
            this.recalculateScore(id);
        }

        logger.debug('RelevanceScorer: config updated', config);
        this.emit('configUpdated', this.config);
    }

    /**
     * Сброс всех scores
     */
    reset(): void {
        this.scores.clear();
        this.interactions.clear();
        this.semanticCache.clear();
        this.queryVector = null;
        logger.debug('RelevanceScorer: reset');
        this.emit('reset');
    }

    /**
     * Получение статистики
     */
    getStats(): {
        trackedItems: number;
        averageScore: number;
        minScore: number;
        maxScore: number;
    } {
        const scores = this.getAllScores();
        if (scores.length === 0) {
            return { trackedItems: 0, averageScore: 0, minScore: 0, maxScore: 0 };
        }

        const finalScores = scores.map(s => s.finalScore);
        return {
            trackedItems: scores.length,
            averageScore: finalScores.reduce((a, b) => a + b, 0) / finalScores.length,
            minScore: Math.min(...finalScores),
            maxScore: Math.max(...finalScores),
        };
    }

    /**
     * Освобождение ресурсов
     */
    dispose(): void {
        this.reset();
        this.removeAllListeners();
    }
}

// Singleton instance
let defaultScorer: RelevanceScorer | null = null;

export function getDefaultRelevanceScorer(): RelevanceScorer {
    if (!defaultScorer) {
        defaultScorer = new RelevanceScorer();
    }
    return defaultScorer;
}

export function resetDefaultRelevanceScorer(): void {
    if (defaultScorer) {
        defaultScorer.dispose();
        defaultScorer = null;
    }
}
