/**
 * Incremental Loader - инкрементальная загрузка контента
 * 
 * Возможности:
 * - После compaction быстро перезагружает нужные файлы
 * - Lazy loading для больших файлов
 * - Chunking для огромных файлов
 * - Кэширование с валидацией
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export interface FileLoadRequest {
    /** URI файла */
    uri: vscode.Uri;
    /** Опциональный range для partial loading */
    range?: { start: number; end: number };
    /** Приоритет загрузки */
    priority: LoadPriority;
    /** Callback при загрузке */
    onProgress?: (loaded: number, total: number) => void;
}

export type LoadPriority = 'critical' | 'high' | 'normal' | 'low' | 'background';

export interface LoadedFile {
    uri: vscode.Uri;
    content: string;
    /** Размер файла в байтах */
    size: number;
    /** Размер в токенах (оценка) */
    estimatedTokens: number;
    /** Время загрузки */
    loadTime: number;
    /** Timestamp загрузки */
    loadedAt: number;
    /** Хэш контента для валидации */
    contentHash: string;
    /** Частично загружен? */
    isPartial: boolean;
    /** Если partial - какой range */
    loadedRange?: { start: number; end: number };
    /** Язык файла */
    language: string;
    /** Метаданные */
    metadata?: FileMetadata;
}

export interface FileMetadata {
    /** Количество строк */
    lineCount: number;
    /** Максимальная длина строки */
    maxLineLength: number;
    /** Есть ли BOM */
    hasBOM: boolean;
    /** Кодировка (предполагаемая) */
    encoding: string;
}

export interface ChunkedFile {
    /** Оригинальный URI */
    uri: vscode.Uri;
    /** Общий размер файла */
    totalSize: number;
    /** Количество чанков */
    chunkCount: number;
    /** Размер чанка */
    chunkSize: number;
    /** Загруженные чанки */
    loadedChunks: Set<number>;
    /** Мапа chunk index -> content */
    chunks: Map<number, string>;
    /** Статистика */
    metadata: FileMetadata;
}

export interface LoaderConfig {
    /** Максимальный размер файла для полной загрузки (bytes) */
    maxFullLoadSize: number;
    /** Максимальный размер файла для lazy loading (bytes) */
    maxLazyLoadSize: number;
    /** Размер чанка для больших файлов */
    chunkSize: number;
    /** Таймаут загрузки (ms) */
    loadTimeout: number;
    /** Максимальный размер кэша (bytes) */
    maxCacheSize: number;
    /** TTL кэша (ms) */
    cacheTTL: number;
    /** Количество параллельных загрузок */
    maxConcurrentLoads: number;
}

export interface LoadResult {
    success: boolean;
    file?: LoadedFile;
    error?: string;
    /** Время загрузки */
    duration: number;
    /** Было ли из кэша */
    fromCache: boolean;
}

const DEFAULT_CONFIG: LoaderConfig = {
    maxFullLoadSize: 1024 * 1024, // 1MB
    maxLazyLoadSize: 10 * 1024 * 1024, // 10MB
    chunkSize: 64 * 1024, // 64KB
    loadTimeout: 30000, // 30s
    maxCacheSize: 50 * 1024 * 1024, // 50MB
    cacheTTL: 5 * 60 * 1000, // 5 minutes
    maxConcurrentLoads: 5,
};

const PRIORITY_ORDER: LoadPriority[] = ['critical', 'high', 'normal', 'low', 'background'];

export class IncrementalLoader extends EventEmitter {
    private config: LoaderConfig;
    private cache: Map<string, LoadedFile> = new Map();
    private chunkedFiles: Map<string, ChunkedFile> = new Map();
    private loadingQueue: Array<{ request: FileLoadRequest; resolve: (result: LoadResult) => void }> = [];
    private activeLoads = 0;
    private cacheSize = 0;

    constructor(config?: Partial<LoaderConfig>) {
        super();
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Загружает файл
     */
    async loadFile(request: FileLoadRequest): Promise<LoadResult> {
        const startTime = Date.now();
        const uriKey = request.uri.toString();

        try {
            // Проверяем кэш
            const cached = this.getFromCache(uriKey);
            if (cached && !request.range) {
                logger.debug(`IncrementalLoader: cache hit for ${request.uri.fsPath}`);
                return {
                    success: true,
                    file: cached,
                    duration: Date.now() - startTime,
                    fromCache: true,
                };
            }

            // Проверяем file size
            const stat = await fs.promises.stat(request.uri.fsPath);
            
            if (stat.size > this.config.maxLazyLoadSize) {
                // Очень большой файл - используем chunking
                return this.loadChunked(request, stat.size, startTime);
            } else if (stat.size > this.config.maxFullLoadSize || request.range) {
                // Средний файл или partial request - lazy loading
                return this.loadLazy(request, stat.size, startTime);
            } else {
                // Маленький файл - полная загрузка
                return this.loadFull(request, stat.size, startTime);
            }
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            logger.error(`IncrementalLoader: failed to load ${request.uri.fsPath}`, error);
            return {
                success: false,
                error: errorMsg,
                duration: Date.now() - startTime,
                fromCache: false,
            };
        }
    }

    /**
     * Полная загрузка файла
     */
    private async loadFull(
        request: FileLoadRequest,
        fileSize: number,
        startTime: number
    ): Promise<LoadResult> {
        const uriKey = request.uri.toString();

        // Ждём слота для загрузки
        await this.acquireLoadSlot(request.priority);

        try {
            const content = await fs.promises.readFile(request.uri.fsPath, 'utf-8');
            const file = this.createLoadedFile(request.uri, content, fileSize, false);
            
            this.addToCache(uriKey, file);

            logger.debug(`IncrementalLoader: full load ${request.uri.fsPath} (${fileSize} bytes)`);
            this.emit('fileLoaded', file, 'full');

            return {
                success: true,
                file,
                duration: Date.now() - startTime,
                fromCache: false,
            };
        } finally {
            this.releaseLoadSlot();
        }
    }

    /**
     * Lazy loading - загрузка только нужной части
     */
    private async loadLazy(
        request: FileLoadRequest,
        fileSize: number,
        startTime: number
    ): Promise<LoadResult> {
        const uriKey = request.uri.toString();

        await this.acquireLoadSlot(request.priority);

        try {
            let content: string;
            let isPartial = false;
            let loadedRange: { start: number; end: number } | undefined;

            if (request.range) {
                // Загружаем только указанный range
                const { start, end } = request.range;
                const buffer = Buffer.alloc(end - start);
                const fd = await fs.promises.open(request.uri.fsPath, 'r');
                try {
                    await fd.read(buffer, 0, end - start, start);
                } finally {
                    await fd.close();
                }
                content = buffer.toString('utf-8');
                isPartial = true;
                loadedRange = { start, end };
            } else {
                // Загружаем весь файл но в фоне
                content = await fs.promises.readFile(request.uri.fsPath, 'utf-8');
            }

            const file = this.createLoadedFile(
                request.uri,
                content,
                fileSize,
                isPartial,
                loadedRange
            );

            if (!isPartial) {
                this.addToCache(uriKey, file);
            }

            logger.debug(`IncrementalLoader: lazy load ${request.uri.fsPath} (${fileSize} bytes)`);
            this.emit('fileLoaded', file, isPartial ? 'partial' : 'lazy');

            return {
                success: true,
                file,
                duration: Date.now() - startTime,
                fromCache: false,
            };
        } finally {
            this.releaseLoadSlot();
        }
    }

    /**
     * Chunked loading для больших файлов
     */
    private async loadChunked(
        request: FileLoadRequest,
        fileSize: number,
        startTime: number
    ): Promise<LoadResult> {
        const uriKey = request.uri.toString();

        // Проверяем есть ли уже chunked file
        let chunked = this.chunkedFiles.get(uriKey);
        if (!chunked) {
            const totalChunks = Math.ceil(fileSize / this.config.chunkSize);
            chunked = {
                uri: request.uri,
                totalSize: fileSize,
                chunkCount: totalChunks,
                chunkSize: this.config.chunkSize,
                loadedChunks: new Set(),
                chunks: new Map(),
                metadata: {
                    lineCount: 0,
                    maxLineLength: 0,
                    hasBOM: false,
                    encoding: 'utf-8',
                },
            };
            this.chunkedFiles.set(uriKey, chunked);
        }

        await this.acquireLoadSlot(request.priority);

        try {
            // Определяем какие чанки загружать
            const chunksToLoad = request.range
                ? this.getChunksForRange(request.range, chunked.chunkSize)
                : [0]; // По умолчанию загружаем первый чанк

            // Загружаем чанки
            const fd = await fs.promises.open(request.uri.fsPath, 'r');
            try {
                for (const chunkIndex of chunksToLoad) {
                    if (chunked.loadedChunks.has(chunkIndex)) continue;

                    const chunkStart = chunkIndex * chunked.chunkSize;
                    const chunkEnd = Math.min(chunkStart + chunked.chunkSize, fileSize);
                    const chunkSize = chunkEnd - chunkStart;

                    const buffer = Buffer.alloc(chunkSize);
                    await fd.read(buffer, 0, chunkSize, chunkStart);
                    
                    chunked.chunks.set(chunkIndex, buffer.toString('utf-8'));
                    chunked.loadedChunks.add(chunkIndex);

                    if (request.onProgress) {
                        request.onProgress(chunked.loadedChunks.size, chunked.chunkCount);
                    }

                    this.emit('chunkLoaded', uriKey, chunkIndex);
                }
            } finally {
                await fd.close();
            }

            // Собираем контент из загруженных чанков
            const content = this.assembleChunks(chunked, chunksToLoad);
            const file = this.createLoadedFile(
                request.uri,
                content,
                fileSize,
                true,
                request.range
            );

            logger.debug(
                `IncrementalLoader: chunked load ${request.uri.fsPath} ` +
                `(${chunksToLoad.length}/${chunked.chunkCount} chunks)`
            );
            this.emit('fileLoaded', file, 'chunked');

            return {
                success: true,
                file,
                duration: Date.now() - startTime,
                fromCache: false,
            };
        } finally {
            this.releaseLoadSlot();
        }
    }

    /**
     * Загружает дополнительные чанки для файла
     */
    async loadMoreChunks(uri: vscode.Uri, chunkIndices: number[]): Promise<boolean> {
        const uriKey = uri.toString();
        const chunked = this.chunkedFiles.get(uriKey);
        if (!chunked) return false;

        await this.acquireLoadSlot('normal');

        try {
            const fd = await fs.promises.open(uri.fsPath, 'r');
            try {
                for (const chunkIndex of chunkIndices) {
                    if (chunked.loadedChunks.has(chunkIndex)) continue;
                    if (chunkIndex < 0 || chunkIndex >= chunked.chunkCount) continue;

                    const chunkStart = chunkIndex * chunked.chunkSize;
                    const chunkEnd = Math.min(chunkStart + chunked.chunkSize, chunked.totalSize);
                    const size = chunkEnd - chunkStart;

                    const buffer = Buffer.alloc(size);
                    await fd.read(buffer, 0, size, chunkStart);
                    
                    chunked.chunks.set(chunkIndex, buffer.toString('utf-8'));
                    chunked.loadedChunks.add(chunkIndex);

                    this.emit('chunkLoaded', uriKey, chunkIndex);
                }
            } finally {
                await fd.close();
            }

            return true;
        } catch (error) {
            logger.error(`IncrementalLoader: failed to load chunks for ${uri.fsPath}`, error);
            return false;
        } finally {
            this.releaseLoadSlot();
        }
    }

    /**
     * Получает полный контент chunked файла (загружает все чанки если нужно)
     */
    async getFullChunkedContent(uri: vscode.Uri): Promise<string | undefined> {
        const uriKey = uri.toString();
        const chunked = this.chunkedFiles.get(uriKey);
        if (!chunked) return undefined;

        // Загружаем недостающие чанки
        const missingChunks: number[] = [];
        for (let i = 0; i < chunked.chunkCount; i++) {
            if (!chunked.loadedChunks.has(i)) {
                missingChunks.push(i);
            }
        }

        if (missingChunks.length > 0) {
            await this.loadMoreChunks(uri, missingChunks);
        }

        // Собираем полный контент
        return this.assembleChunks(chunked, Array.from({ length: chunked.chunkCount }, (_, i) => i));
    }

    /**
     * Собирает контент из чанков
     */
    private assembleChunks(chunked: ChunkedFile, indices: number[]): string {
        const parts: string[] = [];
        for (const index of indices.sort((a, b) => a - b)) {
            const chunk = chunked.chunks.get(index);
            if (chunk) {
                parts.push(chunk);
            }
        }
        return parts.join('');
    }

    /**
     * Определяет какие чанки нужны для range
     */
    private getChunksForRange(range: { start: number; end: number }, chunkSize: number): number[] {
        const startChunk = Math.floor(range.start / chunkSize);
        const endChunk = Math.floor(range.end / chunkSize);
        
        const chunks: number[] = [];
        for (let i = startChunk; i <= endChunk; i++) {
            chunks.push(i);
        }
        return chunks;
    }

    /**
     * Создаёт LoadedFile объект
     */
    private createLoadedFile(
        uri: vscode.Uri,
        content: string,
        size: number,
        isPartial: boolean,
        loadedRange?: { start: number; end: number }
    ): LoadedFile {
        const lines = content.split('\n');
        
        return {
            uri,
            content,
            size,
            estimatedTokens: Math.ceil(content.length / 4),
            loadTime: 0,
            loadedAt: Date.now(),
            contentHash: this.computeHash(content),
            isPartial,
            loadedRange,
            language: this.detectLanguage(uri),
            metadata: {
                lineCount: lines.length,
                maxLineLength: Math.max(...lines.map(l => l.length), 0),
                hasBOM: content.charCodeAt(0) === 0xFEFF,
                encoding: 'utf-8',
            },
        };
    }

    /**
     * Вычисляет простой hash для контента
     */
    private computeHash(content: string): string {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(16);
    }

    /**
     * Определяет язык по расширению файла
     */
    private detectLanguage(uri: vscode.Uri): string {
        const ext = uri.fsPath.split('.').pop()?.toLowerCase() || '';
        const languageMap: Record<string, string> = {
            'ts': 'typescript',
            'tsx': 'typescriptreact',
            'js': 'javascript',
            'jsx': 'javascriptreact',
            'py': 'python',
            'java': 'java',
            'go': 'go',
            'rs': 'rust',
            'cpp': 'cpp',
            'c': 'c',
            'h': 'c',
            'hpp': 'cpp',
            'json': 'json',
            'md': 'markdown',
            'yaml': 'yaml',
            'yml': 'yaml',
            'html': 'html',
            'css': 'css',
            'scss': 'scss',
        };
        return languageMap[ext] || 'plaintext';
    }

    /**
     * Получает файл из кэша
     */
    private getFromCache(uriKey: string): LoadedFile | undefined {
        const cached = this.cache.get(uriKey);
        if (!cached) return undefined;

        // Проверяем TTL
        const age = Date.now() - cached.loadedAt;
        if (age > this.config.cacheTTL) {
            this.removeFromCache(uriKey);
            return undefined;
        }

        return cached;
    }

    /**
     * Добавляет файл в кэш
     */
    private addToCache(uriKey: string, file: LoadedFile): void {
        // Проверяем размер кэша
        while (this.cacheSize + file.size > this.config.maxCacheSize && this.cache.size > 0) {
            this.evictOldestFromCache();
        }

        this.cache.set(uriKey, file);
        this.cacheSize += file.size;
    }

    /**
     * Удаляет файл из кэша
     */
    private removeFromCache(uriKey: string): void {
        const cached = this.cache.get(uriKey);
        if (cached) {
            this.cacheSize -= cached.size;
            this.cache.delete(uriKey);
        }
    }

    /**
     * Удаляет самый старый файл из кэша
     */
    private evictOldestFromCache(): void {
        let oldest: { key: string; time: number } | null = null;
        
        for (const [key, file] of this.cache.entries()) {
            if (!oldest || file.loadedAt < oldest.time) {
                oldest = { key, time: file.loadedAt };
            }
        }

        if (oldest) {
            this.removeFromCache(oldest.key);
            logger.debug(`IncrementalLoader: evicted ${oldest.key} from cache`);
        }
    }

    /**
     * Ждёт слот для загрузки с учётом приоритета
     */
    private acquireLoadSlot(priority: LoadPriority): Promise<void> {
        return new Promise((resolve) => {
            if (this.activeLoads < this.config.maxConcurrentLoads) {
                this.activeLoads++;
                resolve();
            } else {
                this.loadingQueue.push({ 
                    request: { uri: vscode.Uri.file(''), priority } as FileLoadRequest,
                    resolve: () => {
                        this.activeLoads++;
                        resolve();
                    }
                });
                this.processQueue();
            }
        });
    }

    /**
     * Освобождает слот загрузки
     */
    private releaseLoadSlot(): void {
        this.activeLoads--;
        this.processQueue();
    }

    /**
     * Обрабатывает очередь загрузки
     */
    private processQueue(): void {
        if (this.loadingQueue.length === 0) return;
        if (this.activeLoads >= this.config.maxConcurrentLoads) return;

        // Сортируем по приоритету
        this.loadingQueue.sort((a, b) => {
            const priorityDiff = PRIORITY_ORDER.indexOf(a.request.priority) - 
                PRIORITY_ORDER.indexOf(b.request.priority);
            return priorityDiff;
        });

        const next = this.loadingQueue.shift();
        if (next) {
            next.resolve({} as LoadResult);
        }
    }

    /**
     * Инвалидация кэша для URI
     */
    invalidate(uri: vscode.Uri): void {
        const uriKey = uri.toString();
        this.removeFromCache(uriKey);
        this.chunkedFiles.delete(uriKey);
        logger.debug(`IncrementalLoader: invalidated ${uri.fsPath}`);
        this.emit('invalidated', uri);
    }

    /**
     * Полная очистка кэша
     */
    clearCache(): void {
        this.cache.clear();
        this.chunkedFiles.clear();
        this.cacheSize = 0;
        logger.debug('IncrementalLoader: cache cleared');
        this.emit('cacheCleared');
    }

    /**
     * Получает статистику кэша
     */
    getCacheStats(): {
        cachedFiles: number;
        chunkedFiles: number;
        cacheSize: number;
        maxCacheSize: number;
        activeLoads: number;
        queueLength: number;
    } {
        return {
            cachedFiles: this.cache.size,
            chunkedFiles: this.chunkedFiles.size,
            cacheSize: this.cacheSize,
            maxCacheSize: this.config.maxCacheSize,
            activeLoads: this.activeLoads,
            queueLength: this.loadingQueue.length,
        };
    }

    /**
     * Обновление конфигурации
     */
    updateConfig(config: Partial<LoaderConfig>): void {
        this.config = { ...this.config, ...config };
        logger.debug('IncrementalLoader: config updated', config);
        this.emit('configUpdated', this.config);
    }

    /**
     * Освобождение ресурсов
     */
    dispose(): void {
        this.clearCache();
        this.loadingQueue = [];
        this.removeAllListeners();
    }
}
