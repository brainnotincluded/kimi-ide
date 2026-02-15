/**
 * Status bar item for Kimi IDE
 * Shows current status and provides quick access menu
 */

import * as vscode from 'vscode';
import { log, showError } from './config';

export type KimiStatus = 'idle' | 'thinking' | 'error' | 'ready';

export class KimiStatusBar {
    private statusBarItem: vscode.StatusBarItem;
    private currentStatus: KimiStatus = 'idle';
    private disposables: vscode.Disposable[] = [];

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        
        this.statusBarItem.command = 'kimi.showMenu';
        this.updateStatus('idle');
        this.statusBarItem.show();

        log('Status bar initialized');
    }

    /**
     * Get icon for current status
     */
    private getStatusIcon(status: KimiStatus): string {
        switch (status) {
            case 'idle':
                return '$(zap)'; // Lightning bolt
            case 'thinking':
                return '$(sync~spin)'; // Spinning sync icon
            case 'error':
                return '$(error)'; // Error icon
            case 'ready':
                return '$(check)'; // Checkmark
            default:
                return '$(zap)';
        }
    }

    /**
     * Get tooltip for current status
     */
    private getStatusTooltip(status: KimiStatus): string {
        switch (status) {
            case 'idle':
                return 'Kimi IDE - Click for options';
            case 'thinking':
                return 'Kimi IDE - Processing...';
            case 'error':
                return 'Kimi IDE - Error occurred (click for details)';
            case 'ready':
                return 'Kimi IDE - Ready';
            default:
                return 'Kimi IDE';
        }
    }

    /**
     * Get text for status bar
     */
    private getStatusText(status: KimiStatus): string {
        const icon = this.getStatusIcon(status);
        
        switch (status) {
            case 'thinking':
                return `${icon} Kimi`;
            case 'error':
                return `${icon} Kimi`;
            default:
                return `${icon} Kimi`;
        }
    }

    /**
     * Update status bar appearance
     */
    public updateStatus(status: KimiStatus, message?: string): void {
        this.currentStatus = status;
        
        this.statusBarItem.text = this.getStatusText(status);
        this.statusBarItem.tooltip = message || this.getStatusTooltip(status);
        
        // Set background color for error state
        if (status === 'error') {
            this.statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        } else {
            this.statusBarItem.backgroundColor = undefined;
        }

        log(`Status updated to: ${status}`, message || '');
    }

    /**
     * Get current status
     */
    public getStatus(): KimiStatus {
        return this.currentStatus;
    }

    /**
     * Show status as thinking (during API calls)
     */
    public startThinking(operation?: string): void {
        this.updateStatus('thinking', operation || 'Processing...');
    }

    /**
     * Show status as idle
     */
    public stopThinking(): void {
        this.updateStatus('idle');
    }

    /**
     * Show error status
     */
    public showError(message: string): void {
        this.updateStatus('error', message);
        
        // Reset to idle after 5 seconds
        setTimeout(() => {
            if (this.currentStatus === 'error') {
                this.updateStatus('idle');
            }
        }, 5000);
    }

    /**
     * Show ready status briefly
     */
    public showReady(message?: string): void {
        this.updateStatus('ready', message || 'Ready');
        
        // Reset to idle after 2 seconds
        setTimeout(() => {
            if (this.currentStatus === 'ready') {
                this.updateStatus('idle');
            }
        }, 2000);
    }

    /**
     * Show progress status
     */
    public showProgress(message?: string): void {
        this.updateStatus('thinking', message || 'Processing...');
    }

    /**
     * Show the menu when clicking on status bar
     */
    public async showMenu(): Promise<void> {
        const options: vscode.QuickPickItem[] = [
            {
                label: '$(comment) Open Chat',
                description: 'Open Kimi chat panel',
                detail: 'Start a conversation with Kimi'
            },
            {
                label: '$(code) Generate Code',
                description: 'Generate code from description',
                detail: 'Ask Kimi to generate code'
            },
            {
                label: '$(lightbulb) Explain Code',
                description: 'Get explanation for selected code',
                detail: 'Explain the currently selected code'
            },
            {
                label: '$(tools) Fix Code',
                description: 'Fix issues in selected code',
                detail: 'Let Kimi fix problems in your code'
            },
            {
                label: '$(edit) Inline Edit',
                description: 'Edit selected code inline',
                detail: 'Modify code with natural language'
            },
            { label: '', kind: vscode.QuickPickItemKind.Separator },
            {
                label: '$(gear) Open Settings',
                description: 'Configure Kimi IDE',
                detail: 'Change API key and other settings'
            },
            {
                label: '$(trash) Clear Chat History',
                description: 'Clear current chat session',
                detail: 'Remove all messages from current chat'
            },
        ];

        // Add abort option if thinking
        if (this.currentStatus === 'thinking') {
            options.unshift({
                label: '$(stop-circle) Abort Request',
                description: 'Cancel current operation',
                detail: 'Stop the ongoing AI request'
            });
        }

        const selected = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select Kimi IDE action',
            title: 'Kimi IDE Menu'
        });

        if (!selected) {
            return;
        }

        // Handle selection
        try {
            switch (selected.label) {
                case '$(comment) Open Chat':
                    await vscode.commands.executeCommand('kimi.openChat');
                    break;
                case '$(code) Generate Code':
                    await vscode.commands.executeCommand('kimi.generateCode');
                    break;
                case '$(lightbulb) Explain Code':
                    await vscode.commands.executeCommand('kimi.explainCode');
                    break;
                case '$(tools) Fix Code':
                    await vscode.commands.executeCommand('kimi.fixCode');
                    break;
                case '$(edit) Inline Edit':
                    await vscode.commands.executeCommand('kimi.inlineEdit');
                    break;
                case '$(stop-circle) Abort Request':
                    await vscode.commands.executeCommand('kimi.abortRequest');
                    break;
                case '$(gear) Open Settings':
                    await vscode.commands.executeCommand('workbench.action.openSettings', 'kimi');
                    break;
                case '$(trash) Clear Chat History':
                    await vscode.commands.executeCommand('kimi.clearChat');
                    break;
            }
        } catch (error) {
            showError('Failed to execute command', error);
        }
    }

    /**
     * Hide status bar item
     */
    public hide(): void {
        this.statusBarItem.hide();
    }

    /**
     * Show status bar item
     */
    public show(): void {
        this.statusBarItem.show();
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        this.statusBarItem.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        log('Status bar disposed');
    }
}
