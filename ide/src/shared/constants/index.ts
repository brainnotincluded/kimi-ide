/**
 * @fileoverview Shared constants
 * @module shared/constants
 */

// ============================================================================
// Layout Constants
// ============================================================================

export const LAYOUT = {
  SIDEBAR: {
    DEFAULT_WIDTH: 260,
    MIN_WIDTH: 180,
    MAX_WIDTH: 400,
  },
  BOTTOM_PANEL: {
    DEFAULT_HEIGHT: 220,
    MIN_HEIGHT: 120,
    MAX_HEIGHT: 500,
    COLLAPSED_HEIGHT: 36,
  },
  STATUS_BAR: {
    HEIGHT: 24,
  },
  TITLE_BAR: {
    HEIGHT: 38,
  },
} as const;

// ============================================================================
// Editor Constants
// ============================================================================

export const EDITOR = {
  DEFAULT_FONT_SIZE: 14,
  DEFAULT_FONT_FAMILY: 'Menlo, Monaco, "Courier New", monospace',
  DEFAULT_TAB_SIZE: 2,
} as const;

// ============================================================================
// File Type Mapping
// ============================================================================

export const LANGUAGE_MAP: Record<string, string> = {
  // TypeScript/JavaScript
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  // Python
  py: 'python',
  pyw: 'python',
  pyi: 'python',
  // Systems languages
  rs: 'rust',
  go: 'go',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  // C/C++
  c: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  h: 'c',
  hpp: 'cpp',
  // Web
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  html: 'html',
  htm: 'html',
  // Data
  json: 'json',
  jsonc: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  toml: 'ini',
  // Docs
  md: 'markdown',
  mdx: 'markdown',
  // Shell
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  // Database
  sql: 'sql',
  // Mobile
  dart: 'dart',
  // Other
  rb: 'ruby',
  php: 'php',
} as const;

export const FILE_TYPE_NAMES: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript React',
  js: 'JavaScript',
  jsx: 'JavaScript React',
  mjs: 'JavaScript Module',
  cjs: 'CommonJS',
  py: 'Python',
  pyw: 'Python',
  pyi: 'Python Stub',
  json: 'JSON',
  jsonc: 'JSON with Comments',
  md: 'Markdown',
  mdx: 'MDX',
  css: 'CSS',
  scss: 'SCSS',
  sass: 'Sass',
  less: 'Less',
  html: 'HTML',
  htm: 'HTML',
  xml: 'XML',
  yaml: 'YAML',
  yml: 'YAML',
  rs: 'Rust',
  go: 'Go',
  java: 'Java',
  kt: 'Kotlin',
  kts: 'Kotlin Script',
  scala: 'Scala',
  cpp: 'C++',
  cc: 'C++',
  cxx: 'C++',
  c: 'C',
  h: 'C Header',
  hpp: 'C++ Header',
  cs: 'C#',
  rb: 'Ruby',
  php: 'PHP',
  swift: 'Swift',
  sql: 'SQL',
  sh: 'Shell',
  bash: 'Bash',
  zsh: 'Zsh',
  dockerfile: 'Dockerfile',
  toml: 'TOML',
  ini: 'INI',
  cfg: 'Config',
} as const;

// ============================================================================
// IPC Channel Names
// ============================================================================

export const IPC_CHANNELS = {
  // Workspace
  WORKSPACE: {
    READ_FILE: 'workspace:readFile',
    WRITE_FILE: 'workspace:writeFile',
    READ_DIRECTORY: 'workspace:readDirectory',
    CREATE_FILE: 'workspace:createFile',
    DELETE_FILE: 'workspace:deleteFile',
    CHANGE: 'workspace:change',
  },
  // Dialog
  DIALOG: {
    OPEN_FOLDER: 'dialog:openFolder',
  },
  // Terminal
  TERMINAL: {
    CREATE: 'terminal:create',
    WRITE: 'terminal:write',
    RESIZE: 'terminal:resize',
    KILL: 'terminal:kill',
    DATA: (id: string) => `terminal:data:${id}`,
    EXIT: (id: string) => `terminal:exit:${id}`,
  },
  // Output
  OUTPUT: {
    APPEND: 'output:append',
    CLEAR: 'output:clear',
    GET: 'output:get',
    DATA: (channel: string) => `output:data:${channel}`,
  },
  // Problems
  PROBLEMS: {
    UPDATE: 'problems:update',
    GET_ALL: 'problems:getAll',
    CLEAR: 'problems:clear',
    UPDATED: 'problems:updated',
  },
  // Menu
  MENU: {
    TOGGLE_SIDEBAR: 'menu:toggle-sidebar',
    TOGGLE_TERMINAL: 'menu:toggle-terminal',
    TOGGLE_PROBLEMS: 'menu:toggle-problems',
    TOGGLE_OUTPUT: 'menu:toggle-output',
    COMMAND_PALETTE: 'menu:command-palette',
  },
  // File
  FILE: {
    OPEN: 'file:open',
  },
  // Folder
  FOLDER: {
    OPENED: 'folder:opened',
  },
  // Debug
  DEBUG: {
    CONSOLE: 'debug:console',
    CONSOLE_MESSAGE: 'debug:console:message',
  },
} as const;

// ============================================================================
// Excluded Directories for File Explorer
// ============================================================================

export const EXCLUDED_DIRS = [
  'node_modules',
  '.git',
  '.svn',
  '.hg',
  'dist',
  'build',
  '.next',
  '.nuxt',
  'coverage',
  '.cache',
  '.idea',
  '.vscode',
  '__pycache__',
  '.pytest_cache',
  '*.egg-info',
  'target', // Rust
  'bin',    // Go
  'obj',    // C#
] as const;
