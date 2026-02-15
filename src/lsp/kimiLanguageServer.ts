/**
 * Kimi Language Server
 * 
 * LSP Server implementation for AI-powered features.
 * Provides completion, hover, and definition support through
 * the Language Server Protocol.
 */

import {
    createConnection,
    TextDocuments,
    Diagnostic,
    DiagnosticSeverity,
    ProposedFeatures,
    InitializeParams,
    InitializeResult,
    TextDocumentSyncKind,
    DidChangeConfigurationNotification,
    CompletionItem,
    CompletionItemKind,
    TextDocumentPositionParams,
    Hover,
    MarkupKind,
    SignatureHelp,
    SignatureInformation,
    TextDocumentChangeEvent,
    ParameterInformation,
    Definition,
    Location,
    Range,
    Position,
    InlineCompletionItem,
    InlineCompletionTriggerKind,
} from 'vscode-languageserver/node';

import { TextDocument } from 'vscode-languageserver-textdocument';
import { KimiCompletionProvider } from './completionProvider';
import { KimiHoverProvider } from './hoverProvider';
import { KimiSignatureHelpProvider } from './signatureHelpProvider';

// Create connection
const connection = createConnection(ProposedFeatures.all);

// Create document manager
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

// Configuration
interface KimiSettings {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
    model: string;
    enableInlineCompletions: boolean;
    completionDebounceMs: number;
    maxCompletions: number;
}

const defaultSettings: KimiSettings = {
    enabled: true,
    apiKey: '',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    enableInlineCompletions: true,
    completionDebounceMs: 300,
    maxCompletions: 5,
};

let globalSettings: KimiSettings = defaultSettings;
const documentSettings: Map<string, Thenable<KimiSettings>> = new Map();

// Provider instances
let completionProvider: KimiCompletionProvider;
let hoverProvider: KimiHoverProvider;
let signatureHelpProvider: KimiSignatureHelpProvider;

// Track initialization
let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
let hasInlineCompletionCapability = false;

/**
 * Initialize providers
 */
function initializeProviders(settings: KimiSettings): void {
    completionProvider = new KimiCompletionProvider(settings);
    hoverProvider = new KimiHoverProvider(settings);
    signatureHelpProvider = new KimiSignatureHelpProvider(settings);
}

/**
 * Server initialization handler
 */
connection.onInitialize((params: InitializeParams): InitializeResult => {
    const capabilities = params.capabilities;

    // Check client capabilities
    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasWorkspaceFolderCapability = !!(
        capabilities.workspace && !!capabilities.workspace.workspaceFolders
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );
    hasInlineCompletionCapability = !!(
        capabilities.textDocument &&
        (capabilities.textDocument as any).inlineCompletion
    );

    // Initialize providers with default settings
    initializeProviders(globalSettings);

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: TextDocumentSyncKind.Incremental,
            // Completion provider
            completionProvider: {
                resolveProvider: true,
                triggerCharacters: [
                    '.', '(', '[', '"', "'", '/',
                    '>', ':', '=', '!', '?', '@',
                    // AI-specific triggers
                    ' ', '\n', '\t'
                ],
            },
            // Hover provider
            hoverProvider: true,
            // Signature help provider
            signatureHelpProvider: {
                triggerCharacters: ['(', ',', '<'],
                retriggerCharacters: [','],
            },
            // Definition provider
            definitionProvider: true,
            // Inline completions (if supported)
            ...(hasInlineCompletionCapability && {
                inlineCompletionProvider: {
                    workDoneProgress: false,
                },
            } as any),
        },
        serverInfo: {
            name: 'Kimi Language Server',
            version: '0.1.0',
        },
    };

    return result;
});

/**
 * Server initialized handler
 */
connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        connection.client.register(DidChangeConfigurationNotification.type, undefined);
    }

    if (hasWorkspaceFolderCapability) {
        connection.workspace.onDidChangeWorkspaceFolders((_event) => {
            connection.console.log('Workspace folder change event received.');
        });
    }

    connection.console.log('Kimi Language Server initialized');
});

/**
 * Configuration change handler
 */
connection.onDidChangeConfiguration((change) => {
    if (hasConfigurationCapability) {
        documentSettings.clear();
    } else {
        globalSettings = <KimiSettings>(
            (change.settings.kimi || defaultSettings)
        );
        // Re-initialize providers with new settings
        initializeProviders(globalSettings);
    }
});

/**
 * Get document settings
 */
function getDocumentSettings(resource: string): Thenable<KimiSettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(globalSettings);
    }
    let result = documentSettings.get(resource);
    if (!result) {
        result = connection.workspace.getConfiguration({
            scopeUri: resource,
            section: 'kimi',
        });
        documentSettings.set(resource, result);
    }
    return result;
}

/**
 * Document close handler - clean up settings
 */
documents.onDidClose((e: TextDocumentChangeEvent<TextDocument>) => {
    documentSettings.delete(e.document.uri);
});

/**
 * Completion handler
 */
connection.onCompletion(
    async (textDocumentPosition: TextDocumentPositionParams): Promise<CompletionItem[]> => {
        const settings = await getDocumentSettings(textDocumentPosition.textDocument.uri);
        
        if (!settings.enabled) {
            return [];
        }

        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (!document) {
            return [];
        }

        return completionProvider.provideCompletions(
            document,
            textDocumentPosition.position,
            settings
        );
    }
);

/**
 * Completion resolve handler (for additional details)
 */
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    // Add additional details for AI-generated completions
    if (item.data?.aiGenerated) {
        item.detail = item.detail || '(AI Generated)';
        item.documentation = {
            kind: MarkupKind.Markdown,
            value: item.data.documentation || 'Generated by Kimi AI',
        };
    }
    return item;
});

/**
 * Hover handler
 */
connection.onHover(
    async (textDocumentPosition: TextDocumentPositionParams): Promise<Hover | null> => {
        const settings = await getDocumentSettings(textDocumentPosition.textDocument.uri);
        
        if (!settings.enabled) {
            return null;
        }

        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (!document) {
            return null;
        }

        return hoverProvider.provideHover(
            document,
            textDocumentPosition.position,
            settings
        );
    }
);

/**
 * Signature help handler
 */
connection.onSignatureHelp(
    async (textDocumentPosition: TextDocumentPositionParams): Promise<SignatureHelp | null> => {
        const settings = await getDocumentSettings(textDocumentPosition.textDocument.uri);
        
        if (!settings.enabled) {
            return null;
        }

        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (!document) {
            return null;
        }

        return signatureHelpProvider.provideSignatureHelp(
            document,
            textDocumentPosition.position,
            settings
        );
    }
);

/**
 * Definition handler
 */
connection.onDefinition(
    async (textDocumentPosition: TextDocumentPositionParams): Promise<Definition | null> => {
        const settings = await getDocumentSettings(textDocumentPosition.textDocument.uri);
        
        if (!settings.enabled) {
            return null;
        }

        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (!document) {
            return null;
        }

        // Get the word at position
        const position = textDocumentPosition.position;
        const lineText = document.getText({
            start: { line: position.line, character: 0 },
            end: { line: position.line, character: Number.MAX_VALUE },
        });

        // Simple word extraction
        const wordRegex = /[\w$]+/g;
        let match;
        while ((match = wordRegex.exec(lineText)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (start <= position.character && position.character <= end) {
                const word = match[0];
                
                // Search for definition in the document
                const text = document.getText();
                const definitionRegex = new RegExp(
                    `(?:function|class|interface|const|let|var|def|class)\\s+${word}\\b`,
                    'g'
                );
                
                let defMatch;
                while ((defMatch = definitionRegex.exec(text)) !== null) {
                    const defPosition = document.positionAt(defMatch.index);
                    return {
                        uri: textDocumentPosition.textDocument.uri,
                        range: {
                            start: defPosition,
                            end: {
                                line: defPosition.line,
                                character: defPosition.character + defMatch[0].length,
                            },
                        },
                    };
                }
            }
        }

        return null;
    }
);

/**
 * Inline completion handler (if supported by client)
 */
connection.onRequest(
    'textDocument/inlineCompletion',
    async (params: {
        textDocument: { uri: string };
        position: Position;
        context?: {
            triggerKind: InlineCompletionTriggerKind;
            selectedCompletionInfo?: {
                range: Range;
                text: string;
            };
        };
    }): Promise<{ items: InlineCompletionItem[] } | null> => {
        const settings = await getDocumentSettings(params.textDocument.uri);
        
        if (!settings.enabled || !settings.enableInlineCompletions) {
            return null;
        }

        const document = documents.get(params.textDocument.uri);
        if (!document) {
            return null;
        }

        const items = await completionProvider.provideInlineCompletions(
            document,
            params.position,
            params.context?.triggerKind || InlineCompletionTriggerKind.Invoked,
            settings
        );

        return { items };
    }
);

/**
 * Validate document and send diagnostics
 */
async function validateTextDocument(textDocument: TextDocument): Promise<void> {
    const settings = await getDocumentSettings(textDocument.uri);
    
    if (!settings.enabled) {
        return;
    }

    // Basic diagnostics - can be extended with AI-powered linting
    const text = textDocument.getText();
    const diagnostics: Diagnostic[] = [];

    // Check for common issues (example patterns)
    const patterns = [
        { regex: /TODO|FIXME|XXX/g, message: 'Pending task found', severity: DiagnosticSeverity.Information },
        { regex: /console\.log\(/g, message: 'Debug statement found', severity: DiagnosticSeverity.Warning },
        { regex: /debugger;/g, message: 'Debugger statement found', severity: DiagnosticSeverity.Warning },
    ];

    for (const { regex, message, severity } of patterns) {
        let match;
        while ((match = regex.exec(text)) !== null) {
            const start = textDocument.positionAt(match.index);
            const end = textDocument.positionAt(match.index + match[0].length);
            
            const diagnostic: Diagnostic = {
                severity,
                range: { start, end },
                message: `${message}: ${match[0]}`,
                source: 'kimi',
            };

            if (hasDiagnosticRelatedInformationCapability) {
                diagnostic.relatedInformation = [
                    {
                        location: {
                            uri: textDocument.uri,
                            range: { start, end },
                        },
                        message: 'AI suggestion: Review this code',
                    },
                ];
            }

            diagnostics.push(diagnostic);
        }
    }

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

/**
 * Document content change handler
 */
documents.onDidChangeContent((change) => {
    validateTextDocument(change.document);
});

// Listen for document changes
documents.listen(connection);

// Start listening for connections
connection.listen();

export { connection, documents };
