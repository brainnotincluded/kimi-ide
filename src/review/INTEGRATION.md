# Kimi Automatic Code Review - Integration Guide

## Quick Start

### 1. Add imports to extension.ts

```typescript
import { ReviewEngine, ReviewReporter } from './review';
```

### 2. Initialize in activate()

```typescript
let reviewEngine: ReviewEngine;
let reviewReporter: ReviewReporter;

export async function activate(context: vscode.ExtensionContext) {
    // ... existing code ...
    
    // Initialize code review
    reviewEngine = new ReviewEngine();
    reviewReporter = new ReviewReporter();
    
    context.subscriptions.push(reviewEngine, reviewReporter);
    
    // Listen for review results
    reviewEngine.onReviewEvent((event) => {
        if (event.type === 'completed' && event.result) {
            reviewReporter.reportResult(event.result);
        }
    });
    
    // Register review commands
    registerReviewCommands(context);
    
    // Setup review triggers
    setupReviewTriggers(context);
    
    // Review active editor on startup
    if (vscode.window.activeTextEditor) {
        reviewEngine.reviewDocument(vscode.window.activeTextEditor.document);
    }
}
```

### 3. Register commands

```typescript
function registerReviewCommands(context: vscode.ExtensionContext): void {
    const commands = [
        vscode.commands.registerCommand('kimi.review.runReviewOnFile', async () => {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                const result = await reviewEngine.reviewDocument(editor.document);
                vscode.window.showInformationMessage(
                    `Review complete: ${result.summary.totalIssues} issues found (Score: ${result.summary.score})`
                );
            }
        }),
        
        vscode.commands.registerCommand('kimi.review.clearResults', () => {
            reviewReporter.clearAllResults();
        }),
        
        vscode.commands.registerCommand('kimi.review.showSummary', async () => {
            const results = reviewReporter.getAllResults();
            let totalIssues = 0;
            let totalScore = 0;
            
            for (const result of results.values()) {
                totalIssues += result.summary.totalIssues;
                totalScore += result.summary.score;
            }
            
            const avgScore = results.size > 0 ? Math.round(totalScore / results.size) : 0;
            
            vscode.window.showInformationMessage(
                `Workspace Review: ${totalIssues} issues across ${results.size} files (Avg Score: ${avgScore})`
            );
        }),
    ];
    
    context.subscriptions.push(...commands);
}
```

### 4. Setup triggers

```typescript
function setupReviewTriggers(context: vscode.ExtensionContext): void {
    // Review on save
    const saveDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
        const config = vscode.workspace.getConfiguration('kimi.review');
        if (config.get<boolean>('runOnSave', true)) {
            reviewEngine.reviewDocument(document);
        }
    });
    context.subscriptions.push(saveDisposable);
    
    // Review on type (debounced)
    const changeDisposable = vscode.workspace.onDidChangeTextDocument((e) => {
        const config = vscode.workspace.getConfiguration('kimi.review');
        if (config.get<boolean>('runOnType', false)) {
            reviewEngine.reviewDocumentDebounced(e.document);
        }
    });
    context.subscriptions.push(changeDisposable);
    
    // Clear results when document is closed
    const closeDisposable = vscode.workspace.onDidCloseTextDocument((document) => {
        reviewReporter.clearResult(document.uri);
    });
    context.subscriptions.push(closeDisposable);
}
```

### 5. Add to deactivate()

```typescript
export function deactivate() {
    // ... existing code ...
    
    reviewEngine?.dispose();
    reviewReporter?.dispose();
}
```

## Package.json Configuration

Add the configuration from `package-config.json` to your package.json:

```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "kimi.review.enabled": {
          "type": "boolean",
          "default": true,
          "description": "Enable automatic code review"
        }
        // ... see package-config.json for full configuration
      }
    },
    "commands": [
      {
        "command": "kimi.review.runReviewOnFile",
        "title": "Run Code Review",
        "category": "Kimi"
      }
      // ... see package-config.json for full commands
    ]
  }
}
```

## Features

### Diagnostics (Problems Panel)
- All issues appear in the VS Code Problems panel
- Severity levels: Error, Warning, Info, Hint
- Click to navigate to the issue

### CodeLens (Inline Actions)
- Shows issue count on lines with problems
- Fix buttons for auto-fixable issues
- File-level summary at the top

### CodeActions (Quick Fixes)
- Lightbulb icon with available fixes
- "Fix All" action for the entire file
- Suppress issue action

### Keyboard Shortcuts
- `Ctrl+Shift+R` / `Cmd+Shift+R` - Run review on current file

## Review Categories

1. **Semantic** - Logic bugs, edge cases, algorithmic complexity
2. **Style** - Naming conventions, code style, consistency
3. **Security** - Vulnerabilities, secrets, unsafe patterns
4. **Performance** - Memory leaks, inefficient algorithms
5. **Test** - Test coverage, quality, missing edge cases

## Customization

### Disable specific reviewers

```json
{
  "kimi.review.reviewers.style.enabled": false,
  "kimi.review.reviewers.test.enabled": false
}
```

### Change severity levels

```json
{
  "kimi.review.reviewers.security.severity": "error",
  "kimi.review.reviewers.style.severity": "hint"
}
```

### Exclude patterns

```json
{
  "kimi.review.excludePatterns": [
    "**/node_modules/**",
    "**/generated/**",
    "**/vendor/**"
  ]
}
```

## Architecture

```
ReviewEngine
├── SemanticReviewer
├── StyleReviewer
├── SecurityReviewer
├── PerformanceReviewer
└── TestReviewer

ReviewReporter
├── DiagnosticCollection (Problems panel)
├── CodeLensProvider (Inline actions)
└── CodeActionProvider (Quick fixes)
```

## Advantages over Codebuff

1. **Native VS Code Integration** - Uses diagnostics API, not just text output
2. **CodeLens** - Accept/fix buttons directly in code
3. **Quick Fixes** - One-click fixes for common issues
4. **Parallel Execution** - All reviewers run concurrently
5. **Caching** - Results cached until file changes
6. **Configurable** - Per-reviewer settings, include/exclude patterns
7. **Extensible** - Easy to add new reviewers
