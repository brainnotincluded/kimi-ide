import * as vscode from 'vscode';
import { KimiApi } from '../kimi/apiAdapter';

export class KimiCodeActionProvider implements vscode.CodeActionProvider, vscode.Disposable {
    private kimiApi: KimiApi;
    private disposables: vscode.Disposable[] = [];

    // Code action kinds
    public static readonly providedCodeActionKinds = [
        vscode.CodeActionKind.QuickFix,
        vscode.CodeActionKind.RefactorRewrite,
        vscode.CodeActionKind.Source,
    ];

    constructor(kimiApi: KimiApi) {
        this.kimiApi = kimiApi;
        this.registerCommands();
    }

    /**
     * Register additional commands
     */
    private registerCommands(): void {
        const commands = [
            vscode.commands.registerCommand('kimi.explainCode', () => this.explainSelectedCode()),
            vscode.commands.registerCommand('kimi.fixCode', () => this.fixSelectedCode()),
            vscode.commands.registerCommand('kimi.generateTests', () => this.generateTests()),
            vscode.commands.registerCommand('kimi.optimizeCode', () => this.optimizeCode()),
            vscode.commands.registerCommand('kimi.addDocs', () => this.addDocumentation()),
            vscode.commands.registerCommand('kimi.refactorCode', () => this.refactorCode()),
        ];

        this.disposables.push(...commands);
    }

    /**
     * Provide code actions for the given document and range
     */
    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const actions: vscode.CodeAction[] = [];

        // Only provide actions if there's a selection
        if (range.isEmpty) {
            return actions;
        }

        const selectedText = document.getText(range);
        if (selectedText.trim().length < 3) {
            return actions;
        }

        // Create AI-powered code actions
        const explainAction = this.createCodeAction(
            '$(question) Kimi: Explain this code',
            'kimi.explainCode',
            vscode.CodeActionKind.Source,
            'Explain the selected code in detail'
        );

        const fixAction = this.createCodeAction(
            '$(tools) Kimi: Fix this code',
            'kimi.fixCode',
            vscode.CodeActionKind.QuickFix,
            'Fix potential issues in the selected code'
        );

        const optimizeAction = this.createCodeAction(
            '$(rocket) Kimi: Optimize this code',
            'kimi.optimizeCode',
            vscode.CodeActionKind.RefactorRewrite,
            'Optimize the selected code for performance'
        );

        const testAction = this.createCodeAction(
            '$(beaker) Kimi: Generate tests',
            'kimi.generateTests',
            vscode.CodeActionKind.Source,
            'Generate unit tests for the selected code'
        );

        const docAction = this.createCodeAction(
            '$(book) Kimi: Add documentation',
            'kimi.addDocs',
            vscode.CodeActionKind.Source,
            'Add documentation/comments to the selected code'
        );

        const refactorAction = this.createCodeAction(
            '$(sync) Kimi: Refactor',
            'kimi.refactorCode',
            vscode.CodeActionKind.RefactorRewrite,
            'Refactor the selected code for better structure'
        );

        // Add inline edit action (Cmd+K)
        const inlineEditAction = this.createCodeAction(
            '$(edit) Kimi: Edit with instructions (Cmd+K)',
            'kimi.inlineEdit',
            vscode.CodeActionKind.RefactorRewrite,
            'Edit the selected code with custom instructions'
        );
        inlineEditAction.isPreferred = true;

        actions.push(
            explainAction,
            fixAction,
            optimizeAction,
            testAction,
            docAction,
            refactorAction,
            inlineEditAction
        );

        return actions;
    }

    /**
     * Create a code action
     */
    private createCodeAction(
        title: string,
        command: string,
        kind: vscode.CodeActionKind,
        tooltip?: string
    ): vscode.CodeAction {
        const action = new vscode.CodeAction(title, kind);
        action.command = {
            command,
            title,
            tooltip,
        };
        return action;
    }

    /**
     * Explain the selected code
     */
    public async explainSelectedCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to explain');
            return;
        }

        const selectedCode = editor.document.getText(editor.selection);
        const language = editor.document.languageId;

        const prompt = `Explain the following ${language} code in detail:

\`\`\`${language}
${selectedCode}
\`\`\`

Please provide:
1. What this code does at a high level
2. Step-by-step breakdown of the logic
3. Any important patterns or techniques used
4. Potential edge cases or considerations`;

        await this.runKimiAction('Explaining code...', prompt, 'Explanation');
    }

    /**
     * Fix the selected code
     */
    public async fixSelectedCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to fix');
            return;
        }

        const selectedCode = editor.document.getText(editor.selection);
        const language = editor.document.languageId;

        const prompt = `Fix any issues in the following ${language} code. Look for:
- Bugs or logical errors
- Potential exceptions or crashes
- Security vulnerabilities
- Performance issues
- Type errors

Original code:
\`\`\`${language}
${selectedCode}
\`\`\`

Please provide ONLY the fixed code without explanations. The fixed code should be a drop-in replacement.`;

        await this.runKimiEditAction('Fixing code...', prompt);
    }

    /**
     * Generate tests for the selected code
     */
    public async generateTests(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to generate tests for');
            return;
        }

        const selectedCode = editor.document.getText(editor.selection);
        const language = editor.document.languageId;

        const prompt = `Generate comprehensive unit tests for the following ${language} code:

\`\`\`${language}
${selectedCode}
\`\`\`

Please provide:
1. Test cases covering normal scenarios
2. Edge case tests
3. Error handling tests
4. Use appropriate testing framework for ${language} (e.g., pytest for Python, Jest for JavaScript, etc.)

Output only the test code without explanations.`;

        await this.runKimiAction('Generating tests...', prompt, 'Generated Tests');
    }

    /**
     * Optimize the selected code
     */
    public async optimizeCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to optimize');
            return;
        }

        const selectedCode = editor.document.getText(editor.selection);
        const language = editor.document.languageId;

        const prompt = `Optimize the following ${language} code for:
- Performance (speed, memory usage)
- Readability
- Best practices

Original code:
\`\`\`${language}
${selectedCode}
\`\`\`

Please provide ONLY the optimized code without explanations. Maintain the same functionality but make it better.`;

        await this.runKimiEditAction('Optimizing code...', prompt);
    }

    /**
     * Add documentation to the selected code
     */
    public async addDocumentation(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to document');
            return;
        }

        const selectedCode = editor.document.getText(editor.selection);
        const language = editor.document.languageId;

        const prompt = `Add comprehensive documentation to the following ${language} code. Include:
- Docstrings/comments explaining what the code does
- Parameter descriptions
- Return value descriptions
- Any important notes or warnings

Original code:
\`\`\`${language}
${selectedCode}
\`\`\`

Please provide the documented code with appropriate comments and docstrings for the language.`;

        await this.runKimiEditAction('Adding documentation...', prompt);
    }

    /**
     * Refactor the selected code
     */
    public async refactorCode(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor || editor.selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to refactor');
            return;
        }

        const selectedCode = editor.document.getText(editor.selection);
        const language = editor.document.languageId;

        const prompt = `Refactor the following ${language} code to improve:
- Code structure and organization
- Maintainability
- Following SOLID principles
- Reducing complexity

Original code:
\`\`\`${language}
${selectedCode}
\`\`\`

Please provide ONLY the refactored code without explanations. Keep the same functionality but improve the design.`;

        await this.runKimiEditAction('Refactoring code...', prompt);
    }

    /**
     * Run Kimi action and display result in output panel
     */
    private async runKimiAction(
        progressTitle: string,
        prompt: string,
        resultTitle: string
    ): Promise<void> {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: progressTitle,
                cancellable: true,
            },
            async (progress, token) => {
                try {
                    const response = await this.kimiApi.generateResponse(prompt, {
                        signal: token.isCancellationRequested ? new AbortController().signal : undefined,
                    });

                    if (token.isCancellationRequested) {
                        return;
                    }

                    if (response.error) {
                        throw new Error(response.error);
                    }

                    // Show result in a new untitled document
                    const document = await vscode.workspace.openTextDocument({
                        content: response.content,
                        language: 'markdown',
                    });

                    await vscode.window.showTextDocument(document, {
                        viewColumn: vscode.ViewColumn.Beside,
                        preview: true,
                    });
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Kimi action failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                    );
                }
            }
        );
    }

    /**
     * Run Kimi action that produces edited code
     */
    private async runKimiEditAction(
        progressTitle: string,
        prompt: string
    ): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: progressTitle,
                cancellable: true,
            },
            async (progress, token) => {
                try {
                    const response = await this.kimiApi.generateEdit(prompt, {
                        signal: token.isCancellationRequested ? new AbortController().signal : undefined,
                    });

                    if (token.isCancellationRequested) {
                        return;
                    }

                    if (response.error) {
                        throw new Error(response.error);
                    }

                    // Apply the edit
                    const edit = new vscode.WorkspaceEdit();
                    edit.replace(editor.document.uri, editor.selection, response.content);

                    const success = await vscode.workspace.applyEdit(edit);
                    if (success) {
                        vscode.window.showInformationMessage('Edit applied successfully');
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Kimi action failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                    );
                }
            }
        );
    }

    /**
     * Dispose all resources
     */
    public dispose(): void {
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}

/**
 * Provide inline completions (ghost text) from Kimi
 */
export class KimiInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
    private kimiApi: KimiApi;

    constructor(kimiApi: KimiApi) {
        this.kimiApi = kimiApi;
    }

    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null> {
        // Only trigger on specific patterns or manual trigger
        if (context.triggerKind === vscode.InlineCompletionTriggerKind.Automatic) {
            // Check if we should provide completion (e.g., after specific characters)
            const lineText = document.lineAt(position).text;
            const prefix = lineText.substring(0, position.character);
            
            // Trigger on specific patterns
            const triggerPatterns = [
                /\/\/\s*AI:\s*$/,
                /#\s*AI:\s*$/,
                /\/\*\s*AI:\s*$/,
                /\*\s*AI:\s*$/,
            ];

            if (!triggerPatterns.some(pattern => pattern.test(prefix))) {
                return null;
            }
        }

        try {
            // Get context around cursor
            const contextRange = new vscode.Range(
                new vscode.Position(Math.max(0, position.line - 20), 0),
                position
            );
            const codeContext = document.getText(contextRange);

            const prompt = `Continue the following code. Complete the current line or provide the next few lines of code.

Language: ${document.languageId}

Code context:
\`\`\`${document.languageId}
${codeContext}
\`\`\`

Continue from here (provide only the code continuation, no explanations):`;

            const response = await this.kimiApi.generateResponse(prompt, {
                signal: token.isCancellationRequested ? new AbortController().signal : undefined,
            });

            if (token.isCancellationRequested || response.error) {
                return null;
            }

            const completion = response.content.trim();
            if (!completion) {
                return null;
            }

            return [
                new vscode.InlineCompletionItem(completion, new vscode.Range(position, position)),
            ];
        } catch (error) {
            console.error('Inline completion error:', error);
            return null;
        }
    }
}
