/**
 * Language Support System - Core Module
 * IDE Kimi IDE - Language Support Framework
 * 
 * This module provides the foundation for language support in IDE Kimi IDE.
 * It includes base classes, registries, and utilities for implementing
 * language providers.
 * 
 * @example
 * ```typescript
 * import {
 *   BaseLanguageProvider,
 *   LanguageRegistry,
 *   LanguageClient,
 *   DiagnosticsManager,
 *   LanguageConfigurationManager
 * } from './core';
 * 
 * // Create registry and register a language
 * const registry = new LanguageRegistry();
 * registry.register(new MyLanguageProvider());
 * 
 * // Detect languages in a project
 * const languages = await registry.detectLanguages('/path/to/project');
 * 
 * // Activate detected languages
 * await registry.autoActivate('/path/to/project');
 * ```
 */

// ============================================================================
// Core Types
// ============================================================================

import type { Disposable as DisposableType } from './types';

/**
 * Disposable interface - can be cleaned up
 */
export interface Disposable extends DisposableType {}

export {
    // Position and Range
    Position,
    Range,
    Location,
    LocationLink,
    
    // Diagnostics
    Diagnostic,
    DiagnosticSeverity,
    DiagnosticRelatedInformation,
    
    // Completion
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    InsertTextFormat,
    
    // Hover
    Hover,
    MarkedString,
    MarkupContent,
    MarkupKind,
    
    // Text Edit
    TextEdit,
    Command,
    
    // Symbols
    SymbolKind,
    DocumentSymbol,
    SymbolInformation,
    
    // Events
    EventHandler,
    EventEmitter,
    
    // File Changes
    FileChange,
    FileChangeType,
    
    // Configuration
    LanguageConfiguration,
    LanguageConfigurationMap
} from './types';

// ============================================================================
// Base Language Provider
// ============================================================================

export {
    BaseLanguageProvider,
    LanguageProviderState,
    FormattingContext,
    CompletionContext,
    CompletionTriggerKind,
    DocumentFormattingOptions,
    DocumentRangeFormattingOptions,
    CodeActionContext,
    
    // Additional types from BaseLanguageProvider
    WorkspaceEdit,
    TextDocumentEdit,
    VersionedTextDocumentIdentifier,
    CodeAction,
    CodeLens,
    DocumentLink,
    SignatureHelp,
    SignatureInformation,
    ParameterInformation,
    DocumentHighlight,
    DocumentHighlightKind,
    FoldingRange,
    FoldingRangeKind,
    SelectionRange,
    SemanticTokens,
    InlayHint,
    InlayHintLabelPart,
    InlayHintKind,
    CallHierarchyItem,
    CallHierarchyIncomingCall,
    CallHierarchyOutgoingCall,
    TypeHierarchyItem,
    SymbolTag
} from './BaseLanguageProvider';

// ============================================================================
// Language Registry
// ============================================================================

export {
    LanguageRegistry,
    LanguageRegisteredEvent,
    LanguageUnregisteredEvent,
    LanguagesDetectedEvent,
    LanguageInfo,
    globalLanguageRegistry
} from './LanguageRegistry';

// ============================================================================
// Language Client (LSP)
// ============================================================================

export {
    LanguageClient,
    LanguageClientOptions,
    InitializeParams,
    InitializeResult,
    ClientCapabilities,
    ServerCapabilities,
    WorkspaceFolder,
    ConnectionState,
    ConnectionStateChangedEvent,
    MessageReceivedEvent,
    NotificationReceivedEvent,
    TextDocumentContentChangeEvent,
    createClientCapabilities
} from './LanguageClient';

// ============================================================================
// Diagnostics Manager
// ============================================================================

export {
    DiagnosticsManager,
    DiagnosticChangeEvent,
    DiagnosticsClearedEvent,
    ValidationOptions,
    DocumentVersion,
    PendingValidation,
    ValidatorFunction,
    DiagnosticRelatedInformation as DiagnosticsRelatedInformation,
    createDiagnostic,
    filterDiagnosticsBySeverity,
    groupDiagnosticsByLine
} from './DiagnosticsManager';

// ============================================================================
// Configuration
// ============================================================================

export {
    LanguageConfigurationManager,
    LanguageSupportConfiguration,
    ConfigurationChangeEvent,
    LanguageConfigurationSchema,
    createDefaultLanguageConfig,
    mergeLanguageConfig,
    validateLanguageConfig
} from './Configuration';

// ============================================================================
// Re-exports for convenience
// ============================================================================

/**
 * Utility function to check if a value is a Disposable
 */
export function isDisposable(value: any): value is Disposable {
    return value && typeof value.dispose === 'function';
}

/**
 * Dispose of multiple disposables
 */
export function disposeAll(disposables: Disposable[]): void {
    for (const disposable of disposables) {
        try {
            disposable.dispose();
        } catch (error) {
            console.error('Error disposing:', error);
        }
    }
}

/**
 * Create a combined disposable from multiple disposables
 */
export function combinedDisposable(...disposables: Disposable[]): Disposable {
    return {
        dispose: () => {
            disposeAll(disposables);
        }
    };
}

/**
 * Version of the Language Support System
 */
export const VERSION = '1.0.0';

/**
 * System information
 */
export const SYSTEM_INFO = {
    name: 'IDE Kimi IDE Language Support System',
    version: VERSION,
    description: 'Core framework for language support in IDE Kimi IDE'
};
