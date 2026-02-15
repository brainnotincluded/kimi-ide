/**
 * Kimi IDE - Review Reporter
 * Репортинг результатов review в VS Code
 * Интеграция с diagnostics, CodeLens, CodeActions
 */

import * as vscode from 'vscode';
import { ReviewResult, ReviewIssue, ReviewSeverity, ReviewCodeLens } from './types';
import { logger } from '../utils/logger';
import { toDiagnosticSeverity } from './utils';

export class ReviewReporter implements vscode.Disposable {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private codeLensProvider: ReviewCodeLensProvider;
    private codeActionProvider: ReviewCodeActionProvider;
    private disposables: vscode.Disposable[] = [];
    
    // Track accepted/suppressed issues
    private suppressedIssues: Set<string> = new Set();
    
    // Store current results for quick access
    private currentResults: Map<string, ReviewResult> = new Map();
    
    constructor() {
        // Create diagnostic collection
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('kimi-review');
        this.disposables.push(this.diagnosticCollection);
        
        // Create CodeLens provider
        this.codeLensProvider = new ReviewCodeLensProvider(this);
        const codeLensDisposable = vscode.languages.registerCodeLensProvider(
            { pattern: '**/*' },
            this.codeLensProvider
        );
        this.disposables.push(codeLensDisposable);
        
        // Create CodeAction provider
        this.codeActionProvider = new ReviewCodeActionProvider(this);
        const codeActionDisposable = vscode.languages.registerCodeActionsProvider(
            { pattern: '**/*' },
            this.codeActionProvider,
            {
                providedCodeActionKinds: [
                    vscode.CodeActionKind.QuickFix,
                    vscode.CodeActionKind.Source,
                ],
            }
        );
        this.disposables.push(codeActionDisposable);
        
        // Register commands
        this.registerCommands();
    }
    
    /**
     * Register commands for review actions
     */
    private registerCommands(): void {
        const commands = [
            vscode.commands.registerCommand(
                'kimi.review.acceptIssue',
                (issueId: string) => this.acceptIssue(issueId)
            ),
            vscode.commands.registerCommand(
                'kimi.review.suppressIssue',
                (issueId: string) => this.suppressIssue(issueId)
            ),
            vscode.commands.registerCommand(
                'kimi.review.fixIssue',
                (issue: ReviewIssue) => this.fixIssue(issue)
            ),
            vscode.commands.registerCommand(
                'kimi.review.fixAllIssues',
                (uri: vscode.Uri) => this.fixAllIssues(uri)
            ),
            vscode.commands.registerCommand(
                'kimi.review.showDetails',
                (issue: ReviewIssue) => this.showIssueDetails(issue)
            ),
            vscode.commands.registerCommand(
                'kimi.review.clearResults',
                () => this.clearAllResults()
            ),
        ];
        
        this.disposables.push(...commands);
    }
    
    /**
     * Report review results to VS Code
     */
    public reportResult(result: ReviewResult): void {
        const uri = result.fileUri;
        const uriString = uri.toString();
        
        // Store result
        this.currentResults.set(uriString, result);
        
        // Convert issues to diagnostics
        const diagnostics: vscode.Diagnostic[] = result.allIssues
            .filter(issue => !this.suppressedIssues.has(issue.id))
            .map(issue => this.issueToDiagnostic(issue));
        
        // Set diagnostics
        this.diagnosticCollection.set(uri, diagnostics);
        
        // Update CodeLens
        this.codeLensProvider.updateResult(result);
        
        logger.debug(`Reported ${diagnostics.length} diagnostics for ${uriString}`);
    }
    
    /**
     * Convert a review issue to VS Code diagnostic
     */
    private issueToDiagnostic(issue: ReviewIssue): vscode.Diagnostic {
        const diagnostic = new vscode.Diagnostic(
            issue.range,
            issue.message,
            toDiagnosticSeverity(issue.severity)
        );
        
        // Set code for identification
        diagnostic.code = {
            value: issue.id,
            target: vscode.Uri.parse(`command:kimi.review.showDetails?${encodeURIComponent(JSON.stringify(issue))}`),
        };
        
        // Set source
        diagnostic.source = `Kimi Review: ${issue.category}`;
        
        // Add tags
        if (issue.severity === 'error') {
            diagnostic.tags = [vscode.DiagnosticTag.Unnecessary];
        }
        
        // Add related information
        if (issue.relatedInformation && issue.relatedInformation.length > 0) {
            diagnostic.relatedInformation = issue.relatedInformation.map(info => 
                new vscode.DiagnosticRelatedInformation(
                    new vscode.Location(info.fileUri, info.range),
                    info.message
                )
            );
        }
        
        return diagnostic;
    }
    
    /**
     * Get current result for a document
     */
    public getResult(uri: vscode.Uri): ReviewResult | undefined {
        return this.currentResults.get(uri.toString());
    }
    
    /**
     * Get issue by ID
     */
    public getIssue(issueId: string): ReviewIssue | undefined {
        for (const result of this.currentResults.values()) {
            const issue = result.allIssues.find(i => i.id === issueId);
            if (issue) {
                return issue;
            }
        }
        return undefined;
    }
    
    /**
     * Accept an issue (mark as acknowledged)
     */
    private async acceptIssue(issueId: string): Promise<void> {
        const issue = this.getIssue(issueId);
        if (!issue) {
            return;
        }
        
        // Could store accepted issues for analytics
        logger.info(`Issue accepted: ${issue.message}`);
        
        // Refresh diagnostics
        const result = this.currentResults.get(issue.fileUri.toString());
        if (result) {
            this.reportResult(result);
        }
        
        vscode.window.showInformationMessage('Issue marked as acknowledged');
    }
    
    /**
     * Suppress an issue (hide it)
     */
    private async suppressIssue(issueId: string): Promise<void> {
        this.suppressedIssues.add(issueId);
        
        const issue = this.getIssue(issueId);
        if (issue) {
            const result = this.currentResults.get(issue.fileUri.toString());
            if (result) {
                this.reportResult(result);
            }
        }
        
        vscode.window.showInformationMessage('Issue suppressed');
    }
    
    /**
     * Fix an issue using its quick fix
     */
    private async fixIssue(issue: ReviewIssue): Promise<void> {
        if (!issue.quickFixes || issue.quickFixes.length === 0) {
            vscode.window.showWarningMessage('No automatic fix available for this issue');
            return;
        }
        
        const preferredFix = issue.quickFixes.find(f => f.isPreferred) || issue.quickFixes[0];
        
        try {
            const success = await vscode.workspace.applyEdit(preferredFix.edit);
            if (success) {
                vscode.window.showInformationMessage(`Applied fix: ${preferredFix.title}`);
            } else {
                vscode.window.showErrorMessage('Failed to apply fix');
            }
        } catch (error) {
            logger.error('Failed to apply fix:', error);
            vscode.window.showErrorMessage(`Failed to apply fix: ${error}`);
        }
    }
    
    /**
     * Fix all auto-fixable issues in a document
     */
    private async fixAllIssues(uri: vscode.Uri): Promise<void> {
        const result = this.currentResults.get(uri.toString());
        if (!result) {
            return;
        }
        
        const autoFixableIssues = result.allIssues.filter(
            issue => issue.quickFixes && issue.quickFixes.length > 0
        );
        
        if (autoFixableIssues.length === 0) {
            vscode.window.showInformationMessage('No auto-fixable issues found');
            return;
        }
        
        const choice = await vscode.window.showInformationMessage(
            `Fix ${autoFixableIssues.length} auto-fixable issues?`,
            'Fix All',
            'Cancel'
        );
        
        if (choice !== 'Fix All') {
            return;
        }
        
        const edit = new vscode.WorkspaceEdit();
        
        for (const issue of autoFixableIssues) {
            const fix = issue.quickFixes!.find(f => f.isPreferred) || issue.quickFixes![0];
            
            // Merge edits from each fix
            for (const [uri, edits] of fix.edit.entries()) {
                for (const textEdit of edits) {
                    edit.replace(uri, textEdit.range, textEdit.newText);
                }
            }
        }
        
        try {
            const success = await vscode.workspace.applyEdit(edit);
            if (success) {
                vscode.window.showInformationMessage(`Fixed ${autoFixableIssues.length} issues`);
            } else {
                vscode.window.showErrorMessage('Failed to apply fixes');
            }
        } catch (error) {
            logger.error('Failed to apply fixes:', error);
            vscode.window.showErrorMessage(`Failed to apply fixes: ${error}`);
        }
    }
    
    /**
     * Show issue details
     */
    private async showIssueDetails(issue: ReviewIssue): Promise<void> {
        const items: vscode.QuickPickItem[] = [
            {
                label: '$(warning) Issue Details',
                description: issue.message,
                detail: issue.detail || 'No additional details',
            },
        ];
        
        if (issue.quickFixes && issue.quickFixes.length > 0) {
            items.push({
                label: '$(lightbulb-autofix) Quick Fixes Available',
                description: `${issue.quickFixes.length} fix(es)`,
            });
        }
        
        items.push(
            { label: '$(check) Accept Issue', description: 'Mark as acknowledged' },
            { label: '$(eye-closed) Suppress Issue', description: 'Hide this issue' }
        );
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an action',
        });
        
        if (!selected) {
            return;
        }
        
        if (selected.label.includes('Quick Fixes')) {
            await this.showQuickFixes(issue);
        } else if (selected.label.includes('Accept')) {
            await this.acceptIssue(issue.id);
        } else if (selected.label.includes('Suppress')) {
            await this.suppressIssue(issue.id);
        }
    }
    
    /**
     * Show available quick fixes for an issue
     */
    private async showQuickFixes(issue: ReviewIssue): Promise<void> {
        if (!issue.quickFixes || issue.quickFixes.length === 0) {
            return;
        }
        
        const items = issue.quickFixes.map(fix => ({
            label: `$(lightbulb-autofix) ${fix.title}`,
            description: fix.description || '',
            fix,
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a fix to apply',
        });
        
        if (selected) {
            await this.applyFix(selected.fix);
        }
    }
    
    /**
     * Apply a specific fix
     */
    private async applyFix(fix: { id: string; title: string; description?: string; edit: vscode.WorkspaceEdit }): Promise<void> {
        try {
            const success = await vscode.workspace.applyEdit(fix.edit);
            if (success) {
                vscode.window.showInformationMessage(`Applied: ${fix.title}`);
            } else {
                vscode.window.showErrorMessage('Failed to apply fix');
            }
        } catch (error) {
            logger.error('Failed to apply fix:', error);
            vscode.window.showErrorMessage(`Failed to apply fix: ${error}`);
        }
    }
    
    /**
     * Clear all results
     */
    private clearAllResults(): void {
        this.diagnosticCollection.clear();
        this.currentResults.clear();
        this.codeLensProvider.clearResults();
        vscode.window.showInformationMessage('All review results cleared');
    }
    
    /**
     * Clear results for a specific document
     */
    public clearResult(uri: vscode.Uri): void {
        this.diagnosticCollection.delete(uri);
        this.currentResults.delete(uri.toString());
        this.codeLensProvider.clearResult(uri);
    }
    
    /**
     * Get all current results
     */
    public getAllResults(): Map<string, ReviewResult> {
        return new Map(this.currentResults);
    }
    
    /**
     * Dispose all resources
     */
    public dispose(): void {
        this.diagnosticCollection.dispose();
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.currentResults.clear();
        this.suppressedIssues.clear();
    }
}

/**
 * CodeLens provider for review acceptance/fix actions
 */
class ReviewCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    
    private results: Map<string, ReviewResult> = new Map();
    private reporter: ReviewReporter;
    
    constructor(reporter: ReviewReporter) {
        this.reporter = reporter;
    }
    
    public updateResult(result: ReviewResult): void {
        this.results.set(result.fileUri.toString(), result);
        this._onDidChangeCodeLenses.fire();
    }
    
    public clearResult(uri: vscode.Uri): void {
        this.results.delete(uri.toString());
        this._onDidChangeCodeLenses.fire();
    }
    
    public clearResults(): void {
        this.results.clear();
        this._onDidChangeCodeLenses.fire();
    }
    
    public provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.CodeLens[] {
        const result = this.results.get(document.uri.toString());
        if (!result || result.allIssues.length === 0) {
            return [];
        }
        
        const codeLenses: vscode.CodeLens[] = [];
        
        // Group issues by line
        const issuesByLine = new Map<number, ReviewIssue[]>();
        for (const issue of result.allIssues) {
            const line = issue.range.start.line;
            if (!issuesByLine.has(line)) {
                issuesByLine.set(line, []);
            }
            issuesByLine.get(line)!.push(issue);
        }
        
        // Create CodeLens for each line with issues
        for (const [line, issues] of issuesByLine) {
            const range = new vscode.Range(line, 0, line, 0);
            
            // Summary lens
            const summaryLens = new vscode.CodeLens(range, {
                title: `$(warning) ${issues.length} issue${issues.length > 1 ? 's' : ''}`,
                command: 'kimi.review.showDetails',
                arguments: [issues[0]],
            });
            codeLenses.push(summaryLens);
            
            // Fix all lens if auto-fixes available
            const autoFixableCount = issues.filter(i => i.quickFixes && i.quickFixes.length > 0).length;
            if (autoFixableCount > 0) {
                const fixLens = new vscode.CodeLens(range, {
                    title: `$(lightbulb-autofix) Fix ${autoFixableCount}`,
                    command: 'kimi.review.fixIssue',
                    arguments: [issues.find(i => i.quickFixes && i.quickFixes.length > 0)],
                });
                codeLenses.push(fixLens);
            }
        }
        
        // Add summary lens at top of file
        if (result.allIssues.length > 0) {
            const topRange = new vscode.Range(0, 0, 0, 0);
            const totalFixable = result.allIssues.filter(i => i.quickFixes && i.quickFixes.length > 0).length;
            
            const fileSummaryLens = new vscode.CodeLens(topRange, {
                title: `$(warning) Kimi Review: ${result.allIssues.length} issues (Score: ${result.summary.score})`,
                tooltip: `Click to fix all ${totalFixable} auto-fixable issues`,
                command: totalFixable > 0 ? 'kimi.review.fixAllIssues' : '',
                arguments: [document.uri],
            });
            codeLenses.unshift(fileSummaryLens);
        }
        
        return codeLenses;
    }
}

/**
 * CodeAction provider for quick fixes
 */
class ReviewCodeActionProvider implements vscode.CodeActionProvider {
    private reporter: ReviewReporter;
    
    constructor(reporter: ReviewReporter) {
        this.reporter = reporter;
    }
    
    public provideCodeActions(
        document: vscode.TextDocument,
        range: vscode.Range | vscode.Selection,
        context: vscode.CodeActionContext,
        token: vscode.CancellationToken
    ): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
        const actions: vscode.CodeAction[] = [];
        const result = this.reporter.getResult(document.uri);
        
        if (!result) {
            return actions;
        }
        
        // Find issues in the range
        const issuesInRange = result.allIssues.filter(issue => 
            range.intersection(issue.range) !== undefined
        );
        
        for (const issue of issuesInRange) {
            // Add quick fixes
            if (issue.quickFixes) {
                for (const fix of issue.quickFixes) {
                    const action = new vscode.CodeAction(
                        fix.title,
                        vscode.CodeActionKind.QuickFix
                    );
                    action.edit = fix.edit;
                    action.isPreferred = fix.isPreferred;
                    action.diagnostics = [this.reporter['issueToDiagnostic'](issue)];
                    actions.push(action);
                }
            }
            
            // Add suppress action
            const suppressAction = new vscode.CodeAction(
                `Suppress: ${issue.message}`,
                vscode.CodeActionKind.Source.append('suppress')
            );
            suppressAction.command = {
                command: 'kimi.review.suppressIssue',
                title: 'Suppress Issue',
                arguments: [issue.id],
            };
            actions.push(suppressAction);
        }
        
        // Add "Fix all in file" action if there are auto-fixable issues
        const totalAutoFixable = result.allIssues.filter(i => i.quickFixes && i.quickFixes.length > 0).length;
        if (totalAutoFixable > 0) {
            const fixAllAction = new vscode.CodeAction(
                `$(lightbulb-autofix) Fix all ${totalAutoFixable} auto-fixable issues`,
                vscode.CodeActionKind.SourceFixAll
            );
            fixAllAction.command = {
                command: 'kimi.review.fixAllIssues',
                title: 'Fix All Issues',
                arguments: [document.uri],
            };
            actions.unshift(fixAllAction);
        }
        
        return actions;
    }
}
