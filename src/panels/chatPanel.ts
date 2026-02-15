import * as vscode from 'vscode';
import { MessageRenderer } from './messageRenderer';

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    status?: 'sending' | 'thinking' | 'tool_executing' | 'complete' | 'error';
    toolCalls?: ToolCall[];
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
    result?: any;
    status: 'pending' | 'running' | 'complete' | 'error';
}

export class ChatPanel {
    public static currentPanel: ChatPanel | undefined;
    private static readonly viewType = 'kimiChat';
    
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _messages: ChatMessage[] = [];
    private _messageRenderer: MessageRenderer;
    private _onDidSendMessage: (message: string) => void;
    private _onDidRequestToolAction: (toolCallId: string, action: string) => void;

    public static createOrShow(
        extensionUri: vscode.Uri,
        onDidSendMessage: (message: string) => void,
        onDidRequestToolAction?: (toolCallId: string, action: string) => void
    ): ChatPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (ChatPanel.currentPanel) {
            ChatPanel.currentPanel._panel.reveal(column);
            return ChatPanel.currentPanel;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            ChatPanel.viewType,
            'Kimi Chat',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
            }
        );

        ChatPanel.currentPanel = new ChatPanel(panel, extensionUri, onDidSendMessage, onDidRequestToolAction);
        return ChatPanel.currentPanel;
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        onDidSendMessage: (message: string) => void,
        onDidRequestToolAction?: (toolCallId: string, action: string) => void
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._onDidSendMessage = onDidSendMessage;
        this._onDidRequestToolAction = onDidRequestToolAction || (() => {});
        this._messageRenderer = new MessageRenderer();

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'sendMessage':
                        this._onDidSendMessage(message.text);
                        break;
                    case 'copyToClipboard':
                        await vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Copied to clipboard');
                        break;
                    case 'insertAtCursor':
                        const editor = vscode.window.activeTextEditor;
                        if (editor) {
                            editor.edit(editBuilder => {
                                editBuilder.insert(editor.selection.active, message.text);
                            });
                        }
                        break;
                    case 'createNewFile':
                        const document = await vscode.workspace.openTextDocument({
                            content: message.text,
                            language: message.language || 'plaintext'
                        });
                        await vscode.window.showTextDocument(document);
                        break;
                    case 'toolAction':
                        this._onDidRequestToolAction(message.toolCallId, message.action);
                        break;
                    case 'clearChat':
                        this.clearMessages();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public postMessage(message: any): void {
        this._panel.webview.postMessage(message);
    }

    public addMessage(message: ChatMessage): void {
        this._messages.push(message);
        this._panel.webview.postMessage({
            command: 'addMessage',
            message: this._serializeMessage(message)
        });
    }

    public updateMessage(messageId: string, updates: Partial<ChatMessage>): void {
        const messageIndex = this._messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
            this._messages[messageIndex] = { ...this._messages[messageIndex], ...updates };
            this._panel.webview.postMessage({
                command: 'updateMessage',
                messageId,
                updates: this._serializeMessageUpdates(updates)
            });
        }
    }

    public clearMessages(): void {
        this._messages = [];
        this._panel.webview.postMessage({
            command: 'clearMessages'
        });
    }

    public setStatus(status: string): void {
        this._panel.webview.postMessage({
            command: 'setStatus',
            status
        });
    }

    public dispose(): void {
        ChatPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _serializeMessage(message: ChatMessage): any {
        return {
            ...message,
            renderedContent: this._messageRenderer.render(message.content)
        };
    }

    private _serializeMessageUpdates(updates: Partial<ChatMessage>): any {
        const result: any = { ...updates };
        if (updates.content) {
            result.renderedContent = this._messageRenderer.render(updates.content);
        }
        return result;
    }

    private _update(): void {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kimi Chat</title>
    <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/javascript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/typescript.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/python.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/rust.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/go.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/java.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/c.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/cpp.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/bash.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/json.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/xml.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/css.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/sql.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/yaml.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/dockerfile.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        :root {
            --bg-primary: #0d1117;
            --bg-secondary: #161b22;
            --bg-tertiary: #21262d;
            --bg-hover: #30363d;
            --border-color: #30363d;
            --text-primary: #c9d1d9;
            --text-secondary: #8b949e;
            --text-muted: #6e7681;
            --accent-color: #58a6ff;
            --accent-hover: #79c0ff;
            --user-bg: #1f6feb;
            --user-text: #ffffff;
            --assistant-bg: #21262d;
            --code-bg: #161b22;
            --success-color: #238636;
            --warning-color: #f85149;
            --tool-bg: #388bfd1a;
            --tool-border: #388bfd;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        /* Header */
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background-color: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
        }

        .header-title {
            font-size: 14px;
            font-weight: 600;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .header-icon {
            width: 20px;
            height: 20px;
            background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
            border-radius: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }

        .header-actions {
            display: flex;
            gap: 8px;
        }

        .icon-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 6px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
        }

        .icon-btn:hover {
            background-color: var(--bg-hover);
            color: var(--text-primary);
        }

        /* Messages Container */
        .messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px 16px;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }

        .messages-container::-webkit-scrollbar {
            width: 8px;
        }

        .messages-container::-webkit-scrollbar-track {
            background: transparent;
        }

        .messages-container::-webkit-scrollbar-thumb {
            background-color: var(--bg-hover);
            border-radius: 4px;
        }

        /* Message */
        .message {
            display: flex;
            gap: 12px;
            animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        .message-avatar {
            width: 28px;
            height: 28px;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            flex-shrink: 0;
        }

        .message.user .message-avatar {
            background-color: var(--user-bg);
            color: var(--user-text);
        }

        .message.assistant .message-avatar {
            background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
            color: white;
        }

        .message-content-wrapper {
            flex: 1;
            min-width: 0;
        }

        .message-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }

        .message-author {
            font-size: 13px;
            font-weight: 600;
            color: var(--text-primary);
        }

        .message-time {
            font-size: 11px;
            color: var(--text-muted);
        }

        .message-content {
            font-size: 14px;
            line-height: 1.6;
            color: var(--text-primary);
            word-wrap: break-word;
        }

        .message.user .message-content {
            background-color: var(--user-bg);
            color: var(--user-text);
            padding: 10px 14px;
            border-radius: 12px;
            border-bottom-right-radius: 4px;
            display: inline-block;
            max-width: 85%;
        }

        .message.assistant .message-content {
            background-color: transparent;
            padding: 0;
        }

        /* Status Indicator */
        .status-indicator {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background-color: var(--bg-tertiary);
            border-radius: 8px;
            margin-top: 8px;
            font-size: 12px;
            color: var(--text-secondary);
        }

        .status-indicator.thinking {
            color: var(--accent-color);
        }

        .status-indicator.tool-executing {
            color: var(--warning-color);
        }

        .spinner {
            width: 14px;
            height: 14px;
            border: 2px solid var(--text-muted);
            border-top-color: var(--accent-color);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
            to {
                transform: rotate(360deg);
            }
        }

        .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 12px 0;
        }

        .typing-dot {
            width: 6px;
            height: 6px;
            background-color: var(--text-muted);
            border-radius: 50%;
            animation: typing 1.4s infinite;
        }

        .typing-dot:nth-child(2) {
            animation-delay: 0.2s;
        }

        .typing-dot:nth-child(3) {
            animation-delay: 0.4s;
        }

        @keyframes typing {
            0%, 60%, 100% {
                transform: translateY(0);
            }
            30% {
                transform: translateY(-4px);
            }
        }

        /* Tool Calls */
        .tool-call {
            background-color: var(--tool-bg);
            border: 1px solid var(--tool-border);
            border-radius: 8px;
            margin-top: 12px;
            overflow: hidden;
        }

        .tool-call-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 12px;
            background-color: rgba(56, 139, 253, 0.1);
            cursor: pointer;
        }

        .tool-call-title {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 12px;
            font-weight: 600;
            color: var(--accent-color);
        }

        .tool-call-status {
            font-size: 11px;
            padding: 2px 8px;
            border-radius: 12px;
            background-color: var(--bg-tertiary);
        }

        .tool-call-status.pending {
            color: var(--text-muted);
        }

        .tool-call-status.running {
            color: var(--accent-color);
        }

        .tool-call-status.complete {
            color: var(--success-color);
        }

        .tool-call-status.error {
            color: var(--warning-color);
        }

        .tool-call-content {
            padding: 12px;
            font-size: 12px;
            display: none;
        }

        .tool-call.expanded .tool-call-content {
            display: block;
        }

        .tool-call.expanded .chevron {
            transform: rotate(180deg);
        }

        .chevron {
            transition: transform 0.2s;
        }

        .tool-arguments {
            background-color: var(--code-bg);
            padding: 10px;
            border-radius: 6px;
            margin-bottom: 10px;
            font-family: 'SF Mono', Monaco, Consolas, monospace;
            overflow-x: auto;
        }

        .tool-result {
            border-top: 1px solid var(--border-color);
            padding-top: 10px;
            margin-top: 10px;
        }

        .tool-result-label {
            font-size: 11px;
            color: var(--text-muted);
            margin-bottom: 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Code Blocks */
        .code-block-wrapper {
            margin: 12px 0;
            border-radius: 8px;
            overflow: hidden;
            background-color: var(--code-bg);
            border: 1px solid var(--border-color);
        }

        .code-block-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 12px;
            background-color: var(--bg-tertiary);
            border-bottom: 1px solid var(--border-color);
        }

        .code-language {
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
            font-weight: 600;
        }

        .code-actions {
            display: flex;
            gap: 4px;
        }

        .code-action-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: all 0.2s;
        }

        .code-action-btn:hover {
            background-color: var(--bg-hover);
            color: var(--text-primary);
        }

        pre {
            margin: 0;
            padding: 16px;
            overflow-x: auto;
            background-color: var(--code-bg);
        }

        pre code {
            font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', monospace;
            font-size: 13px;
            line-height: 1.5;
            background: transparent;
            padding: 0;
        }

        code {
            font-family: 'SF Mono', Monaco, Consolas, 'Liberation Mono', monospace;
            font-size: 13px;
            background-color: var(--bg-tertiary);
            padding: 2px 6px;
            border-radius: 4px;
            color: var(--accent-hover);
        }

        pre code {
            background: transparent;
            padding: 0;
            color: inherit;
        }

        /* Inline code in user messages */
        .message.user code {
            background-color: rgba(255, 255, 255, 0.2);
            color: var(--user-text);
        }

        /* Input Area */
        .input-container {
            padding: 16px;
            background-color: var(--bg-secondary);
            border-top: 1px solid var(--border-color);
        }

        .input-wrapper {
            display: flex;
            gap: 12px;
            align-items: flex-end;
            background-color: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 12px 16px;
            transition: border-color 0.2s;
        }

        .input-wrapper:focus-within {
            border-color: var(--accent-color);
        }

        .input-field {
            flex: 1;
            background: transparent;
            border: none;
            color: var(--text-primary);
            font-size: 14px;
            line-height: 1.5;
            resize: none;
            outline: none;
            max-height: 200px;
            min-height: 20px;
            font-family: inherit;
        }

        .input-field::placeholder {
            color: var(--text-muted);
        }

        .send-btn {
            background-color: var(--user-bg);
            color: white;
            border: none;
            width: 32px;
            height: 32px;
            border-radius: 8px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            flex-shrink: 0;
        }

        .send-btn:hover:not(:disabled) {
            background-color: var(--accent-hover);
        }

        .send-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .input-hint {
            text-align: center;
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 8px;
        }

        kbd {
            background-color: var(--bg-tertiary);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: inherit;
            font-size: 10px;
        }

        /* Empty State */
        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: var(--text-secondary);
            text-align: center;
            padding: 40px;
        }

        .empty-state-icon {
            width: 64px;
            height: 64px;
            background: linear-gradient(135deg, var(--accent-color), var(--accent-hover));
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            margin-bottom: 20px;
        }

        .empty-state-title {
            font-size: 18px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 8px;
        }

        .empty-state-subtitle {
            font-size: 14px;
            max-width: 300px;
        }

        /* Markdown Styles */
        .message-content h1,
        .message-content h2,
        .message-content h3,
        .message-content h4 {
            margin: 16px 0 12px;
            font-weight: 600;
            line-height: 1.3;
        }

        .message-content h1 {
            font-size: 20px;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 8px;
        }

        .message-content h2 {
            font-size: 18px;
        }

        .message-content h3 {
            font-size: 16px;
        }

        .message-content p {
            margin: 8px 0;
        }

        .message-content ul,
        .message-content ol {
            margin: 8px 0;
            padding-left: 24px;
        }

        .message-content li {
            margin: 4px 0;
        }

        .message-content blockquote {
            margin: 12px 0;
            padding: 8px 16px;
            border-left: 3px solid var(--accent-color);
            background-color: var(--bg-tertiary);
            border-radius: 0 8px 8px 0;
            color: var(--text-secondary);
        }

        .message-content a {
            color: var(--accent-color);
            text-decoration: none;
        }

        .message-content a:hover {
            text-decoration: underline;
        }

        .message-content table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0;
            font-size: 13px;
        }

        .message-content th,
        .message-content td {
            padding: 8px 12px;
            border: 1px solid var(--border-color);
            text-align: left;
        }

        .message-content th {
            background-color: var(--bg-tertiary);
            font-weight: 600;
        }

        .message-content tr:nth-child(even) {
            background-color: var(--bg-secondary);
        }

        .message-content hr {
            border: none;
            border-top: 1px solid var(--border-color);
            margin: 16px 0;
        }

        /* Error Message */
        .error-message {
            background-color: rgba(248, 81, 73, 0.1);
            border: 1px solid var(--warning-color);
            border-radius: 8px;
            padding: 12px;
            margin-top: 8px;
            font-size: 13px;
            color: var(--warning-color);
        }

        /* Scroll to bottom button */
        .scroll-bottom-btn {
            position: fixed;
            bottom: 100px;
            right: 24px;
            width: 36px;
            height: 36px;
            background-color: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            border-radius: 50%;
            color: var(--text-secondary);
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            visibility: hidden;
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .scroll-bottom-btn.visible {
            opacity: 1;
            visibility: visible;
        }

        .scroll-bottom-btn:hover {
            background-color: var(--bg-hover);
            color: var(--text-primary);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="header-title">
            <div class="header-icon">K</div>
            <span>Kimi Chat</span>
        </div>
        <div class="header-actions">
            <button class="icon-btn" id="clearBtn" title="Clear Chat">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11 1.75V3h2.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75ZM4.496 6.675a.75.75 0 1 0-1.492.15l.66 6.6A1.75 1.75 0 0 0 5.405 15h5.188c.9 0 1.652-.68 1.741-1.575l.66-6.6a.75.75 0 0 0-1.492-.149l-.66 6.6a.25.25 0 0 1-.249.225H5.405a.25.25 0 0 1-.249-.225l-.66-6.6Z"/>
                </svg>
            </button>
        </div>
    </div>

    <div class="messages-container" id="messagesContainer">
        <div class="empty-state" id="emptyState">
            <div class="empty-state-icon">🤖</div>
            <div class="empty-state-title">Welcome to Kimi Chat</div>
            <div class="empty-state-subtitle">Start a conversation with Kimi AI. Ask questions, get code help, or discuss your ideas.</div>
        </div>
    </div>

    <button class="scroll-bottom-btn" id="scrollBottomBtn" title="Scroll to bottom">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 12.5a.75.75 0 0 1-.53-.22l-4-4a.75.75 0 1 1 1.06-1.06L8 10.44l3.47-3.47a.75.75 0 0 1 1.06 1.06l-4 4a.75.75 0 0 1-.53.22Z"/>
            <path d="M8 8.5a.75.75 0 0 1-.53-.22l-4-4a.75.75 0 1 1 1.06-1.06L8 6.44l3.47-3.47a.75.75 0 0 1 1.06 1.06l-4 4a.75.75 0 0 1-.53.22Z" opacity="0.5"/>
        </svg>
    </button>

    <div class="input-container">
        <div class="input-wrapper">
            <textarea 
                class="input-field" 
                id="messageInput" 
                placeholder="Ask Kimi anything..."
                rows="1"
            ></textarea>
            <button class="send-btn" id="sendBtn" disabled>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1.724 1.053a.75.75 0 0 0-1.036 1.006l3.857 9.75a.75.75 0 0 0 1.152.277l3.366-2.473 2.473-3.366a.75.75 0 0 0-.277-1.152L1.724 1.053ZM4.25 10.5 2.18 5.807l9.993 4.947-4.947-9.993L12.5 2.18V4.75a.75.75 0 0 0 1.5 0V1.5a.75.75 0 0 0-.75-.75H9.25a.75.75 0 0 0 0 1.5h2.57L4.25 10.5Z"/>
                </svg>
            </button>
        </div>
        <div class="input-hint">
            <kbd>Shift</kbd> + <kbd>Enter</kbd> for new line • <kbd>Enter</kbd> to send
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const messagesContainer = document.getElementById('messagesContainer');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const clearBtn = document.getElementById('clearBtn');
        const emptyState = document.getElementById('emptyState');
        const scrollBottomBtn = document.getElementById('scrollBottomBtn');

        let messages = [];
        let autoScroll = true;

        // Configure marked
        marked.setOptions({
            breaks: true,
            gfm: true
        });

        // Auto-resize textarea
        messageInput.addEventListener('input', () => {
            sendBtn.disabled = messageInput.value.trim() === '';
            messageInput.style.height = 'auto';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 200) + 'px';
        });

        // Send message
        function sendMessage() {
            const text = messageInput.value.trim();
            if (text) {
                vscode.postMessage({
                    command: 'sendMessage',
                    text: text
                });
                messageInput.value = '';
                messageInput.style.height = 'auto';
                sendBtn.disabled = true;
            }
        }

        sendBtn.addEventListener('click', sendMessage);

        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Clear chat
        clearBtn.addEventListener('click', () => {
            vscode.postMessage({ command: 'clearChat' });
        });

        // Scroll handling
        messagesContainer.addEventListener('scroll', () => {
            const isAtBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 50;
            autoScroll = isAtBottom;
            scrollBottomBtn.classList.toggle('visible', !isAtBottom);
        });

        scrollBottomBtn.addEventListener('click', () => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            autoScroll = true;
        });

        function scrollToBottom() {
            if (autoScroll) {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }
        }

        // Create message element
        function createMessageElement(message) {
            const messageEl = document.createElement('div');
            messageEl.className = \`message \${message.role}\`;
            messageEl.id = \`message-\${message.id}\`;

            const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            let contentHtml = message.renderedContent || marked.parse(message.content);

            // Process code blocks
            contentHtml = contentHtml.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
                const decodedCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
                return createCodeBlock(lang, decodedCode);
            });

            // Add status indicator if needed
            let statusHtml = '';
            if (message.status === 'thinking') {
                statusHtml = \`
                    <div class="status-indicator thinking">
                        <div class="spinner"></div>
                        <span>Thinking...</span>
                    </div>
                \`;
            } else if (message.status === 'tool_executing') {
                statusHtml = \`
                    <div class="status-indicator tool-executing">
                        <div class="spinner"></div>
                        <span>Executing tools...</span>
                    </div>
                \`;
            }

            // Add tool calls if present
            let toolCallsHtml = '';
            if (message.toolCalls && message.toolCalls.length > 0) {
                toolCallsHtml = message.toolCalls.map(tc => createToolCallElement(tc)).join('');
            }

            messageEl.innerHTML = \`
                <div class="message-avatar">\${message.role === 'user' ? 'U' : 'K'}</div>
                <div class="message-content-wrapper">
                    <div class="message-header">
                        <span class="message-author">\${message.role === 'user' ? 'You' : 'Kimi'}</span>
                        <span class="message-time">\${time}</span>
                    </div>
                    <div class="message-content">\${contentHtml}</div>
                    \${statusHtml}
                    \${toolCallsHtml}
                </div>
            \`;

            // Add event listeners for code actions
            messageEl.querySelectorAll('.code-action-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const action = e.currentTarget.dataset.action;
                    const code = e.currentTarget.closest('.code-block-wrapper').querySelector('code').textContent;
                    const language = e.currentTarget.closest('.code-block-wrapper').querySelector('.code-language').textContent;
                    
                    if (action === 'copy') {
                        vscode.postMessage({ command: 'copyToClipboard', text: code });
                    } else if (action === 'insert') {
                        vscode.postMessage({ command: 'insertAtCursor', text: code });
                    } else if (action === 'createFile') {
                        vscode.postMessage({ command: 'createNewFile', text: code, language });
                    }
                });
            });

            // Add event listeners for tool calls
            messageEl.querySelectorAll('.tool-call-header').forEach(header => {
                header.addEventListener('click', () => {
                    header.closest('.tool-call').classList.toggle('expanded');
                });
            });

            return messageEl;
        }

        function createCodeBlock(language, code) {
            const highlightedCode = hljs.highlightAuto(code, language ? [language] : undefined).value;
            return \`
                <div class="code-block-wrapper">
                    <div class="code-block-header">
                        <span class="code-language">\${language || 'text'}</span>
                        <div class="code-actions">
                            <button class="code-action-btn" data-action="copy" title="Copy">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/>
                                    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/>
                                </svg>
                                Copy
                            </button>
                            <button class="code-action-btn" data-action="insert" title="Insert at cursor">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M8.75 6.5a.75.75 0 0 0-1.5 0v1.75H5.5a.75.75 0 0 0 0 1.5h1.75v1.75a.75.75 0 0 0 1.5 0V9.75h1.75a.75.75 0 0 0 0-1.5H8.75Z"/>
                                    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z"/>
                                </svg>
                                Insert
                            </button>
                            <button class="code-action-btn" data-action="createFile" title="Create new file">
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                    <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 14.25 16h-9.5A1.75 1.75 0 0 1 3 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V4.664a.25.25 0 0 0-.073-.177l-2.914-2.914a.25.25 0 0 0-.177-.073Z"/>
                                </svg>
                                New File
                            </button>
                        </div>
                    </div>
                    <pre><code class="language-\${language}">\${highlightedCode}</code></pre>
                </div>
            \`;
        }

        function createToolCallElement(toolCall) {
            const argsHtml = JSON.stringify(toolCall.arguments, null, 2);
            const resultHtml = toolCall.result ? JSON.stringify(toolCall.result, null, 2) : '';
            
            return \`
                <div class="tool-call" id="tool-\${toolCall.id}">
                    <div class="tool-call-header">
                        <div class="tool-call-title">
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM2.5 8a5.5 5.5 0 1 0 11 0 5.5 5.5 0 0 0-11 0Zm3-2a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm4 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm-4 4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm4 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/>
                            </svg>
                            \${toolCall.name}
                        </div>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="tool-call-status \${toolCall.status}">\${toolCall.status}</span>
                            <svg class="chevron" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                                <path d="M12.78 5.22a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L3.22 6.28a.75.75 0 0 1 1.06-1.06L8 8.94l3.72-3.72a.75.75 0 0 1 1.06 0Z"/>
                            </svg>
                        </div>
                    </div>
                    <div class="tool-call-content">
                        <div class="tool-arguments">\${argsHtml}</div>
                        \${resultHtml ? \`
                            <div class="tool-result">
                                <div class="tool-result-label">Result</div>
                                <div class="tool-arguments">\${resultHtml}</div>
                            </div>
                        \` : ''}
                    </div>
                </div>
            \`;
        }

        function updateMessage(messageId, updates) {
            const messageEl = document.getElementById(\`message-\${messageId}\`);
            if (!messageEl) return;

            if (updates.content !== undefined || updates.renderedContent !== undefined) {
                const contentEl = messageEl.querySelector('.message-content');
                let contentHtml = updates.renderedContent || marked.parse(updates.content);
                contentHtml = contentHtml.replace(/<pre><code class="language-(\w+)">([\s\S]*?)<\/code><\/pre>/g, (match, lang, code) => {
                    const decodedCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
                    return createCodeBlock(lang, decodedCode);
                });
                contentEl.innerHTML = contentHtml;

                // Re-attach event listeners
                messageEl.querySelectorAll('.code-action-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const action = e.currentTarget.dataset.action;
                        const code = e.currentTarget.closest('.code-block-wrapper').querySelector('code').textContent;
                        const language = e.currentTarget.closest('.code-block-wrapper').querySelector('.code-language').textContent;
                        
                        if (action === 'copy') {
                            vscode.postMessage({ command: 'copyToClipboard', text: code });
                        } else if (action === 'insert') {
                            vscode.postMessage({ command: 'insertAtCursor', text: code });
                        } else if (action === 'createFile') {
                            vscode.postMessage({ command: 'createNewFile', text: code, language });
                        }
                    });
                });
            }

            if (updates.status !== undefined) {
                const existingStatus = messageEl.querySelector('.status-indicator');
                if (existingStatus) {
                    existingStatus.remove();
                }

                if (updates.status === 'thinking' || updates.status === 'tool_executing') {
                    const wrapper = messageEl.querySelector('.message-content-wrapper');
                    const statusHtml = updates.status === 'thinking' ? \`
                        <div class="status-indicator thinking">
                            <div class="spinner"></div>
                            <span>Thinking...</span>
                        </div>
                    \` : \`
                        <div class="status-indicator tool-executing">
                            <div class="spinner"></div>
                            <span>Executing tools...</span>
                        </div>
                    \`;
                    wrapper.insertAdjacentHTML('beforeend', statusHtml);
                }
            }

            if (updates.toolCalls !== undefined) {
                // Remove existing tool calls
                messageEl.querySelectorAll('.tool-call').forEach(tc => tc.remove());
                
                // Add new tool calls
                if (updates.toolCalls.length > 0) {
                    const wrapper = messageEl.querySelector('.message-content-wrapper');
                    const toolCallsHtml = updates.toolCalls.map(tc => createToolCallElement(tc)).join('');
                    wrapper.insertAdjacentHTML('beforeend', toolCallsHtml);

                    // Re-attach event listeners
                    messageEl.querySelectorAll('.tool-call-header').forEach(header => {
                        header.addEventListener('click', () => {
                            header.closest('.tool-call').classList.toggle('expanded');
                        });
                    });
                }
            }
        }

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;

            switch (message.command) {
                case 'addMessage':
                    if (emptyState) {
                        emptyState.remove();
                    }
                    const msgEl = createMessageElement(message.message);
                    messagesContainer.appendChild(msgEl);
                    messages.push(message.message);
                    scrollToBottom();
                    break;

                case 'updateMessage':
                    updateMessage(message.messageId, message.updates);
                    scrollToBottom();
                    break;

                case 'clearMessages':
                    messagesContainer.innerHTML = \`
                        <div class="empty-state" id="emptyState">
                            <div class="empty-state-icon">🤖</div>
                            <div class="empty-state-title">Welcome to Kimi Chat</div>
                            <div class="empty-state-subtitle">Start a conversation with Kimi AI. Ask questions, get code help, or discuss your ideas.</div>
                        </div>
                    \`;
                    messages = [];
                    break;

                case 'setStatus':
                    // Handle global status updates if needed
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
