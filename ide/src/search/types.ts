/**
 * Search types and interfaces for Kimi IDE IDE
 * VS Code-like project-wide search functionality
 */

export interface SearchMatch {
  /** Line number (1-based) */
  line: number;
  /** Column number (0-based) */
  column: number;
  /** Match length */
  length: number;
  /** Full line text */
  text: string;
  /** Preview with context */
  preview: {
    before: string;
    match: string;
    after: string;
  };
}

export interface SearchResult {
  /** Absolute file path */
  file: string;
  /** Relative file path from project root */
  relativePath: string;
  /** Array of matches in this file */
  matches: SearchMatch[];
  /** Total matches in file */
  matchCount: number;
}

export interface SearchOptions {
  /** Search query string */
  query: string;
  /** Include patterns (glob) */
  include?: string[];
  /** Exclude patterns (glob) */
  exclude?: string[];
  /** Case sensitive search */
  caseSensitive?: boolean;
  /** Whole word match */
  wholeWord?: boolean;
  /** Use regex */
  regex?: boolean;
  /** Maximum number of results */
  maxResults?: number;
  /** Maximum file size to search (in bytes) */
  maxFileSize?: number;
  /** Follow symlinks */
  followSymlinks?: boolean;
  /** Include binary files */
  includeBinary?: boolean;
}

export interface ReplaceOptions extends SearchOptions {
  /** Replacement string */
  replacement: string;
  /** Preserve case (e.g., Foo -> Bar, foo -> bar) */
  preserveCase?: boolean;
}

export interface SearchProgress {
  /** Number of files searched so far */
  filesSearched: number;
  /** Number of files with matches */
  filesWithMatches: number;
  /** Total matches found */
  totalMatches: number;
  /** Whether search is complete */
  completed: boolean;
  /** Current file being searched */
  currentFile?: string;
  /** Error message if any */
  error?: string;
}

export interface SearchStats {
  /** Total time in milliseconds */
  duration: number;
  /** Number of files searched */
  filesSearched: number;
  /** Number of files with matches */
  filesWithMatches: number;
  /** Total matches found */
  totalMatches: number;
  /** Whether ripgrep was used */
  usedRipgrep: boolean;
}

export type SearchEventType = 
  | 'result' 
  | 'progress' 
  | 'complete' 
  | 'error' 
  | 'cancelled';

export interface SearchEvent {
  type: SearchEventType;
  data?: SearchResult | SearchProgress | SearchStats | Error;
}

export type SearchEventListener = (event: SearchEvent) => void;

/** Default exclude patterns (similar to VS Code) */
export const DEFAULT_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/coverage/**',
  '**/*.min.js',
  '**/*.min.css',
  '**/package-lock.json',
  '**/yarn.lock',
  '**/pnpm-lock.yaml',
  '.DS_Store',
  '**/.vscode/**',
  '**/.idea/**',
  '**/out/**',
  '**/.cache/**',
];

/** Default max file size (16MB) */
export const DEFAULT_MAX_FILE_SIZE = 16 * 1024 * 1024;

/** Default max results */
export const DEFAULT_MAX_RESULTS = 10000;
