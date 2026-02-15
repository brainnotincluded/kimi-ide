/**
 * Git Integration Types
 * Type definitions for Git integration in Kimi IDE IDE
 */

/** File status in git */
export type GitFileStatus =
  | 'M' // Modified
  | 'A' // Added
  | 'D' // Deleted
  | 'R' // Renamed
  | 'C' // Copied
  | 'U' // Updated but unmerged
  | '??' // Untracked
  | '!!'; // Ignored

/** Git file entry */
export interface GitFile {
  path: string;
  status: GitFileStatus;
  staged: boolean;
  originalPath?: string; // For renamed files
}

/** Git status result */
export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  files: GitFile[];
  modified: GitFile[];
  staged: GitFile[];
  untracked: GitFile[];
  conflicted: GitFile[];
  isClean: boolean;
}

/** Git branch info */
export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  remoteTracking?: string;
  ahead: number;
  behind: number;
}

/** Git commit info */
export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  email: string;
  date: Date;
  refs: string[];
}

/** Git blame line info */
export interface GitBlameLine {
  line: number;
  hash: string;
  author: string;
  email: string;
  date: Date;
  content: string;
}

/** Git blame result */
export interface GitBlame {
  file: string;
  lines: GitBlameLine[];
}

/** Git diff hunk */
export interface GitDiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: GitDiffLine[];
}

/** Git diff line */
export interface GitDiffLine {
  type: 'added' | 'deleted' | 'unchanged';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

/** Git diff result */
export interface GitDiff {
  oldPath: string;
  newPath: string;
  oldMode?: string;
  newMode?: string;
  hunks: GitDiffHunk[];
  isNew: boolean;
  isDeleted: boolean;
  isRename: boolean;
  similarity?: number;
}

/** Repository info */
export interface RepositoryInfo {
  path: string;
  root: string;
  isRepo: boolean;
  remotes: GitRemote[];
}

/** Git remote */
export interface GitRemote {
  name: string;
  url: string;
  fetch: boolean;
  push: boolean;
}

/** Git operation result */
export interface GitResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Line change type for inline decorations */
export type LineChangeType = 'added' | 'deleted' | 'modified';

/** Inline decoration info */
export interface InlineDecoration {
  line: number;
  type: LineChangeType;
  originalContent?: string;
  diff?: GitDiff;
}

/** Source control panel state */
export interface SourceControlState {
  branch: string;
  branches: GitBranch[];
  changes: GitFile[];
  staged: GitFile[];
  message: string;
  isCommitting: boolean;
  isSyncing: boolean;
  ahead: number;
  behind: number;
}

/** Git configuration */
export interface GitConfiguration {
  autoFetch: boolean;
  autoFetchInterval: number; // minutes
  confirmSync: boolean;
  confirmCommit: boolean;
  showInlineBlame: boolean;
  showInlineDiff: boolean;
}

/** Default git configuration */
export const DEFAULT_GIT_CONFIG: GitConfiguration = {
  autoFetch: true,
  autoFetchInterval: 5,
  confirmSync: true,
  confirmCommit: false,
  showInlineBlame: true,
  showInlineDiff: true,
};
