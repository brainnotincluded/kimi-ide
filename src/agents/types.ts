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
