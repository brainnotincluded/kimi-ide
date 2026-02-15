/**
 * Editor utility functions for Kimi IDE extension
 * Handles text editor operations, selections, cursor context
 */

import * as vscode from 'vscode';
import { logger } from './logger';

export interface CursorContext {
    currentLine: string;
    precedingLines: string[];
    followingLines: string[];
    cursorLine: number;
    cursorCharacter: number;
    languageId: string;
    fileName: string;
}

export interface SelectionInfo {
    text: string;
    startLine: number;
    endLine: number;
    startCharacter: number;
    endCharacter: number;
    isEmpty: boolean;
}

export interface InsertOptions {
    position?: vscode.Position;
    selectAfterInsert?: boolean;
    revealRange?: boolean;
}

/**
 * Get the active text editor
 */
export function getActiveEditor(): vscode.TextEditor | undefined {
    return vscode.window.activeTextEditor;
}

/**
 * Check if there is an active editor
 */
export function hasActiveEditor(): boolean {
    return !!vscode.window.activeTextEditor;
}

/**
 * Get current selection info
 */
export function getSelection(editor?: vscode.TextEditor): SelectionInfo {
    const activeEditor = editor || getActiveEditor();
    
    if (!activeEditor) {
        return {
            text: '',
            startLine: 0,
            endLine: 0,
            startCharacter: 0,
            endCharacter: 0,
            isEmpty: true,
        };
    }

    const selection = activeEditor.selection;
    const text = activeEditor.document.getText(selection);

    return {
        text,
        startLine: selection.start.line,
        endLine: selection.end.line,
        startCharacter: selection.start.character,
        endCharacter: selection.end.character,
        isEmpty: selection.isEmpty,
    };
}

/**
 * Get all selections in multi-select mode
 */
export function getAllSelections(editor?: vscode.TextEditor): SelectionInfo[] {
    const activeEditor = editor || getActiveEditor();
    
    if (!activeEditor) {
        return [];
    }

    return activeEditor.selections.map(selection => {
        const text = activeEditor.document.getText(selection);
        return {
            text,
            startLine: selection.start.line,
            endLine: selection.end.line,
            startCharacter: selection.start.character,
            endCharacter: selection.end.character,
            isEmpty: selection.isEmpty,
        };
    });
}

/**
 * Get selected text or current line
 */
export function getSelectedTextOrLine(editor?: vscode.TextEditor): string {
    const activeEditor = editor || getActiveEditor();
    
    if (!activeEditor) {
        return '';
    }

    const selection = getSelection(activeEditor);
    
    if (!selection.isEmpty) {
        return selection.text;
    }

    // Return current line if no selection
    const line = activeEditor.document.lineAt(activeEditor.selection.active.line);
    return line.text;
}

/**
 * Get cursor context - surrounding lines
 */
export function getCursorContext(
    linesBefore: number = 10,
    linesAfter: number = 10,
    editor?: vscode.TextEditor
): CursorContext | null {
    const activeEditor = editor || getActiveEditor();
    
    if (!activeEditor) {
        return null;
    }

    const document = activeEditor.document;
    const position = activeEditor.selection.active;
    const cursorLine = position.line;
    const cursorCharacter = position.character;

    const startLine = Math.max(0, cursorLine - linesBefore);
    const endLine = Math.min(document.lineCount - 1, cursorLine + linesAfter);

    const precedingLines: string[] = [];
    const followingLines: string[] = [];

    for (let i = startLine; i < cursorLine; i++) {
        precedingLines.push(document.lineAt(i).text);
    }

    for (let i = cursorLine + 1; i <= endLine; i++) {
        followingLines.push(document.lineAt(i).text);
    }

    return {
        currentLine: document.lineAt(cursorLine).text,
        precedingLines,
        followingLines,
        cursorLine,
        cursorCharacter,
        languageId: document.languageId,
        fileName: document.fileName,
    };
}

/**
 * Insert text at position
 */
export async function insertText(
    text: string,
    options: InsertOptions = {}
): Promise<boolean> {
    const editor = getActiveEditor();
    
    if (!editor) {
        logger.warn('No active editor to insert text');
        return false;
    }

    const { 
        position = editor.selection.active,
        selectAfterInsert = false,
        revealRange = true 
    } = options;

    try {
        const editResult = await editor.edit(editBuilder => {
            editBuilder.insert(position, text);
        });

        if (!editResult) {
            logger.warn('Edit operation failed');
            return false;
        }

        const endPosition = position.translate(0, text.length);

        if (selectAfterInsert) {
            editor.selection = new vscode.Selection(position, endPosition);
        } else {
            editor.selection = new vscode.Selection(endPosition, endPosition);
        }

        if (revealRange) {
            editor.revealRange(
                new vscode.Range(position, endPosition),
                vscode.TextEditorRevealType.InCenterIfOutsideViewport
            );
        }

        return true;
    } catch (error) {
        logger.error('Failed to insert text', error);
        return false;
    }
}

/**
 * Replace selection with text
 */
export async function replaceSelection(
    text: string,
    selection?: vscode.Selection,
    revealRange: boolean = true
): Promise<boolean> {
    const editor = getActiveEditor();
    
    if (!editor) {
        logger.warn('No active editor to replace selection');
        return false;
    }

    const targetSelection = selection || editor.selection;

    try {
        const editResult = await editor.edit(editBuilder => {
            editBuilder.replace(targetSelection, text);
        });

        if (!editResult) {
            logger.warn('Replace operation failed');
            return false;
        }

        // Update selection to end of inserted text
        const newPosition = targetSelection.start.translate(0, text.length);
        editor.selection = new vscode.Selection(newPosition, newPosition);

        if (revealRange) {
            editor.revealRange(
                new vscode.Range(targetSelection.start, newPosition),
                vscode.TextEditorRevealType.InCenterIfOutsideViewport
            );
        }

        return true;
    } catch (error) {
        logger.error('Failed to replace selection', error);
        return false;
    }
}

/**
 * Replace entire document content
 */
export async function replaceDocumentContent(
    text: string,
    editor?: vscode.TextEditor
): Promise<boolean> {
    const activeEditor = editor || getActiveEditor();
    
    if (!activeEditor) {
        logger.warn('No active editor to replace document content');
        return false;
    }

    const document = activeEditor.document;
    const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length)
    );

    try {
        const editResult = await activeEditor.edit(editBuilder => {
            editBuilder.replace(fullRange, text);
        });

        return editResult;
    } catch (error) {
        logger.error('Failed to replace document content', error);
        return false;
    }
}

/**
 * Open a file in editor
 */
export async function openFile(
    uri: vscode.Uri,
    options?: vscode.TextDocumentShowOptions
): Promise<vscode.TextEditor | null> {
    try {
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document, options);
        return editor;
    } catch (error) {
        logger.error(`Failed to open file: ${uri.fsPath}`, error);
        return null;
    }
}

/**
 * Create a new untitled file with content
 */
export async function createNewFile(
    content: string,
    language?: string
): Promise<vscode.TextEditor | null> {
    try {
        const document = await vscode.workspace.openTextDocument({
            language,
            content,
        });
        const editor = await vscode.window.showTextDocument(document);
        return editor;
    } catch (error) {
        logger.error('Failed to create new file', error);
        return null;
    }
}

/**
 * Go to line in editor
 */
export async function goToLine(
    line: number,
    character: number = 0,
    editor?: vscode.TextEditor
): Promise<void> {
    const activeEditor = editor || getActiveEditor();
    
    if (!activeEditor) {
        return;
    }

    const position = new vscode.Position(line, character);
    activeEditor.selection = new vscode.Selection(position, position);
    activeEditor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenterIfOutsideViewport
    );
}

/**
 * Get word at position
 */
export function getWordAtPosition(
    position?: vscode.Position,
    editor?: vscode.TextEditor
): string | null {
    const activeEditor = editor || getActiveEditor();
    
    if (!activeEditor) {
        return null;
    }

    const pos = position || activeEditor.selection.active;
    const wordRange = activeEditor.document.getWordRangeAtPosition(pos);
    
    if (!wordRange) {
        return null;
    }

    return activeEditor.document.getText(wordRange);
}

/**
 * Get current document language ID
 */
export function getDocumentLanguage(editor?: vscode.TextEditor): string | null {
    const activeEditor = editor || getActiveEditor();
    return activeEditor?.document.languageId || null;
}

/**
 * Get document text
 */
export function getDocumentText(editor?: vscode.TextEditor): string | null {
    const activeEditor = editor || getActiveEditor();
    return activeEditor?.document.getText() || null;
}

/**
 * Get visible ranges in editor
 */
export function getVisibleRanges(editor?: vscode.TextEditor): vscode.Range[] {
    const activeEditor = editor || getActiveEditor();
    return activeEditor ? [...activeEditor.visibleRanges] : [];
}

/**
 * Check if editor is dirty (has unsaved changes)
 */
export function isDirty(editor?: vscode.TextEditor): boolean {
    const activeEditor = editor || getActiveEditor();
    return activeEditor?.document.isDirty || false;
}

/**
 * Format document
 */
export async function formatDocument(editor?: vscode.TextEditor): Promise<boolean> {
    const activeEditor = editor || getActiveEditor();
    
    if (!activeEditor) {
        return false;
    }

    try {
        await vscode.commands.executeCommand('editor.action.formatDocument');
        return true;
    } catch (error) {
        logger.error('Failed to format document', error);
        return false;
    }
}

/**
 * Get indentation settings for document
 */
export function getIndentationSettings(editor?: vscode.TextEditor): {
    insertSpaces: boolean;
    tabSize: number;
} {
    const activeEditor = editor || getActiveEditor();
    const options = activeEditor?.options || vscode.workspace.getConfiguration('editor');
    
    return {
        insertSpaces: options.insertSpaces as boolean ?? true,
        tabSize: options.tabSize as number ?? 4,
    };
}

/**
 * Create indentation string
 */
export function createIndentation(level: number, editor?: vscode.TextEditor): string {
    const { insertSpaces, tabSize } = getIndentationSettings(editor);
    
    if (insertSpaces) {
        return ' '.repeat(level * tabSize);
    }
    return '\t'.repeat(level);
}
