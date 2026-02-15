import * as vscode from 'vscode';

interface DiffView {
    originalUri: vscode.Uri;
    modifiedUri: vscode.Uri;
    title: string;
}

export class DiffProvider implements vscode.Disposable {
    private disposables: vscode.Disposable[] = [];
    private diffScheme = 'kimi-diff';
    private originalContentMap: Map<string, string> = new Map();
    private modifiedContentMap: Map<string, string> = new Map();

    constructor() {
        this.registerDiffContentProvider();
    }

    /**
     * Register the text document content provider for diff views
     */
    private registerDiffContentProvider(): void {
        const provider = vscode.workspace.registerTextDocumentContentProvider(
            this.diffScheme,
            {
                provideTextDocumentContent: (uri: vscode.Uri): string => {
                    const content = this.originalContentMap.get(uri.toString()) ||
                                   this.modifiedContentMap.get(uri.toString()) ||
                                   '';
                    return content;
                },
            }
        );

        this.disposables.push(provider);
    }

    /**
     * Show diff view comparing original and modified code
     */
    public async showDiff(
        document: vscode.TextDocument,
        originalRange: vscode.Range,
        originalText: string,
        modifiedText: string,
        title: string = 'Kimi Edit'
    ): Promise<void> {
        // Generate unique URIs for diff view
        const timestamp = Date.now();
        const baseName = vscode.workspace.asRelativePath(document.fileName);
        
        const originalUri = vscode.Uri.parse(
            `${this.diffScheme}:/${baseName}?original&${timestamp}`
        );
        const modifiedUri = vscode.Uri.parse(
            `${this.diffScheme}:/${baseName}?modified&${timestamp}`
        );

        // Store content
        this.originalContentMap.set(originalUri.toString(), originalText);
        this.modifiedContentMap.set(modifiedUri.toString(), modifiedText);

        // Create title
        const diffTitle = `${title}: ${baseName}`;

        try {
            // Show diff editor
            await vscode.commands.executeCommand(
                'vscode.diff',
                originalUri,
                modifiedUri,
                diffTitle,
                {
                    preview: true,
                    viewColumn: vscode.ViewColumn.Beside,
                }
            );

            // Add accept/reject buttons to the diff view
            this.showDiffActions(originalRange, modifiedText);
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to show diff: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Show diff actions (accept/reject) in the editor
     */
    private showDiffActions(range: vscode.Range, modifiedText: string): void {
        // Create code lens provider for accept/reject actions
        const codeLensProvider = new DiffActionCodeLensProvider(range, modifiedText);
        
        const disposable = vscode.languages.registerCodeLensProvider(
            { scheme: this.diffScheme },
            codeLensProvider
        );

        // Auto-dispose after 5 minutes
        setTimeout(() => {
            disposable.dispose();
        }, 5 * 60 * 1000);

        this.disposables.push(disposable);
    }

    /**
     * Apply modified text to the original document
     */
    public async applyEdit(
        document: vscode.TextDocument,
        range: vscode.Range,
        newText: string
    ): Promise<boolean> {
        const edit = new vscode.WorkspaceEdit();
        edit.replace(document.uri, range, newText);

        const success = await vscode.workspace.applyEdit(edit);
        
        if (success) {
            // Save document if auto-save is not enabled
            if (!vscode.workspace.getConfiguration('files').get('autoSave')) {
                await document.save();
            }
        }

        return success;
    }

    /**
     * Generate a unified diff string (for copying or external use)
     */
    public generateUnifiedDiff(
        originalText: string,
        modifiedText: string,
        originalFileName: string = 'original',
        modifiedFileName: string = 'modified'
    ): string {
        const originalLines = originalText.split('\n');
        const modifiedLines = modifiedText.split('\n');
        
        // Simple line-by-line diff
        const diff: string[] = [];
        diff.push(`--- ${originalFileName}`);
        diff.push(`+++ ${modifiedFileName}`);
        
        let originalLine = 1;
        let modifiedLine = 1;
        
        const maxLines = Math.max(originalLines.length, modifiedLines.length);
        
        for (let i = 0; i < maxLines; i++) {
            const original = originalLines[i];
            const modified = modifiedLines[i];
            
            if (original === undefined) {
                // Added line
                diff.push(`+${modified}`);
                modifiedLine++;
            } else if (modified === undefined) {
                // Removed line
                diff.push(`-${original}`);
                originalLine++;
            } else if (original !== modified) {
                // Changed line
                diff.push(`-${original}`);
                diff.push(`+${modified}`);
                originalLine++;
                modifiedLine++;
            } else {
                // Unchanged line (context)
                diff.push(` ${original}`);
                originalLine++;
                modifiedLine++;
            }
        }
        
        return diff.join('\n');
    }

    /**
     * Show diff in a side-by-side webview panel
     */
    public async showDiffWebview(
        originalText: string,
        modifiedText: string,
        language: string,
        title: string = 'Kimi Diff'
    ): Promise<void> {
        const panel = vscode.window.createWebviewPanel(
            'kimiDiff',
            title,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
            }
        );

        panel.webview.html = this.getDiffWebviewContent(
            originalText,
            modifiedText,
            language
        );

        // Handle messages from webview
        panel.webview.onDidReceiveMessage(
            (message) => {
                switch (message.command) {
                    case 'accept':
                        vscode.commands.executeCommand('kimi.acceptEdit');
                        panel.dispose();
                        break;
                    case 'reject':
                        vscode.commands.executeCommand('kimi.rejectEdit');
                        panel.dispose();
                        break;
                    case 'copy':
                        vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Copied to clipboard');
                        break;
                }
            },
            undefined,
            this.disposables
        );
    }

    /**
     * Generate HTML content for diff webview
     */
    private getDiffWebviewContent(
        originalText: string,
        modifiedText: string,
        language: string
    ): string {
        const escapeHtml = (text: string): string => {
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        // Simple diff algorithm
        const diff = this.computeLineDiff(originalText, modifiedText);

        const diffHtml = diff.map((line) => {
            const escapedContent = escapeHtml(line.content);
            const lineClass = line.type === 'added' ? 'added' :
                             line.type === 'removed' ? 'removed' : 'unchanged';
            const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
            
            return `<div class="line ${lineClass}">
                <span class="line-number">${line.oldLine || ''}</span>
                <span class="line-number">${line.newLine || ''}</span>
                <span class="prefix">${prefix}</span>
                <span class="content">${escapedContent}</span>
            </div>`;
        }).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kimi Diff</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: var(--vscode-editor-font-family), 'Consolas', 'Monaco', monospace;
            font-size: var(--vscode-editor-font-size, 13px);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 0;
        }
        
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            background-color: var(--vscode-editorWidget-background);
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        
        .header h2 {
            font-size: 14px;
            font-weight: 600;
        }
        
        .actions {
            display: flex;
            gap: 8px;
        }
        
        button {
            padding: 6px 12px;
            border: none;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 500;
        }
        
        .btn-accept {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
        }
        
        .btn-accept:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .btn-reject {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }
        
        .btn-reject:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }
        
        .btn-copy {
            background-color: transparent;
            border: 1px solid var(--vscode-button-border);
            color: var(--vscode-button-foreground);
        }
        
        .diff-container {
            overflow: auto;
            padding: 16px;
        }
        
        .line {
            display: flex;
            font-family: inherit;
            white-space: pre;
            line-height: 1.5;
        }
        
        .line-number {
            width: 40px;
            text-align: right;
            padding-right: 10px;
            color: var(--vscode-editorLineNumber-foreground);
            user-select: none;
        }
        
        .prefix {
            width: 20px;
            text-align: center;
            user-select: none;
        }
        
        .content {
            flex: 1;
            padding-left: 8px;
        }
        
        .added {
            background-color: var(--vscode-diffEditor-insertedLineBackground, rgba(155, 185, 85, 0.2));
        }
        
        .added .prefix {
            color: var(--vscode-diffEditor-insertedTextForeground, #73c991);
        }
        
        .removed {
            background-color: var(--vscode-diffEditor-removedLineBackground, rgba(255, 0, 0, 0.2));
        }
        
        .removed .prefix {
            color: var(--vscode-diffEditor-removedTextForeground, #ff6b6b);
        }
        
        .unchanged {
            background-color: transparent;
        }
        
        .stats {
            padding: 8px 16px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            border-top: 1px solid var(--vscode-widget-border);
            background-color: var(--vscode-editorWidget-background);
        }
    </style>
</head>
<body>
    <div class="header">
        <h2>$(diff) Suggested Changes</h2>
        <div class="actions">
            <button class="btn-copy" onclick="copyDiff()">Copy Diff</button>
            <button class="btn-reject" onclick="rejectEdit()">Reject</button>
            <button class="btn-accept" onclick="acceptEdit()">Accept</button>
        </div>
    </div>
    
    <div class="diff-container">
        ${diffHtml}
    </div>
    
    <div class="stats" id="stats"></div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function acceptEdit() {
            vscode.postMessage({ command: 'accept' });
        }
        
        function rejectEdit() {
            vscode.postMessage({ command: 'reject' });
        }
        
        function copyDiff() {
            const diffText = \`${this.generateUnifiedDiff(originalText, modifiedText)}\`;
            vscode.postMessage({ command: 'copy', text: diffText });
        }
        
        // Calculate stats
        const addedLines = document.querySelectorAll('.added').length;
        const removedLines = document.querySelectorAll('.removed').length;
        document.getElementById('stats').textContent = 
            \`\${addedLines} lines added, \${removedLines} lines removed\`;
    </script>
</body>
</html>`;
    }

    /**
     * Simple line-based diff computation
     */
    private computeLineDiff(
        originalText: string,
        modifiedText: string
    ): Array<{
        type: 'added' | 'removed' | 'unchanged';
        content: string;
        oldLine?: number;
        newLine?: number;
    }> {
        const originalLines = originalText.split('\n');
        const modifiedLines = modifiedText.split('\n');
        
        const result: Array<{
            type: 'added' | 'removed' | 'unchanged';
            content: string;
            oldLine?: number;
            newLine?: number;
        }> = [];

        let oldLine = 1;
        let newLine = 1;

        // Simple LCS-based diff (simplified)
        const maxLen = Math.max(originalLines.length, modifiedLines.length);
        
        for (let i = 0; i < maxLen; i++) {
            const orig = originalLines[i];
            const mod = modifiedLines[i];

            if (i >= originalLines.length) {
                // Only in modified (added)
                result.push({
                    type: 'added',
                    content: mod,
                    newLine: newLine++,
                });
            } else if (i >= modifiedLines.length) {
                // Only in original (removed)
                result.push({
                    type: 'removed',
                    content: orig,
                    oldLine: oldLine++,
                });
            } else if (orig === mod) {
                // Unchanged
                result.push({
                    type: 'unchanged',
                    content: orig,
                    oldLine: oldLine++,
                    newLine: newLine++,
                });
            } else {
                // Changed - treat as remove then add
                result.push({
                    type: 'removed',
                    content: orig,
                    oldLine: oldLine++,
                });
                result.push({
                    type: 'added',
                    content: mod,
                    newLine: newLine++,
                });
            }
        }

        return result;
    }

    /**
     * Dispose all resources
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.originalContentMap.clear();
        this.modifiedContentMap.clear();
    }
}

/**
 * CodeLens provider for diff actions
 */
class DiffActionCodeLensProvider implements vscode.CodeLensProvider {
    private range: vscode.Range;
    private modifiedText: string;

    constructor(range: vscode.Range, modifiedText: string) {
        this.range = range;
        this.modifiedText = modifiedText;
    }

    provideCodeLenses(): vscode.CodeLens[] {
        const acceptLens = new vscode.CodeLens(this.range, {
            title: '$(check) Accept',
            command: 'kimi.acceptEdit',
        });

        const rejectLens = new vscode.CodeLens(this.range, {
            title: '$(x) Reject',
            command: 'kimi.rejectEdit',
        });

        return [acceptLens, rejectLens];
    }
}
