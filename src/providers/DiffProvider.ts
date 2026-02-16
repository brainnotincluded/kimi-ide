/**
 * Diff Provider
 * Handles diff generation and application
 */

import * as vscode from 'vscode';
import { EditSuggestion } from './InlineEditProvider';

/**
 * Diff hunk representing a change
 */
export interface DiffHunk {
    oldStart: number;
    oldCount: number;
    newStart: number;
    newCount: number;
    lines: Array<{
        type: 'context' | 'added' | 'removed';
        content: string;
        lineNumber: number;
    }>;
}

/**
 * Diff Provider
 */
export class DiffProvider {
    private diffDocument?: vscode.TextDocument;
    private diffEditor?: vscode.TextEditor;

    /**
     * Generate diff from edit suggestions
     */
    generateDiffFromEdits(
        document: vscode.TextDocument,
        edits: EditSuggestion[]
    ): DiffHunk[] {
        const hunks: DiffHunk[] = [];
        
        for (const edit of edits) {
            const oldText = document.getText(edit.range);
            const newText = edit.newText;
            
            hunks.push({
                oldStart: edit.range.start.line + 1,
                oldCount: edit.range.end.line - edit.range.start.line + 1,
                newStart: edit.range.start.line + 1,
                newCount: newText.split('\n').length,
                lines: [
                    ...oldText.split('\n').map((line, i) => ({
                        type: 'removed' as const,
                        content: line,
                        lineNumber: edit.range.start.line + i + 1,
                    })),
                    ...newText.split('\n').map((line, i) => ({
                        type: 'added' as const,
                        content: line,
                        lineNumber: edit.range.start.line + i + 1,
                    })),
                ],
            });
        }
        
        return hunks;
    }

    /**
     * Show diff in a diff editor
     */
    async showDiff(
        document: vscode.TextDocument,
        edits: EditSuggestion[]
    ): Promise<vscode.TextEditor | undefined> {
        // Create a temporary document with the modified content
        const originalContent = document.getText();
        let modifiedContent = originalContent;
        
        // Apply edits in reverse order to maintain positions
        const sortedEdits = [...edits].sort((a, b) => 
            b.range.start.compareTo(a.range.start)
        );
        
        for (const edit of sortedEdits) {
            const startOffset = document.offsetAt(edit.range.start);
            const endOffset = document.offsetAt(edit.range.end);
            modifiedContent = 
                modifiedContent.substring(0, startOffset) +
                edit.newText +
                modifiedContent.substring(endOffset);
        }
        
        // Show diff using VS Code's built-in diff
        const uri = document.uri;
        const modifiedUri = uri.with({ scheme: 'kimi-diff', path: uri.path + '.modified' });
        
        // In a real implementation, we'd register a text content provider
        // For now, return undefined as a stub
        return undefined;
    }

    /**
     * Apply edits to an editor
     */
    async applyEdits(
        editor: vscode.TextEditor,
        edits: EditSuggestion[]
    ): Promise<boolean> {
        try {
            const workspaceEdit = new vscode.WorkspaceEdit();
            const uri = editor.document.uri;
            
            for (const edit of edits) {
                workspaceEdit.replace(uri, edit.range, edit.newText);
            }
            
            return await vscode.workspace.applyEdit(workspaceEdit);
        } catch (error) {
            console.error('Failed to apply edits:', error);
            return false;
        }
    }

    /**
     * Create a unified diff string
     */
    createUnifiedDiff(
        original: string,
        modified: string,
        originalPath: string = 'a/file',
        modifiedPath: string = 'b/file'
    ): string {
        const hunks = this.computeDiffHunks(original, modified);
        
        let output = `--- ${originalPath}\n`;
        output += `+++ ${modifiedPath}\n`;
        
        for (const hunk of hunks) {
            output += `@@ -${hunk.oldStart},${hunk.oldCount} +${hunk.newStart},${hunk.newCount} @@\n`;
            for (const line of hunk.lines) {
                const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
                output += `${prefix}${line.content}\n`;
            }
        }
        
        return output;
    }

    private computeDiffHunks(original: string, modified: string): DiffHunk[] {
        const originalLines = original.split('\n');
        const modifiedLines = modified.split('\n');
        const hunks: DiffHunk[] = [];
        
        // Simple LCS-based diff (simplified implementation)
        let i = 0, j = 0;
        let hunkStart = -1;
        const hunkLines: DiffHunk['lines'] = [];
        
        while (i < originalLines.length || j < modifiedLines.length) {
            if (i < originalLines.length && j < modifiedLines.length && 
                originalLines[i] === modifiedLines[j]) {
                if (hunkLines.length > 0) {
                    // End current hunk
                    hunks.push({
                        oldStart: hunkStart + 1,
                        oldCount: i - hunkStart,
                        newStart: hunkStart + 1,
                        newCount: j - hunkStart,
                        lines: [...hunkLines],
                    });
                    hunkLines.length = 0;
                }
                i++;
                j++;
            } else {
                if (hunkStart === -1) hunkStart = i;
                
                if (i < originalLines.length && (j >= modifiedLines.length || 
                    !modifiedLines.includes(originalLines[i]))) {
                    hunkLines.push({
                        type: 'removed',
                        content: originalLines[i],
                        lineNumber: i + 1,
                    });
                    i++;
                } else if (j < modifiedLines.length) {
                    hunkLines.push({
                        type: 'added',
                        content: modifiedLines[j],
                        lineNumber: j + 1,
                    });
                    j++;
                }
            }
        }
        
        if (hunkLines.length > 0) {
            hunks.push({
                oldStart: hunkStart + 1,
                oldCount: i - hunkStart,
                newStart: hunkStart + 1,
                newCount: j - hunkStart,
                lines: hunkLines,
            });
        }
        
        return hunks;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.diffDocument = undefined;
        this.diffEditor = undefined;
    }
}
