/**
 * Editor Agent
 * Выполняет изменения кода с поддержкой 3 параллельных стратегий
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as ts from 'typescript';
import { BaseAgent } from './baseAgent';
import {
    AgentType,
    AgentMessage,
    EditResult,
    EditRequest,
    EditStrategy,
    EditStrategyResult,
    FileDiff,
    DiffHunk,
    DiffLine,
} from './types';

/**
 * Опции для EditorAgent
 */
export interface EditorOptions {
    vscodeContext: {
        workspace: typeof vscode.workspace;
        window: typeof vscode.window;
    };
}

/**
 * Editor Agent - выполняет изменения кода
 */
export class EditorAgent extends BaseAgent {
    private vscodeContext: EditorOptions['vscodeContext'];
    private tsProgram?: ts.Program;
    
    constructor(options: EditorOptions) {
        super({
            type: 'editor',
            priority: 'high',
            timeoutMs: 120000,
            parallel: true,
        });
        
        this.vscodeContext = options.vscodeContext;
    }
    
    /**
     * Выполнение редактирования
     */
    async edit(request: EditRequest): Promise<EditResult> {
        return this.execute<EditRequest, EditResult>(request).then(r => r.data!);
    }
    
    /**
     * Выполнение изменений
     */
    protected async onExecute<TInput, TOutput>(
        input: TInput,
        signal: AbortSignal
    ): Promise<TOutput> {
        const request = input as unknown as EditRequest;
        const req = request as EditRequest;
        const strategies = req.strategies ?? this.getDefaultStrategies();
        const startTime = Date.now();
        
        // Execute all strategies in parallel
        const strategyResults = await Promise.all(
            strategies.map(strategy => 
                this.executeStrategy(strategy, request, signal)
                    .catch(error => ({
                        strategy,
                        success: false,
                        diff: this.createEmptyDiff(request.filePath),
                        score: 0,
                        executionTimeMs: 0,
                        error: String(error),
                    }))
            )
        );
        
        if (signal.aborted) {
            throw new Error('Editing aborted');
        }
        
        // Select best strategy
        const bestResult = this.selectBestStrategy(strategyResults);
        
        return {
            filePath: request.filePath,
            success: bestResult.success,
            strategies: strategyResults,
            selectedStrategy: bestResult.strategy,
            diff: bestResult.diff,
            error: bestResult.error,
        } as TOutput;
    }
    
    /**
     * Получение стратегий по умолчанию
     */
    private getDefaultStrategies(): EditStrategy[] {
        return ['ast.transform', 'text.replace', 'semantic.patch'];
    }
    
    /**
     * Выполнение конкретной стратегии
     */
    private async executeStrategy(
        strategy: EditStrategy,
        request: EditRequest,
        signal: AbortSignal
    ): Promise<EditStrategyResult> {
        const startTime = Date.now();
        
        try {
            let diff: FileDiff;
            
            switch (strategy) {
                case 'ast.transform':
                    diff = await this.executeAstTransform(request, signal);
                    break;
                case 'text.replace':
                    diff = await this.executeTextReplace(request, signal);
                    break;
                case 'semantic.patch':
                    diff = await this.executeSemanticPatch(request, signal);
                    break;
                default:
                    throw new Error(`Unknown strategy: ${strategy}`);
            }
            
            const score = this.scoreResult(diff, request);
            
            return {
                strategy,
                success: true,
                diff,
                score,
                executionTimeMs: Date.now() - startTime,
            };
            
        } catch (error) {
            return {
                strategy,
                success: false,
                diff: this.createEmptyDiff(request.filePath),
                score: 0,
                executionTimeMs: Date.now() - startTime,
                error: String(error),
            };
        }
    }
    
    /**
     * Стратегия 1: AST Transform (TypeScript Compiler API)
     */
    private async executeAstTransform(
        request: EditRequest,
        signal: AbortSignal
    ): Promise<FileDiff> {
        const uri = vscode.Uri.file(request.filePath);
        const document = await this.vscodeContext.workspace.openTextDocument(uri);
        const originalText = document.getText();
        
        // Only works for TypeScript/JavaScript files
        if (!this.isTypeScriptFile(request.filePath)) {
            throw new Error('AST transform only works for TypeScript/JavaScript files');
        }
        
        // Parse source file
        const sourceFile = ts.createSourceFile(
            request.filePath,
            originalText,
            ts.ScriptTarget.Latest,
            true
        );
        
        if (signal.aborted) {
            throw new Error('Aborted');
        }
        
        // Create transformation based on instruction
        const transformed = await this.transformAst(sourceFile, request.instruction);
        
        if (signal.aborted) {
            throw new Error('Aborted');
        }
        
        // Generate diff
        return this.generateDiff(request.filePath, originalText, transformed);
    }
    
    /**
     * Трансформация AST
     */
    private async transformAst(
        sourceFile: ts.SourceFile,
        instruction: string
    ): Promise<string> {
        const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
        
        // Create transformer based on instruction analysis
        const transformer = this.createTransformer(instruction);
        
        // Apply transformation
        const result = ts.transform(sourceFile, [transformer]);
        const transformed = printer.printNode(
            ts.EmitHint.Unspecified,
            result.transformed[0],
            sourceFile
        );
        
        result.dispose();
        return transformed;
    }
    
    /**
     * Создание трансформера на основе инструкции
     */
    private createTransformer(instruction: string): ts.TransformerFactory<ts.SourceFile> {
        const instructionLower = instruction.toLowerCase();
        
        return (context: ts.TransformationContext) => {
            return (sourceFile: ts.SourceFile) => {
                const visit = (node: ts.Node): ts.Node => {
                    // Handle rename refactoring
                    if (instructionLower.includes('rename')) {
                        const match = instruction.match(/rename\s+(\w+)\s+to\s+(\w+)/i);
                        if (match) {
                            const [, oldName, newName] = match;
                            if (ts.isIdentifier(node) && node.text === oldName) {
                                return ts.factory.createIdentifier(newName);
                            }
                        }
                    }
                    
                    // Handle add async
                    if (instructionLower.includes('add async')) {
                        if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node)) {
                            if (!node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword)) {
                                const asyncModifier = ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword);
                                const modifiers = ts.factory.createNodeArray([
                                    asyncModifier,
                                    ...(node.modifiers ?? [])
                                ]);
                                
                                if (ts.isFunctionDeclaration(node)) {
                                    return ts.factory.updateFunctionDeclaration(
                                        node,
                                        modifiers,
                                        node.asteriskToken,
                                        node.name,
                                        node.typeParameters,
                                        node.parameters,
                                        node.type,
                                        node.body
                                    );
                                }
                            }
                        }
                    }
                    
                    // Handle add export
                    if (instructionLower.includes('add export')) {
                        if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) && node.name) {
                            const hasExport = node.modifiers?.some(
                                m => m.kind === ts.SyntaxKind.ExportKeyword
                            );
                            if (!hasExport) {
                                const exportModifier = ts.factory.createModifier(ts.SyntaxKind.ExportKeyword);
                                const modifiers = ts.factory.createNodeArray([
                                    exportModifier,
                                    ...(node.modifiers ?? [])
                                ]);
                                
                                if (ts.isFunctionDeclaration(node)) {
                                    return ts.factory.updateFunctionDeclaration(
                                        node,
                                        modifiers,
                                        node.asteriskToken,
                                        node.name,
                                        node.typeParameters,
                                        node.parameters,
                                        node.type,
                                        node.body
                                    );
                                } else if (ts.isClassDeclaration(node)) {
                                    return ts.factory.updateClassDeclaration(
                                        node,
                                        modifiers,
                                        node.name,
                                        node.typeParameters,
                                        node.heritageClauses,
                                        node.members
                                    );
                                }
                            }
                        }
                    }
                    
                    return ts.visitEachChild(node, visit, context);
                };
                
                return ts.visitNode(sourceFile, visit) as ts.SourceFile;
            };
        };
    }
    
    /**
     * Стратегия 2: Text Replace
     */
    private async executeTextReplace(
        request: EditRequest,
        signal: AbortSignal
    ): Promise<FileDiff> {
        const uri = vscode.Uri.file(request.filePath);
        const document = await this.vscodeContext.workspace.openTextDocument(uri);
        const originalText = document.getText();
        
        // Load context files if provided
        const context = request.context?.relatedFiles ?? [];
        
        // Simple text-based replacement using patterns
        let modifiedText = originalText;
        
        // Extract patterns from instruction
        const patterns = this.extractPatterns(request.instruction);
        
        for (const pattern of patterns) {
            if (signal.aborted) {
                throw new Error('Aborted');
            }
            
            modifiedText = modifiedText.replace(pattern.search, pattern.replace);
        }
        
        // If no patterns matched, try line-based replacement
        if (modifiedText === originalText) {
            modifiedText = this.tryLineBasedReplace(originalText, request.instruction);
        }
        
        return this.generateDiff(request.filePath, originalText, modifiedText);
    }
    
    /**
     * Извлечение паттернов из инструкции
     */
    private extractPatterns(instruction: string): Array<{ search: RegExp; replace: string }> {
        const patterns: Array<{ search: RegExp; replace: string }> = [];
        
        // Pattern: replace X with Y
        const replaceMatch = instruction.match(/replace\s+['"`]?([^'"`]+)['"`]?\s+with\s+['"`]?([^'"`]+)['"`]?/i);
        if (replaceMatch) {
            patterns.push({
                search: new RegExp(this.escapeRegex(replaceMatch[1]), 'g'),
                replace: replaceMatch[2],
            });
        }
        
        // Pattern: change X to Y
        const changeMatch = instruction.match(/change\s+['"`]?([^'"`]+)['"`]?\s+to\s+['"`]?([^'"`]+)['"`]?/i);
        if (changeMatch && !replaceMatch) {
            patterns.push({
                search: new RegExp(this.escapeRegex(changeMatch[1]), 'g'),
                replace: changeMatch[2],
            });
        }
        
        // Pattern: add X before Y
        const beforeMatch = instruction.match(/add\s+['"`]?([^'"`]+)['"`]?\s+before\s+['"`]?([^'"`]+)['"`]?/i);
        if (beforeMatch) {
            patterns.push({
                search: new RegExp(`(${this.escapeRegex(beforeMatch[2])})`),
                replace: `${beforeMatch[1]}$1`,
            });
        }
        
        // Pattern: add X after Y
        const afterMatch = instruction.match(/add\s+['"`]?([^'"`]+)['"`]?\s+after\s+['"`]?([^'"`]+)['"`]?/i);
        if (afterMatch) {
            patterns.push({
                search: new RegExp(`(${this.escapeRegex(afterMatch[2])})`),
                replace: `$1${afterMatch[1]}`,
            });
        }
        
        // Pattern: remove X
        const removeMatch = instruction.match(/remove\s+['"`]?([^'"`]+)['"`]?/i);
        if (removeMatch) {
            patterns.push({
                search: new RegExp(this.escapeRegex(removeMatch[1]), 'g'),
                replace: '',
            });
        }
        
        return patterns;
    }
    
    /**
     * Экранирование regex
     */
    private escapeRegex(str: string): string {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    /**
     * Попытка замены на основе строк
     */
    private tryLineBasedReplace(original: string, instruction: string): string {
        const lines = original.split('\n');
        const instructionLower = instruction.toLowerCase();
        
        // Try to find relevant lines
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Check if line should be modified based on instruction keywords
            const keywords = instructionLower.split(/\s+/).filter(w => w.length > 3);
            const lineLower = line.toLowerCase();
            
            for (const keyword of keywords) {
                if (lineLower.includes(keyword)) {
                    // This line might need modification
                    // Apply heuristic transformations
                    if (instructionLower.includes('add comment')) {
                        lines[i] = `// TODO: ${instruction}\n${line}`;
                    } else if (instructionLower.includes('add type')) {
                        // Try to add type annotation
                        const match = line.match(/(const|let|var)\s+(\w+)\s*=/);
                        if (match) {
                            lines[i] = line.replace(/=/, ': any =');
                        }
                    }
                    break;
                }
            }
        }
        
        return lines.join('\n');
    }
    
    /**
     * Стратегия 3: Semantic Patch
     */
    private async executeSemanticPatch(
        request: EditRequest,
        signal: AbortSignal
    ): Promise<FileDiff> {
        const uri = vscode.Uri.file(request.filePath);
        const document = await this.vscodeContext.workspace.openTextDocument(uri);
        const originalText = document.getText();
        
        // Parse instruction to understand semantic meaning
        const semanticChange = this.parseSemanticChange(request.instruction);
        
        if (signal.aborted) {
            throw new Error('Aborted');
        }
        
        // Apply semantic transformation
        const modifiedText = this.applySemanticChange(originalText, semanticChange);
        
        return this.generateDiff(request.filePath, originalText, modifiedText);
    }
    
    /**
     * Парсинг семантического изменения
     */
    private parseSemanticChange(instruction: string): SemanticChange {
        const instructionLower = instruction.toLowerCase();
        
        // Detect change type
        let type: SemanticChange['type'] = 'modify';
        
        if (instructionLower.includes('extract') || instructionLower.includes('move')) {
            type = 'extract';
        } else if (instructionLower.includes('inline')) {
            type = 'inline';
        } else if (instructionLower.includes('rename')) {
            type = 'rename';
        } else if (instructionLower.includes('add param')) {
            type = 'add_parameter';
        } else if (instructionLower.includes('remove param')) {
            type = 'remove_parameter';
        }
        
        // Extract target
        const targetMatch = instruction.match(/(?:function|method|class|variable)\s+(\w+)/i);
        const target = targetMatch?.[1];
        
        // Extract details
        const details: Record<string, string> = {};
        
        if (type === 'rename') {
            const renameMatch = instruction.match(/rename\s+(\w+)\s+to\s+(\w+)/i);
            if (renameMatch) {
                details.oldName = renameMatch[1];
                details.newName = renameMatch[2];
            }
        }
        
        if (type === 'add_parameter') {
            const paramMatch = instruction.match(/add\s+parameter\s+(\w+)(?:\s+of\s+type\s+(\w+))?/i);
            if (paramMatch) {
                details.paramName = paramMatch[1];
                details.paramType = paramMatch[2] ?? 'any';
            }
        }
        
        return { type, target, details };
    }
    
    /**
     * Применение семантического изменения
     */
    private applySemanticChange(original: string, change: SemanticChange): string {
        switch (change.type) {
            case 'rename':
                if (change.details.oldName && change.details.newName) {
                    return original.replace(
                        new RegExp(`\\b${this.escapeRegex(change.details.oldName)}\\b`, 'g'),
                        change.details.newName
                    );
                }
                break;
                
            case 'add_parameter':
                if (change.target && change.details.paramName) {
                    // Find function and add parameter
                    const funcRegex = new RegExp(
                        `(function\s+${this.escapeRegex(change.target)}\\s*\\()([^)]*)(\\))`,
                        'g'
                    );
                    return original.replace(funcRegex, (match, prefix, params, suffix) => {
                        const newParams = params.trim() 
                            ? `${params}, ${change.details.paramName}: ${change.details.paramType}`
                            : `${change.details.paramName}: ${change.details.paramType}`;
                        return `${prefix}${newParams}${suffix}`;
                    });
                }
                break;
                
            case 'extract':
                // Extract method/variable (simplified)
                return original;
                
            default:
                return original;
        }
        
        return original;
    }
    
    /**
     * Выбор лучшей стратегии
     */
    private selectBestStrategy(results: EditStrategyResult[]): EditStrategyResult {
        // Filter successful results
        const successful = results.filter(r => r.success);
        
        if (successful.length === 0) {
            // Return first failure with error
            return results[0] ?? this.createEmptyResult();
        }
        
        // Sort by score, prefer AST transform for TypeScript
        successful.sort((a, b) => {
            // Prefer AST transform if scores are close
            if (Math.abs(b.score - a.score) < 0.1) {
                if (a.strategy === 'ast.transform') return -1;
                if (b.strategy === 'ast.transform') return 1;
            }
            return b.score - a.score;
        });
        
        return successful[0];
    }
    
    /**
     * Оценка результата
     */
    private scoreResult(diff: FileDiff, request: EditRequest): number {
        let score = 0;
        
        // Prefer changes that actually modify something
        if (diff.additions > 0 || diff.deletions > 0) {
            score += 0.5;
        }
        
        // Prefer smaller, focused changes
        const totalChanges = diff.additions + diff.deletions;
        if (totalChanges > 0 && totalChanges < 50) {
            score += 0.3;
        } else if (totalChanges >= 50 && totalChanges < 200) {
            score += 0.2;
        } else {
            score += 0.1;
        }
        
        // Check if changes are in expected areas
        if (request.context?.surroundingLines) {
            // Would check if changes are near the expected lines
            score += 0.2;
        }
        
        return Math.min(1, score);
    }
    
    /**
     * Генерация diff
     */
    private generateDiff(filePath: string, original: string, modified: string): FileDiff {
        const originalLines = original.split('\n');
        const modifiedLines = modified.split('\n');
        
        const hunks: DiffHunk[] = [];
        let oldLine = 1;
        let newLine = 1;
        
        // Simple diff algorithm
        let i = 0;
        let j = 0;
        
        while (i < originalLines.length || j < modifiedLines.length) {
            const hunkLines: DiffLine[] = [];
            let hunkOldStart = oldLine;
            let hunkNewStart = newLine;
            
            // Find next difference
            while (i < originalLines.length && j < modifiedLines.length && 
                   originalLines[i] === modifiedLines[j]) {
                hunkLines.push({
                    type: 'context',
                    content: originalLines[i],
                    oldLine: oldLine++,
                    newLine: newLine++,
                });
                i++;
                j++;
            }
            
            // Collect removed lines
            while (i < originalLines.length && 
                   (j >= modifiedLines.length || originalLines[i] !== modifiedLines[j])) {
                hunkLines.push({
                    type: 'remove',
                    content: originalLines[i],
                    oldLine: oldLine++,
                });
                i++;
            }
            
            // Collect added lines
            while (j < modifiedLines.length && 
                   (i >= originalLines.length || originalLines[i] !== modifiedLines[j])) {
                hunkLines.push({
                    type: 'add',
                    content: modifiedLines[j],
                    newLine: newLine++,
                });
                j++;
            }
            
            // Create hunk if there are changes
            const hasChanges = hunkLines.some(l => l.type !== 'context');
            if (hasChanges) {
                const contextLines = hunkLines.filter(l => l.type === 'context');
                const removedLines = hunkLines.filter(l => l.type === 'remove');
                const addedLines = hunkLines.filter(l => l.type === 'add');
                
                hunks.push({
                    oldStart: hunkOldStart,
                    oldLines: contextLines.length + removedLines.length,
                    newStart: hunkNewStart,
                    newLines: contextLines.length + addedLines.length,
                    lines: hunkLines,
                });
            }
        }
        
        const additions = hunks.reduce((sum, h) => 
            sum + h.lines.filter(l => l.type === 'add').length, 0);
        const deletions = hunks.reduce((sum, h) => 
            sum + h.lines.filter(l => l.type === 'remove').length, 0);
        
        return {
            originalPath: filePath,
            modifiedPath: filePath,
            hunks,
            additions,
            deletions,
            isNewFile: false,
            isDeleted: false,
        };
    }
    
    /**
     * Создание пустого diff
     */
    private createEmptyDiff(filePath: string): FileDiff {
        return {
            originalPath: filePath,
            modifiedPath: filePath,
            hunks: [],
            additions: 0,
            deletions: 0,
            isNewFile: false,
            isDeleted: false,
        };
    }
    
    /**
     * Создание пустого результата
     */
    private createEmptyResult(): EditStrategyResult {
        return {
            strategy: 'text.replace',
            success: false,
            diff: this.createEmptyDiff(''),
            score: 0,
            executionTimeMs: 0,
            error: 'No strategy succeeded',
        };
    }
    
    /**
     * Проверка TypeScript файла
     */
    private isTypeScriptFile(filePath: string): boolean {
        const ext = path.extname(filePath);
        return ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx';
    }
    
    // ============================================================================
    // Abstract Method Implementations
    // ============================================================================
    
    protected async onInitialize(): Promise<void> {
        // Initialize TypeScript program if needed
    }
    
    protected onMessage<T>(message: AgentMessage<T>): void {
        this.log('Received message:', message.type);
    }
    
    protected async onCancel(): Promise<void> {
        // Cleanup
    }
    
    protected async onDispose(): Promise<void> {
        this.tsProgram = undefined;
    }
}

// ============================================================================
// Helper Types
// ============================================================================

interface SemanticChange {
    type: 'rename' | 'extract' | 'inline' | 'add_parameter' | 'remove_parameter' | 'modify';
    target?: string;
    details: Record<string, string>;
}
