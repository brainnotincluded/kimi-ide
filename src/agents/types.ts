/**
 * Multi-Agent System Types
 * Типы для специализированных агентов в Kimi VS Code Extension
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';

// ============================================================================
// Agent Core Types
// ============================================================================

/**
 * Тип агента
 */
export type AgentType = 
    | 'orchestrator'
    | 'fileDiscovery'
    | 'planner'
    | 'editor'
    | 'reviewer'
    | 'testing';

/**
 * Статус агента
 */
export type AgentStatus = 
    | 'idle'
    | 'running'
    | 'completed'
    | 'error'
    | 'cancelled';

/**
 * Приоритет агента
 */
export type AgentPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Конфигурация агента
 */
export interface AgentConfig {
    id: string;
    type: AgentType;
    priority: AgentPriority;
    timeoutMs: number;
    maxRetries: number;
    parallel: boolean;
    model?: string;
}

/**
 * Результат выполнения агента
 */
export interface AgentResult<T = unknown> {
    success: boolean;
    agentId: string;
    agentType: AgentType;
    data?: T;
    error?: AgentError;
    executionTimeMs: number;
    metadata?: Record<string, unknown>;
}

/**
 * Ошибка агента
 */
export interface AgentError {
    code: string;
    message: string;
    details?: unknown;
    stack?: string;
}

// ============================================================================
// Message Protocol (Wire Protocol Extension)
// ============================================================================

/**
 * Тип сообщения между агентами
 */
export type AgentMessageType = 
    | 'task.assign'
    | 'task.complete'
    | 'task.cancel'
    | 'status.update'
    | 'data.request'
    | 'data.response'
    | 'error.report';

/**
 * Сообщение между агентами
 */
export interface AgentMessage<T = unknown> {
    id: string;
    type: AgentMessageType;
    from: string;
    to: string;
    timestamp: number;
    payload: T;
    correlationId?: string;
}

/**
 * Task assignment payload
 */
export interface TaskAssignPayload {
    taskId: string;
    taskType: string;
    description: string;
    inputs: Record<string, unknown>;
    dependencies?: string[];
    deadline?: number;
}

/**
 * Task completion payload
 */
export interface TaskCompletePayload {
    taskId: string;
    result: unknown;
    artifacts?: TaskArtifact[];
}

/**
 * Артефакт задачи
 */
export interface TaskArtifact {
    type: 'file' | 'diff' | 'test' | 'log' | 'metric';
    path?: string;
    content: string;
    metadata?: Record<string, unknown>;
}

// ============================================================================
// Orchestrator Types
// ============================================================================

/**
 * Запрос от пользователя
 */
export interface UserRequest {
    id: string;
    description: string;
    context?: {
        currentFile?: string;
        selection?: vscode.Range;
        openFiles?: string[];
    };
    constraints?: {
        maxFiles?: number;
        maxTimeMs?: number;
        readonly?: boolean;
    };
}

/**
 * Execution workflow
 */
export interface ExecutionWorkflow {
    id: string;
    requestId: string;
    stages: WorkflowStage[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    createdAt: number;
    updatedAt: number;
}

/**
 * Этап workflow
 */
export interface WorkflowStage {
    id: string;
    name: string;
    agentType: AgentType;
    dependencies: string[];
    status: AgentStatus;
    inputs: Record<string, unknown>;
    outputs?: unknown;
}

/**
 * Spawn decision
 */
export interface SpawnDecision {
    agents: AgentType[];
    parallel: boolean;
    strategy: 'sequential' | 'parallel' | ' DAG';
    reasoning: string;
}

// ============================================================================
// File Discovery Agent Types
// ============================================================================

/**
 * Результат поиска файлов
 */
export interface FileDiscoveryResult {
    files: RankedFile[];
    tree: FileTreeNode;
    stats: DiscoveryStats;
}

/**
 * Ранжированный файл
 */
export interface RankedFile {
    path: string;
    relevanceScore: number;
    reasons: string[];
    size: number;
    language: string;
    lastModified: number;
    symbols?: CodeSymbolSummary[];
}

/**
 * Узел дерева файлов
 */
export interface FileTreeNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: FileTreeNode[];
    size?: number;
    language?: string;
}

/**
 * Сводка по символам кода
 */
export interface CodeSymbolSummary {
    name: string;
    kind: string;
    line: number;
    signature?: string;
}

/**
 * Статистика поиска
 */
export interface DiscoveryStats {
    totalFiles: number;
    scannedFiles: number;
    relevantFiles: number;
    executionTimeMs: number;
    modelCalls: number;
}

/**
 * Запрос на поиск файлов
 */
export interface FileDiscoveryRequest {
    description: string;
    contextFiles?: string[];
    maxResults?: number;
    excludePatterns?: string[];
    includePatterns?: string[];
}

// ============================================================================
// Planner Agent Types
// ============================================================================

/**
 * План изменений
 */
export interface ChangePlan {
    id: string;
    description: string;
    changes: PlannedChange[];
    dependencies: ChangeDependency[];
    estimatedTimeMs: number;
    risks: RiskAssessment[];
}

/**
 * Запланированное изменение
 */
export interface PlannedChange {
    id: string;
    filePath: string;
    changeType: 'create' | 'modify' | 'delete' | 'rename';
    description: string;
    dependencies: string[];
    order: number;
    estimatedImpact: 'low' | 'medium' | 'high';
    rollbackStrategy: string;
}

/**
 * Зависимость изменений
 */
export interface ChangeDependency {
    from: string;
    to: string;
    type: 'requires' | 'conflicts' | 'optional';
}

/**
 * Оценка риска
 */
export interface RiskAssessment {
    type: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    mitigation?: string;
}

/**
 * Execution graph
 */
export interface ExecutionGraph {
    nodes: ExecutionNode[];
    edges: ExecutionEdge[];
    parallelGroups: string[][];
}

/**
 * Узел выполнения
 */
export interface ExecutionNode {
    id: string;
    changeId: string;
    status: 'pending' | 'ready' | 'running' | 'completed' | 'failed';
    agent?: string;
}

/**
 * Ребро выполнения
 */
export interface ExecutionEdge {
    from: string;
    to: string;
    type: 'dependency' | 'sequence';
}

// ============================================================================
// Editor Agent Types
// ============================================================================

/**
 * Результат редактирования
 */
export interface EditResult {
    filePath: string;
    success: boolean;
    strategies: EditStrategyResult[];
    selectedStrategy: string;
    diff: FileDiff;
    error?: string;
}

/**
 * Результат стратегии редактирования
 */
export interface EditStrategyResult {
    strategy: EditStrategy;
    success: boolean;
    diff: FileDiff;
    score: number;
    executionTimeMs: number;
    error?: string;
}

/**
 * Стратегия редактирования
 */
export type EditStrategy = 
    | 'ast.transform'
    | 'text.replace'
    | 'semantic.patch';

/**
 * Diff файла
 */
export interface FileDiff {
    originalPath: string;
    modifiedPath: string;
    hunks: DiffHunk[];
    additions: number;
    deletions: number;
    isNewFile: boolean;
    isDeleted: boolean;
}

/**
 * Hunk diff
 */
export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: DiffLine[];
    header?: string;
}

/**
 * Строка diff
 */
export interface DiffLine {
    type: 'context' | 'add' | 'remove';
    content: string;
    oldLine?: number;
    newLine?: number;
}

/**
 * Запрос на редактирование
 */
export interface EditRequest {
    filePath: string;
    instruction: string;
    context?: {
        surroundingLines?: number;
        relatedFiles?: string[];
    };
    strategies: EditStrategy[];
}

// ============================================================================
// Reviewer Agent Types
// ============================================================================

/**
 * Результат ревью
 */
export interface ReviewResult {
    filePath: string;
    approved: boolean;
    issues: CodeIssue[];
    metrics: QualityMetrics;
    checks: CheckResult[];
}

/**
 * Проблема в коде
 */
export interface CodeIssue {
    id: string;
    severity: 'error' | 'warning' | 'info' | 'suggestion';
    category: 'type' | 'lint' | 'test' | 'security' | 'performance' | 'style';
    message: string;
    filePath: string;
    line?: number;
    column?: number;
    code?: string;
    suggestion?: string;
    fix?: CodeFix;
}

/**
 * Исправление кода
 */
export interface CodeFix {
    description: string;
    replacements: CodeReplacement[];
}

/**
 * Замена кода
 */
export interface CodeReplacement {
    range: { start: number; end: number };
    newText: string;
}

/**
 * Метрики качества
 */
export interface QualityMetrics {
    complexity: number;
    maintainability: number;
    testCoverage: number;
    duplication: number;
    documentation: number;
}

/**
 * Результат проверки
 */
export interface CheckResult {
    type: 'typecheck' | 'lint' | 'test' | 'security' | 'format';
    status: 'passed' | 'failed' | 'skipped';
    durationMs: number;
    output?: string;
    issues: number;
}

// ============================================================================
// Testing Agent Types
// ============================================================================

/**
 * Результат тестирования
 */
export interface TestingResult {
    generated: boolean;
    tests: GeneratedTest[];
    execution?: TestExecutionResult;
    coverage?: CoverageReport;
}

/**
 * Сгенерированный тест
 */
export interface GeneratedTest {
    id: string;
    filePath: string;
    testType: 'unit' | 'integration' | 'e2e';
    targetFunction: string;
    code: string;
    fixtures?: TestFixture[];
}

/**
 * Тестовая фикстура
 */
export interface TestFixture {
    name: string;
    input: unknown;
    expectedOutput: unknown;
    description?: string;
}

/**
 * Результат выполнения тестов
 */
export interface TestExecutionResult {
    success: boolean;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    durationMs: number;
    failures: TestFailure[];
}

/**
 * Ошибка теста
 */
export interface TestFailure {
    testId: string;
    message: string;
    stack?: string;
    expected?: string;
    actual?: string;
}

/**
 * Отчёт о покрытии
 */
export interface CoverageReport {
    overall: number;
    byFile: Record<string, FileCoverage>;
    byFunction: Record<string, number>;
}

/**
 * Покрытие файла
 */
export interface FileCoverage {
    lines: number;
    functions: number;
    branches: number;
    statements: number;
}

// ============================================================================
// Agent Base Class Interface
// ============================================================================

/**
 * Интерфейс базового агента
 */
export interface IAgent extends EventEmitter {
    readonly id: string;
    readonly type: AgentType;
    readonly config: AgentConfig;
    status: AgentStatus;
    
    initialize(): Promise<void>;
    execute<TInput, TOutput>(input: TInput): Promise<AgentResult<TOutput>>;
    cancel(): Promise<void>;
    dispose(): Promise<void>;
    
    on<K extends keyof AgentEventMap>(
        event: K,
        listener: (payload: AgentEventMap[K]) => void
    ): this;
    emit<K extends keyof AgentEventMap>(
        event: K,
        payload: AgentEventMap[K]
    ): boolean;
}

/**
 * События агента
 */
export interface AgentEventMap {
    'status:change': { status: AgentStatus; previous: AgentStatus };
    'message:received': AgentMessage;
    'message:sent': AgentMessage;
    'error': AgentError;
    'complete': AgentResult;
}

// ============================================================================
// Context Types
// ============================================================================

/**
 * Контекст workspace для агентов
 */
export interface WorkspaceContext {
    rootPath: string;
    files: string[];
    gitBranch?: string;
    gitStatus?: string[];
    configuration: vscode.WorkspaceConfiguration;
}

/**
 * Контекст VS Code API
 */
export interface VSCodeContext {
    workspace: typeof vscode.workspace;
    window: typeof vscode.window;
    commands: typeof vscode.commands;
    languages: typeof vscode.languages;
}

/**
 * Контекст AST
 */
export interface ASTContext {
    sourceFile?: unknown;
    typeChecker?: unknown;
    program?: unknown;
}
