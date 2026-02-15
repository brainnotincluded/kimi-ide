/**
 * Command registration for Kimi IDE
 * All commands are registered and handled here
 */

import * as vscode from 'vscode';
import { KimiStatusBar } from '../statusBar';
import { log, logError, showError, showInfo, getFullConfig, isApiKeyConfigured } from '../config';

// Type for command handler
 type CommandHandler = (...args: unknown[]) => Promise<void> | void;

// Map to store registered commands
const registeredCommands = new Map<string, vscode.Disposable>();

// Abort controller for cancelling requests
let currentAbortController: AbortController | null = null;

/**
 * Register all Kimi IDE commands
 */
export function registerCommands(
    context: vscode.ExtensionContext,
    statusBar: KimiStatusBar
): void {
    log('Registering commands...');

    const commands: { [key: string]: CommandHandler } = {
        // Main commands
        'kimi.openChat': () => openChat(context, statusBar),
        'kimi.explainCode': () => explainCode(context, statusBar),
        'kimi.fixCode': () => fixCode(context, statusBar),
        'kimi.generateCode': () => generateCode(context, statusBar),
        'kimi.inlineEdit': () => inlineEdit(context, statusBar),
        
        // Utility commands
        'kimi.abortRequest': () => abortRequest(statusBar),
        'kimi.clearChat': () => clearChat(context, statusBar),
        'kimi.exportChat': () => exportChat(context),
        
        // Status bar menu
        'kimi.showMenu': () => statusBar.showMenu(),
    };

    // Register each command
    for (const [commandId, handler] of Object.entries(commands)) {
        const disposable = vscode.commands.registerCommand(commandId, handler);
        registeredCommands.set(commandId, disposable);
        context.subscriptions.push(disposable);
    }

    log(`Registered ${Object.keys(commands).length} commands`);
}

/**
 * Check if API is ready before executing commands
 */
async function checkApiReady(statusBar: KimiStatusBar): Promise<boolean> {
    const isReady = await isApiKeyConfigured();
    
    if (!isReady) {
        statusBar.showError('API Key not configured');
        const action = await vscode.window.showErrorMessage(
            'Kimi API key is not configured. Please set it in settings.',
            'Open Settings',
            'Cancel'
        );
        
        if (action === 'Open Settings') {
            await vscode.commands.executeCommand('workbench.action.openSettings', 'kimi.apiKey');
        }
        return false;
    }
    
    return true;
}

/**
 * Get selected text from active editor
 */
function getSelectedText(): { text: string; language: string } | null {
    const editor = vscode.window.activeTextEditor;
    
    if (!editor) {
        return null;
    }

    const selection = editor.selection;
    const text = editor.document.getText(selection);
    
    if (!text) {
        return null;
    }

    return {
        text,
        language: editor.document.languageId
    };
}

/**
 * Open chat panel
 */
async function openChat(context: vscode.ExtensionContext, statusBar: KimiStatusBar): Promise<void> {
    log('Opening chat panel...');
    
    if (!await checkApiReady(statusBar)) {
        return;
    }

    try {
        statusBar.startThinking('Opening chat...');
        
        // TODO: Implement actual chat panel opening
        // For now, show info message
        showInfo('Chat panel will be opened here');
        
        statusBar.showReady('Chat opened');
    } catch (error) {
        logError('Failed to open chat', error);
        statusBar.showError('Failed to open chat');
        showError('Failed to open chat', error);
    }
}

/**
 * Explain selected code
 */
async function explainCode(context: vscode.ExtensionContext, statusBar: KimiStatusBar): Promise<void> {
    log('Explaining code...');
    
    if (!await checkApiReady(statusBar)) {
        return;
    }

    const selected = getSelectedText();
    
    if (!selected) {
        showInfo('Please select some code to explain');
        return;
    }

    try {
        statusBar.startThinking('Explaining code...');
        
        // Create abort controller for this request
        currentAbortController = new AbortController();
        
        // TODO: Implement actual API call to explain code
        log(`Explaining ${selected.language} code:`, selected.text.substring(0, 100) + '...');
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (currentAbortController.signal.aborted) {
            throw new Error('Request was aborted');
        }
        
        // TODO: Show explanation in chat panel
        showInfo(`Code explanation ready for ${selected.language}`);
        
        statusBar.showReady('Explanation ready');
    } catch (error) {
        if (error instanceof Error && error.message === 'Request was aborted') {
            statusBar.stopThinking();
            showInfo('Explanation cancelled');
        } else {
            logError('Failed to explain code', error);
            statusBar.showError('Failed to explain code');
            showError('Failed to explain code', error);
        }
    } finally {
        currentAbortController = null;
    }
}

/**
 * Fix selected code
 */
async function fixCode(context: vscode.ExtensionContext, statusBar: KimiStatusBar): Promise<void> {
    log('Fixing code...');
    
    if (!await checkApiReady(statusBar)) {
        return;
    }

    const selected = getSelectedText();
    
    if (!selected) {
        showInfo('Please select some code to fix');
        return;
    }

    try {
        statusBar.startThinking('Fixing code...');
        
        currentAbortController = new AbortController();
        
        // TODO: Implement actual API call to fix code
        log(`Fixing ${selected.language} code...`);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (currentAbortController.signal.aborted) {
            throw new Error('Request was aborted');
        }
        
        showInfo(`Fix suggestions ready for ${selected.language}`);
        
        statusBar.showReady('Fix ready');
    } catch (error) {
        if (error instanceof Error && error.message === 'Request was aborted') {
            statusBar.stopThinking();
            showInfo('Fix cancelled');
        } else {
            logError('Failed to fix code', error);
            statusBar.showError('Failed to fix code');
            showError('Failed to fix code', error);
        }
    } finally {
        currentAbortController = null;
    }
}

/**
 * Generate code from description
 */
async function generateCode(context: vscode.ExtensionContext, statusBar: KimiStatusBar): Promise<void> {
    log('Generating code...');
    
    if (!await checkApiReady(statusBar)) {
        return;
    }

    const description = await vscode.window.showInputBox({
        placeHolder: 'Describe what code you want to generate...',
        prompt: 'Code Generation',
        title: 'Generate Code with Kimi'
    });

    if (!description) {
        return;
    }

    try {
        statusBar.startThinking('Generating code...');
        
        currentAbortController = new AbortController();
        
        // TODO: Implement actual API call to generate code
        log(`Generating code for: ${description}`);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (currentAbortController.signal.aborted) {
            throw new Error('Request was aborted');
        }
        
        showInfo('Code generated successfully');
        
        statusBar.showReady('Code generated');
    } catch (error) {
        if (error instanceof Error && error.message === 'Request was aborted') {
            statusBar.stopThinking();
            showInfo('Generation cancelled');
        } else {
            logError('Failed to generate code', error);
            statusBar.showError('Failed to generate code');
            showError('Failed to generate code', error);
        }
    } finally {
        currentAbortController = null;
    }
}

/**
 * Inline edit selected code
 */
async function inlineEdit(context: vscode.ExtensionContext, statusBar: KimiStatusBar): Promise<void> {
    log('Inline editing...');
    
    if (!await checkApiReady(statusBar)) {
        return;
    }

    const selected = getSelectedText();
    
    if (!selected) {
        showInfo('Please select some code to edit');
        return;
    }

    const instruction = await vscode.window.showInputBox({
        placeHolder: 'Describe how to modify the selected code...',
        prompt: 'Inline Edit',
        title: 'Edit with Kimi'
    });

    if (!instruction) {
        return;
    }

    try {
        statusBar.startThinking('Editing code...');
        
        currentAbortController = new AbortController();
        
        // TODO: Implement actual API call for inline edit
        log(`Editing ${selected.language} code: ${instruction}`);
        
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (currentAbortController.signal.aborted) {
            throw new Error('Request was aborted');
        }
        
        showInfo('Code edited successfully');
        
        statusBar.showReady('Edit complete');
    } catch (error) {
        if (error instanceof Error && error.message === 'Request was aborted') {
            statusBar.stopThinking();
            showInfo('Edit cancelled');
        } else {
            logError('Failed to edit code', error);
            statusBar.showError('Failed to edit code');
            showError('Failed to edit code', error);
        }
    } finally {
        currentAbortController = null;
    }
}

/**
 * Abort current request
 */
function abortRequest(statusBar: KimiStatusBar): void {
    log('Aborting request...');
    
    if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
        statusBar.stopThinking();
        showInfo('Request aborted');
    } else {
        showInfo('No active request to abort');
    }
}

/**
 * Clear chat history
 */
async function clearChat(context: vscode.ExtensionContext, statusBar: KimiStatusBar): Promise<void> {
    log('Clearing chat...');
    
    const config = getFullConfig();
    
    // Confirm before clearing
    const confirm = await vscode.window.showWarningMessage(
        'Are you sure you want to clear the chat history?',
        'Yes',
        'Cancel'
    );
    
    if (confirm !== 'Yes') {
        return;
    }

    try {
        // TODO: Implement actual chat clearing
        showInfo('Chat history cleared');
        statusBar.showReady('Chat cleared');
    } catch (error) {
        logError('Failed to clear chat', error);
        showError('Failed to clear chat', error);
    }
}

/**
 * Export chat history
 */
async function exportChat(context: vscode.ExtensionContext): Promise<void> {
    log('Exporting chat...');

    try {
        const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(`kimi-chat-${Date.now()}.md`),
            filters: {
                'Markdown': ['md'],
                'JSON': ['json'],
                'Text': ['txt']
            },
            title: 'Export Chat History'
        });

        if (!uri) {
            return;
        }

        // TODO: Implement actual chat export
        // For now, create a placeholder file
        const content = '# Kimi Chat Export\n\n_Export functionality coming soon..._\n';
        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));

        showInfo(`Chat exported to ${uri.fsPath}`);
    } catch (error) {
        logError('Failed to export chat', error);
        showError('Failed to export chat', error);
    }
}

/**
 * Dispose all registered commands
 */
export function disposeCommands(): void {
    log('Disposing commands...');
    
    for (const [commandId, disposable] of registeredCommands) {
        disposable.dispose();
        log(`Disposed command: ${commandId}`);
    }
    
    registeredCommands.clear();
}
