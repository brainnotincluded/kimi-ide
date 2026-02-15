/**
 * Codebase Indexer - индексация кодовой базы проекта
 * Создаёт векторные эмбеддинги файлов для RAG (Retrieval Augmented Generation)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createHash } from 'crypto';

// TF-IDF векторизация (lightweight alternative to embeddings API)
interface DocumentVector {
    terms: Map<string, number>;
    magnitude: number;
}

interface FileIndex {
    uri: string;
    relativePath: string;
    content: string;
    contentHash: string;
    lastModified: number;
    size: number;
    language: string;
    vector: DocumentVector;
    symbols: CodeSymbol[];
    summary?: string;
}

export interface CodeSymbol {
    name: string;
    kind: SymbolKind;
    range: { start: number; end: number };
    children?: CodeSymbol[];
}

export enum SymbolKind {
    File = 0,
    Module = 1,
    Namespace = 2,
    Package = 3,
    Class = 4,
    Method = 5,
    Property = 6,
    Field = 7,
    Constructor = 8,
    Enum = 9,
    Interface = 10,
    Function = 11,
    Variable = 12,
    Constant = 13,
    String = 14,
    Number = 15,
    Boolean = 16,
    Array = 17,
    Object = 18,
    Key = 19,
    Null = 20,
    EnumMember = 21,
    Struct = 22,
    Event = 23,
    Operator = 24,
    TypeParameter = 25,
}

interface IndexConfig {
    excludePatterns: string[];
    includePatterns: string[];
    maxFileSize: number;
    supportedLanguages: string[];
}

const DEFAULT_CONFIG: IndexConfig = {
    excludePatterns: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.vscode/**',
        '**/out/**',
        '**/coverage/**',
        '**/*.min.js',
        '**/*.min.css',
        '**/package-lock.json',
        '**/yarn.lock',
        '**/*.lock',
        '**/tmp/**',
        '**/temp/**',
        '**/.cache/**',
        '**/bin/**',
        '**/obj/**',
    ],
    includePatterns: [
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx',
        '**/*.py',
        '**/*.java',
        '**/*.go',
        '**/*.rs',
        '**/*.cpp',
        '**/*.c',
        '**/*.h',
        '**/*.hpp',
        '**/*.cs',
        '**/*.rb',
        '**/*.php',
        '**/*.swift',
        '**/*.kt',
        '**/*.scala',
        '**/*.md',
        '**/*.json',
        '**/*.yaml',
        '**/*.yml',
        '**/*.xml',
        '**/*.html',
        '**/*.css',
        '**/*.scss',
        '**/*.sass',
        '**/*.less',
        '**/*.sql',
    ],
    maxFileSize: 1024 * 1024, // 1MB
    supportedLanguages: [
        'typescript', 'javascript', 'python', 'java', 'go', 'rust',
        'cpp', 'c', 'csharp', 'ruby', 'php', 'swift', 'kotlin',
        'scala', 'markdown', 'json', 'yaml', 'xml', 'html', 'css'
    ],
};

export class CodebaseIndexer {
    private index: Map<string, FileIndex> = new Map();
    private config: IndexConfig;
    private workspaceRoot: string;
    private storageUri: vscode.Uri;
    private isIndexing: boolean = false;
    private stopWords: Set<string>;

    constructor(
        context: vscode.ExtensionContext,
        config?: Partial<IndexConfig>
    ) {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        this.storageUri = context.storageUri || context.globalStorageUri;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.stopWords = this.buildStopWords();
    }

    /**
     * Инициализация и загрузка существующего индекса
     */
    async initialize(): Promise<void> {
        await this.loadIndex();
    }

    /**
     * Полная индексация рабочего пространства
     */
    async indexWorkspace(progressCallback?: (current: number, total: number) => void): Promise<void> {
        if (this.isIndexing) {
            throw new Error('Indexing already in progress');
        }

        this.isIndexing = true;
        const startTime = Date.now();

        try {
            // Очистка старого индекса
            this.index.clear();

            // Получение всех файлов
            const files = await this.getFilesToIndex();
            const totalFiles = files.length;

            console.log(`[Kimi] Starting indexing of ${totalFiles} files...`);

            // Индексация файлов пачками для экономии памяти
            const batchSize = 50;
            for (let i = 0; i < files.length; i += batchSize) {
                const batch = files.slice(i, i + batchSize);
                await Promise.all(batch.map(file => this.indexFile(file)));
                
                if (progressCallback) {
                    progressCallback(Math.min(i + batchSize, totalFiles), totalFiles);
                }

                // Даём event loop обработать другие события
                await new Promise(resolve => setImmediate(resolve));
            }

            // Сохранение индекса
            await this.saveIndex();

            const duration = (Date.now() - startTime) / 1000;
            console.log(`[Kimi] Indexing completed in ${duration}s. Indexed ${this.index.size} files.`);

        } finally {
            this.isIndexing = false;
        }
    }

    /**
     * Инкрементальное обновление индекса (при сохранении файлов)
     */
    async updateFile(uri: vscode.Uri): Promise<void> {
        const filePath = uri.fsPath;
        
        // Проверка, должен ли файл быть проиндексирован
        if (!this.shouldIndexFile(filePath)) {
            // Удаление из индекса, если был
            this.index.delete(filePath);
            return;
        }

        await this.indexFile(uri);
        await this.saveIndex();
    }

    /**
     * Удаление файла из индекса
     */
    async removeFile(uri: vscode.Uri): Promise<void> {
        this.index.delete(uri.fsPath);
        await this.saveIndex();
    }

    /**
     * Поиск по индексу с использованием TF-IDF косинусного сходства
     */
    search(query: string, limit: number = 10): SearchResult[] {
        const queryVector = this.computeTFIDF(this.tokenize(query));
        const results: SearchResult[] = [];

        for (const [filePath, fileIndex] of this.index) {
            const similarity = this.cosineSimilarity(queryVector, fileIndex.vector);
            if (similarity > 0) {
                results.push({
                    uri: fileIndex.uri,
                    relativePath: fileIndex.relativePath,
                    similarity,
                    size: fileIndex.size,
                    language: fileIndex.language,
                });
            }
        }

        // Сортировка по релевантности
        results.sort((a, b) => b.similarity - a.similarity);
        return results.slice(0, limit);
    }

    /**
     * Поиск по символам
     */
    searchSymbols(symbolName: string, kind?: SymbolKind): CodeSymbolResult[] {
        const results: CodeSymbolResult[] = [];
        const lowerName = symbolName.toLowerCase();

        for (const [filePath, fileIndex] of this.index) {
            const matches = this.findSymbols(fileIndex.symbols, lowerName, kind, fileIndex);
            results.push(...matches);
        }

        return results;
    }

    /**
     * Получение контекста файла
     */
    getFileContext(uri: vscode.Uri): FileContext | null {
        const filePath = uri.fsPath;
        const fileIndex = this.index.get(filePath);
        
        if (!fileIndex) {
            return null;
        }

        return {
            uri: fileIndex.uri,
            relativePath: fileIndex.relativePath,
            content: fileIndex.content,
            symbols: fileIndex.symbols,
            summary: fileIndex.summary,
        };
    }

    /**
     * Получение связанных файлов (на основе shared symbols, imports)
     */
    getRelatedFiles(uri: vscode.Uri, limit: number = 5): string[] {
        const filePath = uri.fsPath;
        const fileIndex = this.index.get(filePath);
        
        if (!fileIndex) {
            return [];
        }

        // Извлечение импортов/зависимостей
        const dependencies = this.extractDependencies(fileIndex);
        const related: Map<string, number> = new Map();

        for (const [otherPath, otherIndex] of this.index) {
            if (otherPath === filePath) continue;

            let score = 0;

            // Проверка shared symbols
            const otherSymbols = new Set(otherIndex.symbols.map(s => s.name));
            for (const dep of dependencies) {
                if (otherSymbols.has(dep)) {
                    score += 1;
                }
            }

            // Проверка imports в другом файле
            const otherDeps = this.extractDependencies(otherIndex);
            const fileSymbols = new Set(fileIndex.symbols.map(s => s.name));
            for (const dep of otherDeps) {
                if (fileSymbols.has(dep)) {
                    score += 0.5;
                }
            }

            // Директория proximity
            const dirDistance = this.directoryDistance(
                path.dirname(filePath),
                path.dirname(otherPath)
            );
            score += Math.max(0, 1 - dirDistance * 0.1);

            if (score > 0) {
                related.set(otherPath, score);
            }
        }

        // Сортировка и возврат топ-N
        return Array.from(related.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([path]) => path);
    }

    /**
     * Проверка состояния индекса
     */
    getStats(): IndexStats {
        return {
            totalFiles: this.index.size,
            totalSize: Array.from(this.index.values()).reduce((sum, f) => sum + f.size, 0),
            languages: this.getLanguageDistribution(),
            isIndexing: this.isIndexing,
        };
    }

    // ==================== Private Methods ====================

    private async getFilesToIndex(): Promise<vscode.Uri[]> {
        const files: vscode.Uri[] = [];

        for (const pattern of this.config.includePatterns) {
            const uris = await vscode.workspace.findFiles(
                pattern,
                `{${this.config.excludePatterns.join(',')}}`
            );
            files.push(...uris);
        }

        // Фильтрация по размеру
        const validFiles: vscode.Uri[] = [];
        for (const uri of files) {
            try {
                const stat = await fs.stat(uri.fsPath);
                if (stat.size <= this.config.maxFileSize) {
                    validFiles.push(uri);
                }
            } catch {
                // Игнорируем недоступные файлы
            }
        }

        return validFiles;
    }

    private async indexFile(uri: vscode.Uri): Promise<void> {
        try {
            const filePath = uri.fsPath;
            const content = await fs.readFile(filePath, 'utf-8');
            const contentHash = createHash('md5').update(content).digest('hex');

            // Проверка, изменился ли файл
            const existing = this.index.get(filePath);
            if (existing && existing.contentHash === contentHash) {
                return; // Файл не изменился
            }

            const stat = await fs.stat(filePath);
            const language = this.detectLanguage(filePath);
            const symbols = this.extractSymbols(content, language);
            const tokens = this.tokenize(content);
            const vector = this.computeTFIDF(tokens);

            const relativePath = path.relative(this.workspaceRoot, filePath);

            this.index.set(filePath, {
                uri: uri.toString(),
                relativePath,
                content: this.truncateContent(content),
                contentHash,
                lastModified: stat.mtimeMs,
                size: stat.size,
                language,
                vector,
                symbols,
            });

        } catch (error) {
            console.error(`[Kimi] Failed to index file ${uri.fsPath}:`, error);
        }
    }

    private shouldIndexFile(filePath: string): boolean {
        // Проверка exclude patterns
        for (const pattern of this.config.excludePatterns) {
            if (this.matchGlob(filePath, pattern)) {
                return false;
            }
        }

        // Проверка include patterns
        for (const pattern of this.config.includePatterns) {
            if (this.matchGlob(filePath, pattern)) {
                return true;
            }
        }

        return false;
    }

    private matchGlob(filePath: string, pattern: string): boolean {
        // Упрощённая glob matching
        const regex = new RegExp(
            pattern
                .replace(/\*\*/g, '{{GLOBSTAR}}')
                .replace(/\*/g, '[^/]*')
                .replace(/\?/g, '.')
                .replace(/\{\{GLOBSTAR\}\}/g, '.*')
        );
        return regex.test(filePath);
    }

    private detectLanguage(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        const langMap: Record<string, string> = {
            '.ts': 'typescript',
            '.tsx': 'typescriptreact',
            '.js': 'javascript',
            '.jsx': 'javascriptreact',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.rs': 'rust',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c',
            '.hpp': 'cpp',
            '.cs': 'csharp',
            '.rb': 'ruby',
            '.php': 'php',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.md': 'markdown',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.xml': 'xml',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sass': 'sass',
            '.less': 'less',
            '.sql': 'sql',
        };
        return langMap[ext] || 'plaintext';
    }

    private extractSymbols(content: string, language: string): CodeSymbol[] {
        const symbols: CodeSymbol[] = [];
        const lines = content.split('\n');

        // Упрощённый парсер символов (регулярные выражения)
        // Для production лучше использовать tree-sitter или LSP
        const patterns: { regex: RegExp; kind: SymbolKind }[] = [];

        switch (language) {
            case 'typescript':
            case 'javascript':
            case 'typescriptreact':
            case 'javascriptreact':
                patterns.push(
                    { regex: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, kind: SymbolKind.Function },
                    { regex: /^(?:export\s+)?class\s+(\w+)/, kind: SymbolKind.Class },
                    { regex: /^(?:export\s+)?interface\s+(\w+)/, kind: SymbolKind.Interface },
                    { regex: /^(?:export\s+)?enum\s+(\w+)/, kind: SymbolKind.Enum },
                    { regex: /^(?:export\s+)?const\s+(\w+)\s*[:=]/, kind: SymbolKind.Constant },
                    { regex: /^(?:export\s+)?let\s+(\w+)\s*[:=]/, kind: SymbolKind.Variable },
                    { regex: /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*[{:]/, kind: SymbolKind.Method },
                );
                break;
            case 'python':
                patterns.push(
                    { regex: /^class\s+(\w+)\s*[\(:]/, kind: SymbolKind.Class },
                    { regex: /^def\s+(\w+)\s*\(/, kind: SymbolKind.Function },
                    { regex: /^\s+def\s+(\w+)\s*\(/, kind: SymbolKind.Method },
                );
                break;
            case 'java':
            case 'kotlin':
                patterns.push(
                    { regex: /^(?:public\s+|private\s+|protected\s+)?class\s+(\w+)/, kind: SymbolKind.Class },
                    { regex: /^(?:public\s+|private\s+|protected\s+)?interface\s+(\w+)/, kind: SymbolKind.Interface },
                    { regex: /^(?:public\s+|private\s+|protected\s+)?enum\s+(\w+)/, kind: SymbolKind.Enum },
                    { regex: /^(?:public\s+|private\s+|protected\s+)?(?:static\s+)?[\w<>\[\]]+\s+(\w+)\s*\(/, kind: SymbolKind.Method },
                );
                break;
            case 'go':
                patterns.push(
                    { regex: /^func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(/, kind: SymbolKind.Function },
                    { regex: /^type\s+(\w+)\s+struct/, kind: SymbolKind.Struct },
                    { regex: /^type\s+(\w+)\s+interface/, kind: SymbolKind.Interface },
                );
                break;
            case 'rust':
                patterns.push(
                    { regex: /^fn\s+(\w+)\s*\(/, kind: SymbolKind.Function },
                    { regex: /^struct\s+(\w+)/, kind: SymbolKind.Struct },
                    { regex: /^enum\s+(\w+)/, kind: SymbolKind.Enum },
                    { regex: /^trait\s+(\w+)/, kind: SymbolKind.Interface },
                    { regex: /^impl\s+(?:\w+\s+for\s+)?(\w+)/, kind: SymbolKind.Class },
                );
                break;
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            for (const { regex, kind } of patterns) {
                const match = line.match(regex);
                if (match) {
                    symbols.push({
                        name: match[1],
                        kind,
                        range: { start: i, end: i },
                    });
                }
            }
        }

        return symbols;
    }

    private tokenize(text: string): string[] {
        // Токенизация: слова, camelCase разделение
        const tokens: string[] = [];
        
        // Разделение camelCase и PascalCase
        const normalized = text
            .replace(/([a-z])([A-Z])/g, '$1 $2')
            .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2');

        // Извлечение слов
        const words = normalized.toLowerCase().match(/[a-z][a-z0-9]*/g) || [];
        
        for (const word of words) {
            if (word.length > 2 && !this.stopWords.has(word)) {
                tokens.push(word);
            }
        }

        return tokens;
    }

    private computeTFIDF(tokens: string[]): DocumentVector {
        const termFreq = new Map<string, number>();
        
        for (const token of tokens) {
            termFreq.set(token, (termFreq.get(token) || 0) + 1);
        }

        // TF (Term Frequency)
        const terms = new Map<string, number>();
        for (const [term, freq] of termFreq) {
            terms.set(term, freq / tokens.length);
        }

        // Вычисление magnitude для нормализации
        let magnitude = 0;
        for (const value of terms.values()) {
            magnitude += value * value;
        }

        return { terms, magnitude: Math.sqrt(magnitude) };
    }

    private cosineSimilarity(a: DocumentVector, b: DocumentVector): number {
        let dotProduct = 0;
        
        for (const [term, valueA] of a.terms) {
            const valueB = b.terms.get(term);
            if (valueB !== undefined) {
                dotProduct += valueA * valueB;
            }
        }

        if (a.magnitude === 0 || b.magnitude === 0) {
            return 0;
        }

        return dotProduct / (a.magnitude * b.magnitude);
    }

    private extractDependencies(fileIndex: FileIndex): string[] {
        const deps: string[] = [];
        const content = fileIndex.content;

        // Упрощённое извлечение импортов
        const patterns: RegExp[] = [];

        switch (fileIndex.language) {
            case 'typescript':
            case 'javascript':
            case 'typescriptreact':
            case 'javascriptreact':
                patterns.push(
                    /import\s+.*\s+from\s+['"]([^'"]+)['"]/g,
                    /import\s+['"]([^'"]+)['"]/g,
                    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
                );
                break;
            case 'python':
                patterns.push(
                    /import\s+(\w+)/g,
                    /from\s+(\w+(?:\.\w+)*)\s+import/g,
                );
                break;
            case 'java':
            case 'kotlin':
                patterns.push(/import\s+([\w.]+);/g);
                break;
            case 'go':
                patterns.push(/import\s+["']([^"']+)["']/g);
                break;
            case 'rust':
                patterns.push(/use\s+([\w:]+);/g);
                break;
        }

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                deps.push(match[1]);
            }
        }

        return deps;
    }

    private directoryDistance(dir1: string, dir2: string): number {
        const parts1 = dir1.split(path.sep).filter(p => p);
        const parts2 = dir2.split(path.sep).filter(p => p);
        
        let common = 0;
        for (let i = 0; i < Math.min(parts1.length, parts2.length); i++) {
            if (parts1[i] === parts2[i]) {
                common++;
            } else {
                break;
            }
        }

        return parts1.length + parts2.length - 2 * common;
    }

    private findSymbols(
        symbols: CodeSymbol[],
        name: string,
        kind: SymbolKind | undefined,
        fileIndex: FileIndex
    ): CodeSymbolResult[] {
        const results: CodeSymbolResult[] = [];

        for (const symbol of symbols) {
            const matchesName = symbol.name.toLowerCase().includes(name);
            const matchesKind = kind === undefined || symbol.kind === kind;

            if (matchesName && matchesKind) {
                results.push({
                    name: symbol.name,
                    kind: symbol.kind,
                    uri: fileIndex.uri,
                    relativePath: fileIndex.relativePath,
                    range: symbol.range,
                });
            }

            if (symbol.children) {
                results.push(...this.findSymbols(symbol.children, name, kind, fileIndex));
            }
        }

        return results;
    }

    private truncateContent(content: string, maxLength: number = 10000): string {
        if (content.length <= maxLength) {
            return content;
        }
        return content.substring(0, maxLength) + '\n... [truncated]';
    }

    private async saveIndex(): Promise<void> {
        try {
            const indexPath = vscode.Uri.joinPath(this.storageUri, 'codebase-index.json');
            const data = {
                version: '1.0',
                timestamp: Date.now(),
                files: Array.from(this.index.entries()),
            };
            
            await fs.mkdir(this.storageUri.fsPath, { recursive: true });
            await fs.writeFile(indexPath.fsPath, JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('[Kimi] Failed to save index:', error);
        }
    }

    private async loadIndex(): Promise<void> {
        try {
            const indexPath = vscode.Uri.joinPath(this.storageUri, 'codebase-index.json');
            const content = await fs.readFile(indexPath.fsPath, 'utf-8');
            const data = JSON.parse(content);
            
            if (data.files) {
                this.index = new Map(data.files);
                console.log(`[Kimi] Loaded index with ${this.index.size} files`);
            }
        } catch {
            // Индекс не существует или повреждён
            this.index = new Map();
        }
    }

    private getLanguageDistribution(): Record<string, number> {
        const dist: Record<string, number> = {};
        for (const file of this.index.values()) {
            dist[file.language] = (dist[file.language] || 0) + 1;
        }
        return dist;
    }

    private buildStopWords(): Set<string> {
        return new Set([
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i',
            'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
            'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her',
            'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there',
            'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get',
            'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no',
            'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your',
            'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then',
            'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also',
            'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first',
            'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these',
            'give', 'day', 'most', 'us', 'is', 'are', 'was', 'were', 'been',
            'has', 'had', 'did', 'does', 'doing', 'done', 'get', 'got',
            'getting', 'true', 'false', 'null', 'undefined', 'const', 'let',
            'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class',
            'import', 'export', 'from', 'default', 'async', 'await', 'try',
            'catch', 'throw', 'new', 'this', 'super', 'extends', 'implements',
        ]);
    }
}

// ==================== Types ====================

export interface SearchResult {
    uri: string;
    relativePath: string;
    similarity: number;
    size: number;
    language: string;
}

export interface CodeSymbolResult {
    name: string;
    kind: SymbolKind;
    uri: string;
    relativePath: string;
    range: { start: number; end: number };
}

export interface FileContext {
    uri: string;
    relativePath: string;
    content: string;
    symbols?: CodeSymbol[];
    summary?: string;
}

export interface IndexStats {
    totalFiles: number;
    totalSize: number;
    languages: Record<string, number>;
    isIndexing: boolean;
}
