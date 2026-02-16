// @ts-nocheck
import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Patterns for matching file paths in terminal output
 */
const FILE_PATTERNS = {
    // Standard file:line:column pattern
    FILE_LINE_COL: /(?:[\w\-]+\/)?(?:[\w\-]+\/)*[\w\-]+\.\w+:\d+(?::\d+)?/g,
    
    // File with line number (e.g., "file.txt:123")
    FILE_LINE: /([\w\-./\\]+\.[\w]+):(\d+)/g,
    
    // File with line and column (e.g., "file.txt:123:45")
    FILE_LINE_COLUMN: /([\w\-./\\]+\.[\w]+):(\d+):(\d+)/g,
    
    // Windows path pattern (e.g., "C:\\path\\to\\file.txt:123")
    WINDOWS_PATH_LINE: /([a-zA-Z]:[\\/][\w\-./\\]+\.[\w]+):(\d+)(?::(\d+))?/g,
    
    // Unix absolute path pattern
    UNIX_PATH_LINE: /(\/[\w\-./]+\.[\w]+):(\d+)(?::(\d+))?/g,
    
    // Kimi-specific output patterns
    KIMI_FILE_REF: /(?:File|📄|📝):\s*([\w\-./\\]+\.[\w]+)/g,
    KIMI_CODE_BLOCK: /```[\w]*\n([\s\S]*?)```/g
};

/**
 * Parsed file link information
 */
export interface FileLinkInfo {
    filePath: string;
    line?: number;
    column?: number;
    isAbsolute: boolean;
    workspaceFolder?: string;
}

/**
 * TerminalLinkProvider provides clickable file links in terminal output
 * Supports patterns like:
 * - file.txt:123
 * - file.txt:123:45
 * - /absolute/path/file.txt:123
 * - ./relative/path/file.txt:123
 */
export class TerminalLinkProvider implements vscode.TerminalLinkProvider {
    private context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.register();
    }

    /**
     * Register the link provider with VS Code
     */
    private register(): void {
        const provider = vscode.window.registerTerminalLinkProvider(this);
        this.disposables.push(provider);
    }

    /**
     * Provide terminal links for the given context
     */
    async provideTerminalLinks(
        context: vscode.TerminalLinkContext,
        token: vscode.CancellationToken
    ): Promise<vscode.TerminalLink[]> {
        const links: vscode.TerminalLink[] = [];
        const line = context.line;
        const workspaceFolders = vscode.workspace.workspaceFolders;

        // Try different patterns
        const patterns = [
            { pattern: FILE_PATTERNS.FILE_LINE_COLUMN, hasColumn: true },
            { pattern: FILE_PATTERNS.WINDOWS_PATH_LINE, hasColumn: true },
            { pattern: FILE_PATTERNS.UNIX_PATH_LINE, hasColumn: true },
            { pattern: FILE_PATTERNS.FILE_LINE, hasColumn: false },
        ];

        for (const { pattern, hasColumn } of patterns) {
            let match: RegExpExecArray | null;
            // Reset lastIndex for global regex
            pattern.lastIndex = 0;

            while ((match = pattern.exec(line)) !== null) {
                if (token.isCancellationRequested) {
                    break;
                }

                const fullMatch = match[0];
                const startIndex = match.index;
                const endIndex = startIndex + fullMatch.length;

                let filePath = match[1];
                const lineNum = parseInt(match[2], 10);
                const colNum = hasColumn && match[3] ? parseInt(match[3], 10) : undefined;

                // Resolve the file path
                const resolved = await this.resolveFilePath(filePath, workspaceFolders);
                if (resolved) {
                    const link: any = {
                        startIndex,
                        length: endIndex - startIndex,
                        tooltip: `Open ${path.basename(filePath)} at line ${lineNum}`,
                        // Store additional data for handling
                        data: {
                            filePath: resolved,
                            line: lineNum - 1, // Convert to 0-based
                            column: colNum ? colNum - 1 : 0
                        }
                    };
                    links.push(link as vscode.TerminalLink);
                }
            }
        }

        // Handle Kimi-specific file references
        let kimiMatch: RegExpExecArray | null;
        FILE_PATTERNS.KIMI_FILE_REF.lastIndex = 0;
        while ((kimiMatch = FILE_PATTERNS.KIMI_FILE_REF.exec(line)) !== null) {
            if (token.isCancellationRequested) {
                break;
            }

            const filePath = kimiMatch[1];
            const startIndex = kimiMatch.index;
            const endIndex = startIndex + kimiMatch[0].length;

            const resolved = await this.resolveFilePath(filePath, workspaceFolders);
            if (resolved) {
                const link: any = {
                    startIndex,
                    length: endIndex - startIndex,
                    tooltip: `Open ${path.basename(filePath)}`,
                    data: {
                        filePath: resolved,
                        line: 0,
                        column: 0
                    }
                };
                links.push(link as vscode.TerminalLink);
            }
        }

        return links;
    }

    /**
     * Handle when a terminal link is activated (clicked)
     */
    async handleTerminalLink(link: vscode.TerminalLink): Promise<void> {
        const data = (link as any).data as { filePath: string; line: number; column: number };
        
        if (!data || !data.filePath) {
            vscode.window.showErrorMessage('Invalid link data');
            return;
        }

        try {
            const document = await vscode.workspace.openTextDocument(data.filePath);
            const editor = await vscode.window.showTextDocument(document);

            // Position cursor at the specified line and column
            const position = new vscode.Position(data.line, data.column);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Could not open file: ${data.filePath}`);
            console.error('Error opening file from terminal link:', error);
        }
    }

    /**
     * Resolve a file path to an absolute path
     */
    private async resolveFilePath(
        filePath: string,
        workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined
    ): Promise<string | undefined> {
        // If already absolute
        if (path.isAbsolute(filePath)) {
            const uri = vscode.Uri.file(filePath);
            try {
                await vscode.workspace.fs.stat(uri);
                return filePath;
            } catch {
                return undefined;
            }
        }

        // Try to resolve relative to workspace folders
        if (workspaceFolders) {
            for (const folder of workspaceFolders) {
                const resolvedPath = path.join(folder.uri.fsPath, filePath);
                const uri = vscode.Uri.file(resolvedPath);
                try {
                    await vscode.workspace.fs.stat(uri);
                    return resolvedPath;
                } catch {
                    // Try next folder
                }
            }
        }

        // Try to resolve relative to active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const dir = path.dirname(activeEditor.document.uri.fsPath);
            const resolvedPath = path.join(dir, filePath);
            const uri = vscode.Uri.file(resolvedPath);
            try {
                await vscode.workspace.fs.stat(uri);
                return resolvedPath;
            } catch {
                // Not found
            }
        }

        // Try terminal cwd (this would require additional tracking)
        // For now, return undefined if not found
        return undefined;
    }

    /**
     * Extract file links from text (useful for processing Kimi output)
     */
    static extractFileLinks(text: string): FileLinkInfo[] {
        const links: FileLinkInfo[] = [];
        const seen = new Set<string>();

        const patterns = [
            FILE_PATTERNS.FILE_LINE_COLUMN,
            FILE_PATTERNS.FILE_LINE,
            FILE_PATTERNS.WINDOWS_PATH_LINE,
            FILE_PATTERNS.UNIX_PATH_LINE,
        ];

        for (const pattern of patterns) {
            let match: RegExpExecArray | null;
            pattern.lastIndex = 0;

            while ((match = pattern.exec(text)) !== null) {
                const key = match[0];
                if (seen.has(key)) continue;
                seen.add(key);

                const groups = match.slice(1);
                const filePath = groups[0];
                const line = groups[1] ? parseInt(groups[1], 10) : undefined;
                const column = groups[2] ? parseInt(groups[2], 10) : undefined;

                links.push({
                    filePath,
                    line,
                    column,
                    isAbsolute: path.isAbsolute(filePath)
                });
            }
        }

        return links;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}

/**
 * Terminal Link Handler for custom link types
 */
export class TerminalLinkHandler {
    private disposables: vscode.Disposable[] = [];

    constructor(context: vscode.ExtensionContext) {
        // Register command to open file at location
        const openFileCommand = vscode.commands.registerCommand(
            'kimi.terminal.openFile',
            async (filePath: string, line?: number, column?: number) => {
                try {
                    const document = await vscode.workspace.openTextDocument(filePath);
                    const editor = await vscode.window.showTextDocument(document);
                    
                    if (line !== undefined) {
                        const position = new vscode.Position(line, column || 0);
                        editor.selection = new vscode.Selection(position, position);
                        editor.revealRange(
                            new vscode.Range(position, position),
                            vscode.TextEditorRevealType.InCenter
                        );
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(`Could not open file: ${filePath}`);
                }
            }
        );

        this.disposables.push(openFileCommand);
        context.subscriptions.push(openFileCommand);
    }

    /**
     * Create a markdown link for terminal output
     */
    static createFileLink(filePath: string, line?: number, column?: number): string {
        const baseName = path.basename(filePath);
        if (line !== undefined) {
            const location = column !== undefined ? `:${line}:${column}` : `:${line}`;
            return `${baseName}${location}`;
        }
        return baseName;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
