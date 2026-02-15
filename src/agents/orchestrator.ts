/**
 * Orchestrator Agent
 * Координирует workflow между всеми агентами
 */

import * as vscode from 'vscode';
import { BaseAgent, AgentRegistry } from './baseAgent';
import {
    AgentType,
    AgentMessage,
    AgentStatus,
    UserRequest,
    ExecutionWorkflow,
    WorkflowStage,
    SpawnDecision,
    AgentResult,
    TaskAssignPayload,
    TaskCompletePayload,
} from './types';
import { FileDiscoveryAgent } from './fileDiscoveryAgent';
import { PlannerAgent } from './plannerAgent';
import { EditorAgent } from './editorAgent';
import { ReviewerAgent } from './reviewerAgent';
import { TestingAgent } from './testingAgent';

/**
 * Опции для OrchestratorAgent
 */
export interface OrchestratorOptions {
    vscodeContext: {
        workspace: typeof vscode.workspace;
        window: typeof vscode.window;
    };
    registry: AgentRegistry;
    maxConcurrentAgents?: number;
}

/**
 * Результат workflow
 */
export interface WorkflowResult {
    workflowId: string;
    success: boolean;
    stages: WorkflowStageResult[];
    artifacts: WorkflowArtifact[];
    executionTimeMs: number;
}

/**
 * Результат этапа workflow
 */
export interface WorkflowStageResult {
    stageId: string;
    agentType: AgentType;
    status: 'success' | 'failure' | 'skipped';
    executionTimeMs: number;
    error?: string;
}

/**
 * Артефакт workflow
 */
export interface WorkflowArtifact {
    type: 'diff' | 'test' | 'review' | 'plan' | 'discovery';
    content: unknown;
    createdAt: number;
}

/**
 * Orchestrator Agent - координатор всей системы
 */
export class OrchestratorAgent extends BaseAgent {
    private vscodeContext: OrchestratorOptions['vscodeContext'];
    private registry: AgentRegistry;
    private activeWorkflows = new Map<string, ExecutionWorkflow>();
    private maxConcurrentAgents: number;
    private runningAgents = new Set<string>();
    
    constructor(options: OrchestratorOptions) {
        super({
            type: 'orchestrator',
            priority: 'critical',
            parallel: true,
        });
        
        this.vscodeContext = options.vscodeContext;
        this.registry = options.registry;
        this.maxConcurrentAgents = options.maxConcurrentAgents ?? 5;
    }
    
    /**
     * Обработка запроса пользователя
     */
    async processRequest(request: UserRequest): Promise<WorkflowResult> {
        const startTime = Date.now();
        
        // Create workflow
        const workflow = this.createWorkflow(request);
        this.activeWorkflows.set(workflow.id, workflow);
        
        try {
            // Step 1: Decide which agents to spawn
            const decision = await this.makeSpawnDecision(request);
            this.log('Spawn decision:', decision);
            
            // Step 2: Execute workflow based on decision
            const results = await this.executeWorkflow(workflow, decision);
            
            // Step 3: Gather results
            const artifacts = await this.gatherArtifacts(workflow.id);
            
            return {
                workflowId: workflow.id,
                success: results.every(r => r.status === 'success'),
                stages: results,
                artifacts,
                executionTimeMs: Date.now() - startTime,
            };
            
        } finally {
            this.activeWorkflows.delete(workflow.id);
        }
    }
    
    /**
     * Создание workflow
     */
    private createWorkflow(request: UserRequest): ExecutionWorkflow {
        return {
            id: `workflow_${Date.now()}`,
            requestId: request.id,
            stages: [],
            status: 'pending',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
    }
    
    /**
     * Принятие решения о создании агентов
     */
    private async makeSpawnDecision(request: UserRequest): Promise<SpawnDecision> {
        const description = request.description.toLowerCase();
        
        // Analyze request to determine required agents
        const agents: AgentType[] = [];
        let strategy: SpawnDecision['strategy'] = 'sequential';
        
        // Always include file discovery for codebase changes
        if (this.needsFileDiscovery(description)) {
            agents.push('fileDiscovery');
        }
        
        // Include planner for complex changes
        if (this.needsPlanner(description)) {
            agents.push('planner');
        }
        
        // Include editor for code changes
        if (this.needsEditor(description)) {
            agents.push('editor');
        }
        
        // Include reviewer for quality assurance
        if (this.needsReviewer(description)) {
            agents.push('reviewer');
        }
        
        // Include testing for test generation
        if (this.needsTesting(description)) {
            agents.push('testing');
        }
        
        // Determine strategy based on request complexity
        if (agents.length >= 3) {
            strategy = ' DAG'; // Use dependency graph for complex workflows
        } else if (agents.length === 2 && agents.includes('fileDiscovery')) {
            strategy = 'parallel'; // Can run discovery in parallel with some tasks
        }
        
        return {
            agents,
            parallel: strategy !== 'sequential',
            strategy,
            reasoning: `Spawned ${agents.join(', ')} based on request analysis`,
        };
    }
    
    /**
     * Выполнение workflow
     */
    private async executeWorkflow(
        workflow: ExecutionWorkflow,
        decision: SpawnDecision
    ): Promise<WorkflowStageResult[]> {
        workflow.status = 'running';
        const results: WorkflowStageResult[] = [];
        
        switch (decision.strategy) {
            case 'sequential':
                results.push(...await this.executeSequential(workflow, decision.agents));
                break;
            case 'parallel':
                results.push(...await this.executeParallel(workflow, decision.agents));
                break;
            case ' DAG':
                results.push(...await this.executeDAG(workflow, decision.agents));
                break;
        }
        
        workflow.status = results.every(r => r.status === 'success') ? 'completed' : 'failed';
        return results;
    }
    
    /**
     * Последовательное выполнение
     */
    private async executeSequential(
        workflow: ExecutionWorkflow,
        agentTypes: AgentType[]
    ): Promise<WorkflowStageResult[]> {
        const results: WorkflowStageResult[] = [];
        let previousResult: unknown;
        
        for (const agentType of agentTypes) {
            const result = await this.executeAgent(agentType, workflow, previousResult);
            results.push(result);
            
            if (result.status !== 'success') {
                break;
            }
            
            previousResult = result;
        }
        
        return results;
    }
    
    /**
     * Параллельное выполнение
     */
    private async executeParallel(
        workflow: ExecutionWorkflow,
        agentTypes: AgentType[]
    ): Promise<WorkflowStageResult[]> {
        const promises = agentTypes.map(agentType => 
            this.executeAgent(agentType, workflow, undefined)
        );
        
        return Promise.all(promises);
    }
    
    /**
     * Выполнение с использованием DAG (dependency graph)
     */
    private async executeDAG(
        workflow: ExecutionWorkflow,
        agentTypes: AgentType[]
    ): Promise<WorkflowStageResult[]> {
        const results: WorkflowStageResult[] = [];
        const completed = new Map<AgentType, unknown>();
        
        // Define dependencies
        const dependencies: Record<AgentType, AgentType[]> = {
            fileDiscovery: [],
            planner: ['fileDiscovery'],
            editor: ['planner'],
            reviewer: ['editor'],
            testing: ['editor'],
            orchestrator: [],
        };
        
        // Execute in waves based on dependencies
        const remaining = new Set(agentTypes);
        
        while (remaining.size > 0) {
            // Find agents that can run now (all dependencies satisfied)
            const ready = Array.from(remaining).filter(agent => {
                const deps = dependencies[agent] ?? [];
                return deps.every(dep => !remaining.has(dep));
            });
            
            if (ready.length === 0) {
                throw new Error('Circular dependency detected');
            }
            
            // Execute ready agents in parallel
            const promises = ready.map(async agentType => {
                const depResults = dependencies[agentType]?.map(d => completed.get(d));
                return this.executeAgent(agentType, workflow, depResults);
            });
            
            const waveResults = await Promise.all(promises);
            results.push(...waveResults);
            
            // Mark as completed
            for (let i = 0; i < ready.length; i++) {
                remaining.delete(ready[i]);
                // Store result for dependent agents
                // Note: In real implementation, store actual result
            }
        }
        
        return results;
    }
    
    /**
     * Выполнение конкретного агента
     */
    private async executeAgent(
        agentType: AgentType,
        workflow: ExecutionWorkflow,
        input: unknown
    ): Promise<WorkflowStageResult> {
        const stage: WorkflowStage = {
            id: `stage_${agentType}_${Date.now()}`,
            name: agentType,
            agentType,
            dependencies: [],
            status: 'running',
            inputs: { input },
        };
        
        workflow.stages.push(stage);
        const startTime = Date.now();
        
        try {
            // Spawn and execute agent
            const agent = this.spawnAgent(agentType);
            await agent.initialize();
            
            this.runningAgents.add(agent.id);
            
            const result = await agent.execute(input);
            
            this.runningAgents.delete(agent.id);
            
            stage.status = result.success ? 'completed' : 'error';
            stage.outputs = result.data;
            
            // Cleanup agent
            await agent.dispose();
            
            return {
                stageId: stage.id,
                agentType,
                status: result.success ? 'success' : 'failure',
                executionTimeMs: Date.now() - startTime,
                error: result.error?.message,
            };
            
        } catch (error) {
            stage.status = 'error';
            return {
                stageId: stage.id,
                agentType,
                status: 'failure',
                executionTimeMs: Date.now() - startTime,
                error: String(error),
            };
        }
    }
    
    /**
     * Создание агента по типу
     */
    private spawnAgent(agentType: AgentType): BaseAgent {
        switch (agentType) {
            case 'fileDiscovery':
                return new FileDiscoveryAgent({
                    vscodeContext: this.vscodeContext,
                    model: 'kimi-k2.5-lite',
                }) as unknown as BaseAgent;
            case 'planner':
                return new PlannerAgent({
                    vscodeContext: this.vscodeContext,
                }) as unknown as BaseAgent;
            case 'editor':
                return new EditorAgent({
                    vscodeContext: this.vscodeContext,
                }) as unknown as BaseAgent;
            case 'reviewer': {
                const vscode = require('vscode');
                return new ReviewerAgent({
                    vscodeContext: {
                        workspace: this.vscodeContext.workspace,
                        window: this.vscodeContext.window,
                        languages: vscode.languages,
                    },
                }) as unknown as BaseAgent;
            }
            case 'testing':
                return new TestingAgent({
                    vscodeContext: this.vscodeContext,
                }) as unknown as BaseAgent;
            default:
                throw new Error(`Unknown agent type: ${agentType}`);
        }
    }
    
    /**
     * Сбор артефактов
     */
    private async gatherArtifacts(workflowId: string): Promise<WorkflowArtifact[]> {
        // In real implementation, gather from all stages
        return [];
    }
    
    // ============================================================================
    // Request Analysis Helpers
    // ============================================================================
    
    private needsFileDiscovery(description: string): boolean {
        const keywords = ['find', 'search', 'locate', 'discover', 'where', 'file', 'codebase'];
        return keywords.some(k => description.includes(k));
    }
    
    private needsPlanner(description: string): boolean {
        const keywords = ['plan', 'organize', 'structure', 'refactor', 'implement', 'create', 'add'];
        return keywords.some(k => description.includes(k));
    }
    
    private needsEditor(description: string): boolean {
        const keywords = ['edit', 'change', 'modify', 'fix', 'update', 'implement', 'write', 'create'];
        return keywords.some(k => description.includes(k));
    }
    
    private needsReviewer(description: string): boolean {
        const keywords = ['review', 'check', 'validate', 'quality', 'improve'];
        return keywords.some(k => description.includes(k));
    }
    
    private needsTesting(description: string): boolean {
        const keywords = ['test', 'testing', 'spec', 'verify', 'coverage'];
        return keywords.some(k => description.includes(k));
    }
    
    // ============================================================================
    // Abstract Method Implementations
    // ============================================================================
    
    protected async onInitialize(): Promise<void> {
        // Orchestrator is always ready
    }
    
    protected async onExecute<TInput, TOutput>(
        input: TInput,
        signal: AbortSignal
    ): Promise<TOutput> {
        if (signal.aborted) {
            throw new Error('Execution aborted');
        }
        
        // Orchestrator doesn't execute directly, it coordinates
        return undefined as TOutput;
    }
    
    protected onMessage<T>(message: AgentMessage<T>): void {
        this.log('Received message:', message);
        
        switch (message.type) {
            case 'task.complete':
                this.handleTaskComplete(message.payload as TaskCompletePayload);
                break;
            case 'status.update':
                this.handleStatusUpdate(message);
                break;
            case 'error.report':
                this.handleErrorReport(message);
                break;
        }
    }
    
    protected async onCancel(): Promise<void> {
        // Cancel all running agents
        for (const agentId of Array.from(this.runningAgents)) {
            const agent = this.registry.get(agentId);
            if (agent) {
                await agent.cancel();
            }
        }
        this.runningAgents.clear();
    }
    
    protected async onDispose(): Promise<void> {
        this.activeWorkflows.clear();
    }
    
    // ============================================================================
    // Message Handlers
    // ============================================================================
    
    private handleTaskComplete(payload: TaskCompletePayload): void {
        this.log('Task completed:', payload.taskId);
        // Update workflow state
    }
    
    private handleStatusUpdate(message: AgentMessage): void {
        this.log('Status update from', message.from);
    }
    
    private handleErrorReport(message: AgentMessage): void {
        console.error('Error from', message.from, message.payload);
    }
}
