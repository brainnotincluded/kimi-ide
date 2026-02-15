/**
 * Common interface for language providers in Kimi IDE IDE
 */

export enum DiagnosticSeverity {
  Error = 'error',
  Warning = 'warning',
  Information = 'information',
  Hint = 'hint'
}

export enum CompletionItemKind {
  Text = 'text',
  Method = 'method',
  Function = 'function',
  Constructor = 'constructor',
  Field = 'field',
  Variable = 'variable',
  Class = 'class',
  Interface = 'interface',
  Module = 'module',
  Property = 'property',
  Unit = 'unit',
  Value = 'value',
  Enum = 'enum',
  Keyword = 'keyword',
  Snippet = 'snippet',
  Color = 'color',
  File = 'file',
  Reference = 'reference',
  Folder = 'folder',
  EnumMember = 'enumMember',
  Constant = 'constant',
  Struct = 'struct',
  Event = 'event',
  Operator = 'operator',
  TypeParameter = 'typeParameter'
}

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface IDiagnostic {
  file: string;
  line: number;
  column: number;
  severity: DiagnosticSeverity;
  message: string;
  code?: string;
  source?: string;
  relatedInformation?: {
    file: string;
    line: number;
    column: number;
    message: string;
  }[];
}

export interface ICompletionItem {
  label: string;
  kind: CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText?: string;
  filterText?: string;
  sortText?: string;
  preselect?: boolean;
}

export interface ILanguageProvider {
  readonly id: string;
  readonly name: string;
  readonly extensions: string[];
  
  initialize(): Promise<void>;
  dispose(): Promise<void>;
  
  getDiagnostics(filePath: string): Promise<IDiagnostic[]>;
  getCompletions(filePath: string, position: Position): Promise<ICompletionItem[]>;
  formatCode(filePath: string, range?: Range): Promise<string | null>;
}
