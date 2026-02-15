import * as vscode from 'vscode';
import { KimiApi } from '../kimi/apiAdapter';
import { DiffProvider } from './DiffProvider';

interface InlineEditSession {
    id: string;
    editor: vscode.TextEditor;
    originalRange: vscode.Range;
    originalText: string;
    decorationType: vscode.TextEditorDecorationType;
    inputBox?: vscode.InputBox;
    webviewPanel?: vscode.WebviewPanel;
    suggestedEdit?: string;
}

export class InlineEditProvider implements vscode.Disposable {
    private sessions: Map<string, InlineEditSession> = new Map();
    private kimiApi: KimiApi;
    private diffProvider: DiffProvider;
    private disposables: vscode.Disposable[] = [];

    // Decoration types for inline UI
    private readonly inputBoxDecoration: vscode.TextEditorDecorationType;
    private readonly highlightDecoration: vscode.TextEditorDecorationType;
    private readonly previewDecoration: vscode.TextEditorDecorationType;

    constructor(kimiApi: KimiApi, diffProvider: DiffProvider) {
        this.kimiApi = kimiApi;
        this.diffProvider = diffProvider;

        // Initialize decoration types
        this.inputBoxDecoration = vscode.window.createTextEditorDecorationType({
            after: {
                contentText: '',
                margin: '0 0 0 0',
                backgroundColor: new vscode.ThemeColor('input.background'),
                border: '1px solid ' + new vscode.ThemeColor('input.border'),
                color: new vscode.ThemeColor('input.foreground'),
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
        });

        this.highlightDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('editor.selectionBackground'),
            borderRadius: '3px',
        });

        this.previewDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
            border: '1px dashed ' + new vscode.ThemeColor('diffEditor.insertedTextBackground'),
            borderRadius: '2px',
        });

        this.registerCommands();
    }

    private registerCommands(): void {
        // Main inline edit command (Cmd+K)
        const editSelectionCmd = vscode.commands.registerCommand(
            'kimi.inlineEdit',
            () => this.startInlineEdit()
        );

        // Accept suggested edit
        const acceptEditCmd = vscode.commands.registerCommand(
            'kimi.acceptEdit',
            () => this.acceptEdit()
        );

        // Reject suggested edit
        const rejectEditCmd = vscode.commands.registerCommand(
            'kimi.rejectEdit',
            () => this.rejectEdit()
        );

        // Show diff view
        const showDiffCmd = vscode.commands.registerCommand(
            'kimi.showDiff',
            () => this.showDiff()
        );

        this.disposables.push(editSelectionCmd, acceptEditCmd, rejectEditCmd, showDiffCmd);
    }

    /**
     * Start inline edit session for selected code
     */
    public async startInlineEdit(): Promise<void> {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showWarningMessage('No active editor');
            return;
        }

        const selection = editor.selection;
        if (selection.isEmpty) {
            vscode.window.showInformationMessage('Please select code to edit');
            return;
        }

        // Close any existing session in this editor
        this.closeSessionForEditor(editor);

        const sessionId = this.generateSessionId();
        const selectedText = editor.document.getText(selection);
        
        // Create session
        const session: InlineEditSession = {
            id: sessionId,
            editor,
            originalRange: new vscode.Range(selection.start, selection.end),
            originalText: selectedText,
            decorationType: this.highlightDecoration,
        };

        this.sessions.set(sessionId, session);

        // Highlight selected code
        this.highlightSelection(session);

        // Show input box for edit instructions
        await this.showInputBox(session);
    }

    /**
     * Show input box for user to enter edit instructions
     */
    private async showInputBox(session: InlineEditSession): Promise<void> {
        const inputBox = vscode.window.createInputBox();
        inputBox.title = 'Kimi: Edit Selection';
        inputBox.placeholder = 'Describe how to edit this code (e.g., "Add error handling", "Optimize this loop")';
        inputBox.prompt = `Editing ${session.originalRange.end.line - session.originalRange.start.line + 1} lines`;
        
        // Add buttons
        const cancelButton = vscode.QuickInputButtons.Back;
        inputBox.buttons = [cancelButton];

        inputBox.onDidTriggerButton(() => {
            inputBox.hide();
            this.cleanupSession(session.id);
        });

        inputBox.onDidHide(() => {
            if (!session.suggestedEdit) {
                this.cleanupSession(session.id);
            }
        });

        inputBox.onDidAccept(async () => {
            const instruction = inputBox.value.trim();
            if (!instruction) {
                return;
            }

            inputBox.busy = true;
            inputBox.enabled = false;

            try {
                await this.processEditRequest(session, instruction);
            } finally {
                inputBox.dispose();
            }
        });

        session.inputBox = inputBox;
        inputBox.show();
    }

    /**
     * Process edit request with Kimi API
     */
    private async processEditRequest(session: InlineEditSession, instruction: string): Promise<void> {
        const progressOptions: vscode.ProgressOptions = {
            location: vscode.ProgressLocation.Notification,
            title: 'Kimi is editing your code...',
            cancellable: true,
        };

        await vscode.window.withProgress(progressOptions, async (progress, token) => {
            try {
                // Get surrounding context
                const context = this.getSurroundingContext(session.editor, session.originalRange);
                
                // Build prompt for Kimi
                const prompt = this.buildEditPrompt(
                    session.originalText,
                    instruction,
                    context,
                    session.editor.document.languageId
                );

                // Call Kimi API
                const response = await this.kimiApi.generateEdit(prompt, {
                    signal: token.isCancellationRequested ? new AbortController().signal : undefined,
                });

                if (token.isCancellationRequested) {
                    return;
                }

                if (response.error) {
                    throw new Error(response.error);
                }

                const suggestedEdit = response.content;
                session.suggestedEdit = suggestedEdit;

                // Show inline diff preview
                await this.showInlinePreview(session, suggestedEdit);

                // Show accept/reject UI
                this.showAcceptRejectUI(session);

            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                vscode.window.showErrorMessage(`Kimi edit failed: ${errorMessage}`);
                this.cleanupSession(session.id);
            }
        });
    }

    /**
     * Get surrounding context for better editing
     */
    private getSurroundingContext(
        editor: vscode.TextEditor,
        range: vscode.Range,
        linesBefore: number = 10,
        linesAfter: number = 10
    ): { before: string; after: string } {
        const document = editor.document;
        
        const contextStartLine = Math.max(0, range.start.line - linesBefore);
        const contextEndLine = Math.min(document.lineCount - 1, range.end.line + linesAfter);

        const beforeRange = new vscode.Range(
            new vscode.Position(contextStartLine, 0),
            new vscode.Position(range.start.line, 0)
        );

        const afterRange = new vscode.Range(
            new vscode.Position(range.end.line + 1, 0),
            new vscode.Position(contextEndLine, document.lineAt(contextEndLine).text.length)
        );

        return {
            before: document.getText(beforeRange),
            after: document.getText(afterRange),
        };
    }

    /**
     * Build edit prompt for Kimi
     */
    private buildEditPrompt(
        selectedCode: string,
        instruction: string,
        context: { before: string; after: string },
        language: string
    ): string {
        return `You are an expert code editor. Edit the following code according to the user's instruction.

Language: ${language}

Context before:
\`\`\`${language}
${context.before}
\`\`\`

Selected code to edit:
\`\`\`${language}
${selectedCode}
\`\`\`

Context after:
\`\`\`${language}
${context.after}
\`\`\`

User's instruction: "${instruction}"

Please provide ONLY the edited code as a replacement for the selected code. Do not include explanations, markdown formatting, or any text outside the code itself. The edited code should be a drop-in replacement that maintains proper indentation and fits seamlessly with the surrounding context.`;
    }

    /**
     * Show inline preview of suggested edit
     */
    private async showInlinePreview(session: InlineEditSession, suggestedEdit: string): Promise<void> {
        // Create inline diff using decorations
        const lines = suggestedEdit.split('\n');
        const decorations: vscode.DecorationOptions[] = [];

        // Calculate position for preview (after selected code)
        const endLine = session.originalRange.end.line;
        const endChar = session.editor.document.lineAt(endLine).text.length;
        const position = new vscode.Position(endLine, endChar);

        // Create hover message with actions
        const hoverMessage = new vscode.MarkdownString();
        hoverMessage.isTrusted = true;
        hoverMessage.supportHtml = true;
        hoverMessage.appendMarkdown(`
**Kimi Suggested Edit**\n\n
[Accept](command:kimi.acceptEdit) | [Reject](command:kimi.rejectEdit) | [View Diff](command:kimi.showDiff)\n\n
\`\`\`${session.editor.document.languageId}
${suggestedEdit}
\`\`\`
        `);

        decorations.push({
            range: new vscode.Range(position, position),
            hoverMessage,
        });

        // Add preview decoration
        session.editor.setDecorations(this.previewDecoration, decorations);

        // Store session data for accept/reject
        (session.editor as any).kimiInlineEditSession = session;
    }

    /**
     * Show accept/reject UI (can be inline or as code actions)
     */
    private showAcceptRejectUI(session: InlineEditSession): void {
        // Create a status bar item for quick actions
        const statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Right,
            100
        );
        statusBarItem.text = `$(lightbulb) Kimi Edit: $(check) Accept | $(x) Reject`;
        statusBarItem.tooltip = 'Kimi suggested an edit for the selected code';
        statusBarItem.command = 'kimi.showDiff';
        statusBarItem.show();

        // Auto-hide after 30 seconds if not interacted
        setTimeout(() => {
            statusBarItem.dispose();
        }, 30000);

        // Also show information message with actions
        vscode.window
            .showInformationMessage(
                'Kimi suggested an edit',
                { modal: false },
                { title: '$(check) Accept', action: 'accept' },
                { title: '$(x) Reject', action: 'reject' },
                { title: '$(diff) View Diff', action: 'diff' }
            )
            .then((selection) => {
                if (selection?.action === 'accept') {
                    this.acceptEdit();
                } else if (selection?.action === 'reject') {
                    this.rejectEdit();
                } else if (selection?.action === 'diff') {
                    this.showDiff();
                }
            });
    }

    /**
     * Accept the suggested edit
     */
    public async acceptEdit(): Promise<void> {
        const session = this.getActiveSession();
        if (!session || !session.suggestedEdit) {
            vscode.window.showWarningMessage('No active edit session');
            return;
        }

        const edit = new vscode.WorkspaceEdit();
        edit.replace(
            session.editor.document.uri,
            session.originalRange,
            session.suggestedEdit
        );

        const success = await vscode.workspace.applyEdit(edit);
        if (success) {
            vscode.window.showInformationMessage('Edit applied successfully');
        }

        this.cleanupSession(session.id);
    }

    /**
     * Reject the suggested edit
     */
    public rejectEdit(): void {
        const session = this.getActiveSession();
        if (!session) {
            return;
        }

        vscode.window.showInformationMessage('Edit rejected');
        this.cleanupSession(session.id);
    }

    /**
     * Show full diff view
     */
    public async showDiff(): Promise<void> {
        const session = this.getActiveSession();
        if (!session || !session.suggestedEdit) {
            vscode.window.showWarningMessage('No active edit session');
            return;
        }

        await this.diffProvider.showDiff(
            session.editor.document,
            session.originalRange,
            session.originalText,
            session.suggestedEdit,
            'Kimi Suggested Edit'
        );
    }

    /**
     * Get active session (most recent)
     */
    private getActiveSession(): InlineEditSession | undefined {
        const sessions = Array.from(this.sessions.values());
        return sessions[sessions.length - 1];
    }

    /**
     * Highlight the selected code
     */
    private highlightSelection(session: InlineEditSession): void {
        session.editor.setDecorations(this.highlightDecoration, [session.originalRange]);
    }

    /**
     * Clean up a session
     */
    private cleanupSession(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        // Remove decorations
        session.editor.setDecorations(this.highlightDecoration, []);
        session.editor.setDecorations(this.previewDecoration, []);
        session.editor.setDecorations(this.inputBoxDecoration, []);

        // Dispose input box
        session.inputBox?.dispose();
        session.webviewPanel?.dispose();

        // Clear session data
        delete (session.editor as any).kimiInlineEditSession;
        
        this.sessions.delete(sessionId);
    }

    /**
     * Close any existing session for an editor
     */
    private closeSessionForEditor(editor: vscode.TextEditor): void {
        Array.from(this.sessions.entries()).forEach(([id, session]) => {
            if (session.editor === editor) {
                this.cleanupSession(id);
            }
        });
    }

    /**
     * Generate unique session ID
     */
    private generateSessionId(): string {
        return `kimi-edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Dispose all resources
     */
    public dispose(): void {
        // Clean up all sessions
        Array.from(this.sessions.keys()).forEach((id) => {
            this.cleanupSession(id);
        });

        // Dispose decoration types
        this.inputBoxDecoration.dispose();
        this.highlightDecoration.dispose();
        this.previewDecoration.dispose();

        // Dispose commands
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
    }
}
