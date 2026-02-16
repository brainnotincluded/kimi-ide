/**
 * Context Resolver
 * Resolves and manages code context for AI interactions
 */

import * as vscode from 'vscode';

/**
 * Mention types
 */
export type Mention = FileMention | SymbolMention | UrlMention;

export interface FileMention {
    type: 'file';
    path: string;
    line?: number;
    column?: number;
}

export interface SymbolMention {
    type: 'symbol';
    name: string;
    kind: string;
    filePath?: string;
}

export interface UrlMention {
    type: 'url';
    url: string;
}

/**
 * Resolved mention
 */
export interface ResolvedMention {
    type: 'file' | 'symbol' | 'url' | 'folder';
    content: string;
    path?: string;
    value?: string;
    files?: string[];
    symbols?: string[];
    metadata?: Record<string, any>;
}

/**
 * Auto context
 */
export interface AutoContext {
    imports: string[];
    relatedFiles: any[];
    testFiles: string[];
    openFiles?: any[];
    currentFile?: any;
}

/**
 * Context config
 */
export interface ContextConfig {
    maxTokens: number;
    includeImports: boolean;
    includeRelated: boolean;
    includeTests: boolean;
}

/**
 * Mention completion
 */
export interface MentionCompletion {
    label: string;
    kind: 'file' | 'symbol' | 'url';
    detail?: string;
    insertText: string;
}

/**
 * Context resolution options
 */
export interface ContextOptions {
    document?: vscode.TextDocument;
    position?: { line: number; character: number };
    files?: vscode.TextDocument[];
    filePath?: string;
    entries?: string[];
    includeImports?: boolean;
    maxTokens?: number;
}

/**
 * Resolved context
 */
export interface ResolvedContext {
    content: string;
    files: string[];
    symbols: string[];
    tokenCount: number;
    mentions?: ResolvedMention[];
    autoContext?: AutoContext;
    totalTokens?: number;
}

/**
 * Symbol information
 */
export interface SymbolInfo {
    name: string;
    kind: string;
    location: vscode.Location;
}

/**
 * Context Resolver
 */
export class ContextResolver {
    private cache: Map<string, { content: string; timestamp: number }> = new Map();
    private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes

    /**
     * Resolve context based on options
     */
    async resolve(options: ContextOptions): Promise<ResolvedContext> {
        const resolved: ResolvedContext = {
            content: '',
            files: [],
            symbols: [],
            tokenCount: 0,
        };

        // Handle single document
        if (options.document) {
            const content = options.document.getText();
            resolved.content += content;
            resolved.files.push(options.document.fileName);
            resolved.tokenCount += this.estimateTokens(content);
        }

        // Handle multiple files
        if (options.files) {
            for (const file of options.files) {
                if (!resolved.files.includes(file.fileName)) {
                    const content = file.getText();
                    resolved.content += '\n\n' + content;
                    resolved.files.push(file.fileName);
                    resolved.tokenCount += this.estimateTokens(content);
                }
            }
        }

        // Handle file path
        if (options.filePath) {
            try {
                const uri = vscode.Uri.file(options.filePath);
                const document = await vscode.workspace.openTextDocument(uri);
                const content = document.getText();
                resolved.content += content;
                resolved.files.push(options.filePath);
                resolved.tokenCount += this.estimateTokens(content);
            } catch {
                // File not found, ignore
            }
        }

        // Handle entries
        if (options.entries) {
            for (const entry of options.entries) {
                if (!resolved.files.includes(entry)) {
                    try {
                        const uri = vscode.Uri.file(entry);
                        const document = await vscode.workspace.openTextDocument(uri);
                        const content = document.getText();
                        resolved.content += '\n\n' + content;
                        resolved.files.push(entry);
                        resolved.tokenCount += this.estimateTokens(content);
                    } catch {
                        // File not found, ignore
                    }
                }
            }
        }

        return resolved;
    }

    /**
     * Resolve symbols at a position
     */
    async resolveSymbolsAtPosition(
        document: vscode.TextDocument,
        position: { line: number; character: number }
    ): Promise<SymbolInfo[]> {
        const symbols: SymbolInfo[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        // Simple regex-based symbol extraction
        const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)/g;
        const classRegex = /(?:export\s+)?class\s+(\w+)/g;
        const constRegex = /(?:export\s+)?const\s+(\w+)\s*=/g;
        
        let match;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            while ((match = functionRegex.exec(line)) !== null) {
                symbols.push({
                    name: match[1],
                    kind: 'function',
                    location: new vscode.Location(
                        document.uri,
                        new vscode.Range(i, match.index, i, match.index + match[0].length)
                    ),
                });
            }
            
            while ((match = classRegex.exec(line)) !== null) {
                symbols.push({
                    name: match[1],
                    kind: 'class',
                    location: new vscode.Location(
                        document.uri,
                        new vscode.Range(i, match.index, i, match.index + match[0].length)
                    ),
                });
            }
            
            while ((match = constRegex.exec(line)) !== null) {
                symbols.push({
                    name: match[1],
                    kind: 'constant',
                    location: new vscode.Location(
                        document.uri,
                        new vscode.Range(i, match.index, i, match.index + match[0].length)
                    ),
                });
            }
        }
        
        return symbols;
    }

    /**
     * Resolve definition at position
     */
    async resolveDefinition(
        document: vscode.TextDocument,
        position: { line: number; character: number }
    ): Promise<vscode.Location | undefined> {
        const wordRange = document.getWordRangeAtPosition(
            new vscode.Position(position.line, position.character)
        );
        
        if (!wordRange) return undefined;
        
        const word = document.getText(wordRange);
        const text = document.getText();
        
        // Simple definition finding - look for declarations
        const patterns = [
            new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${word}\\s*\\(`),
            new RegExp(`(?:export\\s+)?class\\s+${word}\\s*\\{`),
            new RegExp(`(?:export\\s+)?(?:const|let|var)\\s+${word}\\s*=?`),
        ];
        
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            for (const pattern of patterns) {
                const match = lines[i].match(pattern);
                if (match) {
                    return new vscode.Location(
                        document.uri,
                        new vscode.Range(i, 0, i, lines[i].length)
                    );
                }
            }
        }
        
        return undefined;
    }

    /**
     * Parse mentions from text
     */
    parseMentions(text: string): Mention[] {
        const mentions: Mention[] = [];
        
        // Parse file mentions: @file/path or @"file path"
        const fileRegex = /@(?:"([^"]+)"|([\w\-\./]+))/g;
        let match;
        while ((match = fileRegex.exec(text)) !== null) {
            const path = match[1] || match[2];
            mentions.push({ type: 'file', path });
        }
        
        return mentions;
    }

    /**
     * Resolve file context
     */
    async resolveFileContext(filePath: string): Promise<ResolvedContext> {
        const uri = vscode.Uri.file(filePath);
        const document = await vscode.workspace.openTextDocument(uri);
        const content = document.getText();
        
        return {
            content,
            files: [filePath],
            symbols: [],
            tokenCount: this.estimateTokens(content),
        };
    }

    /**
     * Get current context
     */
    async getCurrentContext(): Promise<ResolvedContext> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return {
                content: '',
                files: [],
                symbols: [],
                tokenCount: 0,
            };
        }
        
        return this.resolve({
            document: editor.document,
            position: editor.selection.active,
        });
    }

    /**
     * Set context
     */
    setContext(key: string, content: string): void {
        this.cache.set(key, { content, timestamp: Date.now() });
    }

    /**
     * Find related files
     */
    async findRelatedFiles(
        document: vscode.TextDocument,
        options: { includeTests?: boolean } = {}
    ): Promise<vscode.Uri[]> {
        const related: vscode.Uri[] = [];
        const baseName = document.fileName.replace(/\.[^/.]+$/, '');
        const extension = document.fileName.split('.').pop() || '';
        
        // Find test files
        if (options.includeTests) {
            const testPatterns = [
                `${baseName}.test.${extension}`,
                `${baseName}.spec.${extension}`,
                `${baseName}__tests__/${baseName.split('/').pop()}.${extension}`,
            ];
            
            for (const pattern of testPatterns) {
                try {
                    const uri = vscode.Uri.file(pattern);
                    await vscode.workspace.fs.stat(uri);
                    related.push(uri);
                } catch {
                    // File doesn't exist
                }
            }
        }
        
        return related;
    }

    /**
     * Find files that import the current file
     */
    async findImporters(document: vscode.TextDocument): Promise<vscode.Uri[]> {
        const importers: vscode.Uri[] = [];
        const fileName = document.fileName.split('/').pop() || '';
        const baseName = fileName.replace(/\.[^/.]+$/, '');
        
        // This is a simplified implementation
        // A full implementation would search through all files
        
        return importers;
    }

    /**
     * Estimate token count for text
     */
    private estimateTokens(text: string): number {
        // Rough estimate: ~4 characters per token
        return Math.ceil(text.length / 4);
    }
}
