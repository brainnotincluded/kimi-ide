/**
 * Symbol Provider - работа с символами кода через VS Code API
 * Получение outline, построение dependency graph
 */

import * as vscode from 'vscode';
import * as path from 'path';

interface SymbolNode {
    name: string;
    kind: vscode.SymbolKind;
    detail?: string;
    range: vscode.Range;
    selectionRange: vscode.Range;
    children: SymbolNode[];
    uri: string;
}

interface DependencyEdge {
    from: string;
    to: string;
    type: 'import' | 'inheritance' | 'implementation' | 'usage' | 'call';
    line?: number;
}

interface DependencyGraph {
    nodes: Map<string, SymbolNode[]>;
    edges: DependencyEdge[];
}

interface FileOutline {
    uri: string;
    relativePath: string;
    symbols: SymbolNode[];
    imports: ImportInfo[];
    exports: ExportInfo[];
}

interface ImportInfo {
    source: string;
    symbols: string[];
    isDefault?: boolean;
    line: number;
}

interface ExportInfo {
    symbol: string;
    isDefault: boolean;
    line: number;
}

interface SymbolReference {
    uri: string;
    range: vscode.Range;
    context: string;
}

interface CallHierarchyItem {
    symbol: string;
    kind: vscode.SymbolKind;
    uri: string;
    range: vscode.Range;
    callers: CallHierarchyItem[];
    callees: CallHierarchyItem[];
}

export class SymbolProvider {
    private context: vscode.ExtensionContext;
    private cache: Map<string, FileOutline> = new Map();
    private callHierarchyProvider: CallHierarchyProvider;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.callHierarchyProvider = new CallHierarchyProvider();
    }

    /**
     * Получение outline (структуры символов) файла
     */
    async getFileOutline(uri: vscode.Uri): Promise<FileOutline | null> {
        // Проверка кэша
        const cached = this.cache.get(uri.fsPath);
        if (cached) {
            return cached;
        }

        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                uri
            );

            if (!symbols) {
                return null;
            }

            const document = await vscode.workspace.openTextDocument(uri);
            const imports = this.extractImports(document);
            const exports = this.extractExports(document);

            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
            const relativePath = path.relative(workspaceRoot, uri.fsPath);

            const outline: FileOutline = {
                uri: uri.toString(),
                relativePath,
                symbols: symbols.map(s => this.convertSymbol(s, uri)),
                imports,
                exports,
            };

            this.cache.set(uri.fsPath, outline);
            return outline;

        } catch (error) {
            console.error(`[Kimi] Failed to get outline for ${uri.fsPath}:`, error);
            return null;
        }
    }

    /**
     * Получение символов в диапазоне
     */
    async getSymbolsInRange(uri: vscode.Uri, range: vscode.Range): Promise<SymbolNode[]> {
        const outline = await this.getFileOutline(uri);
        if (!outline) {
            return [];
        }

        return this.findSymbolsInRange(outline.symbols, range);
    }

    /**
     * Получение родительского символа
     */
    async getParentSymbol(uri: vscode.Uri, position: vscode.Position): Promise<SymbolNode | null> {
        const outline = await this.getFileOutline(uri);
        if (!outline) {
            return null;
        }

        return this.findParentSymbol(outline.symbols, position);
    }

    /**
     * Поиск символа по имени во всём workspace
     */
    async searchWorkspaceSymbols(query: string): Promise<vscode.SymbolInformation[]> {
        try {
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeWorkspaceSymbolProvider',
                query
            );
            return symbols || [];
        } catch (error) {
            console.error('[Kimi] Failed to search workspace symbols:', error);
            return [];
        }
    }

    /**
     * Получение определения символа
     */
    async getDefinition(
        uri: vscode.Uri,
        position: vscode.Position
    ): Promise<vscode.Location[]> {
        try {
            const locations = await vscode.commands.executeCommand<vscode.Location[] | vscode.LocationLink[]>(
                'vscode.executeDefinitionProvider',
                uri,
                position
            );

            if (!locations) {
                return [];
            }

            // Нормализация LocationLink в Location
            return locations.map(loc => {
                if ('targetUri' in loc) {
                    return new vscode.Location(
                        loc.targetUri,
                        loc.targetRange
                    );
                }
                return loc;
            });
        } catch (error) {
            console.error('[Kimi] Failed to get definition:', error);
            return [];
        }
    }

    /**
     * Получение ссылок на символ
     */
    async getReferences(
        uri: vscode.Uri,
        position: vscode.Position,
        includeDeclaration: boolean = true
    ): Promise<SymbolReference[]> {
        try {
            const locations = await vscode.commands.executeCommand<vscode.Location[]>(
                'vscode.executeReferenceProvider',
                uri,
                position,
                { includeDeclaration }
            );

            if (!locations) {
                return [];
            }

            const references: SymbolReference[] = [];

            for (const loc of locations) {
                try {
                    const doc = await vscode.workspace.openTextDocument(loc.uri);
                    const line = doc.lineAt(loc.range.start.line);
                    references.push({
                        uri: loc.uri.toString(),
                        range: loc.range,
                        context: line.text.trim(),
                    });
                } catch {
                    // Игнорируем недоступные документы
                }
            }

            return references;
        } catch (error) {
            console.error('[Kimi] Failed to get references:', error);
            return [];
        }
    }

    /**
     * Построение иерархии вызовов
     */
    async getCallHierarchy(
        uri: vscode.Uri,
        position: vscode.Position,
        direction: 'incoming' | 'outgoing' = 'incoming'
    ): Promise<CallHierarchyItem[]> {
        return this.callHierarchyProvider.getCallHierarchy(uri, position, direction);
    }

    /**
     * Построение dependency graph для файла или workspace
     */
    async buildDependencyGraph(uri?: vscode.Uri): Promise<DependencyGraph> {
        const graph: DependencyGraph = {
            nodes: new Map(),
            edges: [],
        };

        if (uri) {
            // Graph для конкретного файла
            await this.buildFileDependencyGraph(uri, graph);
        } else {
            // Graph для всего workspace
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,tsx,js,jsx,py,java,go,rs}',
                '**/node_modules/**'
            );

            for (const file of files.slice(0, 100)) { // Ограничение для производительности
                await this.buildFileDependencyGraph(file, graph);
            }
        }

        return graph;
    }

    /**
     * Получение зависимостей файла
     */
    async getFileDependencies(uri: vscode.Uri): Promise<{
        imports: ImportInfo[];
        exports: ExportInfo[];
        dependencies: string[];
    }> {
        const outline = await this.getFileOutline(uri);
        if (!outline) {
            return { imports: [], exports: [], dependencies: [] };
        }

        const dependencies: string[] = [];

        for (const imp of outline.imports) {
            // Разрешение относительных импортов
            if (imp.source.startsWith('.')) {
                const resolved = await this.resolveImportPath(uri, imp.source);
                if (resolved) {
                    dependencies.push(resolved);
                }
            }
        }

        return {
            imports: outline.imports,
            exports: outline.exports,
            dependencies,
        };
    }

    /**
     * Нахождение всех файлов, зависящих от данного
     */
    async getDependents(uri: vscode.Uri): Promise<string[]> {
        const dependents: string[] = [];
        const targetPath = uri.fsPath;
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

        if (!workspaceRoot) {
            return dependents;
        }

        // Получаем все файлы проекта
        const files = await vscode.workspace.findFiles(
            '**/*.{ts,tsx,js,jsx,py,java,go,rs}',
            '**/node_modules/**'
        );

        for (const file of files) {
            if (file.fsPath === targetPath) {
                continue;
            }

            const deps = await this.getFileDependencies(file);
            if (deps.dependencies.includes(targetPath)) {
                dependents.push(file.fsPath);
            }
        }

        return dependents;
    }

    /**
     * Получение контекста символа для LLM
     */
    async getSymbolContext(
        uri: vscode.Uri,
        symbolName: string
    ): Promise<{
        symbol: SymbolNode;
        content: string;
        references: SymbolReference[];
        relatedSymbols: SymbolNode[];
    } | null> {
        const outline = await this.getFileOutline(uri);
        if (!outline) {
            return null;
        }

        const symbol = this.findSymbolByName(outline.symbols, symbolName);
        if (!symbol) {
            return null;
        }

        // Получение содержимого символа
        const document = await vscode.workspace.openTextDocument(uri);
        const content = document.getText(symbol.range);

        // Получение ссылок
        const references = await this.getReferences(
            uri,
            symbol.selectionRange.start
        );

        // Получение связанных символов (в том же scope)
        const relatedSymbols = this.findRelatedSymbols(outline.symbols, symbol);

        return {
            symbol,
            content,
            references: references.slice(0, 10),
            relatedSymbols,
        };
    }

    /**
     * Инвалидация кэша
     */
    invalidateCache(uri?: vscode.Uri): void {
        if (uri) {
            this.cache.delete(uri.fsPath);
        } else {
            this.cache.clear();
        }
    }

    // ==================== Private Methods ====================

    private convertSymbol(symbol: vscode.DocumentSymbol, uri: vscode.Uri): SymbolNode {
        return {
            name: symbol.name,
            kind: symbol.kind,
            detail: symbol.detail,
            range: symbol.range,
            selectionRange: symbol.selectionRange,
            children: symbol.children.map(c => this.convertSymbol(c, uri)),
            uri: uri.toString(),
        };
    }

    private findSymbolsInRange(symbols: SymbolNode[], range: vscode.Range): SymbolNode[] {
        const result: SymbolNode[] = [];

        for (const symbol of symbols) {
            if (symbol.range.intersection(range)) {
                result.push(symbol);
            }
            
            if (symbol.children.length > 0) {
                result.push(...this.findSymbolsInRange(symbol.children, range));
            }
        }

        return result;
    }

    private findParentSymbol(symbols: SymbolNode[], position: vscode.Position): SymbolNode | null {
        for (const symbol of symbols) {
            if (symbol.range.contains(position)) {
                // Рекурсивный поиск в детях
                const childParent = this.findParentSymbol(symbol.children, position);
                return childParent || symbol;
            }
        }
        return null;
    }

    private findSymbolByName(symbols: SymbolNode[], name: string): SymbolNode | null {
        for (const symbol of symbols) {
            if (symbol.name === name) {
                return symbol;
            }
            
            const child = this.findSymbolByName(symbol.children, name);
            if (child) {
                return child;
            }
        }
        return null;
    }

    private findRelatedSymbols(symbols: SymbolNode[], target: SymbolNode): SymbolNode[] {
        // Находим родительский символ
        const parent = this.findParentOf(symbols, target);
        if (!parent) {
            return [];
        }

        // Возвращаем siblings
        return parent.children.filter(s => s.name !== target.name);
    }

    private findParentOf(symbols: SymbolNode[], target: SymbolNode): SymbolNode | null {
        for (const symbol of symbols) {
            if (symbol.children.includes(target)) {
                return symbol;
            }
            
            const parent = this.findParentOf(symbol.children, target);
            if (parent) {
                return parent;
            }
        }
        return null;
    }

    private extractImports(document: vscode.TextDocument): ImportInfo[] {
        const imports: ImportInfo[] = [];
        const text = document.getText();
        const languageId = document.languageId;

        const patterns = this.getImportPatterns(languageId);

        for (const { regex, extractor } of patterns) {
            let match;
            while ((match = regex.exec(text)) !== null) {
                const line = document.positionAt(match.index).line;
                const info = extractor(match);
                if (info) {
                    imports.push({ ...info, line });
                }
            }
        }

        return imports;
    }

    private extractExports(document: vscode.TextDocument): ExportInfo[] {
        const exports: ExportInfo[] = [];
        const text = document.getText();
        const languageId = document.languageId;

        let regex: RegExp | null = null;

        switch (languageId) {
            case 'typescript':
            case 'javascript':
                regex = /export\s+(?:default\s+)?(?:class|function|const|let|var|interface|type|enum)?\s+(\w+)/g;
                break;
            case 'python':
                // Python использует module-level экспорты
                break;
        }

        if (regex) {
            let match;
            while ((match = regex.exec(text)) !== null) {
                const line = document.positionAt(match.index).line;
                exports.push({
                    symbol: match[1],
                    isDefault: text.substring(match.index, match.index + 15).includes('default'),
                    line,
                });
            }
        }

        return exports;
    }

    private getImportPatterns(languageId: string): Array<{
        regex: RegExp;
        extractor: (match: RegExpExecArray) => ImportInfo | null;
    }> {
        switch (languageId) {
            case 'typescript':
            case 'javascript':
            case 'typescriptreact':
            case 'javascriptreact':
                return [
                    // ES6 imports
                    {
                        regex: /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]+)\})?\s*from\s+['"]([^'"]+)['"]/g,
                        extractor: (m) => ({
                            source: m[3],
                            symbols: [
                                ...(m[1] ? [m[1]] : []),
                                ...(m[2] ? m[2].split(',').map(s => s.trim().split(' ')[0]) : []),
                            ],
                            isDefault: !!m[1],
                            line: 0,
                        }),
                    },
                    // Side-effect imports
                    {
                        regex: /import\s+['"]([^'"]+)['"]/g,
                        extractor: (m) => ({
                            source: m[1],
                            symbols: [],
                            line: 0,
                        }),
                    },
                    // CommonJS require
                    {
                        regex: /(?:const|let|var)\s+(?:(\w+)|\{([^}]+)\})\s+=\s+require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
                        extractor: (m) => ({
                            source: m[3],
                            symbols: [
                                ...(m[1] ? [m[1]] : []),
                                ...(m[2] ? m[2].split(',').map(s => s.trim()) : []),
                            ],
                            line: 0,
                        }),
                    },
                ];
            case 'python':
                return [
                    {
                        regex: /import\s+([\w.]+)(?:\s+as\s+(\w+))?/g,
                        extractor: (m) => ({
                            source: m[1],
                            symbols: m[2] ? [m[2]] : [m[1].split('.').pop() || m[1]],
                            line: 0,
                        }),
                    },
                    {
                        regex: /from\s+([\w.]+)\s+import\s+(.+)/g,
                        extractor: (m) => ({
                            source: m[1],
                            symbols: m[2].split(',').map(s => s.trim().split(' ')[0]),
                            line: 0,
                        }),
                    },
                ];
            case 'java':
                return [
                    {
                        regex: /import\s+([\w.]+);/g,
                        extractor: (m) => ({
                            source: m[1],
                            symbols: [m[1].split('.').pop() || m[1]],
                            line: 0,
                        }),
                    },
                ];
            case 'go':
                return [
                    {
                        regex: /import\s+(?:\([^)]*["']([^"']+)["'][^)]*\)|["']([^"']+)["'])/g,
                        extractor: (m) => ({
                            source: m[1] || m[2],
                            symbols: [],
                            line: 0,
                        }),
                    },
                ];
            case 'rust':
                return [
                    {
                        regex: /use\s+([\w:]+);/g,
                        extractor: (m) => ({
                            source: m[1],
                            symbols: [m[1].split('::').pop() || m[1]],
                            line: 0,
                        }),
                    },
                    {
                        regex: /extern\s+crate\s+(\w+);/g,
                        extractor: (m) => ({
                            source: m[1],
                            symbols: [m[1]],
                            line: 0,
                        }),
                    },
                ];
            default:
                return [];
        }
    }

    private async resolveImportPath(fromUri: vscode.Uri, importPath: string): Promise<string | null> {
        const fromDir = path.dirname(fromUri.fsPath);
        
        // Пробуем разные расширения
        const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.rs', '/index.ts', '/index.js'];
        
        for (const ext of extensions) {
            const resolved = path.resolve(fromDir, importPath + ext);
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(resolved));
                return resolved;
            } catch {
                // Пробуем следующий
            }
        }

        return null;
    }

    private async buildFileDependencyGraph(uri: vscode.Uri, graph: DependencyGraph): Promise<void> {
        const outline = await this.getFileOutline(uri);
        if (!outline) {
            return;
        }

        graph.nodes.set(uri.fsPath, outline.symbols);

        for (const imp of outline.imports) {
            graph.edges.push({
                from: uri.fsPath,
                to: imp.source,
                type: 'import',
                line: imp.line,
            });
        }
    }
}

// ==================== Call Hierarchy Provider ====================

class CallHierarchyProvider {
    async getCallHierarchy(
        uri: vscode.Uri,
        position: vscode.Position,
        direction: 'incoming' | 'outgoing'
    ): Promise<CallHierarchyItem[]> {
        try {
            const items = await vscode.commands.executeCommand<vscode.CallHierarchyItem[]>(
                direction === 'incoming' 
                    ? 'vscode.prepareCallHierarchy'
                    : 'vscode.prepareCallHierarchy',
                uri,
                position
            );

            if (!items || items.length === 0) {
                return [];
            }

            const result: CallHierarchyItem[] = [];

            for (const item of items) {
                const hierarchyItem = await this.buildHierarchyItem(item, direction);
                if (hierarchyItem) {
                    result.push(hierarchyItem);
                }
            }

            return result;

        } catch (error) {
            console.error('[Kimi] Failed to get call hierarchy:', error);
            return [];
        }
    }

    private async buildHierarchyItem(
        item: vscode.CallHierarchyItem,
        direction: 'incoming' | 'outgoing'
    ): Promise<CallHierarchyItem | null> {
        const result: CallHierarchyItem = {
            symbol: item.name,
            kind: item.kind,
            uri: item.uri.toString(),
            range: item.range,
            callers: [],
            callees: [],
        };

        try {
            if (direction === 'incoming') {
                const incoming = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
                    'vscode.provideIncomingCalls',
                    item
                );

                if (incoming) {
                    for (const call of incoming) {
                        const caller = await this.buildHierarchyItem(call.from, direction);
                        if (caller) {
                            result.callers.push(caller);
                        }
                    }
                }
            } else {
                const outgoing = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
                    'vscode.provideOutgoingCalls',
                    item
                );

                if (outgoing) {
                    for (const call of outgoing) {
                        const callee = await this.buildHierarchyItem(call.to, direction);
                        if (callee) {
                            result.callees.push(callee);
                        }
                    }
                }
            }
        } catch {
            // Игнорируем ошибки при построении иерархии
        }

        return result;
    }
}

// ==================== Types ====================

export {
    SymbolNode,
    DependencyEdge,
    DependencyGraph,
    FileOutline,
    ImportInfo,
    ExportInfo,
    SymbolReference,
    CallHierarchyItem,
};
