/**
 * Core types for Language Support System
 * IDE Kimi IDE - Language Support Framework
 */

// ============================================================================
// Position and Range Types
// ============================================================================

export interface Position {
    line: number;
    character: number;
}

export interface Range {
    start: Position;
    end: Position;
}

// ============================================================================
// Location Types
// ============================================================================

export interface Location {
    uri: string;
    range: Range;
}

export interface LocationLink {
    originSelectionRange?: Range;
    targetUri: string;
    targetRange: Range;
    targetSelectionRange: Range;
}

// ============================================================================
// Diagnostic Types
// ============================================================================

export enum DiagnosticSeverity {
    Error = 1,
    Warning = 2,
    Information = 3,
    Hint = 4
}

export interface Diagnostic {
    range: Range;
    severity: DiagnosticSeverity;
    code?: string | number;
    source?: string;
    message: string;
    relatedInformation?: DiagnosticRelatedInformation[];
}

export interface DiagnosticRelatedInformation {
    location: Location;
    message: string;
}

// ============================================================================
// Completion Types
// ============================================================================

export enum CompletionItemKind {
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

export enum InsertTextFormat {
    PlainText = 1,
    Snippet = 2
}

export interface CompletionItem {
    label: string;
    kind?: CompletionItemKind;
    detail?: string;
    documentation?: string | MarkupContent;
    sortText?: string;
    filterText?: string;
    insertText?: string;
    insertTextFormat?: InsertTextFormat;
    additionalTextEdits?: TextEdit[];
    command?: Command;
}

export interface CompletionList {
    isIncomplete: boolean;
    items: CompletionItem[];
}

// ============================================================================
// Hover Types
// ============================================================================

export interface Hover {
    contents: MarkupContent | MarkedString | MarkedString[];
    range?: Range;
}

export type MarkedString = string | { language: string; value: string };

export interface MarkupContent {
    kind: MarkupKind;
    value: string;
}

export enum MarkupKind {
    PlainText = 'plaintext',
    Markdown = 'markdown'
}

// ============================================================================
// Text Edit Types
// ============================================================================

export interface TextEdit {
    range: Range;
    newText: string;
}

export interface Command {
    title: string;
    command: string;
    arguments?: any[];
}

// ============================================================================
// Symbol Types
// ============================================================================

export enum SymbolKind {
    File = 1,
    Module = 2,
    Namespace = 3,
    Package = 4,
    Class = 5,
    Method = 6,
    Property = 7,
    Field = 8,
    Constructor = 9,
    Enum = 10,
    Interface = 11,
    Function = 12,
    Variable = 13,
    Constant = 14,
    String = 15,
    Number = 16,
    Boolean = 17,
    Array = 18,
    Object = 19,
    Key = 20,
    Null = 21,
    EnumMember = 22,
    Struct = 23,
    Event = 24,
    Operator = 25,
    TypeParameter = 26
}

export interface DocumentSymbol {
    name: string;
    detail?: string;
    kind: SymbolKind;
    deprecated?: boolean;
    range: Range;
    selectionRange: Range;
    children?: DocumentSymbol[];
}

export interface SymbolInformation {
    name: string;
    kind: SymbolKind;
    deprecated?: boolean;
    location: Location;
    containerName?: string;
}

// ============================================================================
// Workspace Types
// ============================================================================

export interface FileChange {
    uri: string;
    type: FileChangeType;
}

export enum FileChangeType {
    Created = 1,
    Changed = 2,
    Deleted = 3
}

// ============================================================================
// Language Configuration Types
// ============================================================================

export interface LanguageConfiguration {
    enabled: boolean;
    executable?: string;
    args?: string[];
    [key: string]: any;
}

export interface LanguageConfigurationMap {
    [languageId: string]: LanguageConfiguration;
}

// ============================================================================
// Event Types
// ============================================================================

export type EventHandler<T> = (data: T) => void;

export interface Disposable {
    dispose(): void;
}

export class EventEmitter<T> {
    private handlers: EventHandler<T>[] = [];

    on(handler: EventHandler<T>): Disposable {
        this.handlers.push(handler);
        return {
            dispose: () => {
                const index = this.handlers.indexOf(handler);
                if (index !== -1) {
                    this.handlers.splice(index, 1);
                }
            }
        };
    }

    emit(data: T): void {
        this.handlers.forEach(handler => handler(data));
    }

    dispose(): void {
        this.handlers = [];
    }
}
