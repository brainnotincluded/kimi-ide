// @ts-nocheck
import * as vscode from 'vscode';
import { EventEmitter } from 'events';

/**
 * Command execution status
 */
export enum CommandStatus {
    Pending = 'pending',
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed',
    Cancelled = 'cancelled'
}

/**
 * Shell command execution info
 */
export interface ShellCommandInfo {
    id: string;
    command: string;
    status: CommandStatus;
    startTime: Date;
    endTime?: Date;
    exitCode?: number;
    output: string;
    cwd?: string;
}

/**
 * Shell integration event types
 */
export interface ShellIntegrationEvents {
    commandStarted: (info: ShellCommandInfo) => void;
    commandCompleted: (info: ShellCommandInfo) => void;
    commandFailed: (info: ShellCommandInfo, error: Error) => void;
    outputReceived: (commandId: string, data: string) => void;
}

/**
 * ShellIntegration provides advanced shell integration features:
 * - Track command execution lifecycle
 * - Capture command output
 * - Get exit codes
 * - Integration with kimi-cli
 */
export class ShellIntegration extends EventEmitter {
    private context: vscode.ExtensionContext;
    private disposables: vscode.Disposable[] = [];
    private activeCommands: Map<string, ShellCommandInfo> = new Map();
    private commandHistory: ShellCommandInfo[] = [];
    private maxHistorySize: number = 100;
    private outputCaptureEnabled: boolean = true;

    constructor(context: vscode.ExtensionContext) {
        super();
        this.context = context;
        this.registerEventListeners();
    }

    /**
     * Register shell integration event listeners
     */
    private registerEventListeners(): void {
        // Listen for shell integration activation
        if (vscode.window.onDidChangeTerminalShellIntegration) {
            const disposable = vscode.window.onDidChangeTerminalShellIntegration((e) => {
                this.handleShellIntegrationChange(e.terminal, e.shellIntegration);
            });
            this.disposables.push(disposable);
        }

        // Listen for terminal data (if available)
        // Note: This requires proposed API
        // vscode.window.onDidWriteTerminalData?.((e) => {
        //     this.handleTerminalData(e.terminal, e.data);
        // });

        // Track terminal closures
        const closeDisposable = vscode.window.onDidCloseTerminal((terminal) => {
            // Clean up any active commands for this terminal
            for (const [id, info] of this.activeCommands.entries()) {
                if (info.status === CommandStatus.Running) {
                    info.status = CommandStatus.Cancelled;
                    info.endTime = new Date();
                    this.emit('commandFailed', info, new Error('Terminal closed'));
                }
            }
        });
        this.disposables.push(closeDisposable);
    }

    /**
     * Handle shell integration activation/changes
     */
    private handleShellIntegrationChange(
        terminal: vscode.Terminal,
        shellIntegration: vscode.TerminalShellIntegration
    ): void {
        console.log(`Shell integration activated for terminal: ${terminal.name}`);
        
        // Store shell integration reference
        // This can be used to execute commands with full tracking
    }

    /**
     * Execute a command with full tracking and output capture
     */
    async executeCommand(
        command: string,
        terminal?: vscode.Terminal,
        options: {
            cwd?: string;
            timeout?: number;
            captureOutput?: boolean;
            env?: Record<string, string>;
        } = {}
    ): Promise<ShellCommandInfo> {
        const targetTerminal = terminal || vscode.window.activeTerminal;
        
        if (!targetTerminal) {
            throw new Error('No terminal available');
        }

        const commandId = `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const commandInfo: ShellCommandInfo = {
            id: commandId,
            command,
            status: CommandStatus.Pending,
            startTime: new Date(),
            output: '',
            cwd: options.cwd
        };

        this.activeCommands.set(commandId, commandInfo);

        // Change directory if specified
        if (options.cwd) {
            targetTerminal.sendText(`cd "${options.cwd}"`, true);
        }

        // Check if shell integration is available
        const shellIntegration = (targetTerminal as any).shellIntegration;
        
        if (shellIntegration && shellIntegration.executeCommand) {
            return this.executeWithShellIntegration(commandInfo, shellIntegration, options);
        } else {
            // Fallback: execute without full tracking
            return this.executeWithoutShellIntegration(commandInfo, targetTerminal, options);
        }
    }

    /**
     * Execute using shell integration API
     */
    private async executeWithShellIntegration(
        commandInfo: ShellCommandInfo,
        shellIntegration: vscode.TerminalShellIntegration,
        options: { timeout?: number; captureOutput?: boolean }
    ): Promise<ShellCommandInfo> {
        return new Promise((resolve, reject) => {
            const timeout = options.timeout || 30000;
            let timeoutHandle: NodeJS.Timeout;

            try {
                const execution = shellIntegration.executeCommand(commandInfo.command);
                commandInfo.status = CommandStatus.Running;
                this.emit('commandStarted', commandInfo);

                // Handle execution close
                if (execution.onDidClose) {
                    execution.onDidClose((exitCode: number | undefined) => {
                        clearTimeout(timeoutHandle);
                        
                        commandInfo.exitCode = exitCode;
                        commandInfo.endTime = new Date();
                        commandInfo.status = exitCode === 0 ? CommandStatus.Completed : CommandStatus.Failed;
                        
                        this.activeCommands.delete(commandInfo.id);
                        this.addToHistory(commandInfo);
                        
                        if (exitCode === 0) {
                            this.emit('commandCompleted', commandInfo);
                        } else {
                            this.emit('commandFailed', commandInfo, new Error(`Exit code: ${exitCode}`));
                        }
                        
                        resolve(commandInfo);
                    });
                }

                // Capture output if available
                if (options.captureOutput && execution.read) {
                    this.captureExecutionOutput(commandInfo, execution);
                }

                // Set timeout
                timeoutHandle = setTimeout(() => {
                    commandInfo.status = CommandStatus.Cancelled;
                    commandInfo.endTime = new Date();
                    this.activeCommands.delete(commandInfo.id);
                    
                    reject(new Error(`Command timeout after ${timeout}ms`));
                }, timeout);

            } catch (error) {
                commandInfo.status = CommandStatus.Failed;
                commandInfo.endTime = new Date();
                this.activeCommands.delete(commandInfo.id);
                
                this.emit('commandFailed', commandInfo, error as Error);
                reject(error);
            }
        });
    }

    /**
     * Execute without shell integration (limited tracking)
     */
    private async executeWithoutShellIntegration(
        commandInfo: ShellCommandInfo,
        terminal: vscode.Terminal,
        options: { timeout?: number }
    ): Promise<ShellCommandInfo> {
        return new Promise((resolve, reject) => {
            const timeout = options.timeout || 30000;
            
            commandInfo.status = CommandStatus.Running;
            this.emit('commandStarted', commandInfo);

            // Send command to terminal
            terminal.sendText(commandInfo.command, true);

            // For non-shell integration mode, we can't track completion
            // Just mark as completed after a short delay
            setTimeout(() => {
                commandInfo.status = CommandStatus.Completed;
                commandInfo.endTime = new Date();
                commandInfo.exitCode = undefined; // Unknown
                
                this.activeCommands.delete(commandInfo.id);
                this.addToHistory(commandInfo);
                
                this.emit('commandCompleted', commandInfo);
                resolve(commandInfo);
            }, 500);

            // Set timeout
            setTimeout(() => {
                if (this.activeCommands.has(commandInfo.id)) {
                    commandInfo.status = CommandStatus.Cancelled;
                    commandInfo.endTime = new Date();
                    this.activeCommands.delete(commandInfo.id);
                    
                    reject(new Error(`Command timeout after ${timeout}ms`));
                }
            }, timeout);
        });
    }

    /**
     * Capture output from command execution
     */
    private async captureExecutionOutput(
        commandInfo: ShellCommandInfo,
        execution: vscode.TerminalShellExecution
    ): Promise<void> {
        if (!execution.read) return;

        try {
            const reader = await execution.read();
            
            // Read output stream
            const readChunk = async () => {
                try {
                    const result = await reader.read();
                    if (!result.done) {
                        const chunk = result.value;
                        commandInfo.output += chunk;
                        this.emit('outputReceived', commandInfo.id, chunk);
                        
                        // Continue reading
                        setImmediate(readChunk);
                    }
                } catch (error) {
                    // Stop reading on error
                    console.error('Error reading output:', error);
                }
            };

            readChunk();
        } catch (error) {
            console.error('Failed to start output capture:', error);
        }
    }

    /**
     * Execute kimi-cli specific command
     */
    async executeKimiCommand(
        toolName: string,
        args: string[],
        terminal?: vscode.Terminal,
        options: {
            cwd?: string;
            timeout?: number;
        } = {}
    ): Promise<ShellCommandInfo> {
        const kimiCommand = `kimi ${toolName} ${args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ')}`;
        return this.executeCommand(kimiCommand, terminal, options);
    }

    /**
     * Get active command by ID
     */
    getActiveCommand(id: string): ShellCommandInfo | undefined {
        return this.activeCommands.get(id);
    }

    /**
     * Get all active commands
     */
    getAllActiveCommands(): ShellCommandInfo[] {
        return Array.from(this.activeCommands.values());
    }

    /**
     * Get command history
     */
    getCommandHistory(limit?: number): ShellCommandInfo[] {
        const history = [...this.commandHistory];
        if (limit) {
            return history.slice(-limit);
        }
        return history;
    }

    /**
     * Add command to history
     */
    private addToHistory(commandInfo: ShellCommandInfo): void {
        this.commandHistory.push(commandInfo);
        
        // Trim history if needed
        if (this.commandHistory.length > this.maxHistorySize) {
            this.commandHistory = this.commandHistory.slice(-this.maxHistorySize);
        }
    }

    /**
     * Clear command history
     */
    clearHistory(): void {
        this.commandHistory = [];
    }

    /**
     * Cancel an active command
     */
    cancelCommand(commandId: string): boolean {
        const command = this.activeCommands.get(commandId);
        if (command && command.status === CommandStatus.Running) {
            command.status = CommandStatus.Cancelled;
            command.endTime = new Date();
            this.activeCommands.delete(commandId);
            
            this.emit('commandFailed', command, new Error('Command cancelled'));
            return true;
        }
        return false;
    }

    /**
     * Enable/disable output capture
     */
    setOutputCapture(enabled: boolean): void {
        this.outputCaptureEnabled = enabled;
    }

    /**
     * Check if shell integration is available for a terminal
     */
    isShellIntegrationAvailable(terminal?: vscode.Terminal): boolean {
        const target = terminal || vscode.window.activeTerminal;
        if (!target) return false;
        
        return !!(target as any).shellIntegration?.executeCommand;
    }

    /**
     * Wait for shell integration to be ready
     */
    async waitForShellIntegration(
        terminal: vscode.Terminal,
        timeout: number = 5000
    ): Promise<boolean> {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this.isShellIntegrationAvailable(terminal)) {
                    clearInterval(checkInterval);
                    clearTimeout(timeoutHandle);
                    resolve(true);
                }
            }, 100);

            const timeoutHandle = setTimeout(() => {
                clearInterval(checkInterval);
                resolve(false);
            }, timeout);
        });
    }

    /**
     * Get last command output
     */
    getLastOutput(): string {
        const lastCommand = this.commandHistory[this.commandHistory.length - 1];
        return lastCommand?.output || '';
    }

    /**
     * Get last N lines of output
     */
    getLastOutputLines(lines: number = 50): string {
        const output = this.getLastOutput();
        const allLines = output.split('\n');
        return allLines.slice(-lines).join('\n');
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.activeCommands.clear();
        this.commandHistory = [];
        this.removeAllListeners();
    }
}

/**
 * Terminal output analyzer for Kimi integration
 */
export class TerminalOutputAnalyzer {
    /**
     * Analyze terminal output for errors
     */
    static analyzeForErrors(output: string): Array<{
        type: 'error' | 'warning' | 'info';
        message: string;
        line?: number;
    }> {
        const issues: Array<{ type: 'error' | 'warning' | 'info'; message: string; line?: number }> = [];
        const lines = output.split('\n');

        const errorPatterns = [
            { pattern: /error[:\s]/i, type: 'error' as const },
            { pattern: /exception[:\s]/i, type: 'error' as const },
            { pattern: /fatal[:\s]/i, type: 'error' as const },
            { pattern: /warning[:\s]/i, type: 'warning' as const },
            { pattern: /warn[:\s]/i, type: 'warning' as const },
        ];

        lines.forEach((line, index) => {
            for (const { pattern, type } of errorPatterns) {
                if (pattern.test(line)) {
                    issues.push({
                        type,
                        message: line.trim(),
                        line: index + 1
                    });
                    break;
                }
            }
        });

        return issues;
    }

    /**
     * Extract code blocks from output
     */
    static extractCodeBlocks(output: string): Array<{
        language?: string;
        code: string;
    }> {
        const blocks: Array<{ language?: string; code: string }> = [];
        const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
        
        let match: RegExpExecArray | null;
        while ((match = codeBlockPattern.exec(output)) !== null) {
            blocks.push({
                language: match[1],
                code: match[2].trim()
            });
        }

        return blocks;
    }

    /**
     * Summarize terminal output for Kimi
     */
    static summarizeForKimi(output: string, maxLength: number = 2000): string {
        if (output.length <= maxLength) {
            return output;
        }

        // Try to keep the beginning and end which usually contain important info
        const halfLength = Math.floor(maxLength / 2) - 50;
        const beginning = output.slice(0, halfLength);
        const end = output.slice(-halfLength);

        return `${beginning}\n\n... [${output.length - maxLength + 100} characters truncated] ...\n\n${end}`;
    }
}
