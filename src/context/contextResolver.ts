/**
 * Context Resolver - разрешение контекста из чата
 * Обрабатывает @file, @folder, @symbol упоминания
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { CodebaseIndexer, SearchResult, CodeSymbolResult, FileContext, SymbolKind } from './codebaseIndexer';

interface Mention {
    type: 'file' | 'folder' | 'symbol' | 'url';
    value: string;
    raw: string;
    range: [number, number];
}

interface ResolvedContext {
    mentions: ResolvedMention[];
    autoContext: AutoContext;
    totalTokens: number;
}

interface ResolvedMention {
    type: 'file' | 'folder' | 'symbol' | 'url';
    value: string;
    content?: string;
    files?: string[];
    symbols?: CodeSymbolResult[];
}

interface AutoContext {
    currentFile?: FileContext;
    relatedFiles: FileContext[];
    openFiles: FileContext[];
}

interface ContextConfig {
    maxAutoContextFiles: number;
    maxContextTokens: number;
    enableAutoContext: boolean;
    prioritizeOpenFiles: boolean;
}

const DEFAULT_CONFIG: ContextConfig = {
    maxAutoContextFiles: 5,
    maxContextTokens: 120000, // ~128K с запасом
    enableAutoContext: true,
    prioritizeOpenFiles: true,
};

export class ContextResolver {
    private indexer: CodebaseIndexer;
    private config: ContextConfig;
    private mentionRegex = /@(\w+):?([^\s]+)/g;
    private fuzzyMatcher: FuzzyMatcher;

    constructor(indexer: CodebaseIndexer, config?: Partial<ContextConfig>) {
        this.indexer = indexer;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.fuzzyMatcher = new FuzzyMatcher();
    }

    /**
     * Разбор сообщения пользователя и извлечение всех упоминаний
     */
    parseMentions(message: string): Mention[] {
        const mentions: Mention[] = [];
        let match;

        // Сброс regex
        this.mentionRegex.lastIndex = 0;

        while ((match = this.mentionRegex.exec(message)) !== null) {
            const raw = match[0];
            const typePrefix = match[1].toLowerCase();
            const value = match[2];
            const start = match.index;
            const end = start + raw.length;

            let type: Mention['type'];

            switch (typePrefix) {
                case 'file':
                case 'f':
                    type = 'file';
                    break;
                case 'folder':
                case 'dir':
                case 'd':
                    type = 'folder';
                    break;
                case 'symbol':
                case 'sym':
                case 's':
                    type = 'symbol';
                    break;
                case 'url':
                case 'http':
                case 'https':
                    type = 'url';
                    break;
                default:
                    // Попытка автоопределения типа
                    if (value.includes('/')) {
                        type = value.endsWith('/') ? 'folder' : 'file';
                    } else if (value.includes('.')) {
                        type = 'file';
                    } else {
                        type = 'symbol';
                    }
            }

            mentions.push({
                type,
                value: this.normalizeMentionValue(value, type),
                raw,
                range: [start, end],
            });
        }

        return mentions;
    }

    /**
     * Разрешение всех упоминаний в контент
     */
    async resolveMentions(mentions: Mention[]): Promise<ResolvedMention[]> {
        const resolved: ResolvedMention[] = [];

        for (const mention of mentions) {
            try {
                const result = await this.resolveMention(mention);
                if (result) {
                    resolved.push(result);
                }
            } catch (error) {
                console.error(`[Kimi] Failed to resolve mention ${mention.raw}:`, error);
            }
        }

        return resolved;
    }

    /**
     * Разрешение одного упоминания
     */
    async resolveMention(mention: Mention): Promise<ResolvedMention | null> {
        switch (mention.type) {
            case 'file':
                return await this.resolveFileMention(mention.value);
            case 'folder':
                return await this.resolveFolderMention(mention.value);
            case 'symbol':
                return await this.resolveSymbolMention(mention.value);
            case 'url':
                return await this.resolveUrlMention(mention.value);
            default:
                return null;
        }
    }

    /**
     * Получение автоматического контекста на основе текущего состояния редактора
     */
    async getAutoContext(): Promise<AutoContext> {
        const autoContext: AutoContext = {
            relatedFiles: [],
            openFiles: [],
        };

        if (!this.config.enableAutoContext) {
            return autoContext;
        }

        // Текущий активный файл
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const currentContext = this.indexer.getFileContext(activeEditor.document.uri);
            if (currentContext) {
                autoContext.currentFile = currentContext;

                // Связанные файлы
                const relatedPaths = this.indexer.getRelatedFiles(
                    activeEditor.document.uri,
                    this.config.maxAutoContextFiles
                );

                for (const relatedPath of relatedPaths) {
                    const relatedUri = vscode.Uri.file(relatedPath);
                    const context = this.indexer.getFileContext(relatedUri);
                    if (context) {
                        autoContext.relatedFiles.push(context);
                    }
                }
            }
        }

        // Открытые файлы
        if (this.config.prioritizeOpenFiles) {
            const visibleEditors = vscode.window.visibleTextEditors;
            for (const editor of visibleEditors) {
                const context = this.indexer.getFileContext(editor.document.uri);
                if (context && context.uri !== autoContext.currentFile?.uri) {
                    autoContext.openFiles.push(context);
                }
            }
        }

        return autoContext;
    }

    /**
     * Поиск релевантных файлов по запросу
     */
    async searchRelevantFiles(query: string, limit: number = 10): Promise<SearchResult[]> {
        return this.indexer.search(query, limit);
    }

    /**
     * Resolve a single file to its context
     */
    async resolveFileContext(uri: vscode.Uri): Promise<FileContext | null> {
        const fileIndex = this.indexer.getFileContext(uri);
        if (!fileIndex) {
            return null;
        }
        
        return {
            uri: fileIndex.uri,
            relativePath: fileIndex.relativePath,
            content: fileIndex.content,
            symbols: fileIndex.symbols,
        };
    }

    /**
     * Get current editor context
     */
    getCurrentContext(): { currentFile?: string; selectedText?: string; language?: string } {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return {};
        }
        
        return {
            currentFile: editor.document.uri.fsPath,
            selectedText: editor.selection.isEmpty ? undefined : editor.document.getText(editor.selection),
            language: editor.document.languageId,
        };
    }

    /**
     * Set custom context data
     */
    setContext(context: Record<string, any>): void {
        // Store context data - can be extended to use workspace state
        (this as any).customContext = { ...(this as any).customContext, ...context };
    }

    /**
     * Полная сборка контекста для отправки в LLM
     */
    async buildContext(message: string): Promise<ResolvedContext> {
        const mentions = this.parseMentions(message);
        const resolvedMentions = await this.resolveMentions(mentions);
        const autoContext = await this.getAutoContext();

        // Оценка токенов (приблизительно)
        let totalTokens = 0;
        
        for (const mention of resolvedMentions) {
            if (mention.content) {
                totalTokens += this.estimateTokens(mention.content);
            }
        }

        if (autoContext.currentFile) {
            totalTokens += this.estimateTokens(autoContext.currentFile.content);
        }

        for (const file of autoContext.relatedFiles) {
            totalTokens += this.estimateTokens(file.content);
        }

        // Если превышен лимит, сокращаем auto-context
        if (totalTokens > this.config.maxContextTokens) {
            const overflow = totalTokens - this.config.maxContextTokens;
            const filesToRemove = Math.ceil(overflow / 2000); // ~2000 tokens per file avg
            
            autoContext.relatedFiles = autoContext.relatedFiles.slice(
                0,
                Math.max(0, autoContext.relatedFiles.length - filesToRemove)
            );
        }

        return {
            mentions: resolvedMentions,
            autoContext,
            totalTokens: Math.min(totalTokens, this.config.maxContextTokens),
        };
    }

    /**
     * Получение автодополнений для упоминаний
     */
    async getMentionCompletions(
        prefix: string,
        type: Mention['type'] | 'auto'
    ): Promise<MentionCompletion[]> {
        const completions: MentionCompletion[] = [];

        if (type === 'auto' || type === 'file') {
            const files = await this.searchFiles(prefix);
            completions.push(...files.map(f => ({
                label: f.path,
                type: 'file' as const,
                detail: f.language,
                insertText: `@file:${f.path}`,
            })));
        }

        if (type === 'auto' || type === 'folder') {
            const folders = await this.searchFolders(prefix);
            completions.push(...folders.map(f => ({
                label: f,
                type: 'folder' as const,
                insertText: `@folder:${f}`,
            })));
        }

        if (type === 'auto' || type === 'symbol') {
            const symbols = this.indexer.searchSymbols(prefix);
            completions.push(...symbols.slice(0, 20).map(s => ({
                label: s.name,
                type: 'symbol' as const,
                detail: `${SymbolKind[s.kind]} in ${s.relativePath}`,
                insertText: `@symbol:${s.name}`,
            })));
        }

        // Сортировка по релевантности
        completions.sort((a, b) => {
            const scoreA = this.fuzzyMatcher.score(a.label, prefix);
            const scoreB = this.fuzzyMatcher.score(b.label, prefix);
            return scoreB - scoreA;
        });

        return completions.slice(0, 20);
    }

    // ==================== Private Methods ====================

    private async resolveFileMention(value: string): Promise<ResolvedMention | null> {
        // Поиск файла
        const fileUri = await this.findFile(value);
        if (!fileUri) {
            return null;
        }

        const context = this.indexer.getFileContext(fileUri);
        if (!context) {
            return null;
        }

        return {
            type: 'file',
            value: context.relativePath,
            content: context.content,
        };
    }

    private async resolveFolderMention(value: string): Promise<ResolvedMention | null> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            return null;
        }

        const folderPath = path.join(workspaceRoot, value);
        
        try {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folderPath, '**/*'),
                '**/node_modules/**'
            );

            const filePaths = files.map(f => 
                path.relative(workspaceRoot, f.fsPath)
            );

            return {
                type: 'folder',
                value,
                files: filePaths,
            };
        } catch {
            return null;
        }
    }

    private async resolveSymbolMention(value: string): Promise<ResolvedMention | null> {
        const symbols = this.indexer.searchSymbols(value);
        
        if (symbols.length === 0) {
            return null;
        }

        return {
            type: 'symbol',
            value,
            symbols: symbols.slice(0, 10),
        };
    }

    private async resolveUrlMention(value: string): Promise<ResolvedMention | null> {
        try {
            // Для URL просто возвращаем ссылку
            // В реальной реализации можно скачивать и парсить контент
            return {
                type: 'url',
                value,
            };
        } catch {
            return null;
        }
    }

    private async findFile(filePath: string): Promise<vscode.Uri | null> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceRoot) {
            return null;
        }

        // Прямой путь
        const directPath = path.join(workspaceRoot.uri.fsPath, filePath);
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(directPath));
            return vscode.Uri.file(directPath);
        } catch {
            // Файл не найден напрямую, ищем fuzzy
        }

        // Fuzzy поиск
        const files = await this.searchFiles(filePath);
        if (files.length > 0) {
            const bestMatch = files[0];
            return vscode.Uri.file(path.join(workspaceRoot.uri.fsPath, bestMatch.path));
        }

        return null;
    }

    private async searchFiles(query: string): Promise<Array<{ path: string; language: string }>> {
        const results = this.indexer.search(query, 20);
        return results.map(r => ({
            path: r.relativePath,
            language: r.language,
        }));
    }

    private async searchFolders(query: string): Promise<string[]> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceRoot) {
            return [];
        }

        // Получаем все директории из индекса
        const folders = new Set<string>();
        const results = this.indexer.search(query, 50);
        
        for (const result of results) {
            const dir = path.dirname(result.relativePath);
            if (dir !== '.') {
                folders.add(dir);
            }
        }

        return Array.from(folders).slice(0, 10);
    }

    private normalizeMentionValue(value: string, type: Mention['type']): string {
        // Удаление кавычек если есть
        value = value.replace(/^["']|["']$/g, '');
        
        // Нормализация путей
        if (type === 'file' || type === 'folder') {
            value = value.replace(/\\/g, '/');
        }

        return value;
    }

    private estimateTokens(text: string): number {
        // Приблизительная оценка: ~4 символа на токен для английского/кода
        return Math.ceil(text.length / 4);
    }
}

// ==================== Helper Classes ====================

class FuzzyMatcher {
    /**
     * Fuzzy matching score (0-1)
     */
    score(str: string, pattern: string): number {
        const lowerStr = str.toLowerCase();
        const lowerPattern = pattern.toLowerCase();

        // Точное совпадение
        if (lowerStr === lowerPattern) {
            return 1;
        }

        // Начинается с паттерна
        if (lowerStr.startsWith(lowerPattern)) {
            return 0.9;
        }

        // Содержит паттерн
        if (lowerStr.includes(lowerPattern)) {
            return 0.7;
        }

        // Fuzzy match
        let patternIdx = 0;
        let strIdx = 0;
        let matches = 0;

        while (patternIdx < lowerPattern.length && strIdx < lowerStr.length) {
            if (lowerPattern[patternIdx] === lowerStr[strIdx]) {
                matches++;
                patternIdx++;
            }
            strIdx++;
        }

        if (patternIdx === lowerPattern.length) {
            // Все символы паттерна найдены
            return 0.5 * (matches / lowerStr.length);
        }

        return 0;
    }
}

// ==================== Types ====================

interface MentionCompletion {
    label: string;
    type: 'file' | 'folder' | 'symbol' | 'url';
    detail?: string;
    insertText: string;
}

export { Mention, ResolvedContext, ResolvedMention, AutoContext, ContextConfig, MentionCompletion };
