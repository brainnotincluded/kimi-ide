/**
 * Diagnostics Manager - Manages diagnostic (error/warning) reporting
 * IDE Kimi IDE - Language Support Framework
 */

import { Diagnostic, Range, DiagnosticSeverity, EventEmitter, Disposable } from './types';

// ============================================================================
// Types
// ============================================================================

export interface DiagnosticChangeEvent {
    /** URI of the document that changed */
    uri: string;
    /** New diagnostics for the document */
    diagnostics: Diagnostic[];
    /** Source of the diagnostics (language provider ID) */
    source: string;
}

export interface DiagnosticsClearedEvent {
    /** URI of the document that was cleared */
    uri: string;
    /** Whether all diagnostics were cleared */
    all: boolean;
}

export interface ValidationOptions {
    /** Delay in milliseconds before running validation */
    delay?: number;
    /** Whether to validate on change */
    validateOnChange?: boolean;
    /** Whether to validate on save */
    validateOnSave?: boolean;
    /** Whether to validate on type */
    validateOnType?: boolean;
}

export interface DocumentVersion {
    /** Document URI */
    uri: string;
    /** Document version number */
    version: number;
    /** Document content */
    content: string;
}

export interface PendingValidation {
    /** Timeout ID */
    timeoutId: NodeJS.Timeout;
    /** Document version at validation request time */
    version: number;
}

/**
 * Function type for validating a document and returning diagnostics
 */
export type ValidatorFunction = (
    uri: string,
    content: string,
    version: number
) => Promise<Diagnostic[]> | Diagnostic[];

// ============================================================================
// Diagnostics Manager
// ============================================================================

/**
 * Diagnostics Manager - Central hub for managing diagnostics in IDE Kimi IDE
 * 
 * This class manages the collection, storage, and distribution of diagnostics
 * (errors, warnings, information, hints) from various language providers.
 * 
 * @example
 * ```typescript
 * const diagnosticsManager = new DiagnosticsManager();
 * 
 * // Register a validator for a language
 * diagnosticsManager.registerValidator('typescript', async (uri, content) => {
 *   // Run TypeScript compiler or linter
 *   return [{ range: {...}, severity: DiagnosticSeverity.Error, message: '...' }];
 * });
 * 
 * // Listen for diagnostic changes
 * diagnosticsManager.onDiagnosticsChanged(({ uri, diagnostics }) => {
 *   editor.setDiagnostics(uri, diagnostics);
 * });
 * 
 * // Trigger validation on document change
 * document.onChange(() => {
 *   diagnosticsManager.onChange(document.uri, document.content, document.version);
 * });
 * ```
 */
export class DiagnosticsManager implements Disposable {
    /** Map of document URI to diagnostics */
    private diagnostics: Map<string, Diagnostic[]> = new Map();
    
    /** Map of document URI to pending validation timeout */
    private pendingValidations: Map<string, PendingValidation> = new Map();
    
    /** Map of language ID to validator function */
    private validators: Map<string, ValidatorFunction> = new Map();
    
    /** Map of document URI to language ID */
    private documentLanguages: Map<string, string> = new Map();
    
    /** Validation options */
    private options: Required<ValidationOptions>;

    // Event emitters
    private onDiagnosticsChangedEmitter = new EventEmitter<DiagnosticChangeEvent>();
    private onDiagnosticsClearedEmitter = new EventEmitter<DiagnosticsClearedEvent>();
    private onValidationStartedEmitter = new EventEmitter<string>();
    private onValidationFinishedEmitter = new EventEmitter<string>();

    /**
     * Create a new DiagnosticsManager
     * @param options - Validation options
     */
    constructor(options: ValidationOptions = {}) {
        this.options = {
            delay: 500,
            validateOnChange: true,
            validateOnSave: true,
            validateOnType: false,
            ...options
        };
    }

    // ============================================================================
    // Validation Registration
    // ============================================================================

    /**
     * Register a validator function for a language
     * @param languageId - Language identifier
     * @param validator - Function to validate documents and return diagnostics
     * @returns Disposable to unregister the validator
     * 
     * @example
     * ```typescript
     * diagnosticsManager.registerValidator('typescript', async (uri, content, version) => {
     *   const diagnostics = await tsc.check(uri, content);
     *   return diagnostics.map(d => ({
     *     range: d.range,
     *     severity: d.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
     *     message: d.message,
     *     code: d.code,
     *     source: 'typescript'
     *   }));
     * });
     * ```
     */
    registerValidator(languageId: string, validator: ValidatorFunction): Disposable {
        this.validators.set(languageId, validator);
        
        return {
            dispose: () => {
                this.validators.delete(languageId);
            }
        };
    }

    /**
     * Unregister a validator for a language
     * @param languageId - Language identifier
     */
    unregisterValidator(languageId: string): boolean {
        return this.validators.delete(languageId);
    }

    /**
     * Check if a validator is registered for a language
     * @param languageId - Language identifier
     */
    hasValidator(languageId: string): boolean {
        return this.validators.has(languageId);
    }

    // ============================================================================
    // Document Management
    // ============================================================================

    /**
     * Associate a document with a language
     * @param uri - Document URI
     * @param languageId - Language identifier
     */
    setDocumentLanguage(uri: string, languageId: string): void {
        this.documentLanguages.set(uri, languageId);
    }

    /**
     * Get the language ID associated with a document
     * @param uri - Document URI
     */
    getDocumentLanguage(uri: string): string | undefined {
        return this.documentLanguages.get(uri);
    }

    /**
     * Remove a document and its diagnostics
     * @param uri - Document URI
     */
    removeDocument(uri: string): void {
        this.cancelValidation(uri);
        this.diagnostics.delete(uri);
        this.documentLanguages.delete(uri);
        this.onDiagnosticsClearedEmitter.emit({ uri, all: false });
    }

    // ============================================================================
    // Validation Triggering
    // ============================================================================

    /**
     * Handle document content change - triggers validation with debouncing
     * @param uri - Document URI
     * @param content - New document content
     * @param version - Document version
     * 
     * @example
     * ```typescript
     * editor.onChange((content, version) => {
     *   diagnosticsManager.onChange(editor.uri, content, version);
     * });
     * ```
     */
    onChange(uri: string, content: string, version: number): void {
        if (!this.options.validateOnChange) {
            return;
        }

        const languageId = this.documentLanguages.get(uri);
        if (!languageId || !this.validators.has(languageId)) {
            return;
        }

        this.scheduleValidation(uri, content, version, languageId);
    }

    /**
     * Handle document save - triggers immediate validation
     * @param uri - Document URI
     * @param content - Document content
     * @param version - Document version
     */
    onSave(uri: string, content: string, version: number): void {
        if (!this.options.validateOnSave) {
            return;
        }

        const languageId = this.documentLanguages.get(uri);
        if (!languageId || !this.validators.has(languageId)) {
            return;
        }

        // Cancel pending validation and run immediately
        this.cancelValidation(uri);
        this.runValidation(uri, content, version, languageId);
    }

    /**
     * Handle typing - optionally triggers validation
     * @param uri - Document URI
     * @param content - Document content
     * @param version - Document version
     */
    onType(uri: string, content: string, version: number): void {
        if (!this.options.validateOnType) {
            return;
        }

        this.onChange(uri, content, version);
    }

    /**
     * Manually trigger validation for a document
     * @param uri - Document URI
     * @param content - Document content
     * @param version - Document version
     * @returns Promise that resolves when validation is complete
     */
    async validateNow(uri: string, content: string, version: number): Promise<Diagnostic[]> {
        const languageId = this.documentLanguages.get(uri);
        if (!languageId) {
            throw new Error(`No language registered for document: ${uri}`);
        }

        const validator = this.validators.get(languageId);
        if (!validator) {
            throw new Error(`No validator registered for language: ${languageId}`);
        }

        this.cancelValidation(uri);
        return this.runValidation(uri, content, version, languageId);
    }

    // ============================================================================
    // Diagnostics Management
    // ============================================================================

    /**
     * Publish diagnostics for a document
     * @param uri - Document URI
     * @param diagnostics - Array of diagnostics
     * @param source - Source of the diagnostics (e.g., language provider ID)
     * 
     * @example
     * ```typescript
     * // Directly publish diagnostics (e.g., from LSP)
     * diagnosticsManager.publishDiagnostics(
     *   'file:///path/to/file.ts',
     *   [{ range: {...}, severity: DiagnosticSeverity.Error, message: '...' }],
     *   'typescript-language-server'
     * );
     * ```
     */
    publishDiagnostics(uri: string, diagnostics: Diagnostic[], source: string): void {
        // Sort diagnostics by severity (errors first) and then by position
        const sortedDiagnostics = [...diagnostics].sort((a, b) => {
            const severityOrder = [
                DiagnosticSeverity.Error,
                DiagnosticSeverity.Warning,
                DiagnosticSeverity.Information,
                DiagnosticSeverity.Hint
            ];
            
            const aOrder = severityOrder.indexOf(a.severity);
            const bOrder = severityOrder.indexOf(b.severity);
            
            if (aOrder !== bOrder) {
                return aOrder - bOrder;
            }
            
            // Same severity, sort by line then character
            if (a.range.start.line !== b.range.start.line) {
                return a.range.start.line - b.range.start.line;
            }
            return a.range.start.character - b.range.start.character;
        });

        this.diagnostics.set(uri, sortedDiagnostics);
        
        this.onDiagnosticsChangedEmitter.emit({
            uri,
            diagnostics: sortedDiagnostics,
            source
        });
    }

    /**
     * Clear diagnostics for a document
     * @param uri - Document URI, or undefined to clear all diagnostics
     */
    clearDiagnostics(uri?: string): void {
        if (uri) {
            this.diagnostics.delete(uri);
            this.onDiagnosticsClearedEmitter.emit({ uri, all: false });
        } else {
            const uris = Array.from(this.diagnostics.keys());
            this.diagnostics.clear();
            uris.forEach(u => {
                this.onDiagnosticsClearedEmitter.emit({ uri: u, all: true });
            });
        }
    }

    /**
     * Get diagnostics for a document
     * @param uri - Document URI
     * @returns Array of diagnostics, or empty array if none
     */
    getDiagnostics(uri: string): Diagnostic[] {
        return this.diagnostics.get(uri) || [];
    }

    /**
     * Get all diagnostics
     * @returns Map of URI to diagnostics
     */
    getAllDiagnostics(): Map<string, Diagnostic[]> {
        return new Map(this.diagnostics);
    }

    /**
     * Get diagnostics count by severity
     * @param uri - Document URI, or undefined for all documents
     */
    getDiagnosticsCount(uri?: string): { errors: number; warnings: number; info: number; hints: number } {
        const diagnostics = uri 
            ? this.diagnostics.get(uri) || []
            : Array.from(this.diagnostics.values()).flat();

        return {
            errors: diagnostics.filter(d => d.severity === DiagnosticSeverity.Error).length,
            warnings: diagnostics.filter(d => d.severity === DiagnosticSeverity.Warning).length,
            info: diagnostics.filter(d => d.severity === DiagnosticSeverity.Information).length,
            hints: diagnostics.filter(d => d.severity === DiagnosticSeverity.Hint).length
        };
    }

    /**
     * Check if a document has errors
     * @param uri - Document URI
     */
    hasErrors(uri: string): boolean {
        const diagnostics = this.diagnostics.get(uri);
        return diagnostics?.some(d => d.severity === DiagnosticSeverity.Error) ?? false;
    }

    /**
     * Check if any document has errors
     */
    hasAnyErrors(): boolean {
        for (const diagnostics of this.diagnostics.values()) {
            if (diagnostics.some(d => d.severity === DiagnosticSeverity.Error)) {
                return true;
            }
        }
        return false;
    }

    // ============================================================================
    // Events
    // ============================================================================

    /**
     * Event fired when diagnostics change for a document
     */
    get onDiagnosticsChanged(): EventEmitter<DiagnosticChangeEvent> {
        return this.onDiagnosticsChangedEmitter;
    }

    /**
     * Event fired when diagnostics are cleared
     */
    get onDiagnosticsCleared(): EventEmitter<DiagnosticsClearedEvent> {
        return this.onDiagnosticsClearedEmitter;
    }

    /**
     * Event fired when validation starts for a document
     */
    get onValidationStarted(): EventEmitter<string> {
        return this.onValidationStartedEmitter;
    }

    /**
     * Event fired when validation finishes for a document
     */
    get onValidationFinished(): EventEmitter<string> {
        return this.onValidationFinishedEmitter;
    }

    // ============================================================================
    // Configuration
    // ============================================================================

    /**
     * Update validation options
     * @param options - New validation options
     */
    configure(options: ValidationOptions): void {
        this.options = { ...this.options, ...options };
    }

    /**
     * Get current validation options
     */
    getConfiguration(): Required<ValidationOptions> {
        return { ...this.options };
    }

    // ============================================================================
    // Private Methods
    // ============================================================================

    private scheduleValidation(
        uri: string,
        content: string,
        version: number,
        languageId: string
    ): void {
        // Cancel any existing validation for this document
        this.cancelValidation(uri);

        // Schedule new validation
        const timeoutId = setTimeout(() => {
            this.runValidation(uri, content, version, languageId);
        }, this.options.delay);

        this.pendingValidations.set(uri, { timeoutId, version });
    }

    private cancelValidation(uri: string): void {
        const pending = this.pendingValidations.get(uri);
        if (pending) {
            clearTimeout(pending.timeoutId);
            this.pendingValidations.delete(uri);
        }
    }

    private async runValidation(
        uri: string,
        content: string,
        version: number,
        languageId: string
    ): Promise<Diagnostic[]> {
        const validator = this.validators.get(languageId);
        if (!validator) {
            return [];
        }

        this.pendingValidations.delete(uri);
        this.onValidationStartedEmitter.emit(uri);

        try {
            const diagnostics = await validator(uri, content, version);
            
            // Only publish if no newer validation has started
            const pending = this.pendingValidations.get(uri);
            if (!pending || pending.version <= version) {
                this.publishDiagnostics(uri, diagnostics, languageId);
            }
            
            this.onValidationFinishedEmitter.emit(uri);
            return diagnostics;
        } catch (error) {
            console.error(`Validation failed for ${uri}:`, error);
            this.onValidationFinishedEmitter.emit(uri);
            return [];
        }
    }

    /**
     * Dispose of the diagnostics manager
     */
    dispose(): void {
        // Cancel all pending validations
        for (const { timeoutId } of this.pendingValidations.values()) {
            clearTimeout(timeoutId);
        }
        this.pendingValidations.clear();

        // Clear all diagnostics
        this.clearDiagnostics();

        // Dispose event emitters
        this.onDiagnosticsChangedEmitter.dispose();
        this.onDiagnosticsClearedEmitter.dispose();
        this.onValidationStartedEmitter.dispose();
        this.onValidationFinishedEmitter.dispose();

        // Clear all maps
        this.diagnostics.clear();
        this.validators.clear();
        this.documentLanguages.clear();
    }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a diagnostic object
 */
export function createDiagnostic(
    range: Range,
    message: string,
    severity: DiagnosticSeverity = DiagnosticSeverity.Error,
    options: {
        code?: string | number;
        source?: string;
        relatedInformation?: DiagnosticRelatedInformation[];
    } = {}
): Diagnostic {
    return {
        range,
        severity,
        message,
        code: options.code,
        source: options.source,
        relatedInformation: options.relatedInformation
    };
}

export interface DiagnosticRelatedInformation {
    location: {
        uri: string;
        range: Range;
    };
    message: string;
}

/**
 * Filter diagnostics by severity
 */
export function filterDiagnosticsBySeverity(
    diagnostics: Diagnostic[],
    minSeverity: DiagnosticSeverity
): Diagnostic[] {
    return diagnostics.filter(d => d.severity <= minSeverity);
}

/**
 * Group diagnostics by line number
 */
export function groupDiagnosticsByLine(diagnostics: Diagnostic[]): Map<number, Diagnostic[]> {
    const groups = new Map<number, Diagnostic[]>();
    
    for (const diagnostic of diagnostics) {
        const line = diagnostic.range.start.line;
        if (!groups.has(line)) {
            groups.set(line, []);
        }
        groups.get(line)!.push(diagnostic);
    }
    
    return groups;
}
