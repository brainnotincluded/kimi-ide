/**
 * Web Language Support Types
 * TypeScript/JavaScript/JSON/YAML/TOML support for IDE Kimi IDE
 */

// ============ Diagnostics ============

export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  code?: string | number;
  source: 'eslint' | 'tsc' | 'json-schema' | 'yaml-schema';
  ruleId?: string;
  fixes?: TextEdit[];
}

export interface TextEdit {
  range: Range;
  newText: string;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface Position {
  line: number;
  character: number;
}

// ============ Completions ============

export interface CompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
  filterText?: string;
  sortText?: string;
  preselect?: boolean;
  commitCharacters?: string[];
  command?: Command;
  additionalTextEdits?: TextEdit[];
}

export type CompletionItemKind =
  | 'text'
  | 'method'
  | 'function'
  | 'constructor'
  | 'field'
  | 'variable'
  | 'class'
  | 'interface'
  | 'module'
  | 'property'
  | 'unit'
  | 'value'
  | 'enum'
  | 'keyword'
  | 'snippet'
  | 'color'
  | 'file'
  | 'reference'
  | 'folder'
  | 'enumMember'
  | 'constant'
  | 'struct'
  | 'event'
  | 'operator'
  | 'typeParameter';

export interface Command {
  title: string;
  command: string;
  arguments?: unknown[];
}

// ============ Formatting ============

export interface FormattingOptions {
  tabSize: number;
  insertSpaces: boolean;
  trimTrailingWhitespace?: boolean;
  insertFinalNewline?: boolean;
  trimFinalNewlines?: boolean;
}

export interface FormattingResult {
  formatted: string;
  edits: TextEdit[];
}

// ============ Refactoring ============

export interface RefactoringAction {
  name: string;
  description: string;
  kind: 'quickfix' | 'refactor' | 'source';
  edits: WorkspaceEdit;
}

export interface WorkspaceEdit {
  changes: Record<string, TextEdit[]>;
  documentChanges?: DocumentChange[];
}

export interface DocumentChange {
  textDocument: { uri: string; version: number };
  edits: TextEdit[];
}

export interface RenameParams {
  file: string;
  position: Position;
  newName: string;
}

export interface ExtractFunctionParams {
  file: string;
  range: Range;
  functionName: string;
}

// ============ Import Organization ============

export interface ImportOrganizerOptions {
  sortImports: boolean;
  groupImports: boolean;
  removeUnused: boolean;
  importOrder?: string[];
}

// ============ Package.json ============

export interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  types?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  engines?: { node?: string; npm?: string };
}

export interface NPMScript {
  name: string;
  command: string;
  description?: string;
}

export interface DependencyInfo {
  name: string;
  version: string;
  type: 'dependency' | 'devDependency' | 'peerDependency' | 'optionalDependency';
  latestVersion?: string;
  outdated?: boolean;
}

// ============ Configuration ============

export interface WebLanguageConfig {
  typescript: {
    tsdk: string;
    enableTSDiagnostics: boolean;
    tsconfigPath?: string;
  };
  prettier: {
    configPath?: string;
    useTabs: boolean;
    tabWidth: number;
    singleQuote: boolean;
    semi: boolean;
    trailingComma: 'none' | 'es5' | 'all';
  };
  eslint: {
    nodePath?: string;
    enabled: boolean;
    autoFix: boolean;
    configPath?: string;
  };
  editor: {
    formatOnSave: boolean;
    organizeImportsOnSave: boolean;
    defaultFormatter: 'prettier' | 'typescript';
  };
  json: {
    schemaStore: boolean;
    schemas: JSONSchemaMapping[];
  };
  yaml: {
    schemaStore: boolean;
    schemas: JSONSchemaMapping[];
  };
}

export interface JSONSchemaMapping {
  fileMatch: string[];
  url: string;
}

// ============ Language Server ============

export interface LanguageServerConfig {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
}

export interface ServerCapabilities {
  textDocumentSync?: number | { openClose?: boolean; change?: number; willSave?: boolean; willSaveWaitUntil?: boolean; save?: boolean | { includeText?: boolean } };
  completionProvider?: { resolveProvider?: boolean; triggerCharacters?: string[] };
  hoverProvider?: boolean;
  signatureHelpProvider?: { triggerCharacters?: string[]; retriggerCharacters?: string[] };
  definitionProvider?: boolean;
  referencesProvider?: boolean;
  documentHighlightProvider?: boolean;
  documentSymbolProvider?: boolean;
  codeActionProvider?: boolean | { codeActionKinds?: string[]; resolveProvider?: boolean };
  codeLensProvider?: { resolveProvider?: boolean };
  documentFormattingProvider?: boolean;
  documentRangeFormattingProvider?: boolean;
  documentOnTypeFormattingProvider?: { firstTriggerCharacter: string; moreTriggerCharacter?: string[] };
  renameProvider?: boolean | { prepareProvider?: boolean };
  documentLinkProvider?: { resolveProvider?: boolean };
  colorProvider?: boolean;
  foldingRangeProvider?: boolean;
  executeCommandProvider?: { commands: string[] };
  selectionRangeProvider?: boolean;
  semanticTokensProvider?: unknown;
}

// ============ Status ============

export interface TSStatus {
  version: string;
  isReady: boolean;
  projectCount: number;
  fileCount: number;
}

export interface ESLintStatus {
  enabled: boolean;
  isReady: boolean;
  rulesCount: number;
  configPath?: string;
}

export interface PrettierStatus {
  enabled: boolean;
  version: string;
  configPath?: string;
}

export interface WebLanguageStatus {
  typescript: TSStatus;
  eslint: ESLintStatus;
  prettier: PrettierStatus;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'none';
}

// ============ IPC Messages ============

export interface InstallPackagesRequest {
  packages: string[];
  dev?: boolean;
  global?: boolean;
  packageManager?: 'npm' | 'yarn' | 'pnpm';
}

export interface InstallPackagesResult {
  success: boolean;
  installed: string[];
  failed: string[];
  output: string;
}

export interface RunScriptRequest {
  script: string;
  args?: string[];
  cwd?: string;
}

export interface RunScriptResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface FormatRequest {
  file: string;
  content: string;
  options?: Partial<FormattingOptions>;
}

export interface FormatResult {
  success: boolean;
  formatted?: string;
  edits?: TextEdit[];
  error?: string;
}

export interface LintRequest {
  file: string;
  content?: string;
  fix?: boolean;
}

export interface LintResult {
  success: boolean;
  diagnostics: Diagnostic[];
  fixed?: boolean;
  error?: string;
}
