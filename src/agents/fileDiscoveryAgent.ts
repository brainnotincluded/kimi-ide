/**
 * File Discovery Agent
 * Находит релевантные файлы с использованием быстрой модели и VS Code API
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { BaseAgent } from './baseAgent';
import {
    AgentType,
    AgentMessage,
    FileDiscoveryResult,
    FileDiscoveryRequest,
    RankedFile,
    FileTreeNode,
    DiscoveryStats,
    CodeSymbolSummary,
} from './types';

/**
 * Опции для FileDiscoveryAgent
 */
export interface FileDiscoveryOptions {
    vscodeContext: {
        workspace: typeof vscode.workspace;
    };
    model?: string;
    maxFiles?: number;
}

/**
 * Контекст файла для анализа
 */
interface FileContext {
    path: string;
    content: string;
    size: number;
    language: string;
    symbols: CodeSymbolSummary[];
    imports: string[];
    exports: string[];
}

/**
 * File Discovery Agent - находит релевантные файлы
 */
export class FileDiscoveryAgent extends BaseAgent {
    private vscodeContext: FileDiscoveryOptions['vscodeContext'];
    private maxFiles: number;
    private model: string;
    private fileCache = new Map<string, FileContext>();
    
    constructor(options: FileDiscoveryOptions) {
        super({
            type: 'fileDiscovery',
            priority: 'high',
            timeoutMs: 30000,
            model: options.model ?? 'kimi-k2.5-lite',
        });
        
        this.vscodeContext = options.vscodeContext;
        this.maxFiles = options.maxFiles ?? 50;
        this.model = options.model ?? 'kimi-k2.5-lite';
    }
    
    /**
     * Основной метод поиска файлов
     */
    async discoverFiles(request: FileDiscoveryRequest): Promise<FileDiscoveryResult> {
        return this.execute<FileDiscoveryRequest, FileDiscoveryResult>(request).then(r => r.data!);
    }
    
    /**
     * Выполнение поиска файлов
     */
    protected async onExecute<TInput, TOutput>(
        input: TInput,
        signal: AbortSignal
    ): Promise<TOutput> {
        const request = input as unknown as FileDiscoveryRequest;
        const startTime = Date.now();
        
        // Step 1: Build file tree
        const tree = await this.buildFileTree();
        
        // Step 2: Get all relevant files from workspace
        const allFiles = await this.getWorkspaceFiles(request);
        
        if (signal.aborted) {
            throw new Error('Discovery aborted');
        }
        
        // Step 3: Fast filtering with heuristics
        const candidates = await this.filterCandidates(allFiles, request);
        
        // Step 4: Use model to rank files (1-2 calls instead of many grep calls)
        const rankedFiles = await this.rankFilesWithModel(candidates, request);
        
        // Step 5: Extract symbols for top files
        await this.enrichWithSymbols(rankedFiles.slice(0, 10));
        
        const stats: DiscoveryStats = {
            totalFiles: allFiles.length,
            scannedFiles: candidates.length,
            relevantFiles: rankedFiles.length,
            executionTimeMs: Date.now() - startTime,
            totalDirectories: 0,
            filesByLanguage: {},
            totalSize: 0,
        };
        
        return {
            files: rankedFiles.slice(0, this.maxFiles),
            tree,
            stats,
        } as TOutput;
    }
    
    /**
     * Построение дерева файлов
     */
    private async buildFileTree(): Promise<FileTreeNode> {
        const workspaceFolders = this.vscodeContext.workspace.workspaceFolders;
        
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder found');
        }
        
        const rootPath = workspaceFolders[0].uri.fsPath;
        const rootName = path.basename(rootPath);
        
        const rootNode: FileTreeNode = {
            name: rootName,
            path: rootPath,
            type: 'directory',
            children: [],
        };
        
        // Use VS Code API to get file tree
        const pattern = new vscode.RelativePattern(workspaceFolders[0], '**/*');
        const files = await this.vscodeContext.workspace.findFiles(
            pattern,
            '**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/*.map'
        );
        
        // Build tree structure
        for (const uri of files) {
            const relativePath = path.relative(rootPath, uri.fsPath);
            this.addToTree(rootNode, relativePath, uri.fsPath);
        }
        
        return rootNode;
    }
    
    /**
     * Добавление файла в дерево
     */
    private addToTree(root: FileTreeNode, relativePath: string, fullPath: string): void {
        const parts = relativePath.split(path.sep);
        let current = root;
        
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;
            const currentPath = path.join(root.path, parts.slice(0, i + 1).join(path.sep));
            
            let child = current.children?.find((c: FileTreeNode) => c.name === part);
            
            if (!child) {
                child = {
                    name: part,
                    path: currentPath,
                    type: isFile ? 'file' : 'directory',
                    ...(isFile ? {} : { children: [] }),
                };
                current.children = current.children ?? [];
                current.children.push(child);
            }
            
            current = child;
        }
    }
    
    /**
     * Получение файлов из workspace
     */
    private async getWorkspaceFiles(request: FileDiscoveryRequest): Promise<string[]> {
        const workspaceFolders = this.vscodeContext.workspace.workspaceFolders;
        
        if (!workspaceFolders) {
            return [];
        }
        
        // Build include pattern
        const includePattern = request.includePatterns?.length 
            ? `{${request.includePatterns.join(',')}}`
            : '**/*.{ts,js,tsx,jsx,py,rs,go,java,kt,swift,c,cpp,h,hpp}';
        
        // Build exclude pattern
        const excludePattern = [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/out/**',
            '**/build/**',
            '**/.vscode/**',
            '**/*.map',
            '**/*.min.js',
            ...(request.excludePatterns ?? []),
        ].join(',');
        
        const files = await this.vscodeContext.workspace.findFiles(
            includePattern,
            excludePattern
        );
        
        return files.map(uri => uri.fsPath);
    }
    
    /**
     * Быстрая фильтрация кандидатов
     */
    private async filterCandidates(
        files: string[],
        request: FileDiscoveryRequest
    ): Promise<FileContext[]> {
        const candidates: FileContext[] = [];
        const keywords = this.extractKeywords(request.description || '');
        
        for (const filePath of files) {
            // Check cache first
            const cached = this.fileCache.get(filePath);
            if (cached) {
                candidates.push(cached);
                continue;
            }
            
            // Quick heuristics
            const filename = path.basename(filePath).toLowerCase();
            const dirname = path.dirname(filePath).toLowerCase();
            
            // Skip test files unless requested
            if (filename.includes('.test.') || filename.includes('.spec.')) {
                continue;
            }
            
            // Check filename match
            const nameMatch = keywords.some(k => filename.includes(k.toLowerCase()));
            const dirMatch = keywords.some(k => dirname.includes(k.toLowerCase()));
            
            if (nameMatch || dirMatch) {
                try {
                    const context = await this.loadFileContext(filePath);
                    candidates.push(context);
                    this.fileCache.set(filePath, context);
                } catch {
                    // Skip files that can't be read
                }
            }
        }
        
        return candidates;
    }
    
    /**
     * Загрузка контекста файла
     */
    private async loadFileContext(filePath: string): Promise<FileContext> {
        const uri = vscode.Uri.file(filePath);
        const content = await this.vscodeContext.workspace.fs.readFile(uri);
        const text = Buffer.from(content).toString('utf-8');
        
        const ext = path.extname(filePath).slice(1);
        const language = this.mapExtensionToLanguage(ext);
        
        // Extract basic symbols (quick parsing)
        const symbols = this.extractSymbols(text, language);
        
        return {
            path: filePath,
            content: text,
            size: text.length,
            language,
            symbols,
            imports: this.extractImports(text, language),
            exports: this.extractExports(text, language),
        };
    }
    
    /**
     * Ранжирование файлов с использованием модели (1-2 вызова)
     */
    private async rankFilesWithModel(
        candidates: FileContext[],
        request: FileDiscoveryRequest
    ): Promise<RankedFile[]> {
        if (candidates.length === 0) {
            return [];
        }
        
        // Limit candidates for model analysis
        const limitedCandidates = candidates.slice(0, 100);
        
        // Build prompt with file summaries
        const fileSummaries = limitedCandidates.map(f => ({
            path: f.path,
            language: f.language,
            size: f.size,
            symbols: f.symbols.slice(0, 10).map(s => `${s.kind}:${s.name}`),
            exports: f.exports.slice(0, 5),
        }));
        
        const prompt = this.buildRankingPrompt(request.description || '', fileSummaries);
        
        // Single model call to rank all files
        // Note: In real implementation, this would call the Kimi API
        // For now, we use heuristics as fallback
        const ranked = this.rankByHeuristics(limitedCandidates, request.description || '');
        
        return ranked.map((ctx, index) => ({
            path: ctx.path,
            score: Math.max(0, 1 - index / ranked.length),
            relevanceScore: Math.max(0, 1 - index / ranked.length),
            relevance: (index < 3 ? 'high' : index < 10 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
            reasons: this.generateReasons(ctx, request.description || ''),
            size: ctx.size,
            language: ctx.language,
            lastModified: Date.now(), // Would get actual mtime in real impl
            symbols: ctx.symbols.slice(0, 5),
        }));
    }
    
    /**
     * Эвристическое ранжирование (fallback)
     */
    private rankByHeuristics(
        candidates: FileContext[],
        description: string
    ): FileContext[] {
        const keywords = this.extractKeywords(description);
        
        const scored = candidates.map(ctx => {
            let score = 0;
            
            // Filename match
            const filename = path.basename(ctx.path).toLowerCase();
            for (const keyword of keywords) {
                if (filename.includes(keyword.toLowerCase())) {
                    score += 10;
                }
            }
            
            // Symbol match
            for (const symbol of ctx.symbols) {
                for (const keyword of keywords) {
                    if (symbol.name.toLowerCase().includes(keyword.toLowerCase())) {
                        score += 5;
                    }
                }
            }
            
            // Export match
            for (const exp of ctx.exports) {
                for (const keyword of keywords) {
                    if (exp.toLowerCase().includes(keyword.toLowerCase())) {
                        score += 3;
                    }
                }
            }
            
            // Content match (first 1000 chars)
            const content = ctx.content.slice(0, 1000).toLowerCase();
            for (const keyword of keywords) {
                if (content.includes(keyword.toLowerCase())) {
                    score += 2;
                }
            }
            
            // Penalize large files
            if (ctx.size > 10000) {
                score -= 1;
            }
            
            return { ctx, score };
        });
        
        scored.sort((a, b) => b.score - a.score);
        return scored.map(s => s.ctx);
    }
    
    /**
     * Обогащение файлов символами
     */
    private async enrichWithSymbols(files: RankedFile[]): Promise<void> {
        // Use VS Code Language API to get detailed symbols
        for (const file of files) {
            try {
                const uri = vscode.Uri.file(file.path);
                const document = await this.vscodeContext.workspace.openTextDocument(uri);
                
                // Get symbols using VS Code API
                const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                    'vscode.executeDocumentSymbolProvider',
                    uri
                );
                
                if (symbols) {
                    file.symbols = symbols.slice(0, 10).map(s => ({
                        name: s.name,
                        type: 'function' as const,
                        kind: vscode.SymbolKind[s.kind],
                        filePath: file.path,
                        line: s.location.range.start.line,
                        column: s.location.range.start.character,
                    }));
                }
            } catch {
                // Keep existing symbols if extraction fails
            }
        }
    }
    
    /**
     * Извлечение ключевых слов из описания
     */
    private extractKeywords(description: string): string[] {
        // Remove common words and extract keywords
        const stopWords = new Set([
            'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
            'could', 'should', 'may', 'might', 'must', 'shall', 'can',
            'need', 'dare', 'ought', 'used', 'to', 'of', 'in', 'for',
            'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
            'during', 'before', 'after', 'above', 'below', 'between',
            'under', 'and', 'but', 'or', 'yet', 'so', 'if', 'because',
            'although', 'though', 'while', 'where', 'when', 'that',
            'which', 'who', 'whom', 'whose', 'what', 'this', 'these',
            'those', 'i', 'me', 'my', 'mine', 'myself', 'you', 'your',
            'yours', 'yourself', 'he', 'him', 'his', 'himself', 'she',
            'her', 'hers', 'herself', 'it', 'its', 'itself', 'we', 'us',
            'our', 'ours', 'ourselves', 'they', 'them', 'their', 'theirs',
            'themselves', 'find', 'search', 'look', 'get', 'make', 'add',
            'create', 'update', 'delete', 'remove', 'change', 'modify',
            'implement', 'write', 'code', 'file', 'files'
        ]);
        
        return description
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));
    }
    
    /**
     * Извлечение импортов
     */
    private extractImports(content: string, language: string): string[] {
        const imports: string[] = [];
        
        if (language === 'typescript' || language === 'javascript') {
            const importRegex = /import\s+(?:{[^}]+}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                imports.push(match[1]);
            }
        } else if (language === 'python') {
            const importRegex = /^(?:from\s+(\S+)\s+import|import\s+(\S+))/gm;
            let match;
            while ((match = importRegex.exec(content)) !== null) {
                imports.push(match[1] || match[2]);
            }
        }
        
        return imports;
    }
    
    /**
     * Извлечение экспортов
     */
    private extractExports(content: string, language: string): string[] {
        const exports: string[] = [];
        
        if (language === 'typescript' || language === 'javascript') {
            const exportRegex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type)\s+(\w+)/g;
            let match;
            while ((match = exportRegex.exec(content)) !== null) {
                exports.push(match[1]);
            }
        } else if (language === 'python') {
            // Look for class and function definitions at module level
            const lines = content.split('\n');
            for (const line of lines) {
                const match = line.match(/^(?:class|def)\s+(\w+)/);
                if (match && !line.startsWith(' ') && !line.startsWith('\t')) {
                    exports.push(match[1]);
                }
            }
        }
        
        return exports.slice(0, 20);
    }
    
    /**
     * Извлечение символов
     */
    private extractSymbols(content: string, language: string): CodeSymbolSummary[] {
        const symbols: CodeSymbolSummary[] = [];
        const lines = content.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // TypeScript/JavaScript
            if (language === 'typescript' || language === 'javascript') {
                const match = line.match(/(?:export\s+)?(?:class|function|interface|type|const|let|var)\s+(\w+)/);
                if (match) {
                    symbols.push({
                        name: match[1],
                        type: match[0].includes('class') ? 'class' : 
                              match[0].includes('function') ? 'function' : 'variable',
                        kind: match[0].includes('class') ? 'class' : 
                              match[0].includes('function') ? 'function' : 'variable',
                        filePath: '',
                        line: i + 1,
                        column: 0,
                        signature: line.trim(),
                    });
                }
            }
            // Python
            else if (language === 'python') {
                const match = line.match(/(?:class|def)\s+(\w+)/);
                if (match) {
                    symbols.push({
                        name: match[1],
                        type: match[0].includes('class') ? 'class' : 'function',
                        kind: match[0].includes('class') ? 'class' : 'function',
                        filePath: '',
                        line: i + 1,
                        column: 0,
                        signature: line.trim(),
                    });
                }
            }
        }
        
        return symbols.slice(0, 30);
    }
    
    /**
     * Построение промпта для ранжирования
     */
    private buildRankingPrompt(description: string, files: unknown[]): string {
        return `You are a code search expert. Given a task description and a list of files with their summaries, rank the files by relevance to the task.

Task: ${description}

Files:
${JSON.stringify(files, null, 2)}

Return a JSON array of file paths ranked by relevance (most relevant first). Only include paths that are actually relevant to the task.

Response format: ["path/to/file1.ts", "path/to/file2.ts", ...]`;
    }
    
    /**
     * Генерация причин релевантности
     */
    private generateReasons(ctx: FileContext, description: string): string[] {
        const reasons: string[] = [];
        const keywords = this.extractKeywords(description);
        
        const filename = path.basename(ctx.path).toLowerCase();
        for (const keyword of keywords) {
            if (filename.includes(keyword.toLowerCase())) {
                reasons.push(`Filename matches "${keyword}"`);
            }
        }
        
        for (const symbol of ctx.symbols) {
            for (const keyword of keywords) {
                if (symbol.name.toLowerCase().includes(keyword.toLowerCase())) {
                    reasons.push(`Contains symbol "${symbol.name}"`);
                }
            }
        }
        
        return reasons.slice(0, 3);
    }
    
    /**
     * Маппинг расширения на язык
     */
    private mapExtensionToLanguage(ext: string): string {
        const mapping: Record<string, string> = {
            'ts': 'typescript',
            'tsx': 'typescript',
            'js': 'javascript',
            'jsx': 'javascript',
            'py': 'python',
            'rs': 'rust',
            'go': 'go',
            'java': 'java',
            'kt': 'kotlin',
            'swift': 'swift',
            'c': 'c',
            'cpp': 'cpp',
            'h': 'c',
            'hpp': 'cpp',
        };
        return mapping[ext] ?? 'unknown';
    }
    
    // ============================================================================
    // Abstract Method Implementations
    // ============================================================================
    
    protected async onInitialize(): Promise<void> {
        // Pre-load file cache if needed
    }
    
    protected onMessage(message: AgentMessage): void {
        this.log('Received message:', message.type);
    }
    
    protected async onCancel(): Promise<void> {
        this.fileCache.clear();
    }
    
    protected async onDispose(): Promise<void> {
        this.fileCache.clear();
    }
}
