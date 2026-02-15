/**
 * Go Language Support Types
 * 
 * Type definitions for Go language support in Kimi IDE IDE
 */

export interface GoInstallation {
  version: string;
  goroot: string;
  gopath: string;
  goplsInstalled: boolean;
  staticcheckInstalled: boolean;
}

export interface GoModule {
  module: string;
  goVersion: string;
  require: GoRequire[];
  replace: GoReplace[];
  exclude: GoExclude[];
}

export interface GoRequire {
  path: string;
  version: string;
  indirect: boolean;
}

export interface GoReplace {
  old: string;
  new: string;
  newVersion?: string;
}

export interface GoExclude {
  path: string;
  version: string;
}

export interface GoCommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  error?: string;
}

export interface GoDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  code?: string;
  source: string;
}

export interface GoCompletionItem {
  label: string;
  kind: GoCompletionKind;
  detail?: string;
  documentation?: string;
  insertText: string;
  sortText?: string;
}

export enum GoCompletionKind {
  Text = 1,
  Method = 2,
  Function = 3,
  Constructor = 4,
  Field = 5,
  Variable = 6,
  Class = 7,
  Interface = 8,
  Module = 9,
  Property = 10,
  Unit = 11,
  Value = 12,
  Enum = 13,
  Keyword = 14,
  Snippet = 15,
  Color = 16,
  File = 17,
  Reference = 18,
  Folder = 19,
  EnumMember = 20,
  Constant = 21,
  Struct = 22,
  Event = 23,
  Operator = 24,
  TypeParameter = 25
}

export interface GoBuildResult {
  success: boolean;
  binaryPath?: string;
  errors: GoDiagnostic[];
  warnings: GoDiagnostic[];
}

export interface GoTestResult {
  success: boolean;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  output: string;
  failures: GoTestFailure[];
}

export interface GoTestFailure {
  test: string;
  package: string;
  message: string;
  file?: string;
  line?: number;
}

export interface GoToolsStatus {
  go: boolean;
  gopls: boolean;
  staticcheck: boolean;
  goimports: boolean;
  gofumpt: boolean;
  dlv: boolean;
}

export interface GoPackage {
  name: string;
  path: string;
  isStdLib: boolean;
  files: string[];
  imports: string[];
}

export interface GoWorkspaceSymbol {
  name: string;
  kind: GoCompletionKind;
  location: {
    file: string;
    line: number;
    column: number;
  };
  containerName?: string;
}

export type GoLintTool = 'staticcheck' | 'golint' | 'govet';
export type GoFormatTool = 'gofmt' | 'goimports' | 'gofumpt';
export type GoToolsManagement = 'auto' | 'manual';

export interface GoConfiguration {
  goroot?: string;
  gopath?: string;
  toolsManagement: GoToolsManagement;
  lintTool: GoLintTool;
  formatTool: GoFormatTool;
  buildFlags: string[];
  testFlags: string[];
  enableGopls: boolean;
  goplsPath?: string;
}

export interface GoplsInitializeResult {
  capabilities: {
    textDocumentSync?: number;
    completionProvider?: {
      resolveProvider?: boolean;
      triggerCharacters?: string[];
    };
    hoverProvider?: boolean;
    signatureHelpProvider?: {
      triggerCharacters?: string[];
    };
    definitionProvider?: boolean;
    referencesProvider?: boolean;
    documentHighlightProvider?: boolean;
    documentSymbolProvider?: boolean;
    codeActionProvider?: boolean;
    codeLensProvider?: {
      resolveProvider?: boolean;
    };
    documentFormattingProvider?: boolean;
    documentRangeFormattingProvider?: boolean;
    documentOnTypeFormattingProvider?: {
      firstTriggerCharacter: string;
      moreTriggerCharacter?: string[];
    };
    renameProvider?: boolean;
    foldingRangeProvider?: boolean;
    executeCommandProvider?: {
      commands: string[];
    };
    selectionRangeProvider?: boolean;
  };
}
