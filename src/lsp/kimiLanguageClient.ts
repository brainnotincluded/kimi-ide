/**
 * Kimi Language Client
 * 
 * VS Code extension side client for the Kimi Language Server.
 * Manages the connection between VS Code and the LSP server.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    InlineCompletionItem,
    InlineCompletionList,
    InlineCompletionParams,
    InlineCompletionRegistrationOptions,
    InlineCompletionTriggerKind,
} from 'vscode-languageclient/node';

export class KimiLanguageClient implements vscode.Disposable {
    private client: LanguageClient | undefined;
    private disposables: vscode.Disposable[] = [];
    private outputChannel: vscode.OutputChannel;

    constructor(private context: vscode.ExtensionContext) {
        this.outputChannel = vscode.window.createOutputChannel('Kimi LSP');
        this.disposables.push(this.outputChannel);
    }

    /**
     * Start the language client
     */
    async start(): Promise<void> {
        // Check if LSP is enabled in settings
        const config = vscode.workspace.getConfiguration('kimi');
        const enableLSP = config.get<boolean>('enableLSP', true);

        if (!enableLSP) {
            this.outputChannel.appendLine('LSP is disabled in settings');
            return;
        }

        try {
            const serverModule = this.getServerModule();
            
            // Server options
            const serverOptions: ServerOptions = {
                run: {
                    module: serverModule,
                    transport: TransportKind.ipc,
                },
                debug: {
                    module: serverModule,
                    transport: TransportKind.ipc,
                    options: {
                        execArgv: ['--nolazy', '--inspect=6009'],
                    },
                },
            };

            // Client options
            const clientOptions: LanguageClientOptions = {
                documentSelector: [
                    { scheme: 'file', language: 'typescript' },
                    { scheme: 'file', language: 'typescriptreact' },
                    { scheme: 'file', language: 'javascript' },
                    { scheme: 'file', language: 'javascriptreact' },
                    { scheme: 'file', language: 'python' },
                    { scheme: 'file', language: 'java' },
                    { scheme: 'file', language: 'go' },
                    { scheme: 'file', language: 'rust' },
                    { scheme: 'file', language: 'cpp' },
                    { scheme: 'file', language: 'c' },
                    { scheme: 'file', language: 'csharp' },
                    { scheme: 'file', language: 'ruby' },
                    { scheme: 'file', language: 'php' },
                    { scheme: 'file', language: 'swift' },
                    { scheme: 'file', language: 'kotlin' },
                    { scheme: 'file', language: 'scala' },
                    { scheme: 'file', pattern: '**/*' },
                ],
                synchronize: {
                    configurationSection: 'kimi',
                    fileEvents: [
                        vscode.workspace.createFileSystemWatcher('**/.vscode/settings.json'),
                    ],
                },
                outputChannel: this.outputChannel,
                traceOutputChannel: this.outputChannel,
                revealOutputChannelOn: 4, // Never
            };

            // Create and start client
            this.client = new LanguageClient(
                'kimiLanguageServer',
                'Kimi Language Server',
                serverOptions,
                clientOptions
            );

            // Register progress handler
            this.client.onProgress(
                { method: 'kimi' } as any,
                'kimi',
                (progress) => {
                    this.outputChannel.appendLine(`Progress: ${JSON.stringify(progress)}`);
                }
            );

            // Start client
            this.outputChannel.appendLine('Starting Kimi Language Server...');
            await this.client.start();
            this.outputChannel.appendLine('Kimi Language Server started successfully');

            // Register inline completion provider if supported
            this.registerInlineCompletionProvider();

        } catch (error) {
            this.outputChannel.appendLine(`Failed to start LSP client: ${error}`);
            vscode.window.showErrorMessage(
                `Kimi LSP failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    /**
     * Stop the language client
     */
    async stop(): Promise<void> {
        if (this.client) {
            await this.client.stop();
            this.outputChannel.appendLine('Kimi Language Server stopped');
        }
    }

    /**
     * Get the server module path
     */
    private getServerModule(): string {
        // In development, use the TypeScript file directly
        // In production, use the compiled JavaScript file
        return path.join(this.context.extensionPath, 'out', 'lsp', 'kimiLanguageServer.js');
    }

    /**
     * Register inline completion provider
     */
    private registerInlineCompletionProvider(): void {
        if (!this.client) {
            return;
        }

        // Check if client supports inline completions
        const capabilities = this.client.initializeResult?.capabilities;
        if (!(capabilities as any)?.inlineCompletionProvider) {
            this.outputChannel.appendLine('Server does not support inline completions');
            return;
        }

        // Register VS Code inline completion provider
        const provider: vscode.InlineCompletionItemProvider = {
            provideInlineCompletionItems: async (
                document: vscode.TextDocument,
                position: vscode.Position,
                context: vscode.InlineCompletionContext,
                token: vscode.CancellationToken
            ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> => {
                if (!this.client) {
                    return null;
                }

                try {
                    const params: InlineCompletionParams = {
                        textDocument: {
                            uri: document.uri.toString(),
                        },
                        position: {
                            line: position.line,
                            character: position.character,
                        },
                        context: {
                            triggerKind: context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic
                                ? InlineCompletionTriggerKind.Automatic
                                : InlineCompletionTriggerKind.Invoked,
                            selectedCompletionInfo: context.selectedCompletionInfo
                                ? {
                                    range: {
                                        start: {
                                            line: context.selectedCompletionInfo.range.start.line,
                                            character: context.selectedCompletionInfo.range.start.character,
                                        },
                                        end: {
                                            line: context.selectedCompletionInfo.range.end.line,
                                            character: context.selectedCompletionInfo.range.end.character,
                                        },
                                    },
                                    text: context.selectedCompletionInfo.text,
                                }
                                : undefined,
                        },
                    };

                    const result = await this.client.sendRequest(
                        'textDocument/inlineCompletion',
                        params,
                        token
                    ) as { items: InlineCompletionItem[] } | null;

                    if (!result || !result.items || result.items.length === 0) {
                        return null;
                    }

                    const items: vscode.InlineCompletionItem[] = result.items.map(item => {
                        const insertText = typeof item.insertText === 'string' ? item.insertText : String(item.insertText || '');
                        const inlineItem = new vscode.InlineCompletionItem(
                            insertText
                        );
                        if (item.range) {
                            inlineItem.range = new vscode.Range(
                                item.range.start.line,
                                item.range.start.character,
                                item.range.end.line,
                                item.range.end.character
                            );
                        }
                        if (item.command) {
                            inlineItem.command = {
                                command: item.command.command,
                                title: item.command.title,
                                arguments: item.command.arguments,
                            };
                        }
                        return inlineItem;
                    });

                    return items;

                } catch (error) {
                    this.outputChannel.appendLine(`Inline completion error: ${error}`);
                    return null;
                }
            },
        };

        const disposable = vscode.languages.registerInlineCompletionItemProvider(
            { pattern: '**/*' },
            provider
        );

        this.disposables.push(disposable);
        this.outputChannel.appendLine('Inline completion provider registered');
    }

    /**
     * Send custom notification to server
     */
    async sendNotification(method: string, params?: any): Promise<void> {
        if (this.client) {
            await this.client.sendNotification(method, params);
        }
    }

    /**
     * Send custom request to server
     */
    async sendRequest<R>(method: string, params?: any): Promise<R | null> {
        if (this.client) {
            return await this.client.sendRequest(method, params) as R;
        }
        return null;
    }

    /**
     * Check if client is running
     */
    isRunning(): boolean {
        return this.client?.isRunning() ?? false;
    }

    /**
     * Dispose all resources
     */
    dispose(): void {
        this.stop();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
