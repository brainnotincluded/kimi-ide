/**
 * Problems Panel IPC Handlers
 * IDE Kimi IDE - Main process IPC for problems panel
 */

import { ipcMain, IpcMainInvokeEvent, clipboard } from 'electron';
import { ProblemsManager, getProblemsManager } from './ProblemsManager';
import { ProblemItemData, CodeAction, Position } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// IPC Channel Names
// ============================================================================

export const PROBLEMS_CHANNELS = {
  GET_ALL: 'problems:getAll',
  GET_FOR_FILE: 'problems:getForFile',
  CLEAR_ALL: 'problems:clear',
  CLEAR_FOR_FILE: 'problems:clearForFile',
  OPEN_FILE: 'problems:openFile',
  APPLY_CODE_ACTION: 'problems:applyCodeAction',
  GET_CODE_ACTIONS: 'problems:getCodeActions',
  COPY_MESSAGE: 'problems:copyMessage',
  GET_COUNTS: 'problems:getCounts',
  SET_FILTER: 'problems:setFilter',
  GET_FILTER: 'problems:getFilter',
  ON_CHANGED: 'problems:onChanged',
  ON_VALIDATION_STARTED: 'problems:onValidationStarted',
  ON_VALIDATION_FINISHED: 'problems:onValidationFinished',
} as const;

// ============================================================================
// Setup IPC Handlers
// ============================================================================

export function setupProblemsIPCHandlers(problemsManager?: ProblemsManager): void {
  const manager = problemsManager || getProblemsManager();

  // Get all problems
  ipcMain.handle(PROBLEMS_CHANNELS.GET_ALL, async (): Promise<ProblemItemData[]> => {
    return manager.getAllDiagnostics();
  });

  // Get problems for specific file
  ipcMain.handle(
    PROBLEMS_CHANNELS.GET_FOR_FILE,
    async (_: IpcMainInvokeEvent, filePath: string): Promise<ProblemItemData[]> => {
      return manager.getDiagnostics(filePath);
    }
  );

  // Clear all problems
  ipcMain.handle(PROBLEMS_CHANNELS.CLEAR_ALL, async (): Promise<void> => {
    manager.clearDiagnostics();
  });

  // Clear problems for specific file
  ipcMain.handle(
    PROBLEMS_CHANNELS.CLEAR_FOR_FILE,
    async (_: IpcMainInvokeEvent, filePath: string): Promise<void> => {
      manager.clearDiagnostics(filePath);
    }
  );

  // Open file at position
  ipcMain.handle(
    PROBLEMS_CHANNELS.OPEN_FILE,
    async (
      event: IpcMainInvokeEvent,
      filePath: string,
      position: Position
    ): Promise<void> => {
      // Send to renderer to open the file
      const window = (event as any).sender;
      window.send('problems:openFileInEditor', { filePath, position });
    }
  );

  // Apply code action
  ipcMain.handle(
    PROBLEMS_CHANNELS.APPLY_CODE_ACTION,
    async (
      _: IpcMainInvokeEvent,
      filePath: string,
      action: CodeAction
    ): Promise<boolean> => {
      return applyCodeAction(filePath, action);
    }
  );

  // Get code actions
  ipcMain.handle(
    PROBLEMS_CHANNELS.GET_CODE_ACTIONS,
    async (
      _: IpcMainInvokeEvent,
      filePath: string,
      range: { start: Position; end: Position }
    ): Promise<CodeAction[]> => {
      return manager.getCodeActions(filePath, range);
    }
  );

  // Copy message to clipboard
  ipcMain.handle(
    PROBLEMS_CHANNELS.COPY_MESSAGE,
    async (_: IpcMainInvokeEvent, message: string): Promise<void> => {
      clipboard.writeText(message);
    }
  );

  // Get problem counts
  ipcMain.handle(PROBLEMS_CHANNELS.GET_COUNTS, async () => {
    return manager.getCounts();
  });

  // Set filter
  ipcMain.handle(
    PROBLEMS_CHANNELS.SET_FILTER,
    async (_: IpcMainInvokeEvent, filter: { errors?: boolean; warnings?: boolean; information?: boolean; hints?: boolean }): Promise<void> => {
      manager.setFilter(filter);
    }
  );

  // Get filter
  ipcMain.handle(PROBLEMS_CHANNELS.GET_FILTER, async () => {
    return manager.getFilter();
  });

  // Setup event forwarding to renderer
  setupEventForwarding(manager);
}

// ============================================================================
// Event Forwarding
// ============================================================================

function setupEventForwarding(manager: ProblemsManager): void {
  const { BrowserWindow } = require('electron');

  // Forward problems changed event to all windows
  manager.onProblemsChanged.on((event) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: any) => {
      window.webContents.send(PROBLEMS_CHANNELS.ON_CHANGED, event);
    });
  });

  // Forward validation started event
  manager.onFileValidationStarted.on((filePath) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: any) => {
      window.webContents.send(PROBLEMS_CHANNELS.ON_VALIDATION_STARTED, filePath);
    });
  });

  // Forward validation finished event
  manager.onFileValidationFinished.on((filePath) => {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((window: any) => {
      window.webContents.send(PROBLEMS_CHANNELS.ON_VALIDATION_FINISHED, filePath);
    });
  });
}

// ============================================================================
// Code Action Application
// ============================================================================

async function applyCodeAction(filePath: string, action: CodeAction): Promise<boolean> {
  try {
    if (!action.edit) {
      // Execute command if no edit
      if (action.command) {
        // TODO: Execute command
        console.log('Execute command:', action.command);
      }
      return true;
    }

    // Read file content
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');

    // Apply edits (in reverse order to preserve line numbers)
    const edits = Object.entries(action.edit.changes).flatMap(([file, fileEdits]) =>
      fileEdits.map((edit) => ({ file, edit }))
    );

    // Sort edits by position in reverse order
    edits.sort((a, b) => {
      if (a.edit.range.start.line !== b.edit.range.start.line) {
        return b.edit.range.start.line - a.edit.range.start.line;
      }
      return b.edit.range.start.character - a.edit.range.start.character;
    });

    // Apply each edit
    for (const { file, edit } of edits) {
      if (file !== filePath) {
        // Edit in different file
        const otherContent = await fs.readFile(file, 'utf-8');
        const otherLines = otherContent.split('\n');
        applyEditToLines(otherLines, edit);
        await fs.writeFile(file, otherLines.join('\n'), 'utf-8');
      } else {
        applyEditToLines(lines, edit);
      }
    }

    // Write back to file
    await fs.writeFile(filePath, lines.join('\n'), 'utf-8');

    return true;
  } catch (error) {
    console.error('[Problems IPC] Failed to apply code action:', error);
    return false;
  }
}

function applyEditToLines(
  lines: string[],
  edit: { range: { start: { line: number; character: number }; end: { line: number; character: number } }; newText: string }
): void {
  const { start, end } = edit.range;
  const startLine = start.line;
  const endLine = end.line;
  const startChar = start.character;
  const endChar = end.character;

  if (startLine === endLine) {
    // Single line edit
    const line = lines[startLine];
    lines[startLine] = line.substring(0, startChar) + edit.newText + line.substring(endChar);
  } else {
    // Multi-line edit
    const startLineContent = lines[startLine].substring(0, startChar);
    const endLineContent = lines[endLine].substring(endChar);
    const newLines = edit.newText.split('\n');
    
    newLines[0] = startLineContent + newLines[0];
    newLines[newLines.length - 1] = newLines[newLines.length - 1] + endLineContent;
    
    lines.splice(startLine, endLine - startLine + 1, ...newLines);
  }
}

// ============================================================================
// Cleanup
// ============================================================================

export function removeProblemsIPCHandlers(): void {
  for (const channel of Object.values(PROBLEMS_CHANNELS)) {
    ipcMain.removeHandler(channel);
  }
}
