/**
 * Source Mapper
 * IDE Kimi IDE - Debugger Framework
 */

import { EventEmitter, Disposable } from './types';

// ============================================================================
// Types
// ============================================================================

export interface SourceLocation {
    /** Путь к файлу */
    path: string;
    /** Номер строки */
    line: number;
    /** Номер колонки */
    column?: number;
}

export interface BreakpointInfo {
    /** ID breakpoint */
    id: number;
    /** Путь к файлу */
    path: string;
    /** Номер строки */
    line: number;
    /** Номер колонки */
    column?: number;
    /** Условие */
    condition?: string;
    /** Hit condition */
    hitCondition?: string;
    /** Log message */
    logMessage?: string;
    /** Проверка пройдена */
    verified: boolean;
}

export interface CurrentLineInfo {
    /** Путь к файлу */
    path: string;
    /** Номер строки */
    line: number;
    /** Номер колонки */
    column?: number;
    /** ID потока */
    threadId?: number;
    /** ID стекового фрейма */
    frameId?: number;
}

export enum LineHighlightType {
    /** Текущая исполняемая строка */
    Current = 'current',
    /** Строка после step */
    Stepped = 'stepped',
    /** Точка останова */
    Breakpoint = 'breakpoint'
}

// ============================================================================
// Events
// ============================================================================

export interface CurrentLineChangedEvent {
    previous: CurrentLineInfo | null;
    current: CurrentLineInfo | null;
}

export interface BreakpointsChangedEvent {
    path: string;
    breakpoints: BreakpointInfo[];
}

// ============================================================================
// Source Mapper
// ============================================================================

/**
 * Source Mapper - управление отображением исходного кода в отладчике
 * 
 * Отвечает за:
 * - Подсветку текущей строки (жёлтая)
 * - Отображение breakpoints (красные точки)
 * - Подсветку после step
 */
export class SourceMapper implements Disposable {
    private breakpoints: Map<string, Map<number, BreakpointInfo>> = new Map();
    private currentLine: CurrentLineInfo | null = null;
    private stepHighlight: SourceLocation | null = null;
    private nextBreakpointId = 1;

    // Event emitters
    private onCurrentLineChangedEmitter = new EventEmitter<CurrentLineChangedEvent>();
    private onBreakpointsChangedEmitter = new EventEmitter<BreakpointsChangedEvent>();

    // ============================================================================
    // Events
    // ============================================================================

    get onCurrentLineChanged(): EventEmitter<CurrentLineChangedEvent> {
        return this.onCurrentLineChangedEmitter;
    }

    get onBreakpointsChanged(): EventEmitter<BreakpointsChangedEvent> {
        return this.onBreakpointsChangedEmitter;
    }

    // ============================================================================
    // Current Line
    // ============================================================================

    /**
     * Установить текущую строку (для подсветки)
     */
    setCurrentLine(location: SourceLocation, threadId?: number, frameId?: number): void {
        const previous = this.currentLine;
        
        this.currentLine = {
            path: location.path,
            line: location.line,
            column: location.column,
            threadId,
            frameId
        };

        // Clear step highlight when setting new current line
        this.stepHighlight = null;

        this.onCurrentLineChangedEmitter.emit({
            previous,
            current: this.currentLine
        });
    }

    /**
     * Получить текущую строку
     */
    getCurrentLine(): CurrentLineInfo | null {
        return this.currentLine;
    }

    /**
     * Очистить текущую строку
     */
    clearCurrentLine(): void {
        const previous = this.currentLine;
        this.currentLine = null;

        this.onCurrentLineChangedEmitter.emit({
            previous,
            current: null
        });
    }

    // ============================================================================
    // Step Highlight
    // ============================================================================

    /**
     * Установить подсветку после step
     */
    setStepHighlight(location: SourceLocation): void {
        this.stepHighlight = location;
    }

    /**
     * Получить подсветку step
     */
    getStepHighlight(): SourceLocation | null {
        return this.stepHighlight;
    }

    /**
     * Очистить подсветку step
     */
    clearStepHighlight(): void {
        this.stepHighlight = null;
    }

    // ============================================================================
    // Breakpoints
    // ============================================================================

    /**
     * Добавить breakpoint
     */
    addBreakpoint(
        path: string,
        line: number,
        options?: {
            column?: number;
            condition?: string;
            hitCondition?: string;
            logMessage?: string;
        }
    ): BreakpointInfo {
        const fileBreakpoints = this.getOrCreateFileBreakpoints(path);

        // Проверяем существование
        if (fileBreakpoints.has(line)) {
            return fileBreakpoints.get(line)!;
        }

        const breakpoint: BreakpointInfo = {
            id: this.nextBreakpointId++,
            path,
            line,
            column: options?.column,
            condition: options?.condition,
            hitCondition: options?.hitCondition,
            logMessage: options?.logMessage,
            verified: false // Будет обновлено после подтверждения от debug adapter
        };

        fileBreakpoints.set(line, breakpoint);
        this.emitBreakpointsChanged(path);

        return breakpoint;
    }

    /**
     * Удалить breakpoint
     */
    removeBreakpoint(path: string, line: number): boolean {
        const fileBreakpoints = this.breakpoints.get(path);
        if (!fileBreakpoints) {
            return false;
        }

        const deleted = fileBreakpoints.delete(line);
        if (deleted) {
            this.emitBreakpointsChanged(path);
        }

        return deleted;
    }

    /**
     * Удалить breakpoint по ID
     */
    removeBreakpointById(breakpointId: number): boolean {
        for (const [path, fileBreakpoints] of this.breakpoints) {
            for (const [line, bp] of fileBreakpoints) {
                if (bp.id === breakpointId) {
                    fileBreakpoints.delete(line);
                    this.emitBreakpointsChanged(path);
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Обновить breakpoint
     */
    updateBreakpoint(
        breakpointId: number,
        updates: Partial<Omit<BreakpointInfo, 'id' | 'path'>>
    ): BreakpointInfo | null {
        for (const fileBreakpoints of this.breakpoints.values()) {
            for (const bp of fileBreakpoints.values()) {
                if (bp.id === breakpointId) {
                    Object.assign(bp, updates);
                    this.emitBreakpointsChanged(bp.path);
                    return bp;
                }
            }
        }
        return null;
    }

    /**
     * Установить verified статус breakpoint
     */
    setBreakpointVerified(breakpointId: number, verified: boolean): void {
        this.updateBreakpoint(breakpointId, { verified });
    }

    /**
     * Получить breakpoint по ID
     */
    getBreakpointById(breakpointId: number): BreakpointInfo | null {
        for (const fileBreakpoints of this.breakpoints.values()) {
            for (const bp of fileBreakpoints.values()) {
                if (bp.id === breakpointId) {
                    return bp;
                }
            }
        }
        return null;
    }

    /**
     * Получить breakpoint
     */
    getBreakpoint(path: string, line: number): BreakpointInfo | null {
        const fileBreakpoints = this.breakpoints.get(path);
        if (!fileBreakpoints) {
            return null;
        }
        return fileBreakpoints.get(line) || null;
    }

    /**
     * Получить все breakpoints для файла
     */
    getBreakpointsForFile(path: string): BreakpointInfo[] {
        const fileBreakpoints = this.breakpoints.get(path);
        if (!fileBreakpoints) {
            return [];
        }
        return Array.from(fileBreakpoints.values());
    }

    /**
     * Получить все breakpoints
     */
    getAllBreakpoints(): BreakpointInfo[] {
        const all: BreakpointInfo[] = [];
        for (const fileBreakpoints of this.breakpoints.values()) {
            all.push(...fileBreakpoints.values());
        }
        return all;
    }

    /**
     * Проверить наличие breakpoint на строке
     */
    hasBreakpoint(path: string, line: number): boolean {
        const fileBreakpoints = this.breakpoints.get(path);
        return fileBreakpoints?.has(line) ?? false;
    }

    /**
     * Очистить все breakpoints для файла
     */
    clearBreakpointsForFile(path: string): void {
        if (this.breakpoints.delete(path)) {
            this.emitBreakpointsChanged(path);
        }
    }

    /**
     * Очистить все breakpoints
     */
    clearAllBreakpoints(): void {
        const paths = Array.from(this.breakpoints.keys());
        this.breakpoints.clear();
        for (const path of paths) {
            this.emitBreakpointsChanged(path);
        }
    }

    /**
     * Переместить breakpoint
     */
    moveBreakpoint(path: string, oldLine: number, newLine: number): BreakpointInfo | null {
        const fileBreakpoints = this.breakpoints.get(path);
        if (!fileBreakpoints) {
            return null;
        }

        const bp = fileBreakpoints.get(oldLine);
        if (!bp) {
            return null;
        }

        fileBreakpoints.delete(oldLine);
        bp.line = newLine;
        fileBreakpoints.set(newLine, bp);

        this.emitBreakpointsChanged(path);
        return bp;
    }

    // ============================================================================
    // Line Decoration Helpers
    // ============================================================================

    /**
     * Получить тип подсветки для строки
     */
    getLineHighlightType(path: string, line: number): LineHighlightType | null {
        // Приоритет: текущая строка > step highlight > breakpoint
        
        if (this.currentLine?.path === path && this.currentLine.line === line) {
            return LineHighlightType.Current;
        }
        
        if (this.stepHighlight?.path === path && this.stepHighlight.line === line) {
            return LineHighlightType.Stepped;
        }
        
        if (this.hasBreakpoint(path, line)) {
            return LineHighlightType.Breakpoint;
        }
        
        return null;
    }

    /**
     * Проверить, является ли строка текущей
     */
    isCurrentLine(path: string, line: number): boolean {
        return this.currentLine?.path === path && this.currentLine.line === line;
    }

    /**
     * Проверить, является ли строка step highlight
     */
    isStepHighlight(path: string, line: number): boolean {
        return this.stepHighlight?.path === path && this.stepHighlight.line === line;
    }

    // ============================================================================
    // Utility
    // ============================================================================

    /**
     * Получить путь к файлу из URI
     */
    static normalizePath(uri: string): string {
        if (uri.startsWith('file://')) {
            return decodeURIComponent(uri.slice(7));
        }
        return uri;
    }

    /**
     * Получить URI из пути
     */
    static toUri(path: string): string {
        return 'file://' + encodeURIComponent(path);
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private getOrCreateFileBreakpoints(path: string): Map<number, BreakpointInfo> {
        if (!this.breakpoints.has(path)) {
            this.breakpoints.set(path, new Map());
        }
        return this.breakpoints.get(path)!;
    }

    private emitBreakpointsChanged(path: string): void {
        const breakpoints = this.getBreakpointsForFile(path);
        this.onBreakpointsChangedEmitter.emit({ path, breakpoints });
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.clearAllBreakpoints();
        this.clearCurrentLine();
        this.clearStepHighlight();
        this.onCurrentLineChangedEmitter.dispose();
        this.onBreakpointsChangedEmitter.dispose();
    }
}

// ============================================================================
// Source Cache
// ============================================================================

/**
 * Кэш исходных файлов для отладчика
 */
export class SourceCache implements Disposable {
    private cache: Map<string, { content: string; timestamp: number }> = new Map();
    private maxSize: number;
    private ttl: number;

    constructor(options?: { maxSize?: number; ttl?: number }) {
        this.maxSize = options?.maxSize ?? 50;
        this.ttl = options?.ttl ?? 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Получить содержимое файла из кэша
     */
    get(path: string): string | null {
        const entry = this.cache.get(path);
        if (!entry) {
            return null;
        }

        // Check TTL
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(path);
            return null;
        }

        return entry.content;
    }

    /**
     * Добавить файл в кэш
     */
    set(path: string, content: string): void {
        // Cleanup if cache is full
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }

        this.cache.set(path, {
            content,
            timestamp: Date.now()
        });
    }

    /**
     * Удалить файл из кэша
     */
    delete(path: string): void {
        this.cache.delete(path);
    }

    /**
     * Очистить кэш
     */
    clear(): void {
        this.cache.clear();
    }

    /**
     * Dispose
     */
    dispose(): void {
        this.clear();
    }
}
