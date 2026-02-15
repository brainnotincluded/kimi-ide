/**
 * @fileoverview Shared types between main and renderer processes
 * @module shared/types
 */

// ============================================================================
// Workspace Types
// ============================================================================

export interface DirectoryEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  expanded?: boolean;
}

export interface FileChangeEvent {
  path: string;
  type: 'add' | 'change' | 'unlink';
}

// ============================================================================
// Editor Types
// ============================================================================

export interface EditorTab {
  id: string;
  filePath: string;
  isDirty: boolean;
}

export interface CursorPosition {
  line: number;
  column: number;
}

// ============================================================================
// Terminal Types
// ============================================================================

export interface TerminalSize {
  cols: number;
  rows: number;
}

export interface TerminalInfo {
  id: string;
  pid?: number;
  cwd: string;
}

// ============================================================================
// Problem/Diagnostic Types
// ============================================================================

export type ProblemSeverity = 'error' | 'warning' | 'info';

export interface Problem {
  file: string;
  line: number;
  column?: number;
  severity: ProblemSeverity;
  message: string;
  source?: string;
  code?: string;
}

export interface ProblemsCount {
  errors: number;
  warnings: number;
  infos: number;
}

// ============================================================================
// Output Types
// ============================================================================

export interface OutputChannel {
  name: string;
  data: string[];
}

// ============================================================================
// Bottom Panel Types
// ============================================================================

export type BottomTab = 'terminal' | 'problems' | 'output' | 'debug-console';

// ============================================================================
// Sidebar Types
// ============================================================================

export type SidebarView = 'explorer' | 'search' | 'git' | 'debug' | 'extensions';

// ============================================================================
// Status Bar Types
// ============================================================================

export interface GitInfo {
  branch: string;
  changes: number;
}

export interface StatusBarState {
  cursorPosition: CursorPosition;
  gitInfo: GitInfo | null;
  aiConnected: boolean;
  problemsCount: ProblemsCount;
}

// ============================================================================
// IPC Response Types
// ============================================================================

export interface IPCResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TerminalCreateResponse {
  success: boolean;
  pid?: number;
  error?: string;
}

// ============================================================================
// Language Types
// ============================================================================

export interface LanguageInfo {
  id: string;
  name: string;
  confidence: number;
}

// ============================================================================
// Re-exports from existing modules
// ============================================================================

export * from '../../renderer/types/chat';
