/**
 * VS Code Integration for Parallel Multi-Strategy Editing
 * Provides UI components and interactions with VS Code API
 */

import * as vscode from 'vscode';
import { UserSelectionOptions, EditingResult, RankedResult, MergeResult, ParallelEditResult } from './types';

/**
 * VS Code integration implementation
 */
export class VSCodeIntegrationImpl {
  private outputChannel: vscode.OutputChannel;
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel('Kimi Parallel Editor');
    this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    this.statusBarItem.command = 'kimi.parallelEditor.showResults';
  }

  /**
   * Show diff viewer for a single result
   */
  async showDiffViewer(options: {
    original: string;
    modified: string;
    title: string;
    language: string;
    viewColumn?: vscode.ViewColumn;
  }): Promise<void> {
    const originalUri = vscode.Uri.parse(`kimi-parallel://original/${Date.now()}`);
    const modifiedUri = vscode.Uri.parse(`kimi-parallel://modified/${Date.now()}`);

    // Create document content provider
    const provider = new (class implements vscode.TextDocumentContentProvider {
      private contents = new Map<string, string>();

      setContent(uri: vscode.Uri, content: string): void {
        this.contents.set(uri.toString(), content);
      }

      provideTextDocumentContent(uri: vscode.Uri): string {
        return this.contents.get(uri.toString()) || '';
      }
    })();

    provider.setContent(originalUri, options.original);
    provider.setContent(modifiedUri, options.modified);

    // Show diff
    await vscode.commands.executeCommand(
      'vscode.diff',
      originalUri,
      modifiedUri,
      options.title,
      {
        preview: true,
        viewColumn: options.viewColumn || vscode.ViewColumn.Two,
      }
    );
  }

  /**
   * Show multi-variant diff picker
   */
  async showMultiDiffViewer(options: {
    original: string;
    variants: Array<{
      content: string;
      label: string;
      description: string;
      result?: EditingResult;
    }>;
    title: string;
  }): Promise<number | 'merge' | 'cancel'> {
    // Create webview panel for side-by-side comparison
    const panel = vscode.window.createWebviewPanel(
      'kimiParallelEditor',
      options.title,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [],
      }
    );

    // Generate HTML content
    panel.webview.html = this.generateComparisonHtml(options);

    // Handle messages from webview
    const result = await new Promise<number | 'merge' | 'cancel'>((resolve) => {
      const disposable = panel.webview.onDidReceiveMessage((message) => {
        disposable.dispose();
        panel.dispose();
        
        switch (message.command) {
          case 'select':
            resolve(message.index);
            break;
          case 'merge':
            resolve('merge');
            break;
          case 'cancel':
            resolve('cancel');
            break;
          default:
            resolve('cancel');
        }
      });

      panel.onDidDispose(() => resolve('cancel'));
    });

    return result;
  }

  /**
   * Generate HTML for comparison view
   */
  private generateComparisonHtml(options: {
    original: string;
    variants: Array<{
      content: string;
      label: string;
      description: string;
      result?: EditingResult;
    }>;
  }): string {
    const { original, variants } = options;

    const variantCards = variants.map((v, i) => {
      const metrics = v.result?.metrics;
      const isMerge = v.label.toLowerCase().includes('merge');
      
      return `
        <div class="variant-card ${isMerge ? 'merge-card' : ''}" data-index="${i}">
          <div class="variant-header">
            <h3>${this.escapeHtml(v.label)}</h3>
            <p>${this.escapeHtml(v.description)}</p>
          </div>
          <div class="variant-metrics">
            ${metrics ? `
              <span class="metric">+${metrics.linesAdded}/-${metrics.linesRemoved} lines</span>
              ${metrics.complexityScore ? `<span class="metric">Complexity: ${(metrics.complexityScore * 100).toFixed(0)}%</span>` : ''}
            ` : ''}
          </div>
          <div class="variant-preview">
            <pre><code>${this.escapeHtml(v.content.substring(0, 500))}${v.content.length > 500 ? '...' : ''}</code></pre>
          </div>
          <div class="variant-actions">
            <button class="btn-select" onclick="selectVariant(${i})">Select</button>
            <button class="btn-preview" onclick="previewDiff(${i})">Preview Diff</button>
          </div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Parallel Editor Results</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      padding: 20px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
    }
    .header-actions {
      display: flex;
      gap: 10px;
    }
    .original-section {
      margin-bottom: 20px;
      padding: 15px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 6px;
    }
    .original-section h3 {
      margin-top: 0;
    }
    .original-section pre {
      max-height: 150px;
      overflow: auto;
      background: var(--vscode-editor-background);
      padding: 10px;
      border-radius: 4px;
    }
    .variants-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 15px;
    }
    .variant-card {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 15px;
      background: var(--vscode-editor-background);
      transition: box-shadow 0.2s;
    }
    .variant-card:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .variant-card.merge-card {
      border-color: var(--vscode-charts-blue);
      background: var(--vscode-editor-hoverHighlightBackground);
    }
    .variant-header h3 {
      margin: 0 0 5px 0;
      font-size: 14px;
    }
    .variant-header p {
      margin: 0;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }
    .variant-metrics {
      display: flex;
      gap: 10px;
      margin: 10px 0;
      flex-wrap: wrap;
    }
    .metric {
      font-size: 11px;
      padding: 2px 8px;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: 10px;
    }
    .variant-preview {
      margin: 10px 0;
    }
    .variant-preview pre {
      max-height: 200px;
      overflow: auto;
      background: var(--vscode-textCodeBlock-background);
      padding: 10px;
      border-radius: 4px;
      font-size: 12px;
      margin: 0;
    }
    .variant-actions {
      display: flex;
      gap: 10px;
      margin-top: 10px;
    }
    button {
      padding: 6px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-select {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .btn-select:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .btn-preview {
      background: var(--vscode-secondaryButton-background);
      color: var(--vscode-secondaryButton-foreground);
    }
    .btn-merge {
      background: var(--vscode-charts-blue);
      color: white;
    }
    .btn-cancel {
      background: transparent;
      border: 1px solid var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    .explanation-box {
      margin-top: 20px;
      padding: 15px;
      background: var(--vscode-editor-hoverHighlightBackground);
      border-radius: 6px;
      border-left: 3px solid var(--vscode-charts-blue);
    }
    .explanation-box h4 {
      margin-top: 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔀 Parallel Editor Results</h1>
    <div class="header-actions">
      ${variants.length > 3 ? '<button class="btn-merge" onclick="mergeVariants()">Merge Best Parts</button>' : ''}
      <button class="btn-cancel" onclick="cancel()">Cancel</button>
    </div>
  </div>

  <div class="original-section">
    <h3>📄 Original</h3>
    <pre><code>${this.escapeHtml(original.substring(0, 300))}${original.length > 300 ? '...' : ''}</code></pre>
  </div>

  <div class="variants-grid">
    ${variantCards}
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    function selectVariant(index) {
      vscode.postMessage({ command: 'select', index });
    }
    
    function previewDiff(index) {
      vscode.postMessage({ command: 'preview', index });
    }
    
    function mergeVariants() {
      vscode.postMessage({ command: 'merge' });
    }
    
    function cancel() {
      vscode.postMessage({ command: 'cancel' });
    }
  </script>
</body>
</html>`;
  }

  /**
   * Show results panel after editing
   */
  async showResultsPanel(result: ParallelEditResult): Promise<void> {
    const panel = vscode.window.createWebviewPanel(
      'kimiParallelEditorResults',
      'Parallel Editor Results',
      vscode.ViewColumn.Two,
      { enableScripts: true }
    );

    panel.webview.html = this.generateResultsHtml(result);
  }

  /**
   * Generate HTML for results view
   */
  private generateResultsHtml(result: ParallelEditResult): string {
    const strategyRows = result.rankedResults.map((r: RankedResult, i: number) => {
      const medals = ['🥇', '🥈', '🥉'];
      const medal = medals[i] || `${i + 1}.`;
      
      return `
        <tr class="${i === 0 ? 'winner' : ''}">
          <td>${medal} ${r.result.strategy}</td>
          <td>${(r.score * 100).toFixed(1)}%</td>
          <td>${(r.result.confidence * 100).toFixed(0)}%</td>
          <td>+${r.result.metrics.linesAdded}/-${r.result.metrics.linesRemoved}</td>
          <td>${(r.breakdown.safety * 100).toFixed(0)}%</td>
          <td>${r.result.duration}ms</td>
        </tr>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 20px; }
    h1 { font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid var(--vscode-panel-border); }
    th { font-weight: bold; }
    .winner { background: var(--vscode-editor-hoverHighlightBackground); }
    .explanation { 
      padding: 15px; 
      background: var(--vscode-textCodeBlock-background); 
      border-radius: 6px;
      white-space: pre-wrap;
    }
    .metrics { display: flex; gap: 20px; margin: 15px 0; }
    .metric-box { 
      padding: 10px 20px; 
      background: var(--vscode-badge-background);
      border-radius: 6px;
      text-align: center;
    }
    .metric-value { font-size: 24px; font-weight: bold; }
    .metric-label { font-size: 12px; opacity: 0.8; }
  </style>
</head>
<body>
  <h1>✅ Parallel Editing Complete</h1>
  
  <div class="metrics">
    <div class="metric-box">
      <div class="metric-value">${result.results.length}</div>
      <div class="metric-label">Strategies</div>
    </div>
    <div class="metric-box">
      <div class="metric-value">${result.duration}ms</div>
      <div class="metric-label">Duration</div>
    </div>
    <div class="metric-box">
      <div class="metric-value">${result.bestResult.strategy}</div>
      <div class="metric-label">Winner</div>
    </div>
  </div>

  <h2>Strategy Rankings</h2>
  <table>
    <thead>
      <tr>
        <th>Strategy</th>
        <th>Score</th>
        <th>Confidence</th>
        <th>Lines Changed</th>
        <th>Safety</th>
        <th>Time</th>
      </tr>
    </thead>
    <tbody>
      ${strategyRows}
    </tbody>
  </table>

  <h2>Selection Explanation</h2>
  <div class="explanation">${this.escapeHtml(result.explanation)}</div>

  ${result.mergedResult ? `
    <h2>Merge Info</h2>
    <p>Strategies merged: ${result.mergedResult.mergedStrategies.join(', ')}</p>
    <p>Conflicts: ${result.mergedResult.conflicts.length}</p>
  ` : ''}
</body>
</html>`;
  }

  /**
   * Apply edit to active editor
   */
  async applyEdit(content: string): Promise<boolean> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('No active editor');
      return false;
    }

    const document = editor.document;
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );

    const success = await editor.edit((editBuilder) => {
      editBuilder.replace(fullRange, content);
    });

    if (success) {
      vscode.window.showInformationMessage('Changes applied successfully');
    } else {
      vscode.window.showErrorMessage('Failed to apply changes');
    }

    return success;
  }

  /**
   * Show progress notification
   */
  async showProgress<T>(task: string, operation: () => Promise<T>): Promise<T> {
    this.statusBarItem.text = `$(sync~spin) ${task}`;
    this.statusBarItem.show();

    try {
      const result = await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: task,
          cancellable: false,
        },
        async () => operation()
      );

      this.statusBarItem.text = '$(check) Kimi Parallel Editor';
      setTimeout(() => this.statusBarItem.hide(), 3000);

      return result;
    } catch (error) {
      this.statusBarItem.text = '$(error) Kimi Parallel Editor';
      throw error;
    }
  }

  /**
   * Escape HTML for display
   */
  private escapeHtml(text: string): string {
    const div = { toString: () => '' };
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.outputChannel.dispose();
    this.statusBarItem.dispose();
  }
}

/**
 * Register VS Code commands for parallel editor
 */
export function registerParallelEditorCommands(
  context: vscode.ExtensionContext,
  vscodeIntegration: VSCodeIntegrationImpl
): void {
  // Command: Execute parallel edit
  const editCommand = vscode.commands.registerCommand(
    'kimi.parallelEditor.edit',
    async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
      }

      const userRequest = await vscode.window.showInputBox({
        prompt: 'What would you like to do?',
        placeHolder: 'e.g., "Fix the null pointer exception" or "Refactor this function"',
      });

      if (!userRequest) return;

      // This would be connected to the actual ParallelEditor instance
      vscode.window.showInformationMessage(
        `Parallel edit requested: "${userRequest}"`
      );
    }
  );

  // Command: Show last results
  const showResultsCommand = vscode.commands.registerCommand(
    'kimi.parallelEditor.showResults',
    () => {
      vscode.window.showInformationMessage('Show results not implemented');
    }
  );

  // Command: Compare strategies
  const compareCommand = vscode.commands.registerCommand(
    'kimi.parallelEditor.compare',
    async () => {
      const items = [
        { label: '$(shield) Conservative', description: 'Minimal changes, maximum safety' },
        { label: '$(check) Balanced', description: 'Optimal balance of improvement and safety' },
        { label: '$(rocket) Aggressive', description: 'Maximum improvement, higher risk' },
        { label: '$(beaker) Test-First', description: 'TDD approach with tests' },
        { label: '$(dash) Minimal Diff', description: 'Smallest possible change' },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        canPickMany: true,
        placeHolder: 'Select strategies to compare',
      });

      if (selected && selected.length > 0) {
        vscode.window.showInformationMessage(
          `Selected: ${selected.map(s => s.label).join(', ')}`
        );
      }
    }
  );

  context.subscriptions.push(editCommand, showResultsCommand, compareCommand);
}

/**
 * Create diff decorations for inline preview
 */
export function createDiffDecorations(
  original: string,
  modified: string
): { added: vscode.Range[]; removed: vscode.Range[] } {
  const added: vscode.Range[] = [];
  const removed: vscode.Range[] = [];

  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  // Simple line-by-line comparison (would use proper diff algorithm in production)
  const maxLines = Math.max(originalLines.length, modifiedLines.length);

  for (let i = 0; i < maxLines; i++) {
    const originalLine = originalLines[i];
    const modifiedLine = modifiedLines[i];

    if (originalLine !== modifiedLine) {
      if (modifiedLine !== undefined) {
        added.push(new vscode.Range(i, 0, i, modifiedLine.length));
      }
      if (originalLine !== undefined) {
        removed.push(new vscode.Range(i, 0, i, originalLine.length));
      }
    }
  }

  return { added, removed };
}
