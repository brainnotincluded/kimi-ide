// @ts-nocheck
/**
 * Composer Panel
 * Multi-file editing interface like Cursor's Composer
 */

import * as vscode from 'vscode';
import * as path from 'path';

interface ComposerFile {
    uri: vscode.Uri;
    relativePath: string;
    originalContent: string;
    modifiedContent: string;
    status: 'pending' | 'generating' | 'ready' | 'applied' | 'rejected';
    language: string;
}

interface ComposerSession {
    id: string;
    prompt: string;
    files: ComposerFile[];
    status: 'idle' | 'generating' | 'reviewing' | 'applying';
    streamingContent: string;
}

export class ComposerPanel {
    private static currentPanel: ComposerPanel | undefined;
    private panel: vscode.WebviewPanel;
    private session: ComposerSession;
    private disposables: vscode.Disposable[] = [];
    private extensionUri: vscode.Uri;

    public static createOrShow(
        extensionUri: vscode.Uri,
        initialPrompt?: string,
        selectedFiles?: vscode.Uri[]
    ): ComposerPanel {
        const column = vscode.ViewColumn.Two;

        if (ComposerPanel.currentPanel) {
            ComposerPanel.currentPanel.panel.reveal(column);
            if (initialPrompt) {
                ComposerPanel.currentPanel.setPrompt(initialPrompt);
            }
            return ComposerPanel.currentPanel;
        }

        const panel = vscode.window.createWebviewPanel(
            'kimiComposer',
            'Kimi Composer',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [extensionUri],
            }
        );

        ComposerPanel.currentPanel = new ComposerPanel(panel, extensionUri, initialPrompt, selectedFiles);
        return ComposerPanel.currentPanel;
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        initialPrompt?: string,
        selectedFiles?: vscode.Uri[]
    ) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.session = {
            id: `composer-${Date.now()}`,
            prompt: initialPrompt || '',
            files: [],
            status: 'idle',
            streamingContent: '',
        };

        this.panel.webview.html = this.getHtml();
        this.setupMessageHandlers();

        // Load initial files if provided
        if (selectedFiles) {
            this.addFiles(selectedFiles);
        }

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    }

    private setupMessageHandlers(): void {
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'submitPrompt':
                        await this.handleSubmit(message.text);
                        break;
                    case 'acceptFile':
                        await this.acceptFile(message.filePath);
                        break;
                    case 'rejectFile':
                        await this.rejectFile(message.filePath);
                        break;
                    case 'acceptAll':
                        await this.acceptAll();
                        break;
                    case 'rejectAll':
                        await this.rejectAll();
                        break;
                    case 'addFiles':
                        await this.handleAddFiles();
                        break;
                    case 'removeFile':
                        await this.removeFile(message.filePath);
                        break;
                    case 'viewDiff':
                        await this.viewDiff(message.filePath);
                        break;
                }
            },
            null,
            this.disposables
        );
    }

    private async handleSubmit(prompt: string): Promise<void> {
        this.session.prompt = prompt;
        this.session.status = 'generating';
        this.updateWebview();

        // TODO: Integrate with Multi-Agent System to generate edits
        // For now, simulate the process
        
        vscode.window.showInformationMessage(`Generating edits for: ${prompt}`);
        
        // This would call the orchestrator to:
        // 1. Plan changes
        // 2. Generate edits for each file
        // 3. Stream results back
    }

    private async addFiles(uris: vscode.Uri[]): Promise<void> {
        for (const uri of uris) {
            const relativePath = vscode.workspace.asRelativePath(uri, false);
            
            // Check if already added
            if (this.session.files.some(f => f.relativePath === relativePath)) {
                continue;
            }

            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                const content = doc.getText();
                
                this.session.files.push({
                    uri,
                    relativePath,
                    originalContent: content,
                    modifiedContent: content,
                    status: 'pending',
                    language: doc.languageId,
                });
            } catch (error) {
                console.error(`Failed to load file: ${relativePath}`, error);
            }
        }

        this.updateWebview();
    }

    private async handleAddFiles(): Promise<void> {
        const files = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            openLabel: 'Add to Composer',
        });

        if (files) {
            await this.addFiles(files);
        }
    }

    private async removeFile(filePath: string): Promise<void> {
        this.session.files = this.session.files.filter(f => f.relativePath !== filePath);
        this.updateWebview();
    }

    private async acceptFile(filePath: string): Promise<void> {
        const file = this.session.files.find(f => f.relativePath === filePath);
        if (!file || file.status !== 'ready') return;

        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            new vscode.Position(0, 0),
            new vscode.Position(file.originalContent.split('\n').length, 0)
        );
        
        edit.replace(file.uri, fullRange, file.modifiedContent);
        await vscode.workspace.applyEdit(edit);
        
        file.status = 'applied';
        this.updateWebview();
    }

    private async rejectFile(filePath: string): Promise<void> {
        const file = this.session.files.find(f => f.relativePath === filePath);
        if (!file) return;

        file.modifiedContent = file.originalContent;
        file.status = 'rejected';
        this.updateWebview();
    }

    private async acceptAll(): Promise<void> {
        for (const file of this.session.files) {
            if (file.status === 'ready') {
                await this.acceptFile(file.relativePath);
            }
        }
    }

    private async rejectAll(): Promise<void> {
        for (const file of this.session.files) {
            if (file.status === 'ready') {
                await this.rejectFile(file.relativePath);
            }
        }
    }

    private async viewDiff(filePath: string): Promise<void> {
        const file = this.session.files.find(f => f.relativePath === filePath);
        if (!file) return;

        const originalUri = file.uri.with({ scheme: 'kimi-original' });
        const modifiedUri = file.uri.with({ scheme: 'kimi-modified' });

        // Register content providers temporarily
        const originalProvider = new (class implements vscode.TextDocumentContentProvider {
            provideTextDocumentContent(): string {
                return file.originalContent;
            }
        })();

        const modifiedProvider = new (class implements vscode.TextDocumentContentProvider {
            provideTextDocumentContent(): string {
                return file.modifiedContent;
            }
        })();

        const disposable1 = vscode.workspace.registerTextDocumentContentProvider('kimi-original', originalProvider);
        const disposable2 = vscode.workspace.registerTextDocumentContentProvider('kimi-modified', modifiedProvider);

        await vscode.commands.executeCommand(
            'vscode.diff',
            originalUri,
            modifiedUri,
            `${path.basename(filePath)} (Composer Diff)`,
            { preview: true }
        );

        // Clean up after a delay
        setTimeout(() => {
            disposable1.dispose();
            disposable2.dispose();
        }, 5000);
    }

    public setPrompt(prompt: string): void {
        this.session.prompt = prompt;
        this.updateWebview();
    }

    public addContextFromSelection(): void {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) return;

        const selection = editor.document.getText(editor.selection);
        const filePath = vscode.workspace.asRelativePath(editor.document.uri, false);
        
        this.session.prompt += `\n\nContext from ${filePath}:\n\`\`\`\n${selection}\n\`\`\``;
        this.updateWebview();
    }

    private updateWebview(): void {
        this.panel.webview.postMessage({
            command: 'updateState',
            state: this.session,
        });
    }

    private getHtml(): string {
        return `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Kimi Composer</title>
                <style>
                    * {
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                    }
                    
                    body {
                        font-family: var(--vscode-font-family);
                        font-size: var(--vscode-font-size);
                        color: var(--vscode-foreground);
                        background: var(--vscode-editor-background);
                        padding: 16px;
                        line-height: 1.5;
                    }
                    
                    .header {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        margin-bottom: 16px;
                        padding-bottom: 16px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                    }
                    
                    .header h1 {
                        font-size: 18px;
                        font-weight: 600;
                    }
                    
                    .status-badge {
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 12px;
                        font-weight: 500;
                    }
                    
                    .status-idle { background: var(--vscode-badge-background); }
                    .status-generating { background: var(--vscode-progressBar-background); }
                    .status-reviewing { background: var(--vscode-editorInfo-background); }
                    
                    .input-section {
                        margin-bottom: 16px;
                    }
                    
                    .prompt-input {
                        width: 100%;
                        min-height: 80px;
                        padding: 12px;
                        border: 1px solid var(--vscode-input-border);
                        border-radius: 6px;
                        background: var(--vscode-input-background);
                        color: var(--vscode-input-foreground);
                        font-family: inherit;
                        font-size: inherit;
                        resize: vertical;
                    }
                    
                    .prompt-input:focus {
                        outline: none;
                        border-color: var(--vscode-focusBorder);
                    }
                    
                    .toolbar {
                        display: flex;
                        gap: 8px;
                        margin-top: 8px;
                        flex-wrap: wrap;
                    }
                    
                    button {
                        padding: 6px 12px;
                        border: 1px solid var(--vscode-button-border);
                        border-radius: 4px;
                        background: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        cursor: pointer;
                        font-size: 13px;
                        display: flex;
                        align-items: center;
                        gap: 4px;
                    }
                    
                    button:hover {
                        background: var(--vscode-button-hoverBackground);
                    }
                    
                    button.secondary {
                        background: var(--vscode-secondaryButton-background);
                        color: var(--vscode-secondaryButton-foreground);
                    }
                    
                    button.secondary:hover {
                        background: var(--vscode-secondaryButton-hoverBackground);
                    }
                    
                    .files-section {
                        margin-top: 16px;
                    }
                    
                    .section-title {
                        font-size: 14px;
                        font-weight: 600;
                        margin-bottom: 8px;
                        color: var(--vscode-foreground);
                    }
                    
                    .file-list {
                        border: 1px solid var(--vscode-panel-border);
                        border-radius: 6px;
                        overflow: hidden;
                    }
                    
                    .file-item {
                        display: flex;
                        align-items: center;
                        padding: 10px 12px;
                        border-bottom: 1px solid var(--vscode-panel-border);
                        background: var(--vscode-list-hoverBackground);
                    }
                    
                    .file-item:last-child {
                        border-bottom: none;
                    }
                    
                    .file-icon {
                        margin-right: 8px;
                        font-size: 16px;
                    }
                    
                    .file-info {
                        flex: 1;
                        min-width: 0;
                    }
                    
                    .file-name {
                        font-weight: 500;
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    
                    .file-path {
                        font-size: 12px;
                        color: var(--vscode-descriptionForeground);
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    
                    .file-status {
                        padding: 2px 8px;
                        border-radius: 4px;
                        font-size: 11px;
                        font-weight: 500;
                        margin-right: 8px;
                    }
                    
                    .status-pending { background: var(--vscode-badge-background); }
                    .status-generating { background: var(--vscode-progressBar-background); }
                    .status-ready { background: var(--vscode-editorInfo-background); }
                    .status-applied { background: var(--vscode-testing-iconPassed); color: white; }
                    .status-rejected { background: var(--vscode-testing-iconFailed); color: white; }
                    
                    .file-actions {
                        display: flex;
                        gap: 4px;
                    }
                    
                    .file-actions button {
                        padding: 4px 8px;
                        font-size: 12px;
                    }
                    
                    .empty-state {
                        text-align: center;
                        padding: 40px 20px;
                        color: var(--vscode-descriptionForeground);
                    }
                    
                    .empty-state-icon {
                        font-size: 48px;
                        margin-bottom: 16px;
                    }
                    
                    .streaming-content {
                        margin-top: 16px;
                        padding: 12px;
                        background: var(--vscode-textBlockQuote-background);
                        border-left: 3px solid var(--vscode-textBlockQuote-border);
                        font-family: var(--vscode-editor-font-family);
                        font-size: 13px;
                        white-space: pre-wrap;
                        max-height: 300px;
                        overflow-y: auto;
                    }
                    
                    .actions-bar {
                        display: flex;
                        gap: 8px;
                        margin-top: 16px;
                        padding-top: 16px;
                        border-top: 1px solid var(--vscode-panel-border);
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>🎼 Kimi Composer</h1>
                    <span id="status-badge" class="status-badge status-idle">Idle</span>
                </div>
                
                <div class="input-section">
                    <textarea 
                        id="prompt-input" 
                        class="prompt-input" 
                        placeholder="Describe what you want to change across multiple files..."
                    ></textarea>
                    <div class="toolbar">
                        <button id="submit-btn" onclick="submitPrompt()">
                            ▶ Generate Edits
                        </button>
                        <button class="secondary" onclick="addFiles()">
                            📎 Add Files
                        </button>
                    </div>
                </div>
                
                <div id="streaming-section" class="streaming-content" style="display: none;">
                </div>
                
                <div class="files-section">
                    <div class="section-title">Files to Edit</div>
                    <div id="file-list" class="file-list">
                        <div class="empty-state">
                            <div class="empty-state-icon">📁</div>
                            <p>No files added yet</p>
                            <p style="font-size: 13px; margin-top: 8px;">Add files to include in the composition</p>
                        </div>
                    </div>
                </div>
                
                <div id="actions-bar" class="actions-bar" style="display: none;">
                    <button onclick="acceptAll()">✓ Accept All</button>
                    <button class="secondary" onclick="rejectAll()">✕ Reject All</button>
                </div>
                
                <script>
                    const vscode = acquireVsCodeApi();
                    let currentState = {
                        prompt: '',
                        files: [],
                        status: 'idle',
                        streamingContent: ''
                    };
                    
                    function submitPrompt() {
                        const input = document.getElementById('prompt-input');
                        const text = input.value.trim();
                        if (!text) return;
                        
                        vscode.postMessage({
                            command: 'submitPrompt',
                            text: text
                        });
                    }
                    
                    function addFiles() {
                        vscode.postMessage({ command: 'addFiles' });
                    }
                    
                    function removeFile(filePath) {
                        vscode.postMessage({
                            command: 'removeFile',
                            filePath: filePath
                        });
                    }
                    
                    function acceptFile(filePath) {
                        vscode.postMessage({
                            command: 'acceptFile',
                            filePath: filePath
                        });
                    }
                    
                    function rejectFile(filePath) {
                        vscode.postMessage({
                            command: 'rejectFile',
                            filePath: filePath
                        });
                    }
                    
                    function viewDiff(filePath) {
                        vscode.postMessage({
                            command: 'viewDiff',
                            filePath: filePath
                        });
                    }
                    
                    function acceptAll() {
                        vscode.postMessage({ command: 'acceptAll' });
                    }
                    
                    function rejectAll() {
                        vscode.postMessage({ command: 'rejectAll' });
                    }
                    
                    function updateUI() {
                        // Update status badge
                        const statusBadge = document.getElementById('status-badge');
                        statusBadge.className = 'status-badge status-' + currentState.status;
                        statusBadge.textContent = currentState.status.charAt(0).toUpperCase() + 
                                                  currentState.status.slice(1);
                        
                        // Update prompt input
                        const input = document.getElementById('prompt-input');
                        if (currentState.prompt && !input.value) {
                            input.value = currentState.prompt;
                        }
                        
                        // Update streaming content
                        const streamingSection = document.getElementById('streaming-section');
                        if (currentState.streamingContent) {
                            streamingSection.style.display = 'block';
                            streamingSection.textContent = currentState.streamingContent;
                        } else {
                            streamingSection.style.display = 'none';
                        }
                        
                        // Update file list
                        const fileList = document.getElementById('file-list');
                        if (currentState.files.length === 0) {
                            fileList.innerHTML = \`
                                <div class="empty-state">
                                    <div class="empty-state-icon">📁</div>
                                    <p>No files added yet</p>
                                    <p style="font-size: 13px; margin-top: 8px;">Add files to include in the composition</p>
                                </div>
                            \`;
                        } else {
                            fileList.innerHTML = currentState.files.map(file => \`
                                <div class="file-item">
                                    <span class="file-icon">📄</span>
                                    <div class="file-info">
                                        <div class="file-name">${file.relativePath.split('/').pop()}</div>
                                        <div class="file-path">${file.relativePath}</div>
                                    </div>
                                    <span class="file-status status-${file.status}">${file.status}</span>
                                    <div class="file-actions">
                                        <button onclick="viewDiff('${file.relativePath}')">Diff</button>
                                        ${file.status === 'ready' ? `
                                            <button onclick="acceptFile('${file.relativePath}')">Accept</button>
                                            <button onclick="rejectFile('${file.relativePath}')">Reject</button>
                                        ` : ''}
                                        <button class="secondary" onclick="removeFile('${file.relativePath}')">Remove</button>
                                    </div>
                                </div>
                            \`).join('');
                        }
                        
                        // Update actions bar
                        const actionsBar = document.getElementById('actions-bar');
                        const hasReadyFiles = currentState.files.some(f => f.status === 'ready');
                        actionsBar.style.display = hasReadyFiles ? 'flex' : 'none';
                    }
                    
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'updateState':
                                currentState = message.state;
                                updateUI();
                                break;
                        }
                    });
                    
                    // Initial UI update
                    updateUI();
                </script>
            </body>
            </html>
        `;
    }

    public dispose(): void {
        ComposerPanel.currentPanel = undefined;
        this.panel.dispose();
        this.disposables.forEach(d => d.dispose());
    }
}
