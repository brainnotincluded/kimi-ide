/**
 * Testing Agent
 * Генерирует тесты, запускает их, проверяет coverage
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';
import { promisify } from 'util';
import { BaseAgent } from './baseAgent';
import {
    AgentType,
    AgentMessage,
    TestingResult,
    GeneratedTest,
    TestExecutionResult,
    CoverageReport,
    FileCoverage,
    TestFixture,
} from './types';

const execAsync = promisify(cp.exec);

/**
 * Опции для TestingAgent
 */
export interface TestingOptions {
    vscodeContext: {
        workspace: typeof vscode.workspace;
        window: typeof vscode.window;
    };
}

/**
 * Запрос на тестирование
 */
export interface TestingRequest {
    filePath: string;
    content?: string;
    description?: string;
    context?: {
        relatedFiles?: string[];
        existingTests?: string[];
    };
    generateTests?: boolean;
    runTests?: boolean;
    checkCoverage?: boolean;
}

/**
 * Testing Agent - генерация и запуск тестов
 */
export class TestingAgent extends BaseAgent {
    private vscodeContext: TestingOptions['vscodeContext'];
    
    constructor(options: TestingOptions) {
        super({
            type: 'testing',
            priority: 'normal',
            timeoutMs: 120000,
        });
        
        this.vscodeContext = options.vscodeContext;
    }
    
    /**
     * Выполнение тестирования
     */
    async test(request: TestingRequest): Promise<TestingResult> {
        return this.execute<TestingRequest, TestingResult>(request).then(r => r.data!);
    }
    
    /**
     * Выполнение тестовой задачи
     */
    protected async onExecute<TInput, TOutput>(
        input: TInput,
        signal: AbortSignal
    ): Promise<TOutput> {
        const request = input as unknown as TestingRequest;
        const result: TestingResult = {
            generated: false,
            tests: [],
        };
        
        // Step 1: Generate tests if requested
        if (request.generateTests !== false) {
            result.tests = await this.generateTests(request, signal);
            result.generated = result.tests.length > 0;
        }
        
        if (signal.aborted) {
            throw new Error('Testing aborted');
        }
        
        // Step 2: Run tests if requested
        if (request.runTests !== false) {
            result.execution = await this.runTests(request, signal);
        }
        
        if (signal.aborted) {
            throw new Error('Testing aborted');
        }
        
        // Step 3: Check coverage if requested
        if (request.checkCoverage) {
            result.coverage = await this.checkCoverage(request, signal);
        }
        
        return result as TOutput;
    }
    
    /**
     * Генерация тестов
     */
    private async generateTests(
        request: TestingRequest,
        signal: AbortSignal
    ): Promise<GeneratedTest[]> {
        // Load file content
        let content = request.content;
        if (!content) {
            try {
                const uri = vscode.Uri.file(request.filePath);
                const document = await this.vscodeContext.workspace.openTextDocument(uri);
                content = document.getText();
            } catch {
                return [];
            }
        }
        
        if (signal.aborted) {
            throw new Error('Aborted');
        }
        
        // Parse file to extract testable units
        const testableUnits = this.extractTestableUnits(content, request.filePath);
        
        // Generate tests for each unit
        const generatedTests: GeneratedTest[] = [];
        
        for (const unit of testableUnits) {
            if (signal.aborted) {
                break;
            }
            
            const test = await this.generateTestForUnit(unit, request);
            if (test) {
                generatedTests.push(test);
            }
        }
        
        return generatedTests;
    }
    
    /**
     * Извлечение тестируемых юнитов из файла
     */
    private extractTestableUnits(content: string, filePath: string): TestableUnit[] {
        const units: TestableUnit[] = [];
        const ext = path.extname(filePath);
        
        if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
            // Extract functions
            const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{/g;
            let match;
            while ((match = functionRegex.exec(content)) !== null) {
                units.push({
                    type: 'function',
                    name: match[1],
                    signature: match[0],
                    line: content.substring(0, match.index).split('\n').length,
                });
            }
            
            // Extract arrow functions with const
            const arrowRegex = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^{]+)?\s*=>/g;
            while ((match = arrowRegex.exec(content)) !== null) {
                units.push({
                    type: 'function',
                    name: match[1],
                    signature: match[0],
                    line: content.substring(0, match.index).split('\n').length,
                });
            }
            
            // Extract class methods
            const classRegex = /class\s+(\w+)[^{]*\{/g;
            while ((match = classRegex.exec(content)) !== null) {
                const className = match[1];
                const classStart = match.index;
                const classEnd = this.findMatchingBrace(content, classStart + match[0].length - 1);
                const classContent = content.substring(classStart, classEnd);
                
                const methodRegex = /(?:async\s+)?(\w+)\s*\([^)]*\)(?:\s*:\s*[^{]+)?\s*\{/g;
                let methodMatch;
                while ((methodMatch = methodRegex.exec(classContent)) !== null) {
                    // Skip constructor and getters/setters
                    if (methodMatch[1] === 'constructor' || methodMatch[1].startsWith('get ') || methodMatch[1].startsWith('set ')) {
                        continue;
                    }
                    
                    units.push({
                        type: 'method',
                        name: `${className}.${methodMatch[1]}`,
                        signature: methodMatch[0],
                        line: content.substring(0, classStart).split('\n').length + 
                              classContent.substring(0, methodMatch.index).split('\n').length - 1,
                    });
                }
            }
        } else if (ext === '.py') {
            // Python functions
            const funcRegex = /(?:async\s+)?def\s+(\w+)\s*\([^)]*\)(?:\s*->\s*[^:]+)?:/g;
            let match;
            while ((match = funcRegex.exec(content)) !== null) {
                units.push({
                    type: 'function',
                    name: match[1],
                    signature: match[0],
                    line: content.substring(0, match.index).split('\n').length,
                });
            }
            
            // Python classes
            const classRegex = /class\s+(\w+)(?:\([^)]*\))?:/g;
            while ((match = classRegex.exec(content)) !== null) {
                units.push({
                    type: 'class',
                    name: match[1],
                    signature: match[0],
                    line: content.substring(0, match.index).split('\n').length,
                });
            }
        }
        
        return units;
    }
    
    /**
     * Поиск закрывающей скобки
     */
    private findMatchingBrace(content: string, startPos: number): number {
        let depth = 1;
        let pos = startPos + 1;
        
        while (depth > 0 && pos < content.length) {
            if (content[pos] === '{') depth++;
            else if (content[pos] === '}') depth--;
            pos++;
        }
        
        return pos;
    }
    
    /**
     * Генерация теста для юнита
     */
    private async generateTestForUnit(
        unit: TestableUnit,
        request: TestingRequest
    ): Promise<GeneratedTest | null> {
        const ext = path.extname(request.filePath);
        const testType = this.determineTestType(unit);
        
        // Generate test file path
        const testFilePath = this.generateTestFilePath(request.filePath);
        
        // Generate test code based on language
        let testCode = '';
        let fixtures: TestFixture[] = [];
        
        if (ext === '.ts' || ext === '.tsx') {
            const result = this.generateTypeScriptTest(unit, request.filePath);
            testCode = result.code;
            fixtures = result.fixtures;
        } else if (ext === '.js' || ext === '.jsx') {
            const result = this.generateJavaScriptTest(unit, request.filePath);
            testCode = result.code;
            fixtures = result.fixtures;
        } else if (ext === '.py') {
            const result = this.generatePythonTest(unit, request.filePath);
            testCode = result.code;
            fixtures = result.fixtures;
        } else {
            return null;
        }
        
        return {
            id: `test_${unit.name}_${Date.now()}`,
            filePath: testFilePath,
            testType,
            targetFunction: unit.name,
            code: testCode,
            fixtures,
        };
    }
    
    /**
     * Определение типа теста
     */
    private determineTestType(unit: TestableUnit): GeneratedTest['testType'] {
        // Simple heuristic based on unit type
        if (unit.type === 'function') {
            return 'unit';
        } else if (unit.type === 'method') {
            return 'unit';
        } else if (unit.type === 'class') {
            return 'integration';
        }
        return 'unit';
    }
    
    /**
     * Генерация TypeScript теста
     */
    private generateTypeScriptTest(
        unit: TestableUnit,
        sourceFilePath: string
    ): { code: string; fixtures: TestFixture[] } {
        const relativePath = this.getRelativeImportPath(sourceFilePath);
        const functionName = unit.name.includes('.') 
            ? unit.name.split('.')[1] 
            : unit.name;
        
        // Generate test fixtures
        const fixtures: TestFixture[] = [
            {
                name: 'should handle valid input',
                input: this.generateMockInput(unit),
                expectedOutput: this.generateMockOutput(unit),
                description: 'Standard case',
            },
            {
                name: 'should handle edge case',
                input: this.generateEdgeCaseInput(unit),
                expectedOutput: null,
                description: 'Edge case',
            },
        ];
        
        const code = `import { ${functionName} } from '${relativePath}';

describe('${unit.name}', () => {
${fixtures.map((f, i) => `
    it('${f.name}', async () => {
        // Arrange
        const input = ${JSON.stringify(f.input)};
        
        // Act
        const result = await ${functionName}(input);
        
        // Assert
        ${f.expectedOutput !== null 
            ? `expect(result).toEqual(${JSON.stringify(f.expectedOutput)});`
            : `expect(result).toBeDefined();`}
    });
`).join('')}

    it('should handle errors gracefully', async () => {
        // Arrange
        const invalidInput = null;
        
        // Act & Assert
        await expect(${functionName}(invalidInput)).rejects.toThrow();
    });
});
`;
        
        return { code, fixtures };
    }
    
    /**
     * Генерация JavaScript теста
     */
    private generateJavaScriptTest(
        unit: TestableUnit,
        sourceFilePath: string
    ): { code: string; fixtures: TestFixture[] } {
        const relativePath = this.getRelativeImportPath(sourceFilePath);
        const functionName = unit.name.includes('.') 
            ? unit.name.split('.')[1] 
            : unit.name;
        
        const fixtures: TestFixture[] = [
            {
                name: 'should handle valid input',
                input: this.generateMockInput(unit),
                expectedOutput: this.generateMockOutput(unit),
            },
        ];
        
        const code = `const { ${functionName} } = require('${relativePath}');

describe('${unit.name}', () => {
${fixtures.map(f => `
    test('${f.name}', async () => {
        const result = await ${functionName}(${JSON.stringify(f.input)});
        expect(result).toEqual(${JSON.stringify(f.expectedOutput)});
    });
`).join('')}

    test('should handle errors gracefully', async () => {
        await expect(${functionName}(null)).rejects.toThrow();
    });
});
`;
        
        return { code, fixtures };
    }
    
    /**
     * Генерация Python теста
     */
    private generatePythonTest(
        unit: TestableUnit,
        sourceFilePath: string
    ): { code: string; fixtures: TestFixture[] } {
        const moduleName = path.basename(sourceFilePath, path.extname(sourceFilePath));
        
        const fixtures: TestFixture[] = [
            {
                name: 'test_valid_input',
                input: this.generateMockInput(unit),
                expectedOutput: this.generateMockOutput(unit),
            },
        ];
        
        const code = `import pytest
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from ${moduleName} import ${unit.name}

${fixtures.map(f => `
def ${f.name}():
    # Arrange
    input_data = ${JSON.stringify(f.input)}
    
    # Act
    result = ${unit.name}(input_data)
    
    # Assert
    assert result == ${JSON.stringify(f.expectedOutput)}
`).join('\n')}

def test_error_handling():
    with pytest.raises(Exception):
        ${unit.name}(None)
`;
        
        return { code, fixtures };
    }
    
    /**
     * Генерация моковых входных данных
     */
    private generateMockInput(unit: TestableUnit): unknown {
        // Generate sensible mock data based on function signature
        const signature = unit.signature.toLowerCase();
        
        if (signature.includes('string') || signature.includes('str')) {
            return 'test string';
        } else if (signature.includes('number') || signature.includes('int') || signature.includes('float')) {
            return 42;
        } else if (signature.includes('boolean') || signature.includes('bool')) {
            return true;
        } else if (signature.includes('array') || signature.includes('[]')) {
            return [1, 2, 3];
        } else if (signature.includes('object') || signature.includes('{}')) {
            return { id: 1, name: 'test' };
        }
        
        return 'test input';
    }
    
    /**
     * Генерация моковых выходных данных
     */
    private generateMockOutput(unit: TestableUnit): unknown {
        const signature = unit.signature.toLowerCase();
        
        if (signature.includes('boolean') || signature.includes(': bool')) {
            return true;
        } else if (signature.includes('string') || signature.includes(': str')) {
            return 'expected result';
        } else if (signature.includes('number') || signature.includes(': number')) {
            return 123;
        } else if (signature.includes('promise') || signature.includes('async')) {
            return { success: true };
        }
        
        return null;
    }
    
    /**
     * Генерация edge case входных данных
     */
    private generateEdgeCaseInput(unit: TestableUnit): unknown {
        const signature = unit.signature.toLowerCase();
        
        if (signature.includes('string')) {
            return '';
        } else if (signature.includes('number')) {
            return 0;
        } else if (signature.includes('array')) {
            return [];
        }
        
        return null;
    }
    
    /**
     * Получение относительного пути для импорта
     */
    private getRelativeImportPath(filePath: string): string {
        const ext = path.extname(filePath);
        return './' + path.basename(filePath, ext);
    }
    
    /**
     * Генерация пути к тестовому файлу
     */
    private generateTestFilePath(sourceFilePath: string): string {
        const dir = path.dirname(sourceFilePath);
        const ext = path.extname(sourceFilePath);
        const baseName = path.basename(sourceFilePath, ext);
        
        return path.join(dir, `${baseName}.test${ext}`);
    }
    
    /**
     * Запуск тестов
     */
    private async runTests(
        request: TestingRequest,
        signal: AbortSignal
    ): Promise<TestExecutionResult> {
        const workspaceFolder = this.vscodeContext.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return {
                success: false,
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                durationMs: 0,
                failures: [],
            };
        }
        
        // Find test file
        const testFile = this.findTestFile(request.filePath);
        if (!testFile) {
            return {
                success: false,
                total: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                durationMs: 0,
                failures: [{
                    testId: 'no-test-file',
                    message: 'No test file found',
                }],
            };
        }
        
        try {
            const startTime = Date.now();
            
            // Determine test command
            const testCommand = await this.determineTestCommand(testFile);
            
            const { stdout, stderr } = await execAsync(testCommand, {
                cwd: workspaceFolder.uri.fsPath,
                timeout: 60000,
            });
            
            if (signal.aborted) {
                throw new Error('Aborted');
            }
            
            // Parse test results
            const output = stdout + stderr;
            const results = this.parseTestResults(output);
            results.durationMs = Date.now() - startTime;
            
            return results;
            
        } catch (error) {
            const output = error instanceof Error && 'stdout' in error
                ? String((error as { stdout?: string }).stdout || '') + 
                  String((error as { stderr?: string }).stderr || '')
                : String(error);
            
            return this.parseTestResults(output);
        }
    }
    
    /**
     * Поиск тестового файла
     */
    private findTestFile(sourceFilePath: string): string | null {
        const ext = path.extname(sourceFilePath);
        const baseName = path.basename(sourceFilePath, ext);
        const dir = path.dirname(sourceFilePath);
        
        const possibleNames = [
            path.join(dir, `${baseName}.test${ext}`),
            path.join(dir, `${baseName}.spec${ext}`),
            path.join(dir, '__tests__', `${baseName}${ext}`),
        ];
        
        return possibleNames[0];
    }
    
    /**
     * Определение команды для запуска тестов
     */
    private async determineTestCommand(testFile: string): Promise<string> {
        const workspaceFolder = this.vscodeContext.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return `npm test -- "${testFile}"`;
        }
        
        // Check package.json for test runner
        const packageJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');
        
        try {
            const content = await this.vscodeContext.workspace.fs.readFile(packageJsonUri);
            const packageJson = JSON.parse(Buffer.from(content).toString());
            
            if (packageJson.devDependencies?.jest || packageJson.dependencies?.jest) {
                return `npx jest "${testFile}" --verbose`;
            } else if (packageJson.devDependencies?.vitest) {
                return `npx vitest run "${testFile}"`;
            } else if (packageJson.devDependencies?.mocha) {
                return `npx mocha "${testFile}"`;
            }
        } catch {
            // Fall through to default
        }
        
        // Check for pytest
        if (testFile.endsWith('.py')) {
            return `python -m pytest "${testFile}" -v`;
        }
        
        return `npm test -- "${testFile}"`;
    }
    
    /**
     * Парсинг результатов тестов
     */
    private parseTestResults(output: string): TestExecutionResult {
        const result: TestExecutionResult = {
            success: false,
            total: 0,
            passed: 0,
            failed: 0,
            skipped: 0,
            durationMs: 0,
            failures: [],
        };
        
        // Parse Jest/Vitest output
        const passMatch = output.match(/Tests?:\s+(\d+)\s+passed/);
        const failMatch = output.match(/Tests?:\s+(\d+)\s+failed/);
        const totalMatch = output.match(/Tests?:\s+(\d+)\s+total/);
        
        if (passMatch) result.passed = parseInt(passMatch[1], 10);
        if (failMatch) result.failed = parseInt(failMatch[1], 10);
        if (totalMatch) result.total = parseInt(totalMatch[1], 10);
        
        // If no match, try alternative patterns
        if (result.total === 0) {
            const testsMatch = output.match(/(\d+)\s+tests?/i);
            if (testsMatch) result.total = parseInt(testsMatch[1], 10);
        }
        
        // Extract failures
        const failureRegex = /✕\s+(.+)|FAIL\s+(.+)/g;
        let match;
        while ((match = failureRegex.exec(output)) !== null) {
            result.failures.push({
                testId: match[1] || match[2],
                message: 'Test failed',
            });
        }
        
        // Parse pytest output
        if (output.includes('passed') && output.includes('failed')) {
            const pytestMatch = output.match(/(\d+)\s+passed/);
            const pytestFailMatch = output.match(/(\d+)\s+failed/);
            
            if (pytestMatch) result.passed = parseInt(pytestMatch[1], 10);
            if (pytestFailMatch) result.failed = parseInt(pytestFailMatch[1], 10);
            result.total = result.passed + result.failed;
        }
        
        result.success = result.failed === 0 && result.total > 0;
        
        return result;
    }
    
    /**
     * Проверка покрытия
     */
    private async checkCoverage(
        request: TestingRequest,
        signal: AbortSignal
    ): Promise<CoverageReport> {
        const workspaceFolder = this.vscodeContext.workspace.workspaceFolders?.[0];
        
        if (!workspaceFolder) {
            return {
                overall: 0,
                byFile: {},
                byFunction: {},
            };
        }
        
        try {
            // Try to run tests with coverage
            const testFile = this.findTestFile(request.filePath);
            if (!testFile) {
                return { overall: 0, byFile: {}, byFunction: {} };
            }
            
            const command = await this.determineCoverageCommand(testFile);
            
            const { stdout } = await execAsync(command, {
                cwd: workspaceFolder.uri.fsPath,
                timeout: 60000,
            });
            
            if (signal.aborted) {
                throw new Error('Aborted');
            }
            
            return this.parseCoverageOutput(stdout, request.filePath);
            
        } catch {
            // Return empty coverage if command fails
            return {
                overall: 0,
                byFile: {},
                byFunction: {},
            };
        }
    }
    
    /**
     * Определение команды для coverage
     */
    private async determineCoverageCommand(testFile: string): Promise<string> {
        const workspaceFolder = this.vscodeContext.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            return `npx jest --coverage "${testFile}"`;
        }
        
        const packageJsonUri = vscode.Uri.joinPath(workspaceFolder.uri, 'package.json');
        
        try {
            const content = await this.vscodeContext.workspace.fs.readFile(packageJsonUri);
            const packageJson = JSON.parse(Buffer.from(content).toString());
            
            if (packageJson.devDependencies?.jest) {
                return `npx jest --coverage "${testFile}"`;
            } else if (packageJson.devDependencies?.vitest) {
                return `npx vitest run --coverage "${testFile}"`;
            }
        } catch {
            // Fall through
        }
        
        if (testFile.endsWith('.py')) {
            return `python -m pytest --cov="${testFile}"`;
        }
        
        return `npx jest --coverage "${testFile}"`;
    }
    
    /**
     * Парсинг вывода coverage
     */
    private parseCoverageOutput(output: string, filePath: string): CoverageReport {
        const report: CoverageReport = {
            overall: 0,
            byFile: {},
            byFunction: {},
        };
        
        // Parse Jest coverage output
        const overallMatch = output.match(/All files\s+\|\s+[\d.]+\s+\|\s+[\d.]+\s+\|\s+([\d.]+)/);
        if (overallMatch) {
            report.overall = parseFloat(overallMatch[1]);
        }
        
        // Parse file coverage
        const fileRegex = /([^|]+)\|([\d.]+)\|([\d.]+)\|([\d.]+)\|([\d.]+)/g;
        let match;
        while ((match = fileRegex.exec(output)) !== null) {
            const file = match[1].trim();
            if (file && file !== 'File') {
                report.byFile[file] = {
                    statements: parseFloat(match[2]),
                    branches: parseFloat(match[3]),
                    functions: parseFloat(match[4]),
                    lines: parseFloat(match[5]),
                };
            }
        }
        
        return report;
    }
    
    // ============================================================================
    // Abstract Method Implementations
    // ============================================================================
    
    protected async onInitialize(): Promise<void> {
        // Testing agent is ready immediately
    }
    
    protected onMessage<T>(message: AgentMessage<T>): void {
        this.log('Received message:', message.type);
    }
    
    protected async onCancel(): Promise<void> {
        // Cleanup
    }
    
    protected async onDispose(): Promise<void> {
        // Cleanup
    }
}

// ============================================================================
// Helper Types
// ============================================================================

interface TestableUnit {
    type: 'function' | 'method' | 'class';
    name: string;
    signature: string;
    line: number;
}
