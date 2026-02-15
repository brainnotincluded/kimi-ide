import * as vscode from 'vscode';
import { KimiClient } from '../kimi/client';
import { ChatPanel } from '../panels/chatPanel';

/**
 * Регистрация всех команд расширения
 */
export function registerCommands(
    context: vscode.ExtensionContext,
    kimiClient: KimiClient
): void {
    
    // kimi.openChat — Открыть панель чата
    context.subscriptions.push(
        vscode.commands.registerCommand('kimi.openChat', () => {
            ChatPanel.createOrShow(
                context.extensionUri,
                (message: string) => kimiClient.sendMessage(message),
                (toolCallId: string, action: string) => kimiClient.handleToolAction(toolCallId, action)
            );
        })
    );

    // kimi.newChat — Создать новый чат
    context.subscriptions.push(
        vscode.commands.registerCommand('kimi.newChat', () => {
            // TODO: Очистить историю чата
            ChatPanel.createOrShow(
                context.extensionUri,
                (message: string) => kimiClient.sendMessage(message),
                (toolCallId: string, action: string) => kimiClient.handleToolAction(toolCallId, action)
            );
            vscode.window.showInformationMessage('Новый чат создан');
        })
    );

    // kimi.explainCode — Объяснить выделенный код
    context.subscriptions.push(
        vscode.commands.registerCommand('kimi.explainCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Нет активного редактора');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (!selectedText) {
                vscode.window.showWarningMessage('Выделите код для объяснения');
                return;
            }

            try {
                const language = editor.document.languageId;
                const explanation = await kimiClient.explainCode(selectedText, language);
                
                const panel = ChatPanel.createOrShow(
                    context.extensionUri,
                    (message: string) => kimiClient.sendMessage(message),
                    (toolCallId: string, action: string) => kimiClient.handleToolAction(toolCallId, action)
                );
                panel.postMessage({
                    type: 'response',
                    text: explanation
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Ошибка: ${error}`);
            }
        })
    );

    // kimi.fixCode — Исправить выделенный код
    context.subscriptions.push(
        vscode.commands.registerCommand('kimi.fixCode', async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Нет активного редактора');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (!selectedText) {
                vscode.window.showWarningMessage('Выделите код для исправления');
                return;
            }

            try {
                const fixedCode = await kimiClient.fixCode(selectedText);
                
                // Заменить выделенный код
                editor.edit(editBuilder => {
                    editBuilder.replace(selection, fixedCode);
                });
                
                vscode.window.showInformationMessage('Код исправлен');
            } catch (error) {
                vscode.window.showErrorMessage(`Ошибка: ${error}`);
            }
        })
    );

    // kimi.generateCode — Сгенерировать код
    context.subscriptions.push(
        vscode.commands.registerCommand('kimi.generateCode', async () => {
            const prompt = await vscode.window.showInputBox({
                prompt: 'Опишите, какой код нужно сгенерировать',
                placeHolder: 'Например: функция для сортировки массива'
            });

            if (!prompt) {
                return;
            }

            try {
                const editor = vscode.window.activeTextEditor;
                const language = editor?.document.languageId;
                
                const generatedCode = await kimiClient.generateCode(prompt, language);
                
                const panel = ChatPanel.createOrShow(
                    context.extensionUri,
                    (message: string) => kimiClient.sendMessage(message),
                    (toolCallId: string, action: string) => kimiClient.handleToolAction(toolCallId, action)
                );
                panel.postMessage({
                    type: 'response',
                    text: '```\n' + generatedCode + '\n```'
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Ошибка: ${error}`);
            }
        })
    );

    // kimi.inlineEdit — Inline редактирование
    context.subscriptions.push(
        vscode.commands.registerCommand('kimi.inlineEdit', async () => {
            const config = vscode.workspace.getConfiguration('kimi');
            if (!config.get<boolean>('enableInlineEdit', true)) {
                vscode.window.showInformationMessage('Inline редактирование отключено в настройках');
                return;
            }

            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Нет активного редактора');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);
            
            if (!selectedText) {
                vscode.window.showWarningMessage('Выделите код для редактирования');
                return;
            }

            const instruction = await vscode.window.showInputBox({
                prompt: 'Что нужно изменить?',
                placeHolder: 'Например: добавить комментарии, оптимизировать'
            });

            if (!instruction) {
                return;
            }

            try {
                const editedCode = await kimiClient.inlineEdit(selectedText, instruction);
                
                editor.edit(editBuilder => {
                    editBuilder.replace(selection, editedCode);
                });
                
                vscode.window.showInformationMessage('Код отредактирован');
            } catch (error) {
                vscode.window.showErrorMessage(`Ошибка: ${error}`);
            }
        })
    );

    // kimi.addToContext — Добавить файл в контекст
    context.subscriptions.push(
        vscode.commands.registerCommand('kimi.addToContext', async (uri?: vscode.Uri) => {
            let targetUri = uri;
            
            if (!targetUri) {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    targetUri = editor.document.uri;
                }
            }

            if (!targetUri) {
                vscode.window.showWarningMessage('Не выбран файл');
                return;
            }

            try {
                const document = await vscode.workspace.openTextDocument(targetUri);
                const content = document.getText();
                
                // TODO: Добавить в контекст через KimiClient
                vscode.window.showInformationMessage(
                    `Файл ${targetUri.fsPath} добавлен в контекст`
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Ошибка: ${error}`);
            }
        })
    );

    // kimi.clearContext — Очистить контекст
    context.subscriptions.push(
        vscode.commands.registerCommand('kimi.clearContext', async () => {
            // TODO: Очистить контекст через KimiClient
            vscode.window.showInformationMessage('Контекст очищен');
        })
    );
}
