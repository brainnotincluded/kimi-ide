/**
 * Mention Provider
 * Provides @ symbol autocomplete for files, folders, symbols, and web
 */

import * as vscode from 'vscode';
import * as path from 'path';

export interface MentionItem {
    type: 'file' | 'folder' | 'symbol' | 'codebase' | 'web';
    label: string;
    description: string;
    detail?: string;
    icon?: string;
    data?: any;
}

export class MentionProvider {
    private disposables: vscode.Disposable[] = [];
    private fileCache: Map<string, { uri: vscode.Uri; relativePath: string }> = new Map();
    private cacheLastUpdate = 0;
    private readonly cacheTTL = 30000; // 30 seconds

    constructor() {
        this.registerCommands();
        this.startFileWatcher();
    }

    private registerCommands(): void {
        this.disposables.push(
            vscode.commands.registerCommand('kimi.mention.file', () => this.insertMention('file')),
            vscode.commands.registerCommand('kimi.mention.folder', () => this.insertMention('folder')),
            vscode.commands.registerCommand('kimi.mention.codebase', () => this.insertMention('codebase')),
            vscode.commands.registerCommand('kimi.mention.web', () => this.insertMention('web')),
        );
    }

    /**
     * Get mention suggestions based on query
     */
    async getMentions(query: string): Promise<MentionItem[]> {
        const mentions: MentionItem[] = [];
        const lowerQuery = query.toLowerCase();

        // Always show special mentions
        if ('codebase'.startsWith(lowerQuery)) {
            mentions.push({
                type: 'codebase',
                label: '@codebase',
                description: 'Include entire codebase context',
                icon: '$(repo)',
            });
        }

        if ('web'.startsWith(lowerQuery)) {
            mentions.push({
                type: 'web',
                label: '@web',
                description: 'Search the web for information',
                icon: '$(globe)',
            });
        }

        // Get file mentions
        const fileMentions = await this.getFileMentions(query);
        mentions.push(...fileMentions);

        // Get folder mentions
        const folderMentions = await this.getFolderMentions(query);
        mentions.push(...folderMentions);

        return mentions;
    }

    /**
     * Get file mentions
     */
    private async getFileMentions(query: string): Promise<MentionItem[]> {
        const files: MentionItem[] = [];
        
        if (!vscode.workspace.workspaceFolders) {
            return files;
        }

        await this.updateFileCache();

        for (const [relativePath, { uri }] of this.fileCache) {
            if (relativePath.toLowerCase().includes(query.toLowerCase())) {
                const fileName = path.basename(relativePath);
                const dirName = path.dirname(relativePath);
                
                files.push({
                    type: 'file',
                    label: `@${fileName}`,
                    description: dirName === '.' ? '' : dirName,
                    detail: relativePath,
                    icon: this.getFileIcon(fileName),
                    data: { uri, relativePath },
                });
            }
        }

        // Sort by relevance (exact matches first)
        files.sort((a, b) => {
            const aExact = a.detail?.toLowerCase() === query.toLowerCase();
            const bExact = b.detail?.toLowerCase() === query.toLowerCase();
            if (aExact && !bExact) return -1;
            if (bExact && !aExact) return 1;
            return (a.detail || '').localeCompare(b.detail || '');
        });

        return files.slice(0, 10); // Limit to 10 results
    }

    /**
     * Get folder mentions
     */
    private async getFolderMentions(query: string): Promise<MentionItem[]> {
        const folders: MentionItem[] = [];
        
        if (!vscode.workspace.workspaceFolders) {
            return folders;
        }

        const seenFolders = new Set<string>();

        for (const [relativePath] of this.fileCache) {
            const dirPath = path.dirname(relativePath);
            if (dirPath === '.' || seenFolders.has(dirPath)) {
                continue;
            }

            if (dirPath.toLowerCase().includes(query.toLowerCase())) {
                seenFolders.add(dirPath);
                const folderName = path.basename(dirPath);
                
                folders.push({
                    type: 'folder',
                    label: `@${folderName}/`,
                    description: 'Include entire folder',
                    detail: dirPath,
                    icon: '$(folder)',
                    data: { path: dirPath },
                });
            }
        }

        return folders.slice(0, 5);
    }

    /**
     * Update file cache
     */
    private async updateFileCache(): Promise<void> {
        const now = Date.now();
        if (now - this.cacheLastUpdate < this.cacheTTL && this.fileCache.size > 0) {
            return;
        }

        this.fileCache.clear();

        for (const folder of vscode.workspace.workspaceFolders || []) {
            const files = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/*'),
                new vscode.RelativePattern(folder, '**/{node_modules,dist,build,.git}/**'),
                1000
            );

            for (const file of files) {
                const relativePath = vscode.workspace.asRelativePath(file, false);
                this.fileCache.set(relativePath, { uri: file, relativePath });
            }
        }

        this.cacheLastUpdate = now;
    }

    /**
     * Get file icon based on extension
     */
    private getFileIcon(fileName: string): string {
        const ext = path.extname(fileName).toLowerCase();
        const icons: Record<string, string> = {
            '.ts': '$(file-code)',
            '.tsx': '$(file-code)',
            '.js': '$(file-code)',
            '.jsx': '$(file-code)',
            '.py': '$(file-code)',
            '.json': '$(file-json)',
            '.md': '$(file-text)',
            '.css': '$(file-code)',
            '.html': '$(file-code)',
        };
        return icons[ext] || '$(file)';
    }

    /**
     * Insert mention into chat input
     */
    private async insertMention(type: string): Promise<void> {
        // This would integrate with the chat panel
        // For now, just show a quick pick
        
        if (type === 'codebase') {
            vscode.commands.executeCommand('kimi.chat.insertText', '@codebase ');
            return;
        }

        if (type === 'web') {
            const query = await vscode.window.showInputBox({
                prompt: 'Enter web search query',
                placeHolder: 'Search the web...',
            });
            if (query) {
                vscode.commands.executeCommand('kimi.chat.insertText', `@web:${query} `);
            }
            return;
        }

        const mentions = await this.getMentions('');
        const filtered = mentions.filter(m => m.type === type);

        const selected = await vscode.window.showQuickPick(
            filtered.map(m => ({
                label: `${m.icon || ''} ${m.label}`,
                description: m.description,
                detail: m.detail,
                mention: m,
            })),
            { placeHolder: `Select ${type} to mention` }
        );

        if (selected) {
            vscode.commands.executeCommand('kimi.chat.insertText', `${selected.mention.label} `);
        }
    }

    /**
     * Start file watcher to update cache
     */
    private startFileWatcher(): void {
        const watcher = vscode.workspace.createFileSystemWatcher('**/*');
        
        watcher.onDidCreate(() => {
            this.cacheLastUpdate = 0; // Invalidate cache
        });
        
        watcher.onDidDelete(() => {
            this.cacheLastUpdate = 0;
        });
        
        watcher.onDidChange(() => {
            this.cacheLastUpdate = 0;
        });

        this.disposables.push(watcher);
    }

    /**
     * Resolve mention to content
     */
    async resolveMention(mention: MentionItem): Promise<string> {
        switch (mention.type) {
            case 'file':
                if (mention.data?.uri) {
                    const doc = await vscode.workspace.openTextDocument(mention.data.uri);
                    return doc.getText();
                }
                return '';

            case 'folder':
                // Get all files in folder
                const folderPath = mention.data?.path;
                if (!folderPath) return '';
                
                let content = '';
                for (const [relativePath, { uri }] of this.fileCache) {
                    if (relativePath.startsWith(folderPath + '/')) {
                        try {
                            const doc = await vscode.workspace.openTextDocument(uri);
                            content += `\n// File: ${relativePath}\n${doc.getText()}\n`;
                        } catch {
                            // Skip files that can't be opened
                        }
                    }
                }
                return content;

            case 'codebase':
                // Get relevant files from codebase
                return this.getCodebaseContext();

            case 'web':
                // This would trigger a web search
                return `[Web search results for: ${mention.label}]`;

            default:
                return '';
        }
    }

    /**
     * Get codebase context (limited to most relevant files)
     */
    private async getCodebaseContext(): Promise<string> {
        await this.updateFileCache();
        
        // Get open files first
        const openFiles = vscode.window.visibleTextEditors
            .map(e => vscode.workspace.asRelativePath(e.document.uri, false));

        let context = '';
        const includedFiles = new Set<string>();

        // Include open files
        for (const filePath of openFiles) {
            if (includedFiles.has(filePath)) continue;
            
            const fileInfo = this.fileCache.get(filePath);
            if (fileInfo) {
                try {
                    const doc = await vscode.workspace.openTextDocument(fileInfo.uri);
                    context += `\n// File: ${filePath}\n${doc.getText()}\n`;
                    includedFiles.add(filePath);
                } catch {
                    // Skip
                }
            }
        }

        // Include some key files (package.json, README, etc.)
        const keyFiles = ['package.json', 'README.md', 'tsconfig.json'];
        for (const keyFile of keyFiles) {
            if (includedFiles.has(keyFile)) continue;
            
            const fileInfo = this.fileCache.get(keyFile);
            if (fileInfo) {
                try {
                    const doc = await vscode.workspace.openTextDocument(fileInfo.uri);
                    context += `\n// File: ${keyFile}\n${doc.getText()}\n`;
                    includedFiles.add(keyFile);
                } catch {
                    // Skip
                }
            }
        }

        return context || 'No files found in workspace';
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.fileCache.clear();
    }
}
