/**
 * Reviewer Agent
 * Проверяет изменения: typecheck, lint, test в параллель
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { promisify } from 'util';
import { BaseAgent } from './baseAgent';
import {
    AgentType,
    AgentMessage,
    ReviewResult,
    CodeIssue,
    CodeFix,
    QualityMetrics,
    CheckResult,
    FileDiff,
} from './types';

const execAsync = promisify(cp.exec);

/**
 * Опции для ReviewerAgent
 */
export interface ReviewerOptions {
    vscodeContext: {
        workspace: typeof vscode.workspace;
        window: typeof vscode.window;
        languages: typeof vscode.languages;
    };
}

/**
 * Запрос на ревью
 */
export interface ReviewRequest {
    filePath: string;
    diff: FileDiff;
    originalContent?: string;
    modifiedContent?: string;
    context?: {
        relatedFiles?: string[];
        testFiles?: string[];
    };
}

/**
 * Reviewer Agent - проверка качества изменений
 */
export class ReviewerAgent extends BaseAgent {
    private vscodeContext: ReviewerOptions['vscodeContext'];
    private diagnosticCollection?: vscode.DiagnosticCollection;
    
    constructor(options: ReviewerOptions) {
        super({
            type: 'reviewer',
            priority: 'high',
            timeoutMs: 60000,
            parallel: true,
        });
        
        this.vscodeContext = options.vscodeContext;
        this.diagnosticCollection = this.vscodeContext.languages.createDiagnosticCollection('kimi-review');
    }
    
    /**
     * Выполнение ревью
     */
    async review(request: ReviewRequest): Promise<ReviewResult> {
        return this.execute<ReviewRequest, ReviewResult>(request).then(r => r.data!);
    }
    
    /**
     * Выполнение проверки
     */
    protected async onExecute<TInput, TOutput>(
        input: TInput,
        signal: AbortSignal
    ): Promise<TOutput> {
        const request = input as unknown as ReviewRequest;
        const req = request;
        const startTime = Date.now();
        
        // Run all checks in parallel
        const [typeCheckResult, lintResult, testResult, securityResult] = await Promise.all([
            this.runTypeCheck(req, signal).catch(e => this.createErrorCheck('typecheck', e)),
            this.runLint(req, signal).catch(e => this.createErrorCheck('lint', e)),
            this.runTests(req, signal).catch(e => this.createErrorCheck('test', e)),
            this.runSecurityCheck(req, signal).catch(e => this.createErrorCheck('security', e)),
        ]);
        
        if (signal.aborted) {
            throw new Error('Review aborted');
        }
        
        const checks = [typeCheckResult, lintResult, testResult, securityResult];
        
        // Collect all issues
        const issues: CodeIssue[] = [];
        for (const check of checks) {
            issues.push(...this.issuesFromCheckResult(check, req.filePath));
        }
        
        // Run AI review for semantic issues
        const semanticIssues = await this.runSemanticReview(request, signal);
        issues.push(...semanticIssues);
        
        // Calculate metrics
        const metrics = this.calculateMetrics(issues, request);
        
        // Update VS Code diagnostics
        this.updateDiagnostics(request.filePath, issues);
        
        // Determine approval
        const hasErrors = issues.some(i => i.severity === 'error');
        const hasCriticalWarnings = issues.filter(i => i.severity === 'warning').length > 5;
        
        return {
            filePath: req.filePath,
            approved: !hasErrors && !hasCriticalWarnings,
            issues,
            metrics,
            checks,
        } as TOutput;
    }
    
    /**
     * TypeScript type check
     */
    private async runTypeCheck(
        request: ReviewRequest,
        signal: AbortSignal
    ): Promise<CheckResult> {
        const startTime = Date.now();
        
        // Check if this is a TypeScript file
        if (!this.isTypeScriptFile(request.filePath)) {
            return { type: 'typecheck', status: 'skipped', durationMs: 0, issues: 0 };
        }
        
        try {
            // Try to get TypeScript diagnostics using VS Code API
            const uri = vscode.Uri.file(request.filePath);
            
            // Execute tsc --noEmit for the file
            const workspaceFolder = this.vscodeContext.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder');
            }
            
            const { stdout, stderr } = await execAsync(
                `npx tsc --noEmit --skipLibCheck "${request.filePath}"`,
                {
                    cwd: workspaceFolder.uri.fsPath,
                    timeout: 30000,
                }
            );
            
            if (signal.aborted) {
                throw new Error('Aborted');
            }
            
            // Parse TypeScript errors
            const output = stdout + stderr;
            const errors = this.parseTypeScriptErrors(output, request.filePath);
            
            return {
                type: 'typecheck',
                status: errors.length > 0 ? 'failed' : 'passed',
                durationMs: Date.now() - startTime,
                output,
                issues: errors.length,
            };
            
        } catch (error) {
            if (error instanceof Error && 'stdout' in error) {
                const execError = error as unknown as { stdout: string; stderr: string };
                const output = (execError.stdout || '') + (execError.stderr || '');
                const errors = this.parseTypeScriptErrors(output, request.filePath);
                
                return {
                    type: 'typecheck',
                    status: errors.length > 0 ? 'failed' : 'passed',
                    durationMs: Date.now() - startTime,
                    output,
                    issues: errors.length,
                };
            }
            
            return {
                type: 'typecheck',
                status: 'failed',
                durationMs: Date.now() - startTime,
                output: String(error),
                issues: 1,
            };
        }
    }
    
    /**
     * Парсинг ошибок TypeScript
     */
    private parseTypeScriptErrors(output: string, filePath: string): Array<{ line: number; message: string }> {
        const errors: Array<{ line: number; message: string }> = [];
        const lines = output.split('\n');
        
        for (const line of lines) {
            // Match TypeScript error format: file.ts(line,col): error TSxxxx: message
            const match = line.match(/\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)/);
            if (match) {
                errors.push({
                    line: parseInt(match[1], 10),
                    message: `${match[3]}: ${match[4]}`,
                });
            }
        }
        
        return errors;
    }
    
    /**
     * Lint check (ESLint)
     */
    private async runLint(request: ReviewRequest, signal: AbortSignal): Promise<CheckResult> {
        const startTime = Date.now();
        
        try {
            const workspaceFolder = this.vscodeContext.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { type: 'lint', status: 'skipped', durationMs: 0, issues: 0 };
            }
            
            // Check if ESLint config exists
            const eslintConfigFiles = ['.eslintrc.js', '.eslintrc.json', '.eslintrc', 'eslint.config.js'];
            let hasEslint = false;
            
            for (const configFile of eslintConfigFiles) {
                try {
                    const configUri = vscode.Uri.joinPath(workspaceFolder.uri, configFile);
                    await this.vscodeContext.workspace.fs.stat(configUri);
                    hasEslint = true;
                    break;
                } catch {
                    // Config not found
                }
            }
            
            if (!hasEslint) {
                return { type: 'lint', status: 'skipped', durationMs: 0, issues: 0 };
            }
            
            // Run ESLint
            const { stdout, stderr } = await execAsync(
                `npx eslint --format json "${request.filePath}"`,
                {
                    cwd: workspaceFolder.uri.fsPath,
                    timeout: 30000,
                }
            );
            
            if (signal.aborted) {
                throw new Error('Aborted');
            }
            
            const results = JSON.parse(stdout);
            let totalIssues = 0;
            
            for (const result of results) {
                totalIssues += result.messages?.length ?? 0;
            }
            
            return {
                type: 'lint',
                status: totalIssues > 0 ? 'failed' : 'passed',
                durationMs: Date.now() - startTime,
                output: stdout,
                issues: totalIssues,
            };
            
        } catch (error) {
            if (error instanceof Error && 'stdout' in error) {
                const execError = error as { stdout: string };
                try {
                    const results = JSON.parse(execError.stdout);
                    let totalIssues = 0;
                    for (const result of results) {
                        totalIssues += result.messages?.length ?? 0;
                    }
                    
                    return {
                        type: 'lint',
                        status: totalIssues > 0 ? 'failed' : 'passed',
                        durationMs: Date.now() - startTime,
                        output: execError.stdout,
                        issues: totalIssues,
                    };
                } catch {
                    // JSON parse failed
                }
            }
            
            return {
                type: 'lint',
                status: 'failed',
                durationMs: Date.now() - startTime,
                output: String(error),
                issues: 1,
            };
        }
    }
    
    /**
     * Test check
     */
    private async runTests(request: ReviewRequest, signal: AbortSignal): Promise<CheckResult> {
        const startTime = Date.now();
        
        // Find related test file
        const testFile = this.findTestFile(request.filePath, request.context?.testFiles);
        
        if (!testFile) {
            return { type: 'test', status: 'skipped', durationMs: 0, issues: 0 };
        }
        
        try {
            const workspaceFolder = this.vscodeContext.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                return { type: 'test', status: 'skipped', durationMs: 0, issues: 0 };
            }
            
            // Check for test runner
            const packageJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');
            let testCommand = 'npm test';
            
            try {
                const packageJsonContent = await this.vscodeContext.workspace.fs.readFile(packageJsonUri);
                const packageJson = JSON.parse(Buffer.from(packageJsonContent).toString());
                
                if (packageJson.scripts?.test) {
                    // Run specific test file
                    if (packageJson.devDependencies?.jest || packageJson.dependencies?.jest) {
                        testCommand = `npx jest "${testFile}"`;
                    } else if (packageJson.devDependencies?.vitest) {
                        testCommand = `npx vitest run "${testFile}"`;
                    } else if (packageJson.devDependencies?.mocha) {
                        testCommand = `npx mocha "${testFile}"`;
                    }
                }
            } catch {
                // Use default test command
            }
            
            const { stdout, stderr } = await execAsync(testCommand, {
                cwd: workspaceFolder.uri.fsPath,
                timeout: 60000,
            });
            
            if (signal.aborted) {
                throw new Error('Aborted');
            }
            
            return {
                type: 'test',
                status: 'passed',
                durationMs: Date.now() - startTime,
                output: stdout + stderr,
                issues: 0,
            };
            
        } catch (error) {
            const output = error instanceof Error && 'stdout' in error
                ? String((error as unknown as { stdout: string }).stdout) + 
                  String((error as unknown as { stderr: string }).stderr || '')
                : String(error);
            
            // Parse test failures
            const failures = this.parseTestFailures(output);
            
            return {
                type: 'test',
                status: 'failed',
                durationMs: Date.now() - startTime,
                output,
                issues: failures.length,
            };
        }
    }
    
    /**
     * Поиск тестового файла
     */
    private findTestFile(filePath: string, testFiles?: string[]): string | undefined {
        if (testFiles && testFiles.length > 0) {
            // Find matching test file
            const baseName = path.basename(filePath, path.extname(filePath));
            return testFiles.find(tf => tf.includes(baseName));
        }
        
        // Guess test file name
        const dir = path.dirname(filePath);
        const baseName = path.basename(filePath, path.extname(filePath));
        const ext = path.extname(filePath);
        
        const possibleTestNames = [
            path.join(dir, `${baseName}.test${ext}`),
            path.join(dir, `${baseName}.spec${ext}`),
            path.join(dir, '__tests__', `${baseName}${ext}`),
            path.join(dir, 'test', `${baseName}${ext}`),
        ];
        
        // In real implementation, check if file exists
        return possibleTestNames[0];
    }
    
    /**
     * Парсинг ошибок тестов
     */
    private parseTestFailures(output: string): string[] {
        const failures: string[] = [];
        
        // Match common test failure patterns
        const patterns = [
            /FAIL\s+(.+)/g,
            /✕\s+(.+)/g,
            /Error:\s+(.+)/g,
        ];
        
        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(output)) !== null) {
                failures.push(match[1]);
            }
        }
        
        return failures;
    }
    
    /**
     * Security check
     */
    private async runSecurityCheck(
        request: ReviewRequest,
        signal: AbortSignal
    ): Promise<CheckResult> {
        const startTime = Date.now();
        
        // Run basic security heuristics
        const issues = this.runSecurityHeuristics(request);
        
        if (signal.aborted) {
            throw new Error('Aborted');
        }
        
        return {
            type: 'security',
            status: issues.length > 0 ? 'failed' : 'passed',
            durationMs: Date.now() - startTime,
            issues: issues.length,
        };
    }
    
    /**
     * Проверка безопасности (heuristics)
     */
    private runSecurityHeuristics(request: ReviewRequest): Array<{ message: string }> {
        const issues: Array<{ message: string }> = [];
        const content = request.modifiedContent ?? '';
        const contentLower = content.toLowerCase();
        
        // Check for common security issues
        const securityPatterns = [
            { pattern: /eval\s*\(/, message: 'Use of eval() detected' },
            { pattern: /innerHTML\s*=/, message: 'Potential XSS: innerHTML assignment' },
            { pattern: /document\.write\s*\(/, message: 'Use of document.write() detected' },
            { pattern: /exec\s*\(/, message: 'Command execution detected' },
            { pattern: /password\s*[=:]\s*['"`]/, message: 'Hardcoded password detected' },
            { pattern: /api[_-]?key\s*[=:]\s*['"`]/, message: 'Hardcoded API key detected' },
            { pattern: /secret\s*[=:]\s*['"`]/, message: 'Hardcoded secret detected' },
            { pattern: /TODO|FIXME|XXX|HACK/, message: 'TODO/FIXME comments present' },
        ];
        
        for (const { pattern, message } of securityPatterns) {
            if (pattern.test(content)) {
                issues.push({ message });
            }
        }
        
        return issues;
    }
    
    /**
     * Семантическое ревью (AI)
     */
    private async runSemanticReview(
        request: ReviewRequest,
        signal: AbortSignal
    ): Promise<CodeIssue[]> {
        // In real implementation, call Kimi API for semantic review
        // For now, return basic code quality checks
        const issues: CodeIssue[] = [];
        const content = request.modifiedContent ?? '';
        
        // Check for long functions
        const functionMatches = content.match(/(?:function|=>)\s*\{[\s\S]*?\n\}/g);
        if (functionMatches) {
            for (const func of functionMatches) {
                const lines = func.split('\n').length;
                if (lines > 50) {
                    issues.push({
                        id: `semantic_${Date.now()}`,
                        severity: 'warning',
                        category: 'style',
                        message: `Function is ${lines} lines long. Consider breaking it down.`,
                        filePath: request.filePath,
                    });
                }
            }
        }
        
        // Check for console.log
        if (/console\.(log|debug|warn|error)\s*\(/.test(content)) {
            issues.push({
                id: `semantic_${Date.now()}_console`,
                severity: 'info',
                category: 'style',
                message: 'Console statements found. Consider using a proper logging library.',
                filePath: request.filePath,
            });
        }
        
        // Check for unused variables (basic heuristic)
        const varMatches = content.match(/(?:const|let|var)\s+(\w+)/g);
        if (varMatches) {
            for (const varMatch of varMatches) {
                const varName = varMatch.replace(/(?:const|let|var)\s+/, '');
                // Simple check: if variable is declared but never used
                const usageCount = (content.match(new RegExp(`\\b${varName}\\b`, 'g')) ?? []).length;
                if (usageCount <= 1) {
                    issues.push({
                        id: `semantic_${Date.now()}_unused`,
                        severity: 'warning',
                        category: 'style',
                        message: `Variable "${varName}" may be unused`,
                        filePath: request.filePath,
                    });
                }
            }
        }
        
        return issues;
    }
    
    /**
     * Преобразование CheckResult в CodeIssue
     */
    private issuesFromCheckResult(check: CheckResult, filePath: string): CodeIssue[] {
        const issues: CodeIssue[] = [];
        
        if (check.status === 'passed' || check.status === 'skipped') {
            return issues;
        }
        
        // Parse issues from check output
        if (check.type === 'typecheck' && check.output) {
            const tsErrors = this.parseTypeScriptErrors(check.output, filePath);
            for (const error of tsErrors) {
                issues.push({
                    id: `ts_${Date.now()}_${error.line}`,
                    severity: 'error',
                    category: 'type',
                    message: error.message,
                    filePath,
                    line: error.line,
                });
            }
        }
        
        if (check.type === 'lint' && check.output) {
            try {
                const results = JSON.parse(check.output);
                for (const result of results) {
                    for (const message of result.messages ?? []) {
                        issues.push({
                            id: `lint_${Date.now()}_${message.line}`,
                            severity: message.severity === 2 ? 'error' : 'warning',
                            category: 'lint',
                            message: message.message,
                            filePath: result.filePath ?? filePath,
                            line: message.line,
                            column: message.column,
                            code: message.ruleId,
                        });
                    }
                }
            } catch {
                // JSON parse failed
            }
        }
        
        if (check.type === 'test') {
            const failures = this.parseTestFailures(check.output ?? '');
            for (const failure of failures) {
                issues.push({
                    id: `test_${Date.now()}`,
                    severity: 'error',
                    category: 'test',
                    message: `Test failure: ${failure}`,
                    filePath,
                });
            }
        }
        
        if (check.type === 'security') {
            const securityIssues = this.runSecurityHeuristics({ filePath, diff: {} as FileDiff });
            for (const issue of securityIssues) {
                issues.push({
                    id: `sec_${Date.now()}`,
                    severity: 'warning',
                    category: 'security',
                    message: issue.message,
                    filePath,
                });
            }
        }
        
        return issues;
    }
    
    /**
     * Вычисление метрик качества
     */
    private calculateMetrics(issues: CodeIssue[], request: ReviewRequest): QualityMetrics {
        const errors = issues.filter(i => i.severity === 'error').length;
        const warnings = issues.filter(i => i.severity === 'warning').length;
        
        // Calculate complexity score (0-100, higher is better)
        const complexity = Math.max(0, 100 - errors * 10 - warnings * 2);
        
        // Calculate maintainability score
        const maintainability = Math.max(0, 100 - issues.filter(i => i.category === 'style').length * 2);
        
        // Estimate test coverage (placeholder)
        const testCoverage = request.context?.testFiles ? 50 : 0;
        
        // Check for duplication (placeholder)
        const duplication = 0;
        
        // Check documentation
        const hasDocs = /\/\*\*|##\s+|\/\/\s+\w+/.test(request.modifiedContent ?? '');
        const documentation = hasDocs ? 80 : 40;
        
        return {
            complexity,
            maintainability,
            testCoverage,
            duplication,
            documentation,
        };
    }
    
    /**
     * Обновление диагностик VS Code
     */
    private updateDiagnostics(filePath: string, issues: CodeIssue[]): void {
        const uri = vscode.Uri.file(filePath);
        const diagnostics: vscode.Diagnostic[] = [];
        
        for (const issue of issues) {
            const range = issue.line !== undefined
                ? new vscode.Range(
                    new vscode.Position(issue.line - 1, (issue.column ?? 1) - 1),
                    new vscode.Position(issue.line - 1, (issue.column ?? 1) + 100)
                )
                : new vscode.Range(0, 0, 0, 100);
            
            const severity = issue.severity === 'error'
                ? vscode.DiagnosticSeverity.Error
                : issue.severity === 'warning'
                ? vscode.DiagnosticSeverity.Warning
                : vscode.DiagnosticSeverity.Information;
            
            const diagnostic = new vscode.Diagnostic(
                range,
                issue.message,
                severity
            );
            
            diagnostic.code = issue.code;
            diagnostic.source = `kimi-${issue.category}`;
            
            diagnostics.push(diagnostic);
        }
        
        this.diagnosticCollection?.set(uri, diagnostics);
    }
    
    /**
     * Создание ошибочного результата проверки
     */
    private createErrorCheck(type: CheckResult['type'], error: unknown): CheckResult {
        return {
            type,
            status: 'failed',
            durationMs: 0,
            output: String(error),
            issues: 1,
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
        // Reviewer is ready immediately
    }
    
    protected onMessage<T>(message: AgentMessage<T>): void {
        this.log('Received message:', message.type);
    }
    
    protected async onCancel(): Promise<void> {
        // Cleanup
    }
    
    protected async onDispose(): Promise<void> {
        this.diagnosticCollection?.dispose();
    }
}
