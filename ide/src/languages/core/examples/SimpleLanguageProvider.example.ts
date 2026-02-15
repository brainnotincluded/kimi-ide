/**
 * Example: Simple Language Provider Implementation
 * 
 * This file demonstrates how to create a custom language provider
 * by extending BaseLanguageProvider.
 */

import {
    BaseLanguageProvider,
    LanguageProviderState,
    Position,
    Range,
    Diagnostic,
    DiagnosticSeverity,
    CompletionItem,
    CompletionItemKind,
    CompletionContext,
    CompletionTriggerKind,
    Hover,
    MarkupKind,
    Location,
    DocumentFormattingOptions,
    LanguageRegistry,
    LanguageClient,
    createClientCapabilities,
    DiagnosticsManager,
    LanguageConfigurationManager
} from '../index';

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// Example: TypeScript Language Provider
// ============================================================================

class TypeScriptProvider extends BaseLanguageProvider {
    id = 'typescript';
    name = 'TypeScript';
    extensions = ['.ts', '.tsx', '.mts', '.cts'];
    
    private client: LanguageClient | null = null;

    async detect(projectPath: string): Promise<boolean> {
        try {
            const files = await fs.promises.readdir(projectPath);
            
            // Check for tsconfig.json
            const hasConfig = files.includes('tsconfig.json');
            
            // Check for TypeScript files
            const hasFiles = files.some(f => 
                f.endsWith('.ts') || f.endsWith('.tsx')
            );
            
            return hasConfig || hasFiles;
        } catch {
            return false;
        }
    }

    async activate(projectPath: string): Promise<void> {
        this.projectPath = projectPath;
        this.setState(LanguageProviderState.Activating);

        // Initialize LSP client
        this.client = new LanguageClient({
            command: 'typescript-language-server',
            args: ['--stdio'],
            cwd: projectPath
        });

        // Connect to server
        await this.client.connect(
            `file://${projectPath}`,
            createClientCapabilities()
        );

        this.setState(LanguageProviderState.Active);
    }

    async deactivate(): Promise<void> {
        this.setState(LanguageProviderState.Deactivating);
        
        if (this.client) {
            await this.client.disconnect();
            this.client = null;
        }
        
        this.setState(LanguageProviderState.Inactive);
    }

    async getDiagnostics(filePath: string): Promise<Diagnostic[]> {
        if (!this.client?.connected) {
            return [];
        }
        // Get diagnostics from LSP server
        return [];
    }

    async formatDocument(
        filePath: string,
        content: string,
        options: DocumentFormattingOptions
    ): Promise<string | null> {
        if (!this.client?.connected) {
            return null;
        }
        // Format using LSP
        return content;
    }

    async provideCompletions(
        filePath: string,
        content: string,
        position: Position,
        context: CompletionContext
    ): Promise<CompletionItem[] | null> {
        if (!this.client?.connected) {
            return null;
        }
        // Get completions from LSP
        return [];
    }
}

// ============================================================================
// Example: Usage
// ============================================================================

async function example() {
    const registry = new LanguageRegistry();
    const config = new LanguageConfigurationManager();
    const diagnostics = new DiagnosticsManager();

    // Register provider
    registry.register(new TypeScriptProvider());

    // Detect and activate
    const detected = await registry.detectLanguages('/path/to/project');
    console.log('Detected:', detected);
    
    await registry.autoActivate('/path/to/project');

    // Cleanup
    registry.dispose();
    diagnostics.dispose();
}

export { TypeScriptProvider, example };
