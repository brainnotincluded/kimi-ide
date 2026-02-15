/**
 * Outline/Structure View Types
 * IDE Kimi IDE - Advanced Code Outline Panel
 */

/**
 * Symbol kinds supported by the outline view
 */
export type SymbolKind =
  | 'file'
  | 'module'
  | 'namespace'
  | 'package'
  | 'class'
  | 'method'
  | 'property'
  | 'field'
  | 'constructor'
  | 'enum'
  | 'interface'
  | 'function'
  | 'variable'
  | 'constant'
  | 'string'
  | 'number'
  | 'boolean'
  | 'array'
  | 'object'
  | 'key'
  | 'null'
  | 'enumMember'
  | 'struct'
  | 'event'
  | 'operator'
  | 'typeParameter';

/**
 * Symbol tag for additional metadata
 */
export type SymbolTag = 'deprecated' | 'readonly' | 'static' | 'abstract' | 'async' | 'private' | 'protected' | 'public';

/**
 * Position in a file (line, column)
 */
export interface Position {
  line: number;
  character: number;
}

/**
 * Range in a file (start to end)
 */
export interface Range {
  start: Position;
  end: Position;
}

/**
 * Location with file path and range
 */
export interface Location {
  uri: string;
  range: Range;
}

/**
 * Document symbol - represents a symbol in the outline tree
 */
export interface DocumentSymbol {
  /** Symbol name */
  name: string;
  /** Detailed name (includes signature) */
  detail?: string;
  /** Symbol kind */
  kind: SymbolKind;
  /** Additional tags */
  tags?: SymbolTag[];
  /** Position of the symbol name */
  range: Range;
  /** Position of the entire symbol definition */
  selectionRange: Range;
  /** Children symbols (for nested structures) */
  children?: DocumentSymbol[];
  /** Icon override */
  icon?: string;
  /** Accessibility modifier */
  accessibility?: 'public' | 'private' | 'protected' | 'internal';
  /** Documentation */
  documentation?: string;
}

/**
 * Workspace symbol - for cross-file symbol search
 */
export interface WorkspaceSymbol {
  /** Symbol name */
  name: string;
  /** Symbol kind */
  kind: SymbolKind;
  /** File location */
  location: Location;
  /** Container name (class, namespace) */
  containerName?: string;
  /** Symbol tags */
  tags?: SymbolTag[];
  /** Icon override */
  icon?: string;
  /** Score for sorting (higher = better match) */
  score?: number;
}

/**
 * Symbol filter options
 */
export interface SymbolFilter {
  /** Filter by symbol kinds */
  kinds?: SymbolKind[];
  /** Search query */
  query?: string;
  /** Show only public symbols */
  onlyPublic?: boolean;
  /** Hide deprecated symbols */
  hideDeprecated?: boolean;
}

/**
 * Symbol sort options
 */
export type SymbolSortBy = 'position' | 'name' | 'type' | 'accessibility';

export interface SymbolSortOptions {
  /** Sort field */
  by: SymbolSortBy;
  /** Ascending or descending */
  direction?: 'asc' | 'desc';
}

/**
 * Outline view options
 */
export interface OutlineOptions {
  /** Sort configuration */
  sort?: SymbolSortOptions;
  /** Filter configuration */
  filter?: SymbolFilter;
  /** Follow cursor position */
  followCursor?: boolean;
  /** Expand level (0 = collapse all, -1 = expand all) */
  expandLevel?: number;
  /** Show breadcrumbs */
  showBreadcrumbs?: boolean;
  /** Group by type */
  groupByType?: boolean;
}

/**
 * Breadcrumb item
 */
export interface BreadcrumbItem {
  /** Symbol name */
  name: string;
  /** Symbol kind */
  kind: SymbolKind;
  /** Position in file */
  range: Range;
  /** Icon */
  icon?: string;
}

/**
 * Navigation target
 */
export interface NavigationTarget {
  uri: string;
  range: Range;
  /** Optional selection range (for placing cursor) */
  selectionRange?: Range;
}

/**
 * Language support configuration
 */
export interface LanguageSupport {
  /** Language ID */
  languageId: string;
  /** File extensions */
  extensions: string[];
  /** Parser type */
  parser: 'typescript' | 'python' | 'go' | 'rust' | 'java' | 'custom';
  /** Whether workspace symbols are supported */
  supportsWorkspaceSymbols: boolean;
  /** Maximum file size to parse (in bytes) */
  maxFileSize?: number;
}

/**
 * Parse result
 */
export interface ParseResult {
  /** Parsed symbols */
  symbols: DocumentSymbol[];
  /** Parse errors, if any */
  errors?: ParseError[];
  /** Parse duration in ms */
  duration: number;
}

/**
 * Parse error
 */
export interface ParseError {
  message: string;
  range?: Range;
  severity: 'error' | 'warning';
}

/**
 * Outline state
 */
export interface OutlineState {
  /** Current file URI */
  currentUri?: string;
  /** Current symbols */
  symbols: DocumentSymbol[];
  /** Selected symbol path */
  selectedPath?: string[];
  /** Expanded nodes */
  expandedNodes: Set<string>;
  /** View options */
  options: OutlineOptions;
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error?: string;
}

/**
 * IPC message types for outline
 */
export type OutlineIPCMessage =
  | { type: 'outline:getSymbols'; uri: string }
  | { type: 'outline:getSymbols:response'; symbols: DocumentSymbol[]; error?: string }
  | { type: 'outline:getWorkspaceSymbols'; query: string }
  | { type: 'outline:getWorkspaceSymbols:response'; symbols: WorkspaceSymbol[] }
  | { type: 'outline:resolveLocation'; uri: string; position: Position }
  | { type: 'outline:resolveLocation:response'; target?: NavigationTarget }
  | { type: 'outline:documentChanged'; uri: string }
  | { type: 'outline:cursorMoved'; uri: string; position: Position }
  | { type: 'outline:symbolSelected'; path: string[] }
  | { type: 'outline:updateOptions'; options: Partial<OutlineOptions> }
  | { type: 'outline:expand'; path: string[] }
  | { type: 'outline:collapse'; path: string[] };

/**
 * Icon configuration for symbol kinds
 */
export interface SymbolIconConfig {
  /** Icon character or CSS class */
  icon: string;
  /** Icon color */
  color?: string;
  /** Tooltip */
  tooltip?: string;
}

/**
 * Default symbol icons
 */
export const DEFAULT_SYMBOL_ICONS: Record<SymbolKind, SymbolIconConfig> = {
  file: { icon: '📄', color: '#cccccc' },
  module: { icon: '📦', color: '#cccccc' },
  namespace: { icon: '📁', color: '#4ec9b0' },
  package: { icon: '📦', color: '#cccccc' },
  class: { icon: 'C', color: '#ee9d28', tooltip: 'Class' },
  method: { icon: 'm', color: '#b180d7', tooltip: 'Method' },
  property: { icon: 'p', color: '#cccccc', tooltip: 'Property' },
  field: { icon: 'f', color: '#75beff', tooltip: 'Field' },
  constructor: { icon: 'n', color: '#b180d7', tooltip: 'Constructor' },
  enum: { icon: 'E', color: '#ee9d28', tooltip: 'Enum' },
  interface: { icon: 'I', color: '#75beff', tooltip: 'Interface' },
  function: { icon: 'ƒ', color: '#b180d7', tooltip: 'Function' },
  variable: { icon: 'ʌ', color: '#75beff', tooltip: 'Variable' },
  constant: { icon: 'c', color: '#cccccc', tooltip: 'Constant' },
  string: { icon: '"', color: '#ce9178' },
  number: { icon: '#', color: '#b5cea8' },
  boolean: { icon: '◐', color: '#4ec9b0' },
  array: { icon: '[]', color: '#cccccc' },
  object: { icon: '{}', color: '#cccccc' },
  key: { icon: 'k', color: '#9cdcfe' },
  null: { icon: '∅', color: '#4ec9b0' },
  enumMember: { icon: 'e', color: '#75beff', tooltip: 'Enum Member' },
  struct: { icon: 'S', color: '#ee9d28', tooltip: 'Struct' },
  event: { icon: '⚡', color: '#ee9d28' },
  operator: { icon: '±', color: '#cccccc' },
  typeParameter: { icon: 'T', color: '#75beff', tooltip: 'Type Parameter' },
};
