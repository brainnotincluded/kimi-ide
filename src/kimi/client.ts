import * as vscode from 'vscode';
import * as rpc from 'vscode-jsonrpc';
import { spawn, ChildProcess } from 'child_process';

/**
 * JSON-RPC клиент для взаимодействия с kimi-code-cli
 * через Wire Protocol (JSON-RPC over stdio)
 */
export class KimiClient implements vscode.Disposable {
    private childProcess?: ChildProcess;
    private connection?: rpc.MessageConnection;
    private isConnected = false;
    private readonly cliPath: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('kimi');
        this.cliPath = config.get<string>('cliPath', 'kimi');
    }

    /**
     * Подключение к kimi-code-cli
     */
    async connect(): Promise<void> {
        if (this.isConnected) {
            return;
        }

        try {
            // Запуск CLI с wire protocol
            this.childProcess = spawn(this.cliPath, ['--wire'], {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Создание JSON-RPC соединения
            this.connection = rpc.createMessageConnection(
                new (rpc as any).StreamMessageReader(this.childProcess.stdout!),
                new (rpc as any).StreamMessageWriter(this.childProcess.stdin!)
            );

            // Обработка ошибок
            this.connection.onError((error: any) => {
                console.error('Kimi RPC error:', error);
                vscode.window.showErrorMessage(`Kimi RPC error: ${error}`);
            });

            this.connection.onClose(() => {
                this.isConnected = false;
                console.log('Kimi connection closed');
            });

            // Регистрация методов уведомлений от CLI
            this.connection.onNotification('kimi/response', (params) => {
                this.handleResponse(params);
            });

            this.connection.listen();
            this.isConnected = true;

            console.log('Kimi client connected successfully');
        } catch (error) {
            throw new Error(`Failed to connect to Kimi CLI: ${error}`);
        }
    }

    /**
     * Отправка запроса к CLI
     */
    async sendRequest(method: string, params: any): Promise<any> {
        if (!this.connection || !this.isConnected) {
            await this.connect();
        }

        return this.connection!.sendRequest(method, params);
    }

    /**
     * Отправка уведомления к CLI
     */
    async sendNotification(method: string, params?: any): Promise<void> {
        if (!this.connection || !this.isConnected) {
            await this.connect();
        }

        await this.connection!.sendNotification(method, params);
    }

    /**
     * Обработка ответов от CLI
     */
    private handleResponse(params: any): void {
        // TODO: Реализовать обработку потоковых ответов
        console.log('Received response:', params);
    }

    /**
     * Отправка сообщения в чат
     */
    async sendMessage(message: string, context?: any[]): Promise<void> {
        await this.sendNotification('kimi/chat', {
            message,
            context: context || []
        });
    }

    /**
     * Запрос inline редактирования
     */
    async inlineEdit(code: string, instruction: string): Promise<string> {
        return this.sendRequest('kimi/inlineEdit', {
            code,
            instruction
        });
    }

    /**
     * Объяснение кода
     */
    async explainCode(code: string, language?: string): Promise<string> {
        return this.sendRequest('kimi/explain', {
            code,
            language
        });
    }

    /**
     * Исправление кода
     */
    async fixCode(code: string, error?: string): Promise<string> {
        return this.sendRequest('kimi/fix', {
            code,
            error
        });
    }

    /**
     * Генерация кода
     */
    async generateCode(prompt: string, language?: string): Promise<string> {
        return this.sendRequest('kimi/generate', {
            prompt,
            language
        });
    }

    /**
     * Обработка действия с tool call
     */
    async handleToolAction(toolCallId: string, action: string): Promise<void> {
        await this.sendNotification('kimi/toolAction', {
            toolCallId,
            action
        });
    }

    dispose(): void {
        if (this.connection) {
            this.connection.dispose();
        }
        if (this.childProcess) {
            this.childProcess.kill();
        }
        this.isConnected = false;
    }
}
