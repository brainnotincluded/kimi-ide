/**
 * Prompt Builder - сборка промптов с контекстом для Kimi API
 * Учитывает ограничения контекста (128K+ токенов)
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { ResolvedContext, ResolvedMention, AutoContext, Mention } from './contextResolver';
import { SymbolProvider, FileOutline } from './symbolProvider';
import { FileContext, CodeSymbol, SymbolKind } from './codebaseIndexer';

interface PromptConfig {
    maxContextTokens: number;
    maxFilesInContext: number;
    maxSymbolsPerFile: number;
    includeLineNumbers: boolean;
    includeFileTree: boolean;
    prioritizeAGENTSmd: boolean;
    format: 'markdown' | 'xml' | 'json';
}

interface PromptContext {
    systemPrompt?: string;
    agentsMdContent?: string;
    mentionedFiles: FileContext[];
    autoContext: AutoContext;
    userMessage: string;
}



interface BuiltPrompt {
    system: string;
    messages: Array<{
        role: 'user' | 'assistant' | 'system';
        content: string;
    }>;
    contextInfo: {
        filesIncluded: number;
        symbolsIncluded: number;
        estimatedTokens: number;
        truncated: boolean;
    };
}

const DEFAULT_CONFIG: PromptConfig = {
    maxContextTokens: 120000, // 128K с запасом
    maxFilesInContext: 20,
    maxSymbolsPerFile: 50,
    includeLineNumbers: true,
    includeFileTree: true,
    prioritizeAGENTSmd: true,
    format: 'markdown',
};

// Примерные токены на разные части промпта
const TOKEN_BUDGET = {
    systemPrompt: 500,
    agentsMd: 4000,
    fileTree: 1000,
    perFile: 3000,
    currentFile: 8000,
    message: 500,
};

export class PromptBuilder {
    private config: PromptConfig;
    private symbolProvider: SymbolProvider;

    constructor(symbolProvider: SymbolProvider, config?: Partial<PromptConfig>) {
        this.symbolProvider = symbolProvider;
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Сборка полного промпта с контекстом
     */
    async buildPrompt(
        userMessage: string,
        resolvedContext: ResolvedContext,
        options?: {
            conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
            systemPrompt?: string;
        }
    ): Promise<BuiltPrompt> {
        const context: PromptContext = {
            systemPrompt: options?.systemPrompt,
            mentionedFiles: [],
            autoContext: resolvedContext.autoContext,
            userMessage,
        };

        // Разрешение упомянутых файлов
        for (const mention of resolvedContext.mentions) {
            const fileContext = await this.resolveMentionToFileContext(mention);
            if (fileContext) {
                context.mentionedFiles.push(fileContext);
            }
        }

        // Загрузка AGENTS.md
        context.agentsMdContent = await this.loadAgentsMd();

        // Планирование бюджета токенов
        const tokenBudget = this.planTokenBudget(context);

        // Сборка контекстной части
        const contextContent = await this.buildContextContent(context, tokenBudget);

        // Подсчёт статистики
        const stats = this.calculateStats(context, contextContent);

        // Финальная сборка
        return this.assemblePrompt(context, contextContent, options?.conversationHistory, stats);
    }

    /**
     * Сборка системного промпта с инструкциями
     */
    buildSystemPrompt(basePrompt?: string): string {
        const parts: string[] = [];

        if (basePrompt) {
            parts.push(basePrompt);
        }

        parts.push(`
You are Kimi, an AI assistant integrated into VS Code. You have access to the user's codebase through context.

## Guidelines:
1. When referencing code, always include file paths and line numbers when relevant
2. If you need more context, ask the user to use @file, @folder, or @symbol mentions
3. Provide complete, working code examples
4. Explain your reasoning when making changes
5. If you're unsure about something, say so

## Context Format:
Files are provided in the following format:
\`\`\`language:filepath
// file content
\`\`\`

## Available Commands:
- @file:path - Reference a specific file
- @folder:path - Reference all files in a folder
- @symbol:name - Reference a specific symbol (function, class, etc.)
`.trim());

        return parts.join('\n\n');
    }

    /**
     * Форматирование файла для контекста
     */
    formatFileContext(file: FileContext, options?: {
        maxLines?: number;
        includeOutline?: boolean;
        highlightRange?: { start: number; end: number };
    }): string {
        const opts = {
            maxLines: Infinity,
            includeOutline: true,
            ...options,
        };

        const lines = file.content.split('\n');
        let content = '';

        // Заголовок с путём
        const lang = this.detectLanguage(file.relativePath);
        content += `\`\`\`${lang}:${file.relativePath}\n`;

        // Опционально: outline символов
        if (opts.includeOutline && file.symbols && file.symbols.length > 0) {
            content += '// Outline:\n';
            content += this.formatOutline(file.symbols, 0);
            content += '\n';
        }

        // Содержимое файла
        let fileContent = file.content;
        if (opts.maxLines !== Infinity && lines.length > opts.maxLines) {
            const start = opts.highlightRange ? Math.max(0, opts.highlightRange.start - 10) : 0;
            const end = opts.highlightRange 
                ? Math.min(lines.length, opts.highlightRange.end + 10)
                : opts.maxLines;
            
            const selectedLines = lines.slice(start, end);
            
            if (start > 0) {
                selectedLines.unshift(`// ... ${start} lines omitted ...`);
            }
            if (end < lines.length) {
                selectedLines.push(`// ... ${lines.length - end} lines omitted ...`);
            }
            
            fileContent = selectedLines.join('\n');
        }

        // Добавление номеров строк
        if (this.config.includeLineNumbers) {
            fileContent = this.addLineNumbers(fileContent);
        }

        content += fileContent;
        content += '\n\`\`\`\n';

        return content;
    }

    /**
     * Форматирование дерева файлов
     */
    formatFileTree(files: string[]): string {
        const tree = this.buildFileTree(files);
        return this.renderFileTree(tree);
    }

    /**
     * Оценка количества токенов в тексте
     */
    estimateTokens(text: string): number {
        // Более точная оценка для кода
        // Среднее: ~4 символа на токен для английского/кода
        // Для кода с много спецсимволами: ~3.5 символа на токен
        return Math.ceil(text.length / 3.5);
    }

    // ==================== Private Methods ====================

    private async resolveMentionToFileContext(mention: ResolvedMention): Promise<FileContext | null> {
        switch (mention.type) {
            case 'file':
                if (mention.content) {
                    return {
                        uri: mention.value,
                        relativePath: mention.value,
                        content: mention.content,
                    };
                }
                break;

            case 'folder':
                if (mention.files) {
                    // Агрегируем все файлы папки
                    const contents: string[] = [];
                    for (const filePath of mention.files.slice(0, 10)) {
                        try {
                            const uri = vscode.Uri.file(filePath);
                            const outline = await this.symbolProvider.getFileOutline(uri);
                            if (outline) {
                                contents.push(`// ${filePath}\n${outline.symbols.map(s => s.name).join(', ')}`);
                            }
                        } catch {
                            // Игнорируем
                        }
                    }
                    return {
                        uri: mention.value,
                        relativePath: mention.value,
                        content: contents.join('\n\n'),
                    };
                }
                break;

            case 'symbol':
                if (mention.symbols && mention.symbols.length > 0) {
                    const symbol = mention.symbols[0];
                    try {
                        const uri = vscode.Uri.parse(symbol.uri);
                        const context = await this.symbolProvider.getSymbolContext(uri, symbol.name);
                        if (context) {
                            return {
                                uri: symbol.uri,
                                relativePath: symbol.relativePath,
                                content: context.content,
                                symbols: [this.convertSymbolNodeToCodeSymbol(context.symbol)],
                            };
                        }
                    } catch {
                        // Игнорируем
                    }
                }
                break;
        }

        return null;
    }

    private async loadAgentsMd(): Promise<string | undefined> {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
            if (!workspaceRoot) {
                return undefined;
            }

            // Ищем AGENTS.md в корне и поддиректориях
            const patterns = ['AGENTS.md', '**/AGENTS.md'];
            
            for (const pattern of patterns) {
                const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 1);
                if (files.length > 0) {
                    const content = await vscode.workspace.fs.readFile(files[0]);
                    return content.toString();
                }
            }
        } catch {
            // AGENTS.md не обязателен
        }
        return undefined;
    }

    private planTokenBudget(context: PromptContext): TokenBudget {
        let available = this.config.maxContextTokens;

        // Резервируем системный промпт
        available -= TOKEN_BUDGET.systemPrompt;

        // Резервируем место для AGENTS.md
        let agentsMdTokens = 0;
        if (this.config.prioritizeAGENTSmd && context.agentsMdContent) {
            agentsMdTokens = Math.min(
                this.estimateTokens(context.agentsMdContent),
                TOKEN_BUDGET.agentsMd
            );
            available -= agentsMdTokens;
        }

        // Резервируем место для дерева файлов
        if (this.config.includeFileTree) {
            available -= TOKEN_BUDGET.fileTree;
        }

        // Резервируем место для сообщения пользователя
        available -= TOKEN_BUDGET.message;

        // Распределяем оставшиеся токены
        const files: Map<string, number> = new Map();

        // Текущий файл получает больше токенов
        if (context.autoContext.currentFile) {
            files.set(context.autoContext.currentFile.uri, TOKEN_BUDGET.currentFile);
            available -= TOKEN_BUDGET.currentFile;
        }

        // Упомянутые файлы
        for (const file of context.mentionedFiles) {
            const tokens = Math.min(
                this.estimateTokens(file.content),
                TOKEN_BUDGET.perFile
            );
            files.set(file.uri, tokens);
            available -= tokens;
        }

        // Связанные файлы
        let relatedCount = 0;
        for (const file of context.autoContext.relatedFiles) {
            if (available <= 0 || relatedCount >= this.config.maxFilesInContext) {
                break;
            }
            if (!files.has(file.uri)) {
                const tokens = Math.min(TOKEN_BUDGET.perFile, Math.floor(available / 2));
                files.set(file.uri, tokens);
                available -= tokens;
                relatedCount++;
            }
        }

        return {
            agentsMd: agentsMdTokens,
            files,
            available,
        };
    }

    private async buildContextContent(
        context: PromptContext,
        budget: TokenBudget
    ): Promise<string> {
        const parts: string[] = [];

        // AGENTS.md
        if (context.agentsMdContent && budget.agentsMd > 0) {
            parts.push('## Project Context (AGENTS.md)\n');
            parts.push(this.truncateContent(context.agentsMdContent, budget.agentsMd));
            parts.push('\n---\n');
        }

        // Текущий файл
        if (context.autoContext.currentFile) {
            const currentFileBudget = budget.files.get(context.autoContext.currentFile.uri);
            if (currentFileBudget && currentFileBudget > 0) {
                parts.push('## Current File\n');
                parts.push(this.formatFileContext(context.autoContext.currentFile, {
                    maxLines: Math.floor(currentFileBudget / 50), // Примерно 50 символов на строку
                }));
            }
        }

        // Упомянутые файлы
        if (context.mentionedFiles.length > 0) {
            parts.push('## Referenced Files\n');
            for (const file of context.mentionedFiles) {
                const fileBudget = budget.files.get(file.uri);
                if (fileBudget && fileBudget > 0) {
                    parts.push(this.formatFileContext(file, {
                        maxLines: Math.floor(fileBudget / 50),
                    }));
                }
            }
        }

        // Связанные файлы
        if (context.autoContext.relatedFiles.length > 0) {
            parts.push('## Related Files\n');
            for (const file of context.autoContext.relatedFiles) {
                const fileBudget = budget.files.get(file.uri);
                if (fileBudget && fileBudget > 0) {
                    parts.push(this.formatFileContext(file, {
                        maxLines: Math.floor(fileBudget / 50),
                    }));
                }
            }
        }

        // Открытые файлы (кратко)
        if (context.autoContext.openFiles.length > 0) {
            parts.push('## Other Open Files\n');
            const fileNames = context.autoContext.openFiles
                .filter(f => f.uri !== context.autoContext.currentFile?.uri)
                .map(f => `- ${f.relativePath}`)
                .join('\n');
            parts.push(fileNames);
        }

        // Дерево файлов проекта
        if (this.config.includeFileTree) {
            const allFiles = [
                ...context.mentionedFiles.map(f => f.relativePath),
                ...context.autoContext.relatedFiles.map(f => f.relativePath),
                ...(context.autoContext.currentFile ? [context.autoContext.currentFile.relativePath] : []),
            ];
            if (allFiles.length > 0) {
                parts.push('\n## File Structure\n');
                parts.push('```\n' + this.formatFileTree(allFiles) + '\n```\n');
            }
        }

        return parts.join('\n');
    }

    private assemblePrompt(
        context: PromptContext,
        contextContent: string,
        history?: Array<{ role: 'user' | 'assistant'; content: string }>,
        stats?: { files: number; symbols: number; tokens: number; truncated: boolean }
    ): BuiltPrompt {
        const system = this.buildSystemPrompt(context.systemPrompt);
        const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];

        // История разговора
        if (history) {
            messages.push(...history.map(h => ({
                role: h.role,
                content: h.content,
            })));
        }

        // Текущее сообщение с контекстом
        const fullMessage = `${contextContent}\n\n## User Request\n${context.userMessage}`;
        messages.push({
            role: 'user',
            content: fullMessage,
        });

        return {
            system,
            messages,
            contextInfo: {
                filesIncluded: stats?.files || 0,
                symbolsIncluded: stats?.symbols || 0,
                estimatedTokens: stats?.tokens || this.estimateTokens(fullMessage) + this.estimateTokens(system),
                truncated: stats?.truncated || false,
            },
        };
    }

    private calculateStats(context: PromptContext, contextContent: string): {
        files: number;
        symbols: number;
        tokens: number;
        truncated: boolean;
    } {
        let files = context.mentionedFiles.length;
        let symbols = 0;

        if (context.autoContext.currentFile) {
            files++;
            symbols += context.autoContext.currentFile.symbols?.length || 0;
        }

        for (const file of context.mentionedFiles) {
            symbols += file.symbols?.length || 0;
        }

        for (const file of context.autoContext.relatedFiles) {
            files++;
            symbols += file.symbols?.length || 0;
        }

        const totalTokens = this.estimateTokens(contextContent);
        const truncated = totalTokens > this.config.maxContextTokens;

        return { files, symbols, tokens: totalTokens, truncated };
    }

    private formatOutline(symbols: CodeSymbol[], depth: number): string {
        const indent = '  '.repeat(depth);
        let result = '';

        for (const symbol of symbols.slice(0, this.config.maxSymbolsPerFile)) {
            const icon = this.getSymbolIcon(symbol.kind);
            result += `${indent}${icon} ${symbol.name}\n`;
            if (symbol.children && symbol.children.length > 0) {
                result += this.formatOutline(symbol.children, depth + 1);
            }
        }

        return result;
    }

    private getSymbolIcon(kind: SymbolKind): string {
        const icons: Record<SymbolKind, string> = {
            [SymbolKind.File]: '📄',
            [SymbolKind.Module]: '📦',
            [SymbolKind.Namespace]: '📁',
            [SymbolKind.Package]: '📦',
            [SymbolKind.Class]: '🏛️',
            [SymbolKind.Method]: '🔧',
            [SymbolKind.Property]: '⚙️',
            [SymbolKind.Field]: '📝',
            [SymbolKind.Constructor]: '🏗️',
            [SymbolKind.Enum]: '📋',
            [SymbolKind.Interface]: '🔗',
            [SymbolKind.Function]: '⚡',
            [SymbolKind.Variable]: '🔹',
            [SymbolKind.Constant]: '🔒',
            [SymbolKind.String]: '📜',
            [SymbolKind.Number]: '🔢',
            [SymbolKind.Boolean]: '☑️',
            [SymbolKind.Array]: '📚',
            [SymbolKind.Object]: '📦',
            [SymbolKind.Key]: '🗝️',
            [SymbolKind.Null]: '∅',
            [SymbolKind.EnumMember]: '📌',
            [SymbolKind.Struct]: '🧱',
            [SymbolKind.Event]: '🚨',
            [SymbolKind.Operator]: '➕',
            [SymbolKind.TypeParameter]: '🅰️',
        };
        return icons[kind] || '•';
    }

    private addLineNumbers(content: string): string {
        const lines = content.split('\n');
        const maxDigits = String(lines.length).length;
        
        return lines
            .map((line, i) => {
                const num = String(i + 1).padStart(maxDigits, ' ');
                return `${num} | ${line}`;
            })
            .join('\n');
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
            '.cs': 'csharp',
            '.rb': 'ruby',
            '.php': 'php',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.md': 'markdown',
            '.json': 'json',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
        };
        return langMap[ext] || '';
    }

    private truncateContent(content: string, maxTokens: number): string {
        const maxChars = maxTokens * 4; // Приблизительно
        if (content.length <= maxChars) {
            return content;
        }
        return content.substring(0, maxChars) + '\n\n... [truncated]';
    }

    private buildFileTree(files: string[]): FileTreeNode {
        const root: FileTreeNode = { name: '', children: new Map(), isFile: false };

        for (const file of files) {
            const parts = file.split('/');
            let current = root;

            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                const isFile = i === parts.length - 1;

                if (!current.children.has(part)) {
                    current.children.set(part, {
                        name: part,
                        children: new Map(),
                        isFile,
                    });
                }

                current = current.children.get(part)!;
            }
        }

        return root;
    }

    /**
     * Build a simple chat prompt with context
     */
    async buildChatPrompt(message: string, context: any = {}): Promise<string> {
        const parts: string[] = [];
        
        // Add system context if available
        if (context.currentFile) {
            parts.push(`Current file: ${context.currentFile}`);
        }
        
        if (context.language) {
            parts.push(`Language: ${context.language}`);
        }
        
        // Add selected text if available
        if (context.selectedText) {
            parts.push(`\nSelected code:\n\`\`\`${context.language || ''}\n${context.selectedText}\n\`\`\``);
        }
        
        // Add related files
        if (context.relatedFiles && context.relatedFiles.length > 0) {
            parts.push(`\nRelated files: ${context.relatedFiles.join(', ')}`);
        }
        
        // Add user message
        parts.push(`\nUser: ${message}`);
        
        return parts.join('\n');
    }

    private convertSymbolNodeToCodeSymbol(node: any): CodeSymbol {
        return {
            name: node.name,
            kind: node.kind as SymbolKind,
            range: {
                start: typeof node.range?.start === 'number' ? node.range.start : node.selectionRange?.start?.line || 0,
                end: typeof node.range?.end === 'number' ? node.range.end : node.selectionRange?.end?.line || 0,
            },
            children: node.children?.map((c: any) => this.convertSymbolNodeToCodeSymbol(c)),
        };
    }

    private renderFileTree(node: FileTreeNode, prefix: string = ''): string {
        const lines: string[] = [];
        const entries = Array.from(node.children.entries());
        
        // Сортировка: папки первыми, затем файлы
        entries.sort((a, b) => {
            if (a[1].isFile !== b[1].isFile) {
                return a[1].isFile ? 1 : -1;
            }
            return a[0].localeCompare(b[0]);
        });

        for (let i = 0; i < entries.length; i++) {
            const [name, child] = entries[i];
            const isLast = i === entries.length - 1;
            const connector = isLast ? '└── ' : '├── ';
            const childPrefix = isLast ? '    ' : '│   ';

            lines.push(prefix + connector + name);

            if (!child.isFile) {
                lines.push(this.renderFileTree(child, prefix + childPrefix));
            }
        }

        return lines.join('\n');
    }
}

// ==================== Types ====================

interface TokenBudget {
    agentsMd: number;
    files: Map<string, number>;
    available: number;
}

interface FileTreeNode {
    name: string;
    children: Map<string, FileTreeNode>;
    isFile: boolean;
}

export { PromptConfig, PromptContext, BuiltPrompt };
export type { FileContext };
