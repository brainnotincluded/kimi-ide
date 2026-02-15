/**
 * Problems Panel Renderer IPC API
 * IDE Kimi IDE - Renderer process API for problems panel
 */

import { ipcRenderer, IpcRendererEvent } from 'electron';
import {
  ProblemItemData,
  ProblemsChangedEvent,
  ProblemsCount,
  ProblemsFilter,
  CodeAction,
  Position,
} from './types';
import { PROBLEMS_CHANNELS } from './ipc';

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get all problems
 */
export async function getAllProblems(): Promise<ProblemItemData[]> {
  return ipcRenderer.invoke(PROBLEMS_CHANNELS.GET_ALL);
}

/**
 * Get problems for a specific file
 */
export async function getProblemsForFile(filePath: string): Promise<ProblemItemData[]> {
  return ipcRenderer.invoke(PROBLEMS_CHANNELS.GET_FOR_FILE, filePath);
}

/**
 * Clear all problems
 */
export async function clearAllProblems(): Promise<void> {
  return ipcRenderer.invoke(PROBLEMS_CHANNELS.CLEAR_ALL);
}

/**
 * Clear problems for a specific file
 */
export async function clearProblemsForFile(filePath: string): Promise<void> {
  return ipcRenderer.invoke(PROBLEMS_CHANNELS.CLEAR_FOR_FILE, filePath);
}

/**
 * Open file at position
 */
export async function openFileAtPosition(filePath: string, position: Position): Promise<void> {
  return ipcRenderer.invoke(PROBLEMS_CHANNELS.OPEN_FILE, filePath, position);
}

/**
 * Apply code action
 */
export async function applyCodeAction(filePath: string, action: CodeAction): Promise<boolean> {
  return ipcRenderer.invoke(PROBLEMS_CHANNELS.APPLY_CODE_ACTION, filePath, action);
}

/**
 * Get code actions for a problem
 */
export async function getCodeActions(
  filePath: string,
  range: { start: Position; end: Position }
): Promise<CodeAction[]> {
  return ipcRenderer.invoke(PROBLEMS_CHANNELS.GET_CODE_ACTIONS, filePath, range);
}

/**
 * Copy message to clipboard
 */
export async function copyProblemMessage(message: string): Promise<void> {
  return ipcRenderer.invoke(PROBLEMS_CHANNELS.COPY_MESSAGE, message);
}

/**
 * Get problem counts
 */
export async function getProblemCounts(): Promise<ProblemsCount> {
  return ipcRenderer.invoke(PROBLEMS_CHANNELS.GET_COUNTS);
}

/**
 * Set filter
 */
export async function setProblemsFilter(filter: Partial<ProblemsFilter>): Promise<void> {
  return ipcRenderer.invoke(PROBLEMS_CHANNELS.SET_FILTER, filter);
}

/**
 * Get current filter
 */
export async function getProblemsFilter(): Promise<ProblemsFilter> {
  return ipcRenderer.invoke(PROBLEMS_CHANNELS.GET_FILTER);
}

// ============================================================================
// Event Listeners
// ============================================================================

export type ProblemsChangedListener = (event: ProblemsChangedEvent) => void;
export type ValidationStartedListener = (filePath: string) => void;
export type ValidationFinishedListener = (filePath: string) => void;
export type OpenFileInEditorListener = (data: { filePath: string; position: Position }) => void;

const listeners = {
  onChanged: new Set<ProblemsChangedListener>(),
  onValidationStarted: new Set<ValidationStartedListener>(),
  onValidationFinished: new Set<ValidationFinishedListener>(),
  onOpenFileInEditor: new Set<OpenFileInEditorListener>(),
};

// Setup IPC event listeners once
let ipcListenersSetup = false;

function setupIpcListeners(): void {
  if (ipcListenersSetup) return;
  ipcListenersSetup = true;

  // Problems changed
  ipcRenderer.on(PROBLEMS_CHANNELS.ON_CHANGED, (_: IpcRendererEvent, event: ProblemsChangedEvent) => {
    listeners.onChanged.forEach((listener) => listener(event));
  });

  // Validation started
  ipcRenderer.on(PROBLEMS_CHANNELS.ON_VALIDATION_STARTED, (_: IpcRendererEvent, filePath: string) => {
    listeners.onValidationStarted.forEach((listener) => listener(filePath));
  });

  // Validation finished
  ipcRenderer.on(PROBLEMS_CHANNELS.ON_VALIDATION_FINISHED, (_: IpcRendererEvent, filePath: string) => {
    listeners.onValidationFinished.forEach((listener) => listener(filePath));
  });

  // Open file in editor (from main)
  ipcRenderer.on('problems:openFileInEditor', (_: IpcRendererEvent, data: { filePath: string; position: Position }) => {
    listeners.onOpenFileInEditor.forEach((listener) => listener(data));
  });
}

/**
 * Listen for problems changed events
 */
export function onProblemsChanged(listener: ProblemsChangedListener): () => void {
  setupIpcListeners();
  listeners.onChanged.add(listener);
  return () => listeners.onChanged.delete(listener);
}

/**
 * Listen for validation started events
 */
export function onValidationStarted(listener: ValidationStartedListener): () => void {
  setupIpcListeners();
  listeners.onValidationStarted.add(listener);
  return () => listeners.onValidationStarted.delete(listener);
}

/**
 * Listen for validation finished events
 */
export function onValidationFinished(listener: ValidationFinishedListener): () => void {
  setupIpcListeners();
  listeners.onValidationFinished.add(listener);
  return () => listeners.onValidationFinished.delete(listener);
}

/**
 * Listen for open file in editor requests (from main)
 */
export function onOpenFileInEditor(listener: OpenFileInEditorListener): () => void {
  setupIpcListeners();
  listeners.onOpenFileInEditor.add(listener);
  return () => listeners.onOpenFileInEditor.delete(listener);
}

// ============================================================================
// Exposed API
// ============================================================================

export const problems = {
  getAll: getAllProblems,
  getForFile: getProblemsForFile,
  clearAll: clearAllProblems,
  clearForFile: clearProblemsForFile,
  openFile: openFileAtPosition,
  applyCodeAction,
  getCodeActions,
  copyMessage: copyProblemMessage,
  getCounts: getProblemCounts,
  setFilter: setProblemsFilter,
  getFilter: getProblemsFilter,
  onChanged: onProblemsChanged,
  onValidationStarted,
  onValidationFinished,
  onOpenFileInEditor,
};

// Expose to window for debugging
if (typeof window !== 'undefined') {
  (window as any).problems = problems;
}
