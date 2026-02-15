/**
 * Base Language Provider - Abstract class for all language implementations
 * IDE Kimi IDE - Language Support Framework
 */

import {
    Position,
    Range,
    Location,
    Diagnostic,
    CompletionItem,
    CompletionList,
    Hover,
    DocumentSymbol,
    SymbolInformation,
    TextEdit,
    EventEmitter,
    Disposable,
    MarkupContent,
    Command,
    SymbolKind
} from './types';

/**
 * Context for document formatting
 */
export interface FormattingContext {
    /** Indentation size */
    tabSize: number;
    /** Use spaces instead of tabs */
    insertSpaces: boolean;
    /** Preferred end of line character */
    eol?: '\n' | '\r\n' | '\r';
    /** Additional formatting options */
    [key: string]: any;
}

/**
 * Context for completion requests
 */
export interface CompletionContext {
    /** Character that triggered completion */
    triggerCharacter?: string;
    /** How completion was triggered */
    triggerKind: CompletionTriggerKind;
}

export enum CompletionTriggerKind {
    /** Completion was triggered by typing an identifier */
    Invoked = 1,
    /** Completion was triggered by a trigger character */
    TriggerCharacter = 2,
    /** Completion was re-triggered as the current completion list is incomplete */
    TriggerForIncompleteCompletions = 3
}

/**
 * Options for document formatting
 */
export interface DocumentFormattingOptions extends FormattingContext {
    /** Additional provider-specific options */
    [key: string]: any;
}

/**
 * Options for range formatting
 */
export interface DocumentRangeFormattingOptions extends FormattingContext {
    /** Additional provider-specific options */
    [key: string]: any;
}

/**
 * Options for code actions
 */
export interface CodeActionContext {
    /** An array of diagnostics known on the client side overlapping the range */
    diagnostics: Diagnostic[];
    /** Requested kind of actions to return */
    only?: string[];
}

/**
 * Abstract base class for all language providers in IDE Kimi IDE
 * 
 * All language implementations must extend this class and provide
 * concrete implementations for the abstract methods.
 * 
 * @example
 * ```typescript
 * class TypeScriptProvider extends BaseLanguageProvider {
 *   id = 'typescript';
 *   name = 'TypeScript';
 *   extensions = ['.ts', '.tsx'];
 *   
 *   async detect(projectPath: string): Promise<boolean> {
 *     // Check for tsconfig.json or .ts files
 *   }
 *   
 *   async activate(projectPath: string): Promise<void> {
 *     // Start TypeScript language server
 *   }
 *   
 *   // ... implement other methods
 * }
 * ```
 */
export abstract class BaseLanguageProvider implements Disposable {
    // ============================================================================
    // Identity Properties
    // ============================================================================

    /** Unique identifier for the language (e.g., 'typescript', 'python') */
    abstract readonly id: string;

    /** Human-readable name of the language */
    abstract readonly name: string;

    /** File extensions associated with this language (e.g., ['.ts', '.tsx']) */
    abstract readonly extensions: string[];

    // ============================================================================
    // State Properties
    // ============================================================================

    /** Whether the provider is currently active */
    protected isActive: boolean = false;

    /** Path to the currently active project */
    protected projectPath: string | null = null;

    /** Event emitter for state changes */
    protected onDidChangeStateEmitter = new EventEmitter<LanguageProviderState>();

    // ============================================================================
    // Abstract Methods - Must be implemented by subclasses
    // ============================================================================

    /**
     * Detect if this language is applicable to the given project
     * @param projectPath - Path to the project root directory
     * @returns Promise resolving to true if this language is detected
     * 
     * @example
     * ```typescript
     * async detect(projectPath: string): Promise<boolean> {
     *   const hasConfig = await this.fileExists(
     *     path.join(projectPath, 'tsconfig.json')
     *   );
     *   const pattern = '**' + '/*.ts';
     *   const hasFiles = await this.findFiles(projectPath, pattern);
     *   return hasConfig || hasFiles.length > 0;
     * }
     * ```
     */
    abstract detect(projectPath: string): Promise<boolean>;

    /**
     * Activate the language provider for the given project
     * @param projectPath - Path to the project root directory
     * @returns Promise that resolves when activation is complete
     * 
     * This method should:
     * - Start the language server or initialize language tools
     * - Set up file watchers
     * - Load project configuration
     * - Perform any necessary initialization
     */
    abstract activate(projectPath: string): Promise<void>;

    /**
     * Deactivate the language provider
     * @returns Promise that resolves when deactivation is complete
     * 
     * This method should:
     * - Stop the language server
     * - Clean up resources
     * - Remove file watchers
     */
    abstract deactivate(): Promise<void>;

    /**
     * Get diagnostics (errors, warnings) for a file
     * @param filePath - Absolute path to the file
     * @returns Array of diagnostics
     */
    abstract getDiagnostics(filePath: string): Promise<Diagnostic[]>;

    /**
     * Format an entire document
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param options - Formatting options
     * @returns Promise resolving to the formatted text, or null if formatting fails
     */
    abstract formatDocument(
        filePath: string,
        content: string,
        options: DocumentFormattingOptions
    ): Promise<string | null>;

    /**
     * Provide completion items for a position in a file
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param position - Position in the document
     * @param context - Completion context
     * @returns Promise resolving to completion items or list
     */
    abstract provideCompletions(
        filePath: string,
        content: string,
        position: Position,
        context: CompletionContext
    ): Promise<CompletionItem[] | CompletionList | null>;

    // ============================================================================
    // Optional Methods - Can be overridden by subclasses
    // ============================================================================

    /**
     * Provide hover information for a position
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param position - Position in the document
     * @returns Promise resolving to hover information, or null
     */
    provideHover(
        filePath: string,
        content: string,
        position: Position
    ): Promise<Hover | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide definition location(s) for a symbol at a position
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param position - Position in the document
     * @returns Promise resolving to definition location(s), or null
     */
    provideDefinition(
        filePath: string,
        content: string,
        position: Position
    ): Promise<Location | Location[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide references to a symbol at a position
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param position - Position in the document
     * @param includeDeclaration - Whether to include the declaration
     * @returns Promise resolving to reference locations
     */
    provideReferences(
        filePath: string,
        content: string,
        position: Position,
        includeDeclaration: boolean
    ): Promise<Location[]> {
        return Promise.resolve([]);
    }

    /**
     * Format a specific range in a document
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param range - Range to format
     * @param options - Formatting options
     * @returns Promise resolving to formatted text edits, or null
     */
    provideRangeFormatting(
        filePath: string,
        content: string,
        range: Range,
        options: DocumentRangeFormattingOptions
    ): Promise<TextEdit[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide formatting during typing
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param position - Current cursor position
     * @param ch - Character typed
     * @param options - Formatting options
     * @returns Promise resolving to text edits, or null
     */
    provideOnTypeFormatting(
        filePath: string,
        content: string,
        position: Position,
        ch: string,
        options: FormattingContext
    ): Promise<TextEdit[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide symbol information for a document
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @returns Promise resolving to document symbols
     */
    provideDocumentSymbols(
        filePath: string,
        content: string
    ): Promise<DocumentSymbol[] | SymbolInformation[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide code actions for a range in a document
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param range - Range in the document
     * @param context - Code action context
     * @returns Promise resolving to code actions
     */
    provideCodeActions(
        filePath: string,
        content: string,
        range: Range,
        context: CodeActionContext
    ): Promise<(CodeAction | Command)[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide code lenses for a document
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @returns Promise resolving to code lenses
     */
    provideCodeLenses(
        filePath: string,
        content: string
    ): Promise<CodeLens[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Resolve a code lens (fill in command)
     * @param codeLens - Code lens to resolve
     * @returns Promise resolving to resolved code lens
     */
    resolveCodeLens(codeLens: CodeLens): Promise<CodeLens> {
        return Promise.resolve(codeLens);
    }

    /**
     * Provide document links
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @returns Promise resolving to document links
     */
    provideDocumentLinks(
        filePath: string,
        content: string
    ): Promise<DocumentLink[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Resolve a document link
     * @param link - Link to resolve
     * @returns Promise resolving to resolved link
     */
    resolveDocumentLink(link: DocumentLink): Promise<DocumentLink> {
        return Promise.resolve(link);
    }

    /**
     * Provide rename edits for a symbol
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param position - Position of the symbol
     * @param newName - New name for the symbol
     * @returns Promise resolving to workspace edit, or null
     */
    provideRenameEdits(
        filePath: string,
        content: string,
        position: Position,
        newName: string
    ): Promise<WorkspaceEdit | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide signature help at a position
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param position - Position in the document
     * @returns Promise resolving to signature help, or null
     */
    provideSignatureHelp(
        filePath: string,
        content: string,
        position: Position
    ): Promise<SignatureHelp | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide implementation locations for an interface
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param position - Position in the document
     * @returns Promise resolving to implementation locations
     */
    provideImplementation(
        filePath: string,
        content: string,
        position: Position
    ): Promise<Location | Location[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide type definition locations
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param position - Position in the document
     * @returns Promise resolving to type definition locations
     */
    provideTypeDefinition(
        filePath: string,
        content: string,
        position: Position
    ): Promise<Location | Location[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide document highlights for a symbol
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param position - Position in the document
     * @returns Promise resolving to document highlights
     */
    provideDocumentHighlights(
        filePath: string,
        content: string,
        position: Position
    ): Promise<DocumentHighlight[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide folding ranges for a document
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @returns Promise resolving to folding ranges
     */
    provideFoldingRanges(
        filePath: string,
        content: string
    ): Promise<FoldingRange[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide selection ranges for positions
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param positions - Positions in the document
     * @returns Promise resolving to selection ranges
     */
    provideSelectionRanges(
        filePath: string,
        content: string,
        positions: Position[]
    ): Promise<SelectionRange[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide semantic tokens for a document
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @returns Promise resolving to semantic tokens
     */
    provideSemanticTokens(
        filePath: string,
        content: string
    ): Promise<SemanticTokens | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide inlay hints for a document
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param range - Range to provide hints for
     * @returns Promise resolving to inlay hints
     */
    provideInlayHints(
        filePath: string,
        content: string,
        range: Range
    ): Promise<InlayHint[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide call hierarchy items
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param position - Position in the document
     * @returns Promise resolving to call hierarchy items
     */
    provideCallHierarchyItems(
        filePath: string,
        content: string,
        position: Position
    ): Promise<CallHierarchyItem[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide incoming calls for a call hierarchy item
     * @param item - Call hierarchy item
     * @returns Promise resolving to incoming calls
     */
    provideCallHierarchyIncomingCalls(
        item: CallHierarchyItem
    ): Promise<CallHierarchyIncomingCall[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide outgoing calls for a call hierarchy item
     * @param item - Call hierarchy item
     * @returns Promise resolving to outgoing calls
     */
    provideCallHierarchyOutgoingCalls(
        item: CallHierarchyItem
    ): Promise<CallHierarchyOutgoingCall[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Provide type hierarchy items
     * @param filePath - Absolute path to the file
     * @param content - Content of the document
     * @param position - Position in the document
     * @returns Promise resolving to type hierarchy items
     */
    provideTypeHierarchyItems(
        filePath: string,
        content: string,
        position: Position
    ): Promise<TypeHierarchyItem[] | null> {
        return Promise.resolve(null);
    }

    /**
     * Execute a command provided by this language
     * @param command - Command identifier
     * @param args - Command arguments
     * @returns Promise resolving to command result
     */
    executeCommand(command: string, ...args: any[]): Promise<any> {
        return Promise.resolve(undefined);
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    /**
     * Check if the provider is currently active
     */
    get active(): boolean {
        return this.isActive;
    }

    /**
     * Get the current project path
     */
    get currentProjectPath(): string | null {
        return this.projectPath;
    }

    /**
     * Event fired when the provider state changes
     */
    get onDidChangeState(): EventEmitter<LanguageProviderState> {
        return this.onDidChangeStateEmitter;
    }

    /**
     * Check if a file matches this language's extensions
     * @param filePath - Path to check
     */
    matchesFile(filePath: string): boolean {
        const lowercasePath = filePath.toLowerCase();
        return this.extensions.some(ext => 
            lowercasePath.endsWith(ext.toLowerCase())
        );
    }

    /**
     * Update the internal state and emit event
     */
    protected setState(state: LanguageProviderState): void {
        const oldState = this.isActive;
        this.isActive = state === LanguageProviderState.Active;
        this.onDidChangeStateEmitter.emit(state);
    }

    /**
     * Dispose of the provider and clean up resources
     */
    dispose(): void {
        if (this.isActive) {
            this.deactivate().catch(console.error);
        }
        this.onDidChangeStateEmitter.dispose();
    }
}

/**
 * States a language provider can be in
 */
export enum LanguageProviderState {
    Inactive = 'inactive',
    Activating = 'activating',
    Active = 'active',
    Deactivating = 'deactivating',
    Error = 'error'
}

// Additional types referenced above

export interface WorkspaceEdit {
    changes?: { [uri: string]: TextEdit[] };
    documentChanges?: TextDocumentEdit[];
}

export interface TextDocumentEdit {
    textDocument: VersionedTextDocumentIdentifier;
    edits: TextEdit[];
}

export interface VersionedTextDocumentIdentifier {
    uri: string;
    version: number | null;
}

export interface CodeAction {
    title: string;
    kind?: string;
    diagnostics?: Diagnostic[];
    isPreferred?: boolean;
    edit?: WorkspaceEdit;
    command?: Command;
}

export interface CodeLens {
    range: Range;
    command?: Command;
    data?: any;
}

export interface DocumentLink {
    range: Range;
    target?: string;
    tooltip?: string;
    data?: any;
}

export interface SignatureHelp {
    signatures: SignatureInformation[];
    activeSignature?: number;
    activeParameter?: number;
}

export interface SignatureInformation {
    label: string;
    documentation?: string | MarkupContent;
    parameters: ParameterInformation[];
    activeParameter?: number;
}

export interface ParameterInformation {
    label: string | [number, number];
    documentation?: string | MarkupContent;
}

export interface DocumentHighlight {
    range: Range;
    kind?: DocumentHighlightKind;
}

export enum DocumentHighlightKind {
    Text = 1,
    Read = 2,
    Write = 3
}

export interface FoldingRange {
    startLine: number;
    startCharacter?: number;
    endLine: number;
    endCharacter?: number;
    kind?: FoldingRangeKind;
    collapsedText?: string;
}

export enum FoldingRangeKind {
    Comment = 'comment',
    Imports = 'imports',
    Region = 'region'
}

export interface SelectionRange {
    range: Range;
    parent?: SelectionRange;
}

export interface SemanticTokens {
    resultId?: string;
    data: number[];
}

export interface InlayHint {
    position: Position;
    label: string | InlayHintLabelPart[];
    kind?: InlayHintKind;
    textEdits?: TextEdit[];
    tooltip?: string | MarkupContent;
    paddingLeft?: boolean;
    paddingRight?: boolean;
    data?: any;
}

export interface InlayHintLabelPart {
    value: string;
    tooltip?: string | MarkupContent;
    location?: Location;
    command?: Command;
}

export enum InlayHintKind {
    Type = 1,
    Parameter = 2
}

export interface CallHierarchyItem {
    name: string;
    kind: SymbolKind;
    tags?: SymbolTag[];
    detail?: string;
    uri: string;
    range: Range;
    selectionRange: Range;
    data?: any;
}

export interface CallHierarchyIncomingCall {
    from: CallHierarchyItem;
    fromRanges: Range[];
}

export interface CallHierarchyOutgoingCall {
    to: CallHierarchyItem;
    fromRanges: Range[];
}

export interface TypeHierarchyItem {
    name: string;
    kind: SymbolKind;
    tags?: SymbolTag[];
    detail?: string;
    uri: string;
    range: Range;
    selectionRange: Range;
    data?: any;
}

export enum SymbolTag {
    Deprecated = 1
}

export { MarkupContent } from './types';
