/**
 * Planner Agent
 * Создаёт план изменений с определением зависимостей
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { BaseAgent } from './baseAgent';
import {
    AgentType,
    AgentMessage,
    ChangePlan,
    PlannedChange,
    ChangeDependency,
    RiskAssessment,
    ExecutionGraph,
    ExecutionNode,
    ExecutionEdge,
    RankedFile,
} from './types';

/**
 * Опции для PlannerAgent
 */
export interface PlannerOptions {
    vscodeContext: {
        workspace: typeof vscode.workspace;
    };
}

/**
 * Запрос на планирование
 */
export interface PlanningRequest {
    description: string;
    files: RankedFile[];
    context?: {
        currentFile?: string;
        selection?: string;
    };
    constraints?: {
        readonly?: boolean;
        maxChanges?: number;
    };
}

/**
 * Planner Agent - создаёт план изменений
 */
export class PlannerAgent extends BaseAgent {
    private vscodeContext: PlannerOptions['vscodeContext'];
    
    constructor(options: PlannerOptions) {
        super({
            type: 'planner',
            priority: 'high',
            timeoutMs: 60000,
        });
        
        this.vscodeContext = options.vscodeContext;
    }
    
    /**
     * Создание плана изменений
     */
    async createPlan(request: PlanningRequest): Promise<ChangePlan> {
        return this.execute<PlanningRequest, ChangePlan>(request).then(r => r.data!);
    }
    
    /**
     * Выполнение планирования
     */
    protected async onExecute<TInput, TOutput>(
        input: TInput,
        signal: AbortSignal
    ): Promise<TOutput> {
        const request = input as unknown as PlanningRequest;
        const startTime = Date.now();
        
        // Step 1: Analyze request and files
        const analysis = await this.analyzeRequest(request);
        
        if (signal.aborted) {
            throw new Error('Planning aborted');
        }
        
        // Step 2: Generate planned changes
        const changes = await this.generateChanges(request, analysis);
        
        if (signal.aborted) {
            throw new Error('Planning aborted');
        }
        
        // Step 3: Build dependency graph
        const dependencies = this.buildDependencies(changes);
        
        // Step 4: Assess risks
        const risks = this.assessRisks(changes, request.files);
        
        // Step 5: Create execution graph
        const executionGraph = this.buildExecutionGraph(changes, dependencies);
        
        return {
            id: `plan_${Date.now()}`,
            description: request.description,
            changes,
            dependencies,
            estimatedTimeMs: this.estimateTime(changes),
            risks,
        } as TOutput;
    }
    
    /**
     * Анализ запроса
     */
    private async analyzeRequest(request: PlanningRequest): Promise<RequestAnalysis> {
        const analysis: RequestAnalysis = {
            changeType: this.determineChangeType(request.description),
            affectedAreas: [],
            complexity: 'low',
            requiresTests: false,
            requiresDocs: false,
        };
        
        const req = request as PlanningRequest;
        
        // Analyze description for change type
        const desc = req.description.toLowerCase();
        
        if (desc.includes('refactor') || desc.includes('restructure')) {
            analysis.changeType = 'refactor';
            analysis.complexity = 'high';
        } else if (desc.includes('fix') || desc.includes('bug')) {
            analysis.changeType = 'fix';
            analysis.complexity = 'medium';
        } else if (desc.includes('feature') || desc.includes('add') || desc.includes('implement')) {
            analysis.changeType = 'feature';
            analysis.complexity = 'high';
        } else if (desc.includes('test') || desc.includes('spec')) {
            analysis.changeType = 'test';
            analysis.requiresTests = true;
        } else if (desc.includes('doc') || desc.includes('comment')) {
            analysis.changeType = 'docs';
            analysis.requiresDocs = true;
        }
        
        // Determine affected areas from files
        const directories = new Set<string>();
        for (const file of request.files) {
            const dir = path.dirname(file.path);
            directories.add(dir);
        }
        analysis.affectedAreas = Array.from(directories);
        
        // Estimate complexity based on number of files
        if (request.files.length > 10) {
            analysis.complexity = 'high';
        } else if (request.files.length > 5) {
            analysis.complexity = 'medium';
        }
        
        // Check if tests are needed
        if (analysis.changeType === 'feature' || analysis.changeType === 'fix') {
            analysis.requiresTests = true;
        }
        
        return analysis;
    }
    
    /**
     * Определение типа изменения
     */
    private determineChangeType(description: string): ChangeType {
        const desc = description.toLowerCase();
        
        if (desc.includes('create') || desc.includes('add') && desc.includes('new')) {
            return 'create';
        } else if (desc.includes('delete') || desc.includes('remove')) {
            return 'delete';
        } else if (desc.includes('rename') || desc.includes('move')) {
            return 'rename';
        }
        
        return 'modify';
    }
    
    /**
     * Генерация запланированных изменений
     */
    private async generateChanges(
        request: PlanningRequest,
        analysis: RequestAnalysis
    ): Promise<PlannedChange[]> {
        const changes: PlannedChange[] = [];
        let order = 0;
        
        // Group files by directory for logical ordering
        const filesByDir = this.groupFilesByDirectory(request.files);
        
        for (const [dir, files] of Array.from(filesByDir.entries())) {
            // Sort files by relevance score
            files.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
            
            for (const file of files) {
                if (request.constraints?.maxChanges && changes.length >= request.constraints.maxChanges) {
                    break;
                }
                
                const changeType = this.inferChangeType(file, request.description);
                const change: PlannedChange = {
                    id: `change_${changes.length}_${Date.now()}`,
                    filePath: file.path,
                    changeType,
                    description: this.generateChangeDescription(file, request.description),
                    dependencies: [],
                    order: order++,
                    estimatedImpact: this.estimateImpact(file, analysis),
                    rollbackStrategy: this.determineRollbackStrategy(file, changeType),
                };
                
                changes.push(change);
            }
        }
        
        // Update dependencies based on order and file relationships
        this.updateChangeDependencies(changes);
        
        return changes;
    }
    
    /**
     * Группировка файлов по директориям
     */
    private groupFilesByDirectory(files: RankedFile[]): Map<string, RankedFile[]> {
        const groups = new Map<string, RankedFile[]>();
        
        for (const file of files) {
            const dir = path.dirname(file.path);
            if (!groups.has(dir)) {
                groups.set(dir, []);
            }
            groups.get(dir)!.push(file);
        }
        
        return groups;
    }
    
    /**
     * Определение типа изменения для файла
     */
    private inferChangeType(file: RankedFile, description: string): PlannedChange['changeType'] {
        const desc = description.toLowerCase();
        const filename = path.basename(file.path).toLowerCase();
        
        // Check for new file creation
        if (desc.includes('create') && (file.relevanceScore || 0) < 0.3) {
            return 'create';
        }
        
        // Check for file deletion
        if (desc.includes('delete') || desc.includes('remove')) {
            return 'delete';
        }
        
        // Check for rename
        if (desc.includes('rename') || desc.includes('move to')) {
            return 'rename';
        }
        
        // Default to modify
        return 'modify';
    }
    
    /**
     * Генерация описания изменения
     */
    private generateChangeDescription(file: RankedFile, description: string): string {
        const filename = path.basename(file.path);
        
        // Extract action from description
        const actions = ['implement', 'add', 'fix', 'update', 'refactor', 'optimize', 'modify'];
        let action = 'modify';
        
        for (const a of actions) {
            if (description.toLowerCase().includes(a)) {
                action = a;
                break;
            }
        }
        
        return `${action} ${filename}: ${description.slice(0, 100)}`;
    }
    
    /**
     * Оценка влияния изменения
     */
    private estimateImpact(
        file: RankedFile,
        analysis: RequestAnalysis
    ): PlannedChange['estimatedImpact'] {
        // High impact for core files
        const filename = path.basename(file.path);
        
        if (filename.includes('index') || filename.includes('main') || filename.includes('core')) {
            return 'high';
        }
        
        // Medium impact for files with many symbols
        if (file.symbols && file.symbols.length > 10) {
            return 'medium';
        }
        
        // High complexity means high impact
        if (analysis.complexity === 'high') {
            return 'high';
        }
        
        return 'low';
    }
    
    /**
     * Определение стратегии отката
     */
    private determineRollbackStrategy(
        file: RankedFile,
        changeType: PlannedChange['changeType']
    ): string {
        switch (changeType) {
            case 'create':
                return `Delete ${path.basename(file.path)}`;
            case 'delete':
                return `Restore from git: git checkout HEAD -- ${file.path}`;
            case 'rename':
                return `Rename back to original name`;
            case 'modify':
                return `git checkout HEAD -- ${file.path}`;
            default:
                return 'Manual revert required';
        }
    }
    
    /**
     * Обновление зависимостей между изменениями
     */
    private updateChangeDependencies(changes: PlannedChange[]): void {
        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];
            
            // Check for dependencies based on file relationships
            for (let j = 0; j < changes.length; j++) {
                if (i === j) continue;
                
                const other = changes[j];
                
                // Same directory dependency (lower order depends on higher order)
                if (path.dirname(change.filePath) === path.dirname(other.filePath)) {
                    if ((change.order || 0) > (other.order || 0)) {
                        change.dependencies!.push(other.id);
                    }
                }
                
                // Type definition files should be modified first
                if (other.filePath.endsWith('.d.ts') && !change.filePath.endsWith('.d.ts')) {
                    if (!change.dependencies!.includes(other.id)) {
                        change.dependencies!.push(other.id);
                    }
                }
            }
        }
    }
    
    /**
     * Построение графа зависимостей
     */
    private buildDependencies(changes: PlannedChange[]): ChangeDependency[] {
        const dependencies: ChangeDependency[] = [];
        
        for (const change of changes) {
            for (const depId of change.dependencies || []) {
                const dep = changes.find(c => c.id === depId);
                if (dep) {
                    dependencies.push({
                        from: change.id,
                        to: depId,
                        type: 'requires',
                    });
                }
            }
        }
        
        // Detect conflicts
        const filePaths = new Map<string, string[]>();
        for (const change of changes) {
            if (!filePaths.has(change.filePath)) {
                filePaths.set(change.filePath, []);
            }
            filePaths.get(change.filePath)!.push(change.id);
        }
        
        for (const [_, changeIds] of Array.from(filePaths.entries())) {
            if (changeIds.length > 1) {
                // Multiple changes to same file
                for (let i = 1; i < changeIds.length; i++) {
                    dependencies.push({
                        from: changeIds[i],
                        to: changeIds[0],
                        type: 'conflicts',
                    });
                }
            }
        }
        
        return dependencies;
    }
    
    /**
     * Оценка рисков
     */
    private assessRisks(changes: PlannedChange[], files: RankedFile[]): RiskAssessment[] {
        const risks: RiskAssessment[] = [];
        
        // Check for high-impact changes
        const highImpactChanges = changes.filter(c => c.estimatedImpact === 'high');
        if (highImpactChanges.length > 0) {
            risks.push({
                type: 'high_impact',
                severity: 'high',
                description: `${highImpactChanges.length} high-impact changes may affect system stability`,
                mitigation: 'Review changes carefully and run full test suite',
            });
        }
        
        // Check for file deletions
        const deletions = changes.filter(c => c.changeType === 'delete');
        if (deletions.length > 0) {
            risks.push({
                type: 'data_loss',
                severity: 'high',
                description: `${deletions.length} files will be deleted`,
                mitigation: 'Ensure backups exist and verify no dependencies remain',
            });
        }
        
        // Check for large changes
        const largeFiles = files.filter(f => f.size > 50000);
        if (largeFiles.length > 0) {
            risks.push({
                type: 'large_file',
                severity: 'medium',
                description: `${largeFiles.length} large files (>50KB) may be difficult to review`,
                mitigation: 'Consider breaking changes into smaller chunks',
            });
        }
        
        // Check for dependency complexity
        const complexDeps = changes.filter(c => (c.dependencies || []).length > 5);
        if (complexDeps.length > 0) {
            risks.push({
                type: 'dependency_complexity',
                severity: 'medium',
                description: `${complexDeps.length} changes have complex dependencies`,
                mitigation: 'Review dependency graph for circular dependencies',
            });
        }
        
        return risks;
    }
    
    /**
     * Построение графа выполнения
     */
    private buildExecutionGraph(
        changes: PlannedChange[],
        dependencies: ChangeDependency[]
    ): ExecutionGraph {
        const nodes: ExecutionNode[] = changes.map(c => ({
            id: c.id,
            type: 'editor',
            changeId: c.id,
            input: {},
            dependencies: c.dependencies || [],
            status: 'pending',
        }));
        
        const edges: ExecutionEdge[] = dependencies
            .filter(d => d.type === 'requires')
            .map(d => ({
                from: d.from,
                to: d.to,
                type: 'dependency',
            }));
        
        // Add sequence edges for same-order items
        for (let i = 0; i < changes.length - 1; i++) {
            if (changes[i].order === changes[i + 1].order) {
                edges.push({
                    from: changes[i].id,
                    to: changes[i + 1].id,
                    type: 'sequence',
                });
            }
        }
        
        // Build parallel groups (independent changes)
        const parallelGroups = this.findParallelGroups(changes, dependencies);
        
        return { nodes, edges, parallelGroups };
    }
    
    /**
     * Поиск параллельных групп
     */
    private findParallelGroups(
        changes: PlannedChange[],
        dependencies: ChangeDependency[]
    ): string[][] {
        const groups: string[][] = [];
        const processed = new Set<string>();
        
        for (const change of changes) {
            if (processed.has(change.id)) continue;
            
            // Find all changes that can run in parallel with this one
            const group = [change.id];
            processed.add(change.id);
            
            for (const other of changes) {
                if (processed.has(other.id)) continue;
                if (other.id === change.id) continue;
                
                // Check if they're independent
                const hasDep = dependencies.some(
                    d => (d.from === change.id && d.to === other.id) ||
                         (d.from === other.id && d.to === change.id)
                );
                
                if (!hasDep) {
                    group.push(other.id);
                    processed.add(other.id);
                }
            }
            
            if (group.length > 0) {
                groups.push(group);
            }
        }
        
        return groups;
    }
    
    /**
     * Оценка времени выполнения
     */
    private estimateTime(changes: PlannedChange[]): number {
        let totalMs = 0;
        
        for (const change of changes) {
            // Base time for each change
            let changeTime = 5000;
            
            // Add time based on impact
            switch (change.estimatedImpact) {
                case 'low':
                    changeTime += 3000;
                    break;
                case 'medium':
                    changeTime += 8000;
                    break;
                case 'high':
                    changeTime += 15000;
                    break;
            }
            
            // Add time for dependencies
            changeTime += (change.dependencies || []).length * 1000;
            
            totalMs += changeTime;
        }
        
        return totalMs;
    }
    
    // ============================================================================
    // Abstract Method Implementations
    // ============================================================================
    
    protected async onInitialize(): Promise<void> {
        // Planner is ready immediately
    }
    
    protected onMessage(message: AgentMessage): void {
        this.log('Received message:', message.type);
    }
    
    protected async onCancel(): Promise<void> {
        // Cleanup if needed
    }
    
    protected async onDispose(): Promise<void> {
        // Cleanup if needed
    }
}

// ============================================================================
// Helper Types
// ============================================================================

type ChangeType = 'create' | 'modify' | 'delete' | 'rename';

interface RequestAnalysis {
    changeType: ChangeType | 'refactor' | 'fix' | 'feature' | 'test' | 'docs';
    affectedAreas: string[];
    complexity: 'low' | 'medium' | 'high';
    requiresTests: boolean;
    requiresDocs: boolean;
}
