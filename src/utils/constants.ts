/**
 * Constants for Kimi IDE extension
 * Command IDs, configuration keys, and other constants
 */

import * as vscode from 'vscode';

// ============================================================================
// Extension Info
// ============================================================================

export const EXTENSION_ID = 'kimi-ide';
export const EXTENSION_NAME = 'Kimi';
export const EXTENSION_DISPLAY_NAME = 'Kimi IDE';

// ============================================================================
// Command IDs
// ============================================================================

export const Commands = {
    // Chat Commands
    OPEN_CHAT: 'kimi.openChat',
    NEW_CHAT: 'kimi.newChat',
    CLEAR_CHAT: 'kimi.clearChat',
    SEND_MESSAGE: 'kimi.sendMessage',
    STOP_GENERATION: 'kimi.stopGeneration',
    
    // Context Commands
    ADD_FILE_TO_CONTEXT: 'kimi.addFileToContext',
    REMOVE_FILE_FROM_CONTEXT: 'kimi.removeFileFromContext',
    ADD_SELECTION_TO_CONTEXT: 'kimi.addSelectionToContext',
    ADD_TERMINAL_TO_CONTEXT: 'kimi.addTerminalToContext',
    CLEAR_CONTEXT: 'kimi.clearContext',
    
    // Editor Commands
    GENERATE_CODE: 'kimi.generateCode',
    EXPLAIN_CODE: 'kimi.explainCode',
    FIX_CODE: 'kimi.fixCode',
    REFACTOR_CODE: 'kimi.refactorCode',
    ADD_TESTS: 'kimi.addTests',
    ADD_DOCUMENTATION: 'kimi.addDocumentation',
    GENERATE_COMMIT_MESSAGE: 'kimi.generateCommitMessage',
    REVIEW_CHANGES: 'kimi.reviewChanges',
    
    // Quick Actions
    INLINE_EDIT: 'kimi.inlineEdit',
    QUICK_FIX: 'kimi.quickFix',
    SMART_COMPLETE: 'kimi.smartComplete',
    
    // Terminal Commands
    EXPLAIN_TERMINAL: 'kimi.explainTerminal',
    FIX_TERMINAL_ERROR: 'kimi.fixTerminalError',
    
    // Settings Commands
    OPEN_SETTINGS: 'kimi.openSettings',
    SET_API_KEY: 'kimi.setApiKey',
    SELECT_MODEL: 'kimi.selectModel',
    
    // View Commands
    FOCUS_CHAT_VIEW: 'kimi.focusChatView',
    TOGGLE_SIDEBAR: 'kimi.toggleSidebar',
    
    // Utility Commands
    COPY_CODE: 'kimi.copyCode',
    INSERT_CODE: 'kimi.insertCode',
    APPLY_DIFF: 'kimi.applyDiff',
    SHOW_OUTPUT: 'kimi.showOutput',
} as const;

// ============================================================================
// Configuration Keys
// ============================================================================

export const ConfigKeys = {
    // API Configuration
    API_KEY: 'kimi.apiKey',
    API_BASE_URL: 'kimi.apiBaseUrl',
    MODEL: 'kimi.model',
    
    // Generation Configuration
    TEMPERATURE: 'kimi.temperature',
    MAX_TOKENS: 'kimi.maxTokens',
    TOP_P: 'kimi.topP',
    
    // UI Configuration
    THEME: 'kimi.theme',
    FONT_SIZE: 'kimi.fontSize',
    SHOW_LINE_NUMBERS: 'kimi.showLineNumbers',
    WORD_WRAP: 'kimi.wordWrap',
    
    // Behavior Configuration
    AUTO_SAVE: 'kimi.autoSave',
    CONFIRM_CODE_EXECUTION: 'kimi.confirmCodeExecution',
    INCLUDE_GIT_CONTEXT: 'kimi.includeGitContext',
    INCLUDE_TERMINAL_CONTEXT: 'kimi.includeTerminalContext',
    
    // Feature Configuration
    ENABLE_STREAMING: 'kimi.enableStreaming',
    ENABLE_TOOLS: 'kimi.enableTools',
    ENABLE_VISION: 'kimi.enableVision',
    ENABLE_AUTOCOMPLETE: 'kimi.enableAutocomplete',
    
    // Debug Configuration
    LOG_LEVEL: 'kimi.logLevel',
    LOG_TO_FILE: 'kimi.logToFile',
    
    // Advanced Configuration
    TIMEOUT: 'kimi.timeout',
    RETRY_ATTEMPTS: 'kimi.retryAttempts',
    CONTEXT_WINDOW: 'kimi.contextWindow',
} as const;

// ============================================================================
// Default Values
// ============================================================================

export const Defaults = {
    TEMPERATURE: 0.7,
    MAX_TOKENS: 4096,
    TOP_P: 1.0,
    TIMEOUT: 60000, // 60 seconds
    RETRY_ATTEMPTS: 3,
    CONTEXT_WINDOW: 128000,
    FONT_SIZE: 14,
    MAX_FILE_SIZE: 1024 * 1024, // 1MB
} as const;

// ============================================================================
// View IDs
// ============================================================================

export const ViewIds = {
    CHAT_VIEW: 'kimi.chatView',
    CONTEXT_VIEW: 'kimi.contextView',
    HISTORY_VIEW: 'kimi.historyView',
    SETTINGS_VIEW: 'kimi.settingsView',
} as const;

// ============================================================================
// Tree View IDs
// ============================================================================

export const TreeViewIds = {
    CONTEXT_FILES: 'kimi.contextFiles',
    CHAT_HISTORY: 'kimi.chatHistory',
} as const;

// ============================================================================
// Webview IDs
// ============================================================================

export const WebviewIds = {
    CHAT_PANEL: 'kimi.chatPanel',
    COMPOSER_PANEL: 'kimi.composerPanel',
    SETTINGS_PANEL: 'kimi.settingsPanel',
} as const;

// ============================================================================
// Context Keys
// ============================================================================

export const ContextKeys = {
    // Feature States
    IS_LOADING: 'kimi:isLoading',
    IS_GENERATING: 'kimi:isGenerating',
    HAS_CONTEXT: 'kimi:hasContext',
    HAS_SELECTION: 'kimi:hasSelection',
    
    // View States
    CHAT_VISIBLE: 'kimi:chatVisible',
    PANEL_FOCUSED: 'kimi:panelFocused',
    
    // Configuration States
    API_KEY_SET: 'kimi:apiKeySet',
    STREAMING_ENABLED: 'kimi:streamingEnabled',
    TOOLS_ENABLED: 'kimi:toolsEnabled',
} as const;

// ============================================================================
// Storage Keys
// ============================================================================

export const StorageKeys = {
    // Global State
    CHAT_HISTORY: 'kimi.chatHistory',
    SETTINGS: 'kimi.settings',
    LAST_USED_MODEL: 'kimi.lastUsedModel',
    
    // Workspace State
    WORKSPACE_CONTEXT: 'kimi.workspaceContext',
    OPEN_SESSIONS: 'kimi.openSessions',
    
    // Secrets
    API_KEY: 'kimi.apiKey',
} as const;

// ============================================================================
// Model IDs
// ============================================================================

export const Models = {
    // Moonshot AI Models
    KIMI_K2_5: 'kimi-k2-5',
    KIMI_K1_5: 'kimi-k1.5',
    
    // Default
    DEFAULT: 'kimi-k2-5',
} as const;

// ============================================================================
// Provider IDs
// ============================================================================

export const Providers = {
    MOONSHOT: 'moonshot',
} as const;

// ============================================================================
// Provider URLs
// ============================================================================

export const ProviderUrls = {
    MOONSHOT: 'https://api.moonshot.cn/v1',
} as const;

// ============================================================================
// UI Constants
// ============================================================================

export const UI = {
    // Chat
    MAX_CHAT_HISTORY: 100,
    MESSAGE_PREVIEW_LENGTH: 50,
    
    // Context
    MAX_CONTEXT_FILES: 20,
    MAX_CONTEXT_TOKENS: 120000,
    
    // Code Blocks
    MAX_CODE_LENGTH: 10000,
    CODE_PREVIEW_LINES: 5,
    
    // Timeouts
    TYPING_DEBOUNCE_MS: 300,
    STREAM_CHUNK_DELAY_MS: 50,
    TOOLTIP_DELAY_MS: 500,
    
    // Icons
    ICONS: {
        CHAT: '$(comment-discussion)',
        SEND: '$(send)',
        STOP: '$(stop-circle)',
        ADD: '$(add)',
        REMOVE: '$(remove)',
        REFRESH: '$(refresh)',
        SETTINGS: '$(gear)',
        CODE: '$(code)',
        FILE: '$(file-code)',
        FOLDER: '$(folder)',
        ERROR: '$(error)',
        WARNING: '$(warning)',
        INFO: '$(info)',
        CHECK: '$(check)',
        CLOSE: '$(close)',
        COPY: '$(copy)',
        INSERT: '$(insert)',
    },
} as const;

// ============================================================================
// System Prompts
// ============================================================================

export const SystemPrompts = {
    DEFAULT: `You are Kimi, an AI coding assistant integrated into VS Code. You help users with:
- Writing and editing code
- Explaining code and concepts
- Debugging and fixing errors
- Refactoring and improving code
- Writing tests and documentation

Always provide clear, concise responses. Use markdown code blocks with language tags.`,

    CODE_GENERATION: `You are a code generation assistant. Generate clean, well-documented code.
Follow best practices and the existing code style. Use appropriate error handling.`,

    CODE_EXPLANATION: `You are a code explanation assistant. Explain code clearly and concisely.
Focus on what the code does, why it does it, and any important details.`,

    CODE_REVIEW: `You are a code reviewer. Review code for:
- Bugs and potential issues
- Security concerns
- Performance improvements
- Code style and best practices
- Maintainability

Provide specific, actionable feedback.`,

    REFACTORING: `You are a refactoring assistant. Improve code while preserving functionality.
Focus on readability, maintainability, and performance.`,
} as const;

// ============================================================================
// Quick Action Definitions
// ============================================================================

export const QuickActions = [
    {
        id: 'explain',
        label: 'Explain',
        description: 'Explain the selected code',
        icon: '$(info)',
    },
    {
        id: 'fix',
        label: 'Fix',
        description: 'Fix issues in the selected code',
        icon: '$(wrench)',
    },
    {
        id: 'refactor',
        label: 'Refactor',
        description: 'Improve the selected code',
        icon: '$(symbol-color)',
    },
    {
        id: 'test',
        label: 'Add Tests',
        description: 'Generate tests for the selected code',
        icon: '$(beaker)',
    },
    {
        id: 'document',
        label: 'Add Docs',
        description: 'Add documentation to the selected code',
        icon: '$(book)',
    },
] as const;

// ============================================================================
// Error Messages
// ============================================================================

export const ErrorMessages = {
    API_KEY_MISSING: 'API key is not configured. Please set your API key in settings.',
    API_REQUEST_FAILED: 'Request to AI service failed. Please try again.',
    API_RATE_LIMITED: 'Rate limit exceeded. Please wait a moment and try again.',
    API_TIMEOUT: 'Request timed out. The AI service may be slow or unavailable.',
    MODEL_NOT_FOUND: 'Selected model is not available. Please choose a different model.',
    CONTEXT_TOO_LONG: 'Context is too long. Please remove some files or shorten the conversation.',
    FILE_TOO_LARGE: 'File is too large to include in context.',
    NO_ACTIVE_EDITOR: 'No active editor. Please open a file first.',
    NO_SELECTION: 'No code selected. Please select some code first.',
    OPERATION_CANCELLED: 'Operation was cancelled.',
} as const;

// ============================================================================
// Event Names
// ============================================================================

export const Events = {
    // Extension Events
    EXTENSION_ACTIVATED: 'kimi:extensionActivated',
    EXTENSION_DEACTIVATED: 'kimi:extensionDeactivated',
    
    // Chat Events
    CHAT_STARTED: 'kimi:chatStarted',
    MESSAGE_SENT: 'kimi:messageSent',
    MESSAGE_RECEIVED: 'kimi:messageReceived',
    STREAM_CHUNK: 'kimi:streamChunk',
    GENERATION_STOPPED: 'kimi:generationStopped',
    
    // Context Events
    CONTEXT_CHANGED: 'kimi:contextChanged',
    FILE_ADDED: 'kimi:fileAdded',
    FILE_REMOVED: 'kimi:fileRemoved',
    
    // Settings Events
    SETTINGS_CHANGED: 'kimi:settingsChanged',
    MODEL_CHANGED: 'kimi:modelChanged',
} as const;

// ============================================================================
// File Patterns
// ============================================================================

export const FilePatterns = {
    // Included by default
    INCLUDE: [
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx',
        '**/*.json',
        '**/*.md',
        '**/*.py',
        '**/*.java',
        '**/*.go',
        '**/*.rs',
        '**/*.rb',
        '**/*.php',
        '**/*.swift',
        '**/*.kt',
        '**/*.c',
        '**/*.cpp',
        '**/*.h',
        '**/*.hpp',
        '**/*.cs',
        '**/*.html',
        '**/*.css',
        '**/*.scss',
        '**/*.sass',
        '**/*.less',
        '**/*.xml',
        '**/*.yaml',
        '**/*.yml',
        '**/*.sql',
    ],
    
    // Excluded by default
    EXCLUDE: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.vscode/**',
        '**/out/**',
        '**/coverage/**',
        '**/*.min.js',
        '**/*.bundle.js',
        '**/package-lock.json',
        '**/yarn.lock',
        '**/Cargo.lock',
    ],
} as const;

// ============================================================================
// Regular Expressions
// ============================================================================

export const Regex = {
    CODE_BLOCK: /```(\w+)?\n([\s\S]*?)```/g,
    INLINE_CODE: /`([^`]+)`/g,
    URL: /https?:\/\/[^\s]+/g,
    MENTION: /@(\w+)/g,
    FILE_PATH: /[\/\\][\w\-./\\]+/g,
} as const;

// ============================================================================
// API Constants
// ============================================================================

export const API = {
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000,
    REQUEST_TIMEOUT_MS: 60000,
    STREAM_TIMEOUT_MS: 300000, // 5 minutes
    MAX_CONCURRENT_REQUESTS: 3,
} as const;
