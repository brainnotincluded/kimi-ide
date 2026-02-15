import * as vscode from 'vscode';
import { TerminalManager } from '../terminal/terminalManager';
import { TerminalLinkProvider, TerminalLinkHandler } from '../terminal/terminalLinkProvider';
import { ShellIntegration, TerminalOutputAnalyzer } from '../terminal/shellIntegration';

/**
 * Register all terminal-related commands
 */
export function registerTerminalCommands(
    context: vscode.ExtensionContext,
    terminalManager: TerminalManager,
    shellIntegration: ShellIntegration,
    terminalLinkProvider: TerminalLinkProvider
): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];

    // Initialize link handler
    const linkHandler = new TerminalLinkHandler(context);
    disposables.push(linkHandler);

    // Command: Run in Terminal
    const runInTerminal = vscode.commands.registerCommand(
        'kimi.runInTerminal',
        async (command?: string, terminalId?: string) => {
            try {
                // If no command provided, show input box
                if (!command) {
                    const input = await vscode.window.showInputBox({
                        prompt: 'Enter command to run in terminal',
                        placeHolder: 'e.g., npm test',
                        ignoreFocusOut: true
                    });
                    
                    if (!input) {
                        return; // User cancelled
                    }
                    command = input;
                }

                // Show terminal and execute command
                const session = terminalId 
                    ? terminalManager.getTerminal(terminalId) || terminalManager.getDefaultTerminal()
                    : terminalManager.getDefaultTerminal();

                session.terminal.show();
                
                // Use shell integration if available for better tracking
                if (shellIntegration.isShellIntegrationAvailable(session.terminal)) {
                    const result = await shellIntegration.executeCommand(command, session.terminal, {
                        captureOutput: true,
                        timeout: 60000
                    });
                    
                    vscode.window.showInformationMessage(
                        `Command completed with exit code: ${result.exitCode ?? 'unknown'}`
                    );
                } else {
                    // Fallback to simple execution
                    terminalManager.sendCommand(command, session.id);
                }

            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to run command: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );
    disposables.push(runInTerminal);

    // Command: Run Selection in Terminal
    const runSelectionInTerminal = vscode.commands.registerCommand(
        'kimi.runSelectionInTerminal',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('No active editor');
                return;
            }

            const selection = editor.selection;
            let command: string;

            if (selection.isEmpty) {
                // Run current line
                const line = editor.document.lineAt(selection.start.line);
                command = line.text.trim();
            } else {
                // Run selection
                command = editor.document.getText(selection).trim();
            }

            if (!command) {
                vscode.window.showWarningMessage('No command to run');
                return;
            }

            try {
                const session = terminalManager.getDefaultTerminal();
                session.terminal.show();
                terminalManager.sendCommand(command, session.id);
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to run selection: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );
    disposables.push(runSelectionInTerminal);

    // Command: Explain Terminal Output
    const explainTerminalOutput = vscode.commands.registerCommand(
        'kimi.explainTerminalOutput',
        async () => {
            try {
                // Get the last command output
                const output = shellIntegration.getLastOutput();
                
                if (!output.trim()) {
                    // Try to get output from terminal buffer
                    const activeTerminal = vscode.window.activeTerminal;
                    if (!activeTerminal) {
                        vscode.window.showWarningMessage('No active terminal');
                        return;
                    }

                    vscode.window.showInformationMessage(
                        'Please select and copy the terminal output you want to explain, then run this command again.'
                    );
                    return;
                }

                // Analyze the output
                const issues = TerminalOutputAnalyzer.analyzeForErrors(output);
                const codeBlocks = TerminalOutputAnalyzer.extractCodeBlocks(output);
                
                // Summarize for kimi
                const summary = TerminalOutputAnalyzer.summarizeForKimi(output, 3000);

                // Prepare context for Kimi
                const contextItems: string[] = [
                    '## Terminal Output Analysis',
                    '',
                    '### Summary',
                    summary,
                    ''
                ];

                if (issues.length > 0) {
                    contextItems.push('### Detected Issues');
                    contextItems.push('');
                    issues.forEach(issue => {
                        const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
                        contextItems.push(`${icon} **${issue.type.toUpperCase()}**: ${issue.message}`);
                    });
                    contextItems.push('');
                }

                if (codeBlocks.length > 0) {
                    contextItems.push('### Code Blocks Found');
                    contextItems.push(`Found ${codeBlocks.length} code block(s) in output`);
                    contextItems.push('');
                }

                contextItems.push('---');
                contextItems.push('');
                contextItems.push('Please explain this terminal output and help me understand:');
                contextItems.push('1. What happened during the command execution');
                if (issues.some(i => i.type === 'error')) {
                    contextItems.push('2. What caused the errors and how to fix them');
                }
                contextItems.push('3. Any actionable recommendations');

                const prompt = contextItems.join('\n');

                // Send to Kimi chat (using existing kimi chat command)
                await vscode.commands.executeCommand('kimi.sendMessage', prompt);

                vscode.window.showInformationMessage('Terminal output sent to Kimi for explanation');

            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to explain output: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );
    disposables.push(explainTerminalOutput);

    // Command: Explain Selected Terminal Output
    const explainSelectedTerminalOutput = vscode.commands.registerCommand(
        'kimi.explainSelectedTerminalOutput',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showWarningMessage('Please open a file with terminal output copied');
                return;
            }

            const selection = editor.document.getText(editor.selection);
            if (!selection.trim()) {
                vscode.window.showWarningMessage('Please select the terminal output text to explain');
                return;
            }

            try {
                // Analyze the selected output
                const issues = TerminalOutputAnalyzer.analyzeForErrors(selection);
                const summary = TerminalOutputAnalyzer.summarizeForKimi(selection, 3000);

                const prompt = [
                    '## Selected Terminal Output',
                    '',
                    '```',
                    summary,
                    '```',
                    '',
                    issues.length > 0 ? `Detected ${issues.length} issue(s)` : '',
                    '',
                    'Please explain this terminal output and help me understand what it means and what actions I should take.'
                ].join('\n');

                await vscode.commands.executeCommand('kimi.sendMessage', prompt);
                vscode.window.showInformationMessage('Selected terminal output sent to Kimi');

            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to explain output: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );
    disposables.push(explainSelectedTerminalOutput);

    // Command: Create New Terminal
    const createNewTerminal = vscode.commands.registerCommand(
        'kimi.createTerminal',
        async () => {
            const name = await vscode.window.showInputBox({
                prompt: 'Terminal name (optional)',
                placeHolder: 'Kimi Terminal'
            });

            const session = terminalManager.createTerminal(name || 'Kimi Terminal', false);
            vscode.window.showInformationMessage(`Created terminal: ${session.name}`);
        }
    );
    disposables.push(createNewTerminal);

    // Command: Select Active Terminal
    const selectTerminal = vscode.commands.registerCommand(
        'kimi.selectTerminal',
        async () => {
            const session = await terminalManager.showTerminalPicker();
            if (session) {
                session.terminal.show();
                vscode.window.showInformationMessage(`Switched to terminal: ${session.name}`);
            }
        }
    );
    disposables.push(selectTerminal);

    // Command: Kill Terminal
    const killTerminal = vscode.commands.registerCommand(
        'kimi.killTerminal',
        async () => {
            const terminals = terminalManager.getAllTerminals();
            
            if (terminals.length === 0) {
                vscode.window.showWarningMessage('No active Kimi terminals');
                return;
            }

            const items = terminals.map(t => ({
                label: t.name,
                description: t.id,
                session: t
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select terminal to close'
            });

            if (selected) {
                terminalManager.closeTerminal(selected.session.id);
                vscode.window.showInformationMessage(`Closed terminal: ${selected.session.name}`);
            }
        }
    );
    disposables.push(killTerminal);

    // Command: Clear Terminal
    const clearTerminal = vscode.commands.registerCommand(
        'kimi.clearTerminal',
        async () => {
            const session = terminalManager.getDefaultTerminal();
            session.terminal.sendText('clear', true);
        }
    );
    disposables.push(clearTerminal);

    // Command: Execute Kimi Shell
    const executeKimiShell = vscode.commands.registerCommand(
        'kimi.executeShell',
        async (command?: string) => {
            try {
                if (!command) {
                    const input = await vscode.window.showInputBox({
                        prompt: 'Enter shell command to execute via kimi-cli',
                        placeHolder: 'e.g., ls -la',
                        ignoreFocusOut: true
                    });
                    
                    if (!input) return;
                    command = input;
                }

                const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                await terminalManager.executeKimiShell(command, workspaceFolder);

            } catch (error) {
                vscode.window.showErrorMessage(
                    `Failed to execute shell command: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }
    );
    disposables.push(executeKimiShell);

    // Command: Show Terminal History
    const showTerminalHistory = vscode.commands.registerCommand(
        'kimi.showTerminalHistory',
        async () => {
            const history = shellIntegration.getCommandHistory(20);
            
            if (history.length === 0) {
                vscode.window.showInformationMessage('No command history available');
                return;
            }

            const items = history.map(cmd => ({
                label: cmd.command,
                description: `${cmd.status} | ${cmd.startTime.toLocaleTimeString()}`,
                detail: cmd.exitCode !== undefined ? `Exit code: ${cmd.exitCode}` : undefined,
                command: cmd
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a command to re-run or view details'
            });

            if (selected) {
                const action = await vscode.window.showQuickPick([
                    { label: '$(play) Run Again', id: 'run' },
                    { label: '$(output) View Output', id: 'output' },
                    { label: '$(copy) Copy Command', id: 'copy' }
                ], {
                    placeHolder: 'Choose an action'
                });

                switch (action?.id) {
                    case 'run':
                        await vscode.commands.executeCommand('kimi.runInTerminal', selected.command.command);
                        break;
                    case 'output':
                        const doc = await vscode.workspace.openTextDocument({
                            content: selected.command.output || 'No output captured',
                            language: 'plaintext'
                        });
                        await vscode.window.showTextDocument(doc);
                        break;
                    case 'copy':
                        await vscode.env.clipboard.writeText(selected.command.command);
                        vscode.window.showInformationMessage('Command copied to clipboard');
                        break;
                }
            }
        }
    );
    disposables.push(showTerminalHistory);

    // Command: Send Text to Terminal
    const sendTextToTerminal = vscode.commands.registerCommand(
        'kimi.sendTextToTerminal',
        async (text?: string) => {
            if (!text) {
                const input = await vscode.window.showInputBox({
                    prompt: 'Enter text to send to terminal',
                    ignoreFocusOut: true
                });
                
                if (!input) return;
                text = input;
            }

            const session = terminalManager.getDefaultTerminal();
            session.terminal.sendText(text, false); // Don't add newline
        }
    );
    disposables.push(sendTextToTerminal);

    // Register all disposables
    disposables.forEach(d => context.subscriptions.push(d));

    return disposables;
}

/**
 * Register terminal-related context menu items and keybindings
 */
export function registerTerminalContextMenu(context: vscode.ExtensionContext): void {
    // This function can be extended to register additional context menu items
    // that are defined in package.json
}
