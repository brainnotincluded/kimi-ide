/**
 * Smart Context Management System for Kimi IDE
 * 
 * Комплексная система управления контекстом с интеллектуальными возможностями:
 * - Token budgeting с динамическим перераспределением
 * - Relevance scoring для определения важности контента
 * - Smart compaction с сохранением critical information
 * - Incremental loading для больших файлов
 * - Session persistence между перезапусками VS Code
 * 
 * Преимущества над Codebuff:
 * - Интеграция с VS Code workspace state
 * - Persistence между сессиями
 * - Visual context usage indicator в UI
 * - Deterministic compaction strategy
 * - Semantic relevance scoring
 */

// Core Context System
export {
    ContextManager,
    ContextManagerConfig,
    ContextSession,
    ContextStats,
    ContextFile,
    ContextMessage,
    SerializedContextState,
    SerializedRound,
} from './contextManager';

// Token Budget Management
export {
    TokenBudget,
    TokenAllocation,
    ContextComponent,
    TokenBudgetConfig,
    BudgetWarning,
    BudgetSnapshot,
    getDefaultTokenBudget,
    resetDefaultTokenBudget,
} from './tokenBudget';

// Relevance Scoring
export {
    RelevanceScorer,
    RelevanceScore,
    RelevanceItemType,
    RelevanceConfig,
    ScoringContext,
    SemanticVector,
    getDefaultRelevanceScorer,
    resetDefaultRelevanceScorer,
} from './relevanceScorer';

// Compaction Engine
export {
    CompactionEngine,
    ConversationRound,
    RoundImportance,
    RoundSummary,
    ToolCallInfo,
    CodeChangeInfo,
    CompactionConfig,
    CompactionResult,
    CriticalInformation,
} from './compactionEngine';

// Incremental Loader
export {
    IncrementalLoader,
    FileLoadRequest,
    LoadPriority,
    LoadedFile,
    FileMetadata,
    ChunkedFile,
    LoaderConfig,
    LoadResult,
} from './incrementalLoader';

// Existing exports from codebase context
export {
    CodebaseIndexer,
    SearchResult,
    CodeSymbolResult,
    FileContext,
    IndexStats,
    SymbolKind,
} from './codebaseIndexer';

export {
    ContextResolver,
    Mention,
    ResolvedContext,
    ResolvedMention,
    AutoContext,
    ContextConfig,
    MentionCompletion,
} from './contextResolver';

export {
    SymbolProvider,
    SymbolNode,
    DependencyEdge,
    DependencyGraph,
    FileOutline,
    ImportInfo,
    ExportInfo,
    SymbolReference,
    CallHierarchyItem,
} from './symbolProvider';

export {
    PromptBuilder,
    PromptConfig,
    PromptContext,
    FileContext as PromptFileContext,
    BuiltPrompt,
} from './promptBuilder';
