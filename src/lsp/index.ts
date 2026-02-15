/**
 * Kimi LSP Integration
 * 
 * Language Server Protocol integration for Kimi IDE.
 * Provides AI-powered language features through LSP.
 */

// Language Server (runs in separate process)
export { connection, documents } from './kimiLanguageServer';

// Language Client (runs in extension host)
export { KimiLanguageClient } from './kimiLanguageClient';

// Providers (can be used standalone or through LSP)
export { KimiCompletionProvider } from './completionProvider';
export { KimiHoverProvider } from './hoverProvider';
export { KimiSignatureHelpProvider } from './signatureHelpProvider';

// Re-export types
export type {
    // Add any shared types here
} from './completionProvider';
