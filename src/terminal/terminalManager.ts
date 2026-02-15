import * as vscode from 'vscode';
import { EventEmitter } from 'events';

/**
 * Interface for terminal execution result
 */
export interface TerminalExecutionResult {
    exitCode: number | undefined;
    output: string;
    command: string;
}

/**
 * Interface for terminal session
 */
export interface TerminalSession {
    terminal: vscode.Terminal;
    id: string;
    name: string;
    shellIntegration?: vscode.TerminalShellIntegration;
}

/**
 * TerminalManager handles creation and management of VS Code integrated terminals
 * with integration to kimi-cli shell tool
 */
export class TerminalManager extends EventEmitter {
    private static instance: TerminalManager;
    private terminals: Map<string, TerminalSession> = new Map();
    private activeTerminalId: string | undefined;
    private outputBuffer: Map<string, string> = new Map();
    private readonly context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        super();
        this.context = context;
        this.registerEventListeners();
    }

    static getInstance(context: vscode.ExtensionContext): TerminalManager {
        if (!TerminalManager.instance) {
            TerminalManager.instance = new TerminalManager(context);
        }
        return TerminalManager.instance;
    }

    /**
     * Register event listeners for terminal lifecycle
     */
    private registerEventListeners(): void {
        // Listen for terminal closure
        vscode.window.onDidCloseTerminal((terminal) => {
            for (const [id, session] of this.terminals.entries()) {
                if (session.terminal === terminal) {
                    this.terminals.delete(id);
                    this.outputBuffer.delete(id);
                    this.emit('terminalClosed', id);
                    break;
                }
            }
        });

        // Listen for active terminal change
        vscode.window.onDidChangeActiveTerminal((terminal) => {
            if (terminal) {
                for (const [id, session] of this.terminals.entries()) {
                    if (session.terminal === terminal) {
                        this.activeTerminalId = id;
                        this.emit('activeTerminalChanged', id);
                        break;
                    }
                }
            }
        });

        // Listen for shell integration activation
        vscode.window.onDidChangeTerminalShellIntegration?.((e) => {
            const terminalId = this.findTerminalIdByTerminal(e.terminal);
            if (terminalId) {
                const session = this.terminals.get(terminalId);
                if (session) {
                    session.shellIntegration = e.shellIntegration;
                    this.emit('shellIntegrationActivated', terminalId);
                }
            }
        });
    }

    /**
     * Find terminal ID by VS Code terminal instance
     */
    private findTerminalIdByTerminal(terminal: vscode.Terminal): string | undefined {
        for (const [id, session] of this.terminals.entries()) {
            if (session.terminal === terminal) {
                return id;
            }
        }
        return undefined;
    }

    /**
     * Create a new terminal or get existing one
     */
    createTerminal(name: string = 'Kimi Terminal', reuse: boolean = true): TerminalSession {
        // Try to reuse existing terminal with same name
        if (reuse) {
            for (const [id, session] of this.terminals.entries()) {
                if (session.name === name) {
                    session.terminal.show();
                    this.activeTerminalId = id;
                    return session;
                }
            }
        }

        // Create new terminal
        const terminal = vscode.window.createTerminal({
            name,
            shellIntegration: {
                enabled: true
            },
            message: 'Kimi IDE Terminal - Ready for commands'
        });

        const id = `kimi-terminal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const session: TerminalSession = {
            terminal,
            id,
            name
        };

        this.terminals.set(id, session);
        this.outputBuffer.set(id, '');
        this.activeTerminalId = id;

        terminal.show();
        this.emit('terminalCreated', session);

        return session;
    }

    /**
     * Get or create the default terminal
     */
    getDefaultTerminal(): TerminalSession {
        if (this.activeTerminalId && this.terminals.has(this.activeTerminalId)) {
            const session = this.terminals.get(this.activeTerminalId)!;
            session.terminal.show();
            return session;
        }
        return this.createTerminal('Kimi', true);
    }

    /**
     * Send a command to a terminal
     */
    sendCommand(command: string, terminalId?: string, addNewLine: boolean = true): void {
        const session = terminalId 
            ? this.terminals.get(terminalId) 
            : this.getDefaultTerminal();

        if (!session) {
            throw new Error(`Terminal ${terminalId} not found`);
        }

        session.terminal.sendText(command, addNewLine);
        this.emit('commandSent', { terminalId: session.id, command });
    }

    /**
     * Execute a command and capture output (requires shell integration)
     */
    async executeCommand(
        command: string, 
        terminalId?: string,
        timeout: number = 30000
    ): Promise<TerminalExecutionResult> {
        const session = terminalId 
            ? this.terminals.get(terminalId) 
            : this.getDefaultTerminal();

        if (!session) {
            throw new Error(`Terminal ${terminalId} not found`);
        }

        // Check if shell integration is available
        if (!session.shellIntegration) {
            // Fallback: just send command without capturing output
            this.sendCommand(command, session.id);
            return {
                exitCode: undefined,
                output: '',
                command
            };
        }

        return new Promise((resolve, reject) => {
            const execution = session.shellIntegration!.executeCommand(command);
            let output = '';
            let timeoutHandle: NodeJS.Timeout;

            // Handle command output
            const disposables: vscode.Disposable[] = [];

            if (execution.read) {
                // Read output if available
                execution.read().then(async (reader) => {
                    try {
                        while (true) {
                            const { value, done } = await reader.read();
                            if (done) break;
                            output += value;
                        }
                    } catch (e) {
                        // Ignore read errors
                    }
                });
            }

            // Handle command completion
            execution.onDidClose?.((exitCode) => {
                clearTimeout(timeoutHandle);
                disposables.forEach(d => d.dispose());
                
                resolve({
                    exitCode,
                    output,
                    command
                });
            });

            // Timeout handling
            timeoutHandle = setTimeout(() => {
                disposables.forEach(d => d.dispose());
                reject(new Error(`Command execution timeout after ${timeout}ms`));
            }, timeout);
        });
    }

    /**
     * Execute kimi-cli shell command in terminal
     */
    async executeKimiShell(
        command: string, 
        workingDirectory?: string,
        terminalId?: string
    ): Promise<void> {
        const session = this.getDefaultTerminal();
        
        // Change directory if specified
        if (workingDirectory) {
            session.terminal.sendText(`cd "${workingDirectory}"`, true);
        }

        // Execute kimi shell command
        const kimiCommand = `kimi shell "${command.replace(/"/g, '\\"')}"`;
        this.sendCommand(kimiCommand, session.id);
    }

    /**
     * Get all managed terminals
     */
    getAllTerminals(): TerminalSession[] {
        return Array.from(this.terminals.values());
    }

    /**
     * Get a specific terminal by ID
     */
    getTerminal(id: string): TerminalSession | undefined {
        return this.terminals.get(id);
    }

    /**
     * Close a terminal
     */
    closeTerminal(id: string): void {
        const session = this.terminals.get(id);
        if (session) {
            session.terminal.dispose();
            this.terminals.delete(id);
            this.outputBuffer.delete(id);
        }
    }

    /**
     * Close all terminals
     */
    closeAllTerminals(): void {
        for (const [id, session] of this.terminals.entries()) {
            session.terminal.dispose();
        }
        this.terminals.clear();
        this.outputBuffer.clear();
        this.activeTerminalId = undefined;
    }

    /**
     * Show terminal picker to user
     */
    async showTerminalPicker(): Promise<TerminalSession | undefined> {
        const items = this.getAllTerminals().map(session => ({
            label: session.name,
            description: session.id,
            session
        }));

        if (items.length === 0) {
            vscode.window.showInformationMessage('No active Kimi terminals. Creating new one...');
            return this.createTerminal();
        }

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a terminal'
        });

        return selected?.session;
    }

    /**
     * Clear terminal output buffer
     */
    clearBuffer(terminalId: string): void {
        this.outputBuffer.set(terminalId, '');
    }

    /**
     * Append to terminal output buffer
     */
    appendToBuffer(terminalId: string, data: string): void {
        const current = this.outputBuffer.get(terminalId) || '';
        this.outputBuffer.set(terminalId, current + data);
    }

    /**
     * Get terminal output buffer
     */
    getBuffer(terminalId: string): string {
        return this.outputBuffer.get(terminalId) || '';
    }

    /**
     * Dispose all resources
     */
    dispose(): void {
        this.closeAllTerminals();
        this.removeAllListeners();
    }
}

/**
 * Terminal output capture helper
 * Uses VS Code's proposed API for terminal output reading
 */
export class TerminalOutputCapture {
    private disposables: vscode.Disposable[] = [];
    private output: string = '';

    constructor(private terminal: vscode.Terminal) {
        // Note: This requires proposed API
        // terminal.onDidWriteData?.((data) => {
        //     this.output += data;
        // });
    }

    startCapture(): void {
        this.output = '';
    }

    getOutput(): string {
        return this.output;
    }

    clear(): void {
        this.output = '';
    }

    dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
