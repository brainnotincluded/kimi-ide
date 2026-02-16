/**
 * Agent System Types
 * Type definitions for the multi-agent system
 */

/**
 * Agent types
 */
export type AgentType = 
    | 'orchestrator'
    | 'fileDiscovery'
    | 'planner'
    | 'editor'
    | 'reviewer'
    | 'testing'
    | 'analyzer'
    | 'custom';

/**
 * Agent priority levels
 */
export enum AgentPriority {
    CRITICAL = 0,
    HIGH = 1,
    NORMAL = 2,
    LOW = 3,
}

/**
 * Agent status
 */
export enum AgentStatus {
    IDLE = 'idle',
    BUSY = 'busy',
    RUNNING = 'running',
    ERROR = 'error',
    STOPPED = 'stopped',
}

/**
 * Agent task interface
 */
export interface AgentTask {
    id: string;
    type: string;
    priority: AgentPriority;
    payload: any;
    createdAt?: number;
    startedAt?: number;
    completedAt?: number;
    error?: string;
}

/**
 * Agent task result
 */
export interface AgentTaskResult {
    taskId: string;
    success: boolean;
    data?: any;
    error?: string;
    duration?: number;
}

/**
 * Agent result
 */
export interface AgentResult<T = any> {
    success: boolean;
    agentId: string;
    data?: T;
    error?: AgentError;
    executionTimeMs: number;
    metadata?: Record<string, any>;
}

/**
 * Agent error
 */
export interface AgentError {
    code: string;
    message: string;
    details?: any;
    recoverable: boolean;
}

/**
 * Agent message types
 */
export enum AgentMessageType {
    TASK_ASSIGN = 'TASK_ASSIGN',
    TASK_COMPLETE = 'TASK_COMPLETE',
    TASK_FAIL = 'TASK_FAIL',
    STATUS_UPDATE = 'STATUS_UPDATE',
    HEARTBEAT = 'HEARTBEAT',
    CANCEL = 'CANCEL',
}

/**
 * Agent message
 */
export interface AgentMessage {
    id: string;
    type: AgentMessageType | string;
    from: string;
    to: string;
    payload: any;
    timestamp: number;
    correlationId?: string;
}

/**
 * Agent event types
 */
export enum AgentEventType {
    TASK_STARTED = 'task:started',
    TASK_COMPLETED = 'task:completed',
    TASK_FAILED = 'task:failed',
    STATUS_CHANGED = 'status:changed',
    AGENT_REGISTERED = 'agent:registered',
    AGENT_UNREGISTERED = 'agent:unregistered',
}

/**
 * Agent event
 */
export interface AgentEvent {
    type: AgentEventType;
    agentId?: string;
    taskId?: string;
    data?: any;
    timestamp: number;
}

/**
 * Agent event map for EventEmitter
 */
export interface AgentEventMap {
    'status': AgentStatus;
    'message': AgentMessage;
    'error': AgentError;
    'complete': AgentResult;
}

// ============================================================================
// Editor Agent Types
// ============================================================================

/**
 * Edit request
 */
export interface EditRequest {
    filePath: string;
    description: string;
    instruction?: string;
    originalCode?: string;
    newCode?: string;
    strategies?: EditStrategy[];
    context?: {
        surroundingCode?: string;
        surroundingLines?: number;
        imports?: string[];
        dependencies?: string[];
        relatedFiles?: string[];
    };
}

/**
 * Edit result
 */
export interface EditResult {
    success: boolean;
    filePath: string;
    diff: FileDiff;
    appliedStrategy: EditStrategy;
    allStrategies: EditStrategyResult[];
    executionTimeMs: number;
    error?: string;
}

/**
 * Edit strategy
 */
export type EditStrategy = 
    | 'text.replace'
    | 'ast.transform'
    | 'semantic.edit'
    | 'semantic.patch';

/**
 * Edit strategy result
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
 * File diff
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
 * Diff hunk
 */
export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: DiffLine[];
}

/**
 * Diff line
 */
export interface DiffLine {
    type: 'context' | 'add' | 'remove';
    content: string;
    lineNumber?: number;
    oldLine?: number;
    newLine?: number;
}

// ============================================================================
// File Discovery Agent Types
// ============================================================================

/**
 * File discovery request
 */
export interface FileDiscoveryRequest {
    workspacePath: string;
    query?: string;
    description?: string;
    filePatterns?: string[];
    includePatterns?: string[];
    excludePatterns?: string[];
    maxFiles?: number;
}

/**
 * File discovery result
 */
export interface FileDiscoveryResult {
    files: RankedFile[];
    fileTree: FileTreeNode;
    stats: DiscoveryStats;
    symbols: CodeSymbolSummary[];
}

/**
 * Ranked file
 */
export interface RankedFile {
    path: string;
    score: number;
    relevanceScore?: number;
    relevance: 'high' | 'medium' | 'low';
    reasons?: string[];
    language: string;
    size: number;
    lastModified: number;
    symbols?: CodeSymbolSummary[];
}

/**
 * File tree node
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
 * Discovery stats
 */
export interface DiscoveryStats {
    totalFiles: number;
    scannedFiles?: number;
    relevantFiles?: number;
    executionTimeMs?: number;
    totalDirectories: number;
    filesByLanguage: Record<string, number>;
    totalSize: number;
}

/**
 * Code symbol summary
 */
export interface CodeSymbolSummary {
    name: string;
    type: 'class' | 'function' | 'variable' | 'interface' | 'type' | 'enum';
    kind?: string;
    signature?: string;
    filePath: string;
    line: number;
    column: number;
}

// ============================================================================
// Planner Agent Types
// ============================================================================

/**
 * Change plan
 */
export interface ChangePlan {
    id: string;
    description: string;
    changes: PlannedChange[];
    dependencies: ChangeDependency[];
    risks: RiskAssessment[];
    estimatedTimeMs: number;
    executionGraph: ExecutionGraph;
}

/**
 * Planned change
 */
export interface PlannedChange {
    id: string;
    filePath: string;
    changeType: 'add' | 'modify' | 'delete' | 'rename' | 'create';
    description: string;
    order?: number;
    estimatedImpact?: 'low' | 'medium' | 'high';
    rollbackStrategy?: string;
    dependencies?: string[];
}

/**
 * Change dependency
 */
export interface ChangeDependency {
    from: string;
    to: string;
    type: 'requires' | 'conflicts' | 'optional';
}

/**
 * Risk assessment
 */
export interface RiskAssessment {
    type: 'breaking' | 'test' | 'performance' | 'security' | 'high_impact' | 'data_loss' | 'large_file' | 'dependency_complexity';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    mitigation?: string;
}

/**
 * Execution graph
 */
export interface ExecutionGraph {
    nodes: ExecutionNode[];
    edges: ExecutionEdge[];
    parallelGroups?: string[][];
}

/**
 * Execution node
 */
export interface ExecutionNode {
    id: string;
    type: AgentType;
    changeId?: string;
    input: any;
    dependencies: string[];
    status?: string;
}

/**
 * Execution edge
 */
export interface ExecutionEdge {
    from: string;
    to: string;
    type?: string;
}

// ============================================================================
// Reviewer Agent Types
// ============================================================================

/**
 * Review result
 */
export interface ReviewResult {
    filePath: string;
    issues: CodeIssue[];
    fixes: CodeFix[];
    metrics: QualityMetrics;
    passed: boolean;
    summary: string;
}

/**
 * Code issue
 */
export interface CodeIssue {
    id?: string;
    type: 'error' | 'warning' | 'info' | 'suggestion';
    severity: 'critical' | 'high' | 'medium' | 'low' | 'error' | 'warning' | 'info';
    message: string;
    filePath: string;
    line?: number;
    column?: number;
    code?: string;
    category?: string;
    fixable: boolean;
}

/**
 * Code fix
 */
export interface CodeFix {
    issueId: string;
    description: string;
    diff: FileDiff;
    confidence: number;
}

/**
 * Quality metrics
 */
export interface QualityMetrics {
    complexity: number;
    maintainability: number;
    testCoverage: number;
    duplication: number;
    documentation: number;
}

/**
 * Check result
 */
export interface CheckResult {
    check: string;
    passed: boolean;
    message?: string;
    details?: any;
    type?: string;
    status?: string;
    output?: string;
    durationMs?: number;
    issues?: CodeIssue[];
}

// ============================================================================
// Testing Agent Types
// ============================================================================

/**
 * Testing result
 */
export interface TestingResult {
    success: boolean;
    generated?: GeneratedTest[];
    execution?: TestExecutionResult[];
    tests: GeneratedTest[];
    executionResults: TestExecutionResult[];
    coverage: CoverageReport;
    summary: {
        total: number;
        passed: number;
        failed: number;
        skipped: number;
    };
}

/**
 * Generated test
 */
export interface GeneratedTest {
    id: string;
    name: string;
    code: string;
    filePath: string;
    type: 'unit' | 'integration' | 'e2e';
    testType?: string;
    fixtures?: string[];
}

/**
 * Test execution result
 */
export interface TestExecutionResult {
    testId: string;
    success: boolean;
    durationMs: number;
    total?: number;
    passed?: number;
    failed?: number;
    skipped?: number;
    failures?: string[];
    output?: string;
    error?: string;
}

/**
 * Coverage report
 */
export interface CoverageReport {
    overall: number;
    files: FileCoverage[];
    byFile?: Record<string, number>;
    byFunction?: Record<string, number>;
}

/**
 * File coverage
 */
export interface FileCoverage {
    filePath: string;
    lines: number;
    covered: number;
    percentage: number;
}

/**
 * Test fixture
 */
export interface TestFixture {
    name: string;
    data: any;
    input?: any;
    expectedOutput?: any;
    description?: string;
    filePath?: string;
}

/**
 * Agent interface
 */
export interface Agent {
    id: string;
    name: string;
    status: AgentStatus;
    execute(task: AgentTask): Promise<AgentTaskResult>;
    canHandle(task: AgentTask): boolean;
    dispose?(): void;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
    id?: string;
    type?: AgentType;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    timeoutMs?: number;
    maxRetries?: number;
    parallel?: boolean;
    model?: string;
    maxConcurrentTasks?: number;
    taskTimeout?: number;
    retryAttempts?: number;
    logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Agent capabilities
 */
export interface AgentCapabilities {
    canAnalyze: boolean;
    canEdit: boolean;
    canReview: boolean;
    canTest: boolean;
    canPlan: boolean;
    supportedLanguages?: string[];
}

/**
 * User request
 */
export interface UserRequest {
    id: string;
    type: 'edit' | 'analyze' | 'review' | 'test' | 'chat' | 'plan';
    description: string;
    context?: {
        files?: string[];
        selection?: any;
        workspace?: string;
    };
    preferences?: {
        autoApply?: boolean;
        parallelStrategies?: boolean;
        runTests?: boolean;
    };
}

/**
 * Workflow stage
 */
export interface WorkflowStage {
    id: string;
    name: string;
    agentType: AgentType;
    dependsOn?: string[];
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    result?: AgentResult;
    startTime?: number;
    endTime?: number;
}

/**
 * Execution workflow
 */
export interface ExecutionWorkflow {
    id: string;
    request: UserRequest;
    stages: WorkflowStage[];
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime: number;
    endTime?: number;
    artifacts: WorkflowArtifact[];
}

/**
 * Workflow artifact
 */
export interface WorkflowArtifact {
    type: 'diff' | 'test' | 'review' | 'plan' | 'discovery' | 'code' | 'document';
    content: unknown;
    createdAt: number;
    agentId?: string;
}

/**
 * Task assign payload
 */
export interface TaskAssignPayload {
    taskId: string;
    taskType: string;
    input: any;
    timeout?: number;
}

/**
 * Task complete payload
 */
export interface TaskCompletePayload {
    taskId: string;
    result: AgentResult;
    executionTimeMs: number;
}

/**
 * Spawn decision
 */
export interface SpawnDecision {
    agents: AgentType[];
    strategy: 'sequential' | 'parallel' | 'mixed';
    priority: AgentPriority;
    reasoning?: string;
}

/**
 * Agent event listener
 */
export type AgentEventListener = (event: AgentEvent) => void;

/**
 * Agent priority (legacy)
 */
export type AgentPriorityLevel = AgentPriority;
