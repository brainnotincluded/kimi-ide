/**
 * Kimi IDE Extension - Final Integrated Version
 * Complete Multi-Agent System integration with Codebuff-inspired improvements
 * 
 * @version 2.0.0
 * @author Kimi IDE Team
 * 
 * Features:
 * - Multi-Agent System (Orchestrator, FileDiscovery, Planner, Editor, Reviewer, Testing)
 * - Tree-based File Discovery with AST analysis
 * - Parallel Multi-Strategy Editing
 * - Automatic Code Review
 * - Smart Context Management
 * - Full VS Code integration
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { EventEmitter } from 'events';

// =============================================================================
// Core API
// =============================================================================
import { KimiApi } from './kimi/apiAdapter';
import { KimiClient } from './kimi/kimiClient';

// =============================================================================
// Multi-Agent System
// =============================================================================
import {
    MultiAgentSystem,
    createMultiAgentSystem,
    OrchestratorAgent,
    FileDiscoveryAgent,
    PlannerAgent,
    EditorAgent,
    ReviewerAgent,
    TestingAgent,
} from './agents';

// =============================================================================
// Tree-based Discovery System
// =============================================================================
import {
    DiscoveryService,
    createDiscoveryService,
    FilePick,
} from './discovery';

// =============================================================================
// Parallel Editing System
// =============================================================================
import {
    ParallelEditor,
    createParallelEditor,
    LLMClient,
    VSCodeIntegration,
    EditingContext,
} from './editing';

// =============================================================================
// Context Management
// =============================================================================
import { CodebaseIndexer } from './context/codebaseIndexer';
import { ContextResolver } from './context/contextResolver';
import { PromptBuilder } from './context/promptBuilder';
import { SymbolProvider } from './context/symbolProvider';
import { ContextManager } from './context/contextManager';

// =============================================================================
// UI Components
// =============================================================================
import { ChatPanel, ChatMessage } from './panels/chatPanel';
import { ComposerPanel } from './panels/ComposerPanel';
import { KimiStatusBar } from './statusBar';

// =============================================================================
// Providers
// =============================================================================
import { InlineEditProvider } from './providers/InlineEditProvider';
import { DiffProvider } from './providers/DiffProvider';
import { KimiCodeActionProvider, KimiInlineCompletionProvider } from './providers/CodeActionProvider';
import { EnhancedInlineCompletionProvider } from './providers/EnhancedInlineCompletionProvider';
import { MentionProvider } from './providers/MentionProvider';

// =============================================================================
// Terminal Integration
// =============================================================================
import { TerminalManager } from './terminal/terminalManager';

// =============================================================================
// LSP
// =============================================================================
import { KimiLanguageClient } from './lsp/kimiLanguageClient';

// =============================================================================
// Commands & Config
// =============================================================================
import { registerCommands, disposeCommands } from './commands';
import { getFullConfig, isApiKeyConfigured, log, logError, showInfo, showError } from './config';

// =============================================================================
// Constants
// =============================================================================
import { Commands, ContextKeys } from './utils/constants';

// =============================================================================
// Type Definitions
// =============================================================================

interface ExtensionState {
    isActive: boolean;
    isIndexing: boolean;
    currentWorkflow: string | null;
}

interface KimiExtensionApi {
    version: string;
    sendMessage: (message: string, options?: any) => Promise<string>;
    onDidReceiveMessage: vscode.Event<{ role: string; content: string }>;
    getContext: () => any;
    setContext: (context: any) => void;
    isReady: () => boolean;
    getMultiAgentSystem: () => MultiAgentSystem | undefined;
    getDiscoveryService: () => DiscoveryService | undefined;
    executeWorkflow: (request: string) => Promise<any>;
}

// =============================================================================
// Global State
// =============================================================================

let kimiClient: KimiClient | undefined;
let kimiApi: KimiApi | undefined;
let chatPanel: ChatPanel | undefined;
let statusBar: KimiStatusBar | undefined;
let inlineEditProvider: InlineEditProvider | undefined;
let diffProvider: DiffProvider | undefined;
let codeActionProvider: KimiCodeActionProvider | undefined;
let terminalManager: TerminalManager | undefined;
let codebaseIndexer: CodebaseIndexer | undefined;
let contextResolver: ContextResolver | undefined;
let promptBuilder: PromptBuilder | undefined;
let languageClient: KimiLanguageClient | undefined;
let inlineCompletionProvider: vscode.Disposable | undefined;
let symbolProvider: SymbolProvider | undefined;
let smartContextManager: ContextManager | undefined;
let mentionProvider: MentionProvider | undefined;
let composerPanel: ComposerPanel | undefined;

// Multi-Agent System
let multiAgentSystem: MultiAgentSystem | undefined;
let orchestrator: OrchestratorAgent | undefined;

// Discovery Service
let discoveryService: DiscoveryService | undefined;

// Parallel Editor
let parallelEditor: ParallelEditor | undefined;

const disposables: vscode.Disposable[] = [];
const state: ExtensionState = {
    isActive: false,
    isIndexing: false,
    currentWorkflow: null,
};

const messageEmitter = new vscode.EventEmitter<{ role: string; content: string }>();

// =============================================================================
// Activation
// =============================================================================

export async function activate(context: vscode.ExtensionContext): Promise<KimiExtensionApi> {
    const startTime = Date.now();
    log('🚀 Kimi IDE extension activating (Final Integrated Version)...');

    try {
        // Phase 1: Initialize core infrastructure
        await initializeCoreComponents(context);
        
        // Phase 2: Initialize Multi-Agent System
        await initializeMultiAgentSystem();
        
        // Phase 3: Initialize Discovery Service (Tree-based)
        await initializeDiscoveryService();
        
        // Phase 4: Initialize Parallel Editing
        await initializeParallelEditor();
        
        // Phase 5: Initialize Smart Context Management
        await initializeSmartContext(context);
        
        // Phase 6: Register all providers
        registerAllProviders(context);
        
        // Phase 7: Register all commands
        registerAllCommands(context);
        
        // Phase 8: Setup event listeners
        setupEventListeners(context);
        
        // Phase 9: Initialize LSP client (optional)
        await initializeLSP(context);
        
        // Phase 10: Start background services
        await startBackgroundServices();
        
        // Phase 11: Update context keys and show welcome
        updateContextKeys();
        await showWelcomeMessage();
        
        state.isActive = true;
        
        const activationTime = Date.now() - startTime;
        log(`✅ Kimi IDE extension activated in ${activationTime}ms`);
        showInfo(`Kimi IDE activated (${activationTime}ms) - Multi-Agent System ready`);
        
        return createExtensionApi();
        
    } catch (error) {
        logError('❌ Failed to activate Kimi IDE extension', error);
        showError('Extension activation failed', error);
        throw error;
    }
}

// =============================================================================
// Phase 1: Core Components Initialization
// =============================================================================

async function initializeCoreComponents(context: vscode.ExtensionContext): Promise<void> {
    log('[Phase 1] Initializing core components...');
    
    const config = getFullConfig();
    
    // Initialize KimiClient (Wire Protocol) - optional
    try {
        const cliPath = await findKimiCliPath();
        if (cliPath) {
            kimiClient = new KimiClient(context, {
                cliPath,
                cwd: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
                debug: config.debug,
            });
            
            await kimiClient.start().catch(err => {
                log('Wire protocol client failed to start (this is optional):', err.message);
                kimiClient = undefined;
            });
        }
    } catch {
        log('Wire protocol not available, using HTTP API only');
    }
    
    // Initialize API adapter
    kimiApi = new KimiApi(kimiClient);
    
    // Initialize UI components
    statusBar = new KimiStatusBar();
    disposables.push(statusBar);
    
    // Initialize providers
    diffProvider = new DiffProvider();
    inlineEditProvider = new InlineEditProvider(kimiApi, diffProvider);
    codeActionProvider = new KimiCodeActionProvider(kimiApi);
    
    // Initialize terminal manager
    terminalManager = TerminalManager.getInstance(context);
    
    // Initialize context components
    codebaseIndexer = new CodebaseIndexer(context);
    contextResolver = new ContextResolver(codebaseIndexer);
    symbolProvider = new SymbolProvider(context);
    promptBuilder = new PromptBuilder(symbolProvider);
    
    await codebaseIndexer.initialize();
    
    log('[Phase 1] ✓ Core components initialized');
}

// =============================================================================
// Phase 2: Multi-Agent System Initialization
// =============================================================================

async function initializeMultiAgentSystem(): Promise<void> {
    log('[Phase 2] Initializing Multi-Agent System...');
    
    // Create Multi-Agent System with VS Code integration
    multiAgentSystem = createMultiAgentSystem({
        workspace: vscode.workspace,
        window: vscode.window,
        commands: vscode.commands,
        languages: vscode.languages,
    });
    
    await multiAgentSystem.initialize();
    
    // Get orchestrator reference
    orchestrator = multiAgentSystem.getOrchestrator();
    
    // Create specialized agents
    const fileDiscoveryAgent = multiAgentSystem.createFileDiscoveryAgent();
    const plannerAgent = multiAgentSystem.createPlannerAgent();
    const editorAgent = multiAgentSystem.createEditorAgent();
    const reviewerAgent = multiAgentSystem.createReviewerAgent();
    const testingAgent = multiAgentSystem.createTestingAgent();
    
    // Listen for workflow events (via status:change event)
    orchestrator!.on('status:change', (data: { status: string; previous: string }) => {
        if (data.status === 'running') {
            state.currentWorkflow = orchestrator!.id;
            statusBar?.showProgress(`Workflow: ${orchestrator!.id}`);
        } else if (data.status === 'completed') {
            state.currentWorkflow = null;
            statusBar?.showReady('Workflow completed');
        } else if (data.status === 'error') {
            state.currentWorkflow = null;
            statusBar?.showError('Workflow failed');
        }
    });
    
    log('[Phase 2] ✓ Multi-Agent System initialized');
    log(`  - Orchestrator: ${orchestrator!.id}`);
    log(`  - FileDiscovery: ${fileDiscoveryAgent.id}`);
    log(`  - Planner: ${plannerAgent.id}`);
    log(`  - Editor: ${editorAgent.id}`);
    log(`  - Reviewer: ${reviewerAgent.id}`);
    log(`  - Testing: ${testingAgent.id}`);
}

// =============================================================================
// Phase 3: Tree-based Discovery Service
// =============================================================================

async function initializeDiscoveryService(): Promise<void> {
    log('[Phase 3] Initializing Tree-based Discovery Service...');
    
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        log('[Phase 3] ⚠ No workspace folder, skipping discovery service');
        return;
    }
    
    // Create discovery service with AI model client
    discoveryService = new DiscoveryService({
        treeBuilder: {
            cacheDir: '.kimi/cache',
            includePatterns: ['**/*.{ts,tsx,js,jsx,py,rs,go,java}'],
            excludePatterns: [
                '**/node_modules/**',
                '**/dist/**',
                '**/build/**',
                '**/.git/**',
                '**/coverage/**',
            ],
            maxFileSize: 1024 * 1024,
            enableJsDoc: true,
        },
        summarizer: {
            cacheDir: '.kimi/cache/summaries',
            maxSummaryLength: 500,
            generateOnInit: false,
            useAI: true,
            modelClient: createModelClient(),
            batchSize: 10,
            maxConcurrent: 3,
        },
        enableCache: true,
        cacheDir: '.kimi/discovery',
    });
    
    // Listen for discovery events
    discoveryService.on('ready' as string, ((status: { fileCount: number; symbolCount: number }) => {
        log(`[Discovery] Ready: ${status.fileCount} files, ${status.symbolCount} symbols`);
        statusBar?.showReady(`Indexed ${status.fileCount} files`);
    }) as any);
    
    discoveryService.on('error' as string, ((error: Error) => {
        logError('[Discovery] Error', error);
    }) as any);
    
    // Initialize (async, non-blocking)
    discoveryService.initialize().catch(err => {
        logError('[Discovery] Failed to initialize', err);
    });
    
    log('[Phase 3] ✓ Discovery Service initialized');
}

// =============================================================================
// Phase 4: Parallel Editor Initialization
// =============================================================================

async function initializeParallelEditor(): Promise<void> {
    log('[Phase 4] Initializing Parallel Editing System...');
    
    const llmClient: LLMClient = {
        generate: async (params) => {
            const response = await kimiApi!.generateResponse(params.userPrompt, {
                temperature: params.temperature,
                maxTokens: params.maxTokens,
            });
            
            return {
                content: response.content,
                usage: {
                    promptTokens: response.usage?.promptTokens || 0,
                    completionTokens: response.usage?.completionTokens || 0,
                },
            };
        },
    };
    
    const vscodeIntegration: VSCodeIntegration = {
        showDiffViewer: async (options) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;
            const fullRange = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(editor.document.getText().length)
            );
            await diffProvider!.showDiff(
                editor.document,
                fullRange,
                options.original,
                options.modified,
                options.title
            );
        },
        
        showMultiDiffViewer: async (options) => {
            // Show quick pick for selection
            const items = options.variants.map((v, i) => ({
                label: v.label,
                description: v.description,
                detail: v.content.substring(0, 100) + '...',
                index: i,
            }));
            
            const selection = await vscode.window.showQuickPick([...items, { label: '$(merge) Merge All', index: 'merge' as const }], {
                placeHolder: 'Select the best edit or merge all',
            });
            
            if (!selection) return 'cancel';
            if (selection.index === 'merge') return 'merge';
            return selection.index;
        },
        
        applyEdit: async (content) => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return false;
            
            const fullRange = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(editor.document.getText().length)
            );
            
            await editor.edit(editBuilder => {
                editBuilder.replace(fullRange, content);
            });
            
            return true;
        },
        
        showProgress: async <T>(task: string, operation: () => Promise<T>) => {
            return vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: task,
                cancellable: true,
            }, async () => {
                return operation();
            });
        },
    };
    
    parallelEditor = createParallelEditor(llmClient, vscodeIntegration, {
        defaultTimeout: 30000,
        maxConcurrentStrategies: 5,
        enableMetrics: true,
        defaultOptions: {
            strategies: ['conservative', 'balanced', 'aggressive'],
            timeout: 30000,
            enableMerging: true,
            enableUserSelection: true,
            autoApplyThreshold: 0.85,
            preserveCache: true,
        },
    });
    
    log('[Phase 4] ✓ Parallel Editor initialized');
}

// =============================================================================
// Phase 5: Smart Context Management
// =============================================================================

async function initializeSmartContext(context: vscode.ExtensionContext): Promise<void> {
    log('[Phase 5] Initializing Smart Context Management...');
    
    smartContextManager = new ContextManager(context, {
        enablePersistence: true,
        enableAutoCompaction: true,
        showUsageIndicator: true,
        uiUpdateInterval: 2000,
        maxSessionAge: 7 * 24 * 60 * 60 * 1000,
        enableRelevanceTracking: true,
        enableLazyLoading: true,
    });
    
    // Listen for context changes
    smartContextManager.on('statsUpdated' as string, ((data: { totalTokens: number; fileCount: number }) => {
        log(`[Context] Updated: ${data.totalTokens} tokens, ${data.fileCount} files`);
    }) as any);
    
    log('[Phase 5] ✓ Smart Context Manager initialized');
}

// =============================================================================
// Provider Registration
// =============================================================================

function registerAllProviders(context: vscode.ExtensionContext): void {
    log('Registering providers...');
    
    // Register code action provider
    const codeActionDisposable = vscode.languages.registerCodeActionsProvider(
        { pattern: '**/*' },
        codeActionProvider!,
        {
            providedCodeActionKinds: KimiCodeActionProvider.providedCodeActionKinds,
        }
    );
    disposables.push(codeActionDisposable);
    context.subscriptions.push(codeActionDisposable);
    
    // Register enhanced inline completion provider (Cursor-style)
    const enhancedCompletionProvider = new EnhancedInlineCompletionProvider(kimiApi!);
    inlineCompletionProvider = vscode.languages.registerInlineCompletionItemProvider(
        { pattern: '**/*' },
        enhancedCompletionProvider
    );
    disposables.push(inlineCompletionProvider);
    context.subscriptions.push(inlineCompletionProvider);
    
    // Register mention provider for @ symbols
    mentionProvider = new MentionProvider();
    disposables.push(mentionProvider);
    context.subscriptions.push({ dispose: () => mentionProvider?.dispose() } as vscode.Disposable);
    
    // Register document link provider for terminal links
    // This is handled by TerminalManager
    
    log('✓ Providers registered');
}

// =============================================================================
// Command Registration
// =============================================================================

function registerAllCommands(context: vscode.ExtensionContext): void {
    log('Registering commands...');
    
    // Register commands from commands/index.ts
    registerCommands(context, statusBar!);
    
    // Register additional integrated commands
    const additionalCommands: { [key: string]: (...args: any[]) => any } = {
        // Chat commands
        [Commands.OPEN_CHAT]: () => openChatPanel(),
        [Commands.NEW_CHAT]: () => createNewChat(),
        [Commands.CLEAR_CHAT]: () => clearChat(),
        [Commands.STOP_GENERATION]: () => stopGeneration(),
        
        // Configuration commands
        [Commands.SET_API_KEY]: () => configureApiKey(),
        [Commands.SELECT_MODEL]: () => selectModel(),
        [Commands.OPEN_SETTINGS]: () => openSettings(),
        
        // Context commands
        [Commands.ADD_FILE_TO_CONTEXT]: (uri: vscode.Uri) => addFileToContext(uri),
        [Commands.ADD_SELECTION_TO_CONTEXT]: () => addSelectionToContext(),
        [Commands.CLEAR_CONTEXT]: () => clearContext(),
        
        // Terminal commands
        [Commands.EXPLAIN_TERMINAL]: () => explainTerminalOutput(),
        [Commands.FIX_TERMINAL_ERROR]: () => fixTerminalError(),
        
        // Multi-Agent commands
        'kimi.agent.executeWorkflow': (request: string) => executeAgentWorkflow(request),
        'kimi.agent.discoverFiles': (query: string) => discoverFilesWithAgent(query),
        'kimi.agent.planChanges': (description: string) => planChangesWithAgent(description),
        'kimi.agent.reviewCode': () => reviewCurrentFile(),
        
        // Parallel Editing commands
        'kimi.edit.parallel': (request: string) => parallelEdit(request),
        'kimi.edit.smart': (request: string) => smartEdit(request),
        
        // Composer commands
        'kimi.composer.open': () => openComposer(),
        'kimi.composer.openWithSelection': () => openComposerWithSelection(),
        'kimi.composer.addFiles': (uris: vscode.Uri[]) => addFilesToComposer(uris),
        
        // Discovery commands
        'kimi.discovery.search': (query: string) => searchCodebase(query),
        'kimi.discovery.findUsages': (symbol: string) => findSymbolUsages(symbol),
        'kimi.discovery.showTree': () => showCodebaseTree(),
        
        // Utility commands
        [Commands.SHOW_OUTPUT]: () => showOutputChannel(),
        'kimi.showStatus': () => showExtensionStatus(),
    };
    
    for (const [commandId, handler] of Object.entries(additionalCommands)) {
        const disposable = vscode.commands.registerCommand(commandId, handler);
        disposables.push(disposable);
        context.subscriptions.push(disposable);
    }
    
    log('✓ Commands registered');
}

// =============================================================================
// Event Listeners
// =============================================================================

function setupEventListeners(context: vscode.ExtensionContext): void {
    // Track selection changes for context key
    const selectionDisposable = vscode.window.onDidChangeTextEditorSelection((e) => {
        const hasSelection = !e.selections[0].isEmpty;
        vscode.commands.executeCommand('setContext', ContextKeys.HAS_SELECTION, hasSelection);
    });
    disposables.push(selectionDisposable);
    context.subscriptions.push(selectionDisposable);
    
    // Track active editor changes
    const editorDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
        updateContextKeys();
    });
    disposables.push(editorDisposable);
    context.subscriptions.push(editorDisposable);
    
    // Track configuration changes
    const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('kimi')) {
            handleConfigChange();
        }
    });
    disposables.push(configDisposable);
    context.subscriptions.push(configDisposable);
    
    // Track file changes for indexer
    const fileWatcher = vscode.workspace.createFileSystemWatcher('**/*');
    
    fileWatcher.onDidCreate((uri) => {
        codebaseIndexer?.updateFile(uri).catch(() => {});
        discoveryService?.getTree(); // Trigger incremental update
    });
    
    fileWatcher.onDidChange((uri) => {
        codebaseIndexer?.updateFile(uri).catch(() => {});
    });
    
    fileWatcher.onDidDelete((uri) => {
        codebaseIndexer?.removeFile(uri).catch(() => {});
    });
    
    disposables.push(fileWatcher);
    context.subscriptions.push(fileWatcher);
    
    // Track terminal events
    terminalManager?.on('terminalData' as string, ((data: { data: string }) => {
        // Process terminal data for error detection
        if (data.data.includes('error') || data.data.includes('Error')) {
            // Could trigger automatic error explanation
        }
    }) as any);
}

// =============================================================================
// LSP Initialization
// =============================================================================

async function initializeLSP(context: vscode.ExtensionContext): Promise<void> {
    const config = vscode.workspace.getConfiguration('kimi');
    const enableLSP = config.get<boolean>('enableLSP', true);
    
    if (!enableLSP) {
        log('LSP client disabled in settings');
        return;
    }
    
    try {
        languageClient = new KimiLanguageClient(context);
        await languageClient.start();
        log('✓ LSP client started');
    } catch (error) {
        log('LSP client failed to start (optional feature):', error);
        languageClient = undefined;
    }
}

// =============================================================================
// Background Services
// =============================================================================

async function startBackgroundServices(): Promise<void> {
    // Start codebase indexing
    if (codebaseIndexer) {
        try {
            const stats = codebaseIndexer.getStats();
            if (stats.totalFiles === 0) {
                log('Starting initial codebase indexing...');
                state.isIndexing = true;
                statusBar?.showProgress('Indexing codebase...');
                
                await codebaseIndexer.indexWorkspace((current, total) => {
                    if (current % 50 === 0 || current === total) {
                        log(`Indexing: ${current}/${total}`);
                        statusBar?.showProgress(`Indexing: ${current}/${total}`);
                    }
                });
                
                state.isIndexing = false;
                log('✓ Codebase indexing completed');
                statusBar?.showReady(`Indexed ${stats.totalFiles} files`);
            }
        } catch (error) {
            logError('Codebase indexing failed', error);
            state.isIndexing = false;
        }
    }
}

// =============================================================================
// Command Handlers - Chat
// =============================================================================

async function openChatPanel(): Promise<void> {
    if (!kimiApi) {
        showError('Extension not fully initialized');
        return;
    }
    
    const extensionUri = vscode.Uri.file(path.join(__dirname, '..'));
    
    chatPanel = ChatPanel.createOrShow(
        extensionUri,
        (message) => handleChatMessage(message),
        (toolCallId, action) => handleToolAction(toolCallId, action)
    );
    
    vscode.commands.executeCommand('setContext', ContextKeys.CHAT_VISIBLE, true);
}

async function handleChatMessage(message: string): Promise<void> {
    if (!kimiApi || !chatPanel) return;
    
    const userMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content: message,
        timestamp: Date.now(),
        status: 'complete'
    };
    
    chatPanel.addMessage(userMessage);
    chatPanel.setStatus('thinking');
    
    try {
        // Build enhanced context
        const chatContext = await buildEnhancedChatContext();
        const prompt = await (promptBuilder?.buildChatPrompt(message, chatContext) || Promise.resolve(message));
        
        // Use Multi-Agent System for complex queries
        if (shouldUseMultiAgent(message)) {
            const result = await orchestrator!.processRequest({
                id: `req-${Date.now()}`,
                description: message,
                context: chatContext,
            });
            
            const assistantMessage: ChatMessage = {
                id: `msg-${Date.now() + 1}`,
                role: 'assistant',
                content: formatWorkflowResult(result),
                timestamp: Date.now(),
                status: 'complete'
            };
            
            chatPanel.addMessage(assistantMessage);
        } else {
            // Simple query - direct API call
            const response = await kimiApi.generateResponse(prompt);
            
            if (response.error) {
                throw new Error(response.error);
            }
            
            const assistantMessage: ChatMessage = {
                id: `msg-${Date.now() + 1}`,
                role: 'assistant',
                content: response.content,
                timestamp: Date.now(),
                status: 'complete'
            };
            
            chatPanel.addMessage(assistantMessage);
        }
        
        statusBar?.showReady('Response ready');
        
    } catch (error) {
        logError('Chat message handling failed', error);
        
        const errorMessage: ChatMessage = {
            id: `msg-${Date.now() + 1}`,
            role: 'assistant',
            content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            timestamp: Date.now(),
            status: 'error'
        };
        
        chatPanel.addMessage(errorMessage);
    } finally {
        chatPanel.setStatus('idle');
    }
}

function shouldUseMultiAgent(message: string): boolean {
    const multiAgentKeywords = [
        'find', 'search', 'implement', 'refactor', 'organize',
        'plan', 'structure', 'review', 'test', 'optimize'
    ];
    const lowerMessage = message.toLowerCase();
    return multiAgentKeywords.some(k => lowerMessage.includes(k));
}

function formatWorkflowResult(result: any): string {
    const lines: string[] = [];
    lines.push('## Workflow Result');
    lines.push('');
    lines.push(`**Status:** ${result.success ? '✅ Success' : '❌ Failed'}`);
    lines.push(`**Duration:** ${result.executionTimeMs}ms`);
    lines.push('');
    lines.push('### Stages');
    for (const stage of result.stages) {
        const icon = stage.status === 'success' ? '✅' : stage.status === 'failure' ? '❌' : '⏭️';
        lines.push(`${icon} **${stage.agentType}**: ${stage.status} (${stage.executionTimeMs}ms)`);
    }
    return lines.join('\n');
}

// =============================================================================
// Command Handlers - Multi-Agent System
// =============================================================================

async function executeAgentWorkflow(request: string): Promise<void> {
    if (!orchestrator) {
        showError('Multi-Agent System not initialized');
        return;
    }
    
    try {
        const result = await orchestrator!.processRequest({
            id: `req-${Date.now()}`,
            description: request,
            context: await buildEnhancedChatContext(),
        });
        
        // Show results in output channel
        const outputChannel = vscode.window.createOutputChannel('Kimi Workflow');
        outputChannel.appendLine(formatWorkflowResult(result));
        outputChannel.show();
        
    } catch (error) {
        showError('Workflow execution failed', error);
    }
}

async function discoverFilesWithAgent(query: string): Promise<FilePick[]> {
    if (!discoveryService) {
        showError('Discovery service not initialized');
        return [];
    }
    
    try {
        const files = await discoveryService.pickFiles({
            query,
            maxFiles: 10,
            useAI: true,
        });
        
        showInfo(`Found ${files.length} relevant files`);
        return files;
    } catch (error) {
        showError('File discovery failed', error);
        return [];
    }
}

async function planChangesWithAgent(description: string): Promise<void> {
    if (!multiAgentSystem) {
        showError('Multi-Agent System not initialized');
        return;
    }
    
    const planner = multiAgentSystem.createPlannerAgent();
    
    try {
        const plan = await planner.createPlan({
            description,
            files: [],
            context: {
                currentFile: vscode.window.activeTextEditor?.document.uri.fsPath,
            },
        });
        
        // Show plan in webview
        const panel = vscode.window.createWebviewPanel(
            'kimiPlan',
            'Kimi Change Plan',
            vscode.ViewColumn.Two,
            {}
        );
        
        panel.webview.html = renderPlanHtml(plan);
        
    } catch (error) {
        showError('Planning failed', error);
    }
}

async function reviewCurrentFile(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        showInfo('Please open a file to review');
        return;
    }
    
    if (!multiAgentSystem) {
        showError('Multi-Agent System not initialized');
        return;
    }
    
    const reviewer = multiAgentSystem.createReviewerAgent();
    
    try {
        const content = editor.document.getText();
        const language = editor.document.languageId;
        
        const reviewResult = await reviewer.review({
            filePath: editor.document.uri.fsPath,
            diff: {} as any,
            originalContent: content,
            modifiedContent: content,
        });
        
        // Show review results
        const diagnostics: vscode.Diagnostic[] = reviewResult.issues.map((issue: { line?: number; message: string; severity: string }) => {
            const range = issue.line !== undefined
                ? new vscode.Range(issue.line, 0, issue.line, 100)
                : new vscode.Range(0, 0, 0, 100);
            
            const severity = issue.severity === 'error'
                ? vscode.DiagnosticSeverity.Error
                : issue.severity === 'warning'
                ? vscode.DiagnosticSeverity.Warning
                : vscode.DiagnosticSeverity.Information;
            
            return new vscode.Diagnostic(range, issue.message, severity);
        });
        
        const diagnosticCollection = vscode.languages.createDiagnosticCollection('kimi-review');
        diagnosticCollection.set(editor.document.uri, diagnostics);
        
        showInfo(`Review complete: ${reviewResult.issues.length} issues found`);
        
    } catch (error) {
        showError('Review failed', error);
    }
}

// =============================================================================
// Command Handlers - Parallel Editing
// =============================================================================

async function parallelEdit(request: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        showInfo('Please open a file to edit');
        return;
    }
    
    if (!parallelEditor) {
        showError('Parallel Editor not initialized');
        return;
    }
    
    const context: EditingContext = {
        filePath: editor.document.uri.fsPath,
        language: editor.document.languageId,
        originalContent: editor.document.getText(),
        selection: editor.selection.isEmpty ? undefined : {
            start: { line: editor.selection.start.line, character: editor.selection.start.character },
            end: { line: editor.selection.end.line, character: editor.selection.end.character },
        },
        cursorPosition: {
            line: editor.selection.active.line,
            character: editor.selection.active.character,
        },
    };
    
    try {
        const result = await parallelEditor.execute(context, request, {
            strategies: ['conservative', 'balanced', 'aggressive'],
            enableMerging: true,
            enableUserSelection: true,
        });
        
        // Apply the best result
        await editor.edit(editBuilder => {
            const fullRange = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(editor.document.getText().length)
            );
            editBuilder.replace(fullRange, result.bestResult.content);
        });
        
        showInfo(`Edit applied using "${result.bestResult.strategy}" strategy`);
        
    } catch (error) {
        showError('Parallel edit failed', error);
    }
}

async function smartEdit(request: string): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        showInfo('Please open a file to edit');
        return;
    }
    
    if (!parallelEditor) {
        showError('Parallel Editor not initialized');
        return;
    }
    
    const context: EditingContext = {
        filePath: editor.document.uri.fsPath,
        language: editor.document.languageId,
        originalContent: editor.document.getText(),
    };
    
    try {
        const result = await parallelEditor.smartEdit(context, request);
        
        await editor.edit(editBuilder => {
            const fullRange = new vscode.Range(
                editor.document.positionAt(0),
                editor.document.positionAt(editor.document.getText().length)
            );
            editBuilder.replace(fullRange, result.bestResult.content);
        });
        
        showInfo(`Smart edit completed in ${result.duration}ms`);
        
    } catch (error) {
        showError('Smart edit failed', error);
    }
}

// =============================================================================
// Command Handlers - Discovery
// =============================================================================

async function searchCodebase(query: string): Promise<void> {
    if (!discoveryService) {
        showError('Discovery service not initialized');
        return;
    }
    
    try {
        const symbols = discoveryService.search(query);
        const files = discoveryService.quickPick(query);
        
        // Show results in quick pick
        const items: vscode.QuickPickItem[] = [
            ...symbols.map((s: { symbol: { kind: string; name: string; filePath: string; line: number } }) => ({
                label: `$(symbol-${s.symbol.kind}) ${s.symbol.name}`,
                description: `${s.symbol.filePath}:${s.symbol.line}`,
                detail: s.symbol.kind,
            })),
            ...files.map((f: { filePath: string; relevanceScore: number }) => ({
                label: `$(file) ${path.basename(f.filePath)}`,
                description: f.filePath,
                detail: `Relevance: ${(f.relevanceScore * 100).toFixed(0)}%`,
            })),
        ];
        
        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: `Search results for "${query}"`,
        });
        
        if (selection) {
            // Open selected file/symbol
            const filePath = selection.description?.split(':')[0];
            if (filePath) {
                const doc = await vscode.workspace.openTextDocument(filePath);
                await vscode.window.showTextDocument(doc);
            }
        }
        
    } catch (error) {
        showError('Search failed', error);
    }
}

async function findSymbolUsages(symbol: string): Promise<void> {
    if (!discoveryService) {
        showError('Discovery service not initialized');
        return;
    }
    
    const usages = discoveryService.findUsages(symbol);
    
    // Show usages in references view
    // This is a simplified implementation
    showInfo(`Found ${usages.length} usages of ${symbol}`);
}

async function showCodebaseTree(): Promise<void> {
    if (!discoveryService) {
        showError('Discovery service not initialized');
        return;
    }
    
    const tree = discoveryService.getTree();
    const stats = discoveryService.getStatus();
    
    // Show tree in webview
    const panel = vscode.window.createWebviewPanel(
        'kimiTree',
        'Codebase Tree',
        vscode.ViewColumn.Two,
        {}
    );
    
    panel.webview.html = `
        <html>
        <body>
            <h1>Codebase Tree</h1>
            <p>Files: ${stats.fileCount}</p>
            <p>Symbols: ${stats.symbolCount}</p>
            <pre>${JSON.stringify(Array.from(tree.files.keys()).slice(0, 20), null, 2)}</pre>
        </body>
        </html>
    `;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function buildEnhancedChatContext(): Promise<any> {
    const editor = vscode.window.activeTextEditor;
    const context: any = {};
    
    if (editor) {
        context.currentFile = editor.document.uri.fsPath;
        context.selectedText = editor.selection.isEmpty 
            ? undefined 
            : editor.document.getText(editor.selection);
        context.language = editor.document.languageId;
    }
    
    // Add relevant files from indexer
    if (context.selectedText && codebaseIndexer) {
        const results = codebaseIndexer.search(context.selectedText, 3);
        context.relatedFiles = results.map(r => r.relativePath);
    }
    
    // Add discovery service results
    if (discoveryService && context.selectedText) {
        const relevantFiles = await discoveryService.pickFiles({
            query: context.selectedText,
            maxFiles: 5,
            useAI: true,
        });
        context.discoveredFiles = relevantFiles.map(f => f.filePath);
    }
    
    // Add smart context
    if (smartContextManager) {
        context.smartContext = {
            stats: smartContextManager.getStats(),
            files: smartContextManager.getLoadedFiles(),
            criticalInfo: smartContextManager.getCriticalInfo(),
        };
    }
    
    return context;
}

function createModelClient() {
    return {
        generate: async (prompt: string) => {
            const response = await kimiApi!.generateResponse(prompt, {
                temperature: 0.1,
                maxTokens: 500,
            });
            return response.content;
        },
        complete: async (prompt: string, options?: any) => {
            const response = await kimiApi!.generateResponse(prompt, {
                temperature: options?.temperature ?? 0.1,
                maxTokens: options?.maxTokens ?? 500,
            });
            return response.content;
        },
    };
}

function handleToolAction(toolCallId: string, action: string): void {
    log('Tool action:', toolCallId, action);
}

function createNewChat(): void {
    chatPanel?.clearMessages();
    showInfo('New chat session started');
}

function clearChat(): void {
    chatPanel?.clearMessages();
}

function stopGeneration(): void {
    log('Stopping generation...');
    orchestrator?.cancel();
}

async function configureApiKey(): Promise<void> {
    const apiKey = await vscode.window.showInputBox({
        prompt: 'Enter your Kimi API Key',
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => {
            if (!value || value.trim().length < 10) {
                return 'Please enter a valid API key';
            }
            return null;
        },
    });

    if (apiKey) {
        await vscode.workspace.getConfiguration('kimi').update('apiKey', apiKey, true);
        vscode.window.showInformationMessage('Kimi API key saved successfully');
        updateContextKeys();
    }
}

async function selectModel(): Promise<void> {
    const models = [
        { label: 'Kimi K2.5', description: 'Latest model with best performance', id: 'kimi-k2-5' },
        { label: 'Kimi K2.5 Lite', description: 'Fast and efficient', id: 'kimi-k2-5-lite' },
        { label: 'Kimi K1.5', description: 'Balanced performance', id: 'kimi-k1.5' },
    ];
    
    const selected = await vscode.window.showQuickPick(models, {
        placeHolder: 'Select Kimi model'
    });
    
    if (selected) {
        await vscode.workspace.getConfiguration('kimi').update('model', selected.id, true);
        showInfo(`Model changed to ${selected.label}`);
    }
}

function openSettings(): void {
    vscode.commands.executeCommand('workbench.action.openSettings', 'kimi');
}

async function addFileToContext(uri?: vscode.Uri): Promise<void> {
    const fileUri = uri || vscode.window.activeTextEditor?.document.uri;
    if (!fileUri) {
        showInfo('No file selected');
        return;
    }
    
    await smartContextManager?.loadFile(fileUri, 'normal');
    showInfo(`Added ${path.basename(fileUri.fsPath)} to context`);
}

async function addSelectionToContext(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
        showInfo('Please select some code first');
        return;
    }
    
    const selectedText = editor.document.getText(editor.selection);
    smartContextManager?.addMessage('user', `Selected code from ${editor.document.uri.fsPath}:\n\n${selectedText}`);
    showInfo('Selection added to context');
}

function clearContext(): void {
    smartContextManager?.clearContext();
    showInfo('Context cleared');
}

async function explainTerminalOutput(): Promise<void> {
    showInfo('Terminal explanation feature coming soon');
}

async function fixTerminalError(): Promise<void> {
    showInfo('Terminal fix feature coming soon');
}

function showOutputChannel(): void {
    const outputChannel = vscode.window.createOutputChannel('Kimi IDE');
    outputChannel.show();
}

async function showExtensionStatus(): Promise<void> {
    const status = {
        version: '2.0.0',
        isActive: state.isActive,
        isIndexing: state.isIndexing,
        currentWorkflow: state.currentWorkflow,
        multiAgentSystem: multiAgentSystem ? 'initialized' : 'not initialized',
        discoveryService: discoveryService?.getStatus(),
        parallelEditor: parallelEditor ? 'initialized' : 'not initialized',
    };
    
    // Show in output channel
    const outputChannel = vscode.window.createOutputChannel('Kimi Status');
    outputChannel.appendLine(JSON.stringify(status, null, 2));
    outputChannel.show();
    
    // Show notification
    showInfo(`Kimi IDE v2.0.0 - Multi-Agent: ${status.multiAgentSystem}, Discovery: ${status.discoveryService?.isReady ? 'ready' : 'initializing'}`);
}

// =============================================================================
// Utility Functions
// =============================================================================

async function findKimiCliPath(): Promise<string | undefined> {
    const { execSync } = require('child_process');
    
    try {
        const result = execSync('which kimi', { encoding: 'utf-8' });
        return result.trim();
    } catch {
        return undefined;
    }
}

async function showWelcomeMessage(): Promise<void> {
    const config = vscode.workspace.getConfiguration('kimi');
    const hasSeenWelcome = config.get<boolean>('hasSeenWelcome');
    const apiKeyConfigured = await isApiKeyConfigured();
    
    if (!hasSeenWelcome || !apiKeyConfigured) {
        const result = await vscode.window.showInformationMessage(
            'Welcome to Kimi IDE v2.0! Experience the power of Multi-Agent AI coding.',
            'Configure API Key',
            'View Documentation',
            "Don't show again"
        );

        switch (result) {
            case 'Configure API Key':
                await configureApiKey();
                break;
            case 'View Documentation':
                vscode.env.openExternal(vscode.Uri.parse('https://platform.moonshot.cn/docs'));
                break;
            case "Don't show again":
                await config.update('hasSeenWelcome', true, true);
                break;
        }
    }
}

function updateContextKeys(): void {
    const editor = vscode.window.activeTextEditor;
    const hasSelection = editor ? !editor.selection.isEmpty : false;
    
    vscode.commands.executeCommand('setContext', ContextKeys.HAS_SELECTION, hasSelection);
    
    isApiKeyConfigured().then(configured => {
        vscode.commands.executeCommand('setContext', ContextKeys.API_KEY_SET, configured);
    });
}

function handleConfigChange(): void {
    log('Configuration changed, updating...');
    const config = getFullConfig();
    // Update components that listen to config changes
}

function renderPlanHtml(plan: any): string {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: sans-serif; padding: 20px; }
                h1 { color: #333; }
                .stage { margin: 10px 0; padding: 10px; background: #f5f5f5; border-radius: 4px; }
            </style>
        </head>
        <body>
            <h1>Change Plan</h1>
            <p>${plan.description}</p>
            <h2>Stages</h2>
            ${plan.stages?.map((s: any) => `<div class="stage">${s.name}</div>`).join('') || 'No stages defined'}
        </body>
        </html>
    `;
}

// =============================================================================
// Public API
// =============================================================================

function createExtensionApi(): KimiExtensionApi {
    return {
        version: '2.0.0',
        
        sendMessage: async (message: string, options?: any): Promise<string> => {
            if (!kimiApi) {
                throw new Error('Kimi API not available');
            }
            
            const response = await kimiApi.generateResponse(message, options);
            if (response.error) {
                throw new Error(response.error);
            }
            
            messageEmitter.fire({ role: 'assistant', content: response.content });
            return response.content;
        },
        
        onDidReceiveMessage: messageEmitter.event,
        
        getContext: () => {
            return contextResolver?.getCurrentContext() || {};
        },
        
        setContext: (context: any) => {
            contextResolver?.setContext(context);
        },
        
        isReady: () => state.isActive && !!kimiApi,
        
        getMultiAgentSystem: () => multiAgentSystem,
        
        getDiscoveryService: () => discoveryService,
        
        executeWorkflow: async (request: string) => {
            if (!orchestrator) {
                throw new Error('Orchestrator not initialized');
            }
            return orchestrator!.processRequest({
                id: `api-${Date.now()}`,
                description: request,
            });
        },
    };
}

// =============================================================================
// Deactivation
// =============================================================================

export async function deactivate(): Promise<void> {
    log('🔄 Kimi IDE extension deactivating...');
    
    state.isActive = false;
    
    // Stop LSP client
    if (languageClient) {
        await languageClient.stop();
        languageClient = undefined;
    }
    
    // Stop wire client
    if (kimiClient) {
        await kimiClient.stop();
        kimiClient = undefined;
    }
    
    // Dispose Multi-Agent System
    if (multiAgentSystem) {
        await multiAgentSystem.dispose();
        multiAgentSystem = undefined;
    }
    
    // Dispose Discovery Service
    if (discoveryService) {
        discoveryService.dispose();
        discoveryService = undefined;
    }
    
    // Dispose Smart Context Manager
    if (smartContextManager) {
        smartContextManager.dispose();
        smartContextManager = undefined;
    }
    
    // Dispose terminal manager
    if (terminalManager) {
        terminalManager.dispose();
        terminalManager = undefined;
    }
    
    // Dispose chat panel
    if (chatPanel) {
        chatPanel.dispose();
        chatPanel = undefined;
    }
    
    // Dispose providers
    inlineEditProvider?.dispose();
    inlineEditProvider = undefined;
    
    codeActionProvider?.dispose();
    codeActionProvider = undefined;
    
    diffProvider?.dispose();
    diffProvider = undefined;
    
    // Dispose all disposables
    disposables.forEach(d => d.dispose());
    disposables.length = 0;
    
    // Dispose commands
    disposeCommands();
    
    log('✅ Kimi IDE extension deactivated');
}

// =============================================================================
// Composer Command Handlers
// =============================================================================

async function openComposer(): Promise<void> {
    const extensionUri = vscode.Uri.file(path.join(__dirname, '..'));
    composerPanel = ComposerPanel.createOrShow(extensionUri);
}

async function openComposerWithSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.selection.isEmpty) {
        showInfo('Please select code first');
        return;
    }

    const extensionUri = vscode.Uri.file(path.join(__dirname, '..'));
    composerPanel = ComposerPanel.createOrShow(extensionUri);
    composerPanel.addContextFromSelection();
}

async function addFilesToComposer(uris: vscode.Uri[]): Promise<void> {
    if (!composerPanel) {
        const extensionUri = vscode.Uri.file(path.join(__dirname, '..'));
        composerPanel = ComposerPanel.createOrShow(extensionUri);
    }
    // Files would be added via the panel's addFiles method
}
