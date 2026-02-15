/**
 * Kimi IDE - Test Reviewer
 * Проверяет test coverage, quality тестов, missing edge cases
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { BaseReviewer } from './baseReviewer';
import { ReviewIssue, ReviewCategory } from '../types';
import { logger } from '../../utils/logger';

interface TestPattern {
    name: string;
    regex: RegExp;
    languages: string[];
    severity: ReviewIssue['severity'];
    message: string;
    description?: string;
}

export class TestReviewer extends BaseReviewer {
    readonly id = 'test';
    readonly name = 'Test Quality Analyzer';
    readonly category: ReviewCategory = 'test';
    
    private testCodePatterns: TestPattern[] = [
        // Test quality issues
        {
            name: 'test-without-assertion',
            regex: /(?:it|test)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{[^}]*\}(?!\s*[,;])?/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Test may not have any assertions',
            description: 'Tests without assertions may pass even if the code is broken. Add expect() or assert() calls.',
        },
        {
            name: 'skipped-test',
            regex: /(?:it|test|describe)\.skip\s*\(/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'Skipped test detected',
            description: 'Skipped tests should be re-enabled or removed before committing.',
        },
        {
            name: 'only-test',
            regex: /(?:it|test|describe)\.only\s*\(/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Test with .only() will ignore other tests',
            description: 'Remove .only() before committing to ensure all tests run.',
        },
        {
            name: 'todo-test',
            regex: /(?:it|test)\.todo\s*\(/,
            languages: ['javascript', 'typescript'],
            severity: 'hint',
            message: 'TODO test found',
            description: 'Remember to implement this test.',
        },
        {
            name: 'empty-test',
            regex: /(?:it|test)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{\s*\}/,
            languages: ['javascript', 'typescript'],
            severity: 'error',
            message: 'Empty test body',
            description: 'This test does nothing. Implement the test or remove it.',
        },
        {
            name: 'hardcoded-assertion',
            regex: /expect\s*\(\s*(?:true|false|null|undefined|\d+|['"`][^'"`]*['"`])\s*\)/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Assertion with hardcoded value may not test actual behavior',
            description: 'Testing against hardcoded values may not verify the actual function output.',
        },
        {
            name: 'catch-empty-test',
            regex: /\.catch\s*\(\s*(?:\(\s*\)\s*=>\s*\{\s*\}|\(\s*\)\s*=>\s*\{\s*return\s*\})/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Empty catch in test may hide failures',
            description: 'Catching errors without assertions can make failing tests pass silently.',
        },
        {
            name: 'console-in-test',
            regex: /console\.(log|warn|error|debug)\s*\(/,
            languages: ['javascript', 'typescript', 'python'],
            severity: 'hint',
            message: 'Console statement in test should be removed',
            description: 'Console statements in tests should be cleaned up before committing.',
        },
        {
            name: 'settimeout-in-test',
            regex: /setTimeout\s*\(/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'setTimeout in tests can cause flaky tests',
            description: 'Use fake timers or proper async/await instead of setTimeout in tests.',
        },
        {
            name: 'test-too-long',
            regex: /(?:it|test)\s*\(\s*['"`][^'"`]+['"`]\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'Large test function - consider splitting into smaller tests',
            description: 'Large tests are harder to understand and maintain. Split into focused tests.',
        },
        
        // Python test patterns
        {
            name: 'python-assert-true-false',
            regex: /assert\s+(?:True|False)\s*$/m,
            languages: ['python'],
            severity: 'warning',
            message: 'Asserting True/False directly may not test actual behavior',
            description: 'Test the actual return value of functions instead of hardcoded booleans.',
        },
        {
            name: 'python-bare-except',
            regex: /except\s*:/,
            languages: ['python'],
            severity: 'warning',
            message: 'Bare except clause in test may hide failures',
            description: 'Use except Exception or more specific exceptions to avoid catching SystemExit.',
        },
        {
            name: 'python-pass-test',
            regex: /def\s+test_\w+\s*\(\s*[^)]*\)\s*:\s*\n\s*pass/,
            languages: ['python'],
            severity: 'error',
            message: 'Empty test function',
            description: 'This test function does nothing. Implement it or remove it.',
        },
        
        // Java test patterns
        {
            name: 'java-empty-test',
            regex: /@Test\s*\n\s*public\s+void\s+\w+\s*\(\s*\)\s*\{\s*\}/,
            languages: ['java'],
            severity: 'error',
            message: 'Empty test method',
            description: 'This test method has no assertions and does nothing.',
        },
        {
            name: 'java-ignored-test',
            regex: /@Ignore/,
            languages: ['java'],
            severity: 'info',
            message: 'Ignored test detected',
            description: 'Tests marked with @Ignore should be re-enabled or removed.',
        },
    ];
    
    protected getSupportedLanguages(): string[] {
        return ['javascript', 'typescript', 'python', 'java'];
    }
    
    protected async performReview(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<ReviewIssue[]> {
        const issues: ReviewIssue[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        const fileName = path.basename(document.fileName);
        const isTestFile = this.isTestFile(fileName, document.languageId);
        
        if (isTestFile) {
            await this.reviewTestFile(document, lines, issues, token);
        } else {
            await this.reviewSourceFile(document, lines, issues, token);
        }
        
        return issues;
    }
    
    private isTestFile(fileName: string, languageId: string): boolean {
        const testPatterns = [
            /\.(test|spec)\.(js|ts|jsx|tsx)$/,
            /test_.*\.py$/,
            /.*_test\.py$/,
            /Test.*\.java$/,
            /.*Test\.java$/,
            /.*Tests?\.java$/,
        ];
        
        return testPatterns.some(pattern => pattern.test(fileName));
    }
    
    private async reviewTestFile(
        document: vscode.TextDocument,
        lines: string[],
        issues: ReviewIssue[],
        token: vscode.CancellationToken
    ): Promise<void> {
        const applicablePatterns = this.testCodePatterns.filter(
            p => p.languages.includes(document.languageId)
        );
        
        const text = document.getText();
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            if (token.isCancellationRequested) {
                break;
            }
            
            const line = lines[lineIndex];
            
            for (const pattern of applicablePatterns) {
                pattern.regex.lastIndex = 0;
                
                const match = pattern.regex.exec(line);
                if (match) {
                    const startChar = match.index;
                    const endChar = startChar + match[0].length;
                    
                    const range = new vscode.Range(
                        lineIndex,
                        startChar,
                        lineIndex,
                        endChar
                    );
                    
                    issues.push(this.createIssue(
                        document,
                        range,
                        pattern.severity,
                        pattern.name,
                        pattern.message,
                        {
                            detail: pattern.description,
                            confidence: 0.85,
                        }
                    ));
                }
            }
        }
        
        await this.checkTestCoverage(document, text, issues);
        await this.checkDuplicateTestNames(document, text, issues);
    }
    
    private async reviewSourceFile(
        document: vscode.TextDocument,
        lines: string[],
        issues: ReviewIssue[],
        token: vscode.CancellationToken
    ): Promise<void> {
        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );
            
            if (!symbols) {
                return;
            }
            
            const publicFunctions: vscode.DocumentSymbol[] = [];
            
            const findPublicFunctions = (symbols: vscode.DocumentSymbol[]) => {
                for (const symbol of symbols) {
                    if (symbol.kind === vscode.SymbolKind.Function ||
                        symbol.kind === vscode.SymbolKind.Method) {
                        const line = document.lineAt(symbol.range.start.line).text;
                        if (line.includes('export') || line.includes('public')) {
                            publicFunctions.push(symbol);
                        }
                    }
                    
                    if (symbol.children.length > 0) {
                        findPublicFunctions(symbol.children);
                    }
                }
            };
            
            findPublicFunctions(symbols);
            
            for (const func of publicFunctions) {
                await this.checkFunctionEdgeCases(document, func, issues, token);
            }
            
            await this.checkTestFileExists(document, issues);
            
        } catch (error) {
            logger.debug('Could not analyze source file for test coverage:', error);
        }
    }
    
    private async checkTestCoverage(
        document: vscode.TextDocument,
        text: string,
        issues: ReviewIssue[]
    ): Promise<void> {
        const testCount = (text.match(/(?:it|test)\s*\(/g) || []).length;
        const describeCount = (text.match(/describe\s*\(/g) || []).length;
        
        if (testCount === 0 && describeCount === 0) {
            issues.push(this.createIssue(
                document,
                new vscode.Range(0, 0, 0, 0),
                'warning',
                'no-tests-found',
                'No test cases found in test file',
                {
                    detail: 'This file appears to be a test file but contains no test cases.',
                    confidence: 0.9,
                }
            ));
        } else if (testCount === 1) {
            issues.push(this.createIssue(
                document,
                new vscode.Range(0, 0, 0, 0),
                'info',
                'single-test-case',
                'Only one test case found - consider adding more test scenarios',
                {
                    detail: 'Single test cases may miss edge cases. Consider adding tests for error conditions, boundary values, etc.',
                    confidence: 0.6,
                }
            ));
        }
        
        const hasErrorTest = /(?:error|exception|reject|throw|catch)/i.test(text);
        if (!hasErrorTest && testCount > 0) {
            issues.push(this.createIssue(
                document,
                new vscode.Range(0, 0, 0, 0),
                'info',
                'no-error-tests',
                'No tests for error handling found',
                {
                    detail: 'Consider adding tests for error conditions and edge cases.',
                    confidence: 0.5,
                }
            ));
        }
    }
    
    private async checkDuplicateTestNames(
        document: vscode.TextDocument,
        text: string,
        issues: ReviewIssue[]
    ): Promise<void> {
        const testNames: string[] = [];
        const regex = /(?:it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;
        let match: RegExpExecArray | null;
        
        while ((match = regex.exec(text)) !== null) {
            const name = match[1];
            if (testNames.includes(name)) {
                const lines = text.substring(0, match.index).split('\n');
                const line = lines.length - 1;
                
                issues.push(this.createIssue(
                    document,
                    new vscode.Range(line, 0, line, match[0].length),
                    'warning',
                    'duplicate-test-name',
                    `Duplicate test name: "${name}"`,
                    {
                        detail: 'Tests with the same name make it hard to identify which one failed.',
                        confidence: 0.9,
                    }
                ));
            }
            testNames.push(name);
        }
    }
    
    private async checkFunctionEdgeCases(
        document: vscode.TextDocument,
        symbol: vscode.DocumentSymbol,
        issues: ReviewIssue[],
        token: vscode.CancellationToken
    ): Promise<void> {
        const functionText = document.getText(symbol.range);
        const lines = functionText.split('\n');
        
        const edgeCaseIndicators: Array<{ pattern: RegExp; message: string }> = [
            { pattern: /if\s*\(\s*[^)]+===?\s*(?:null|undefined|0|''|""|`)/, message: 'Tests for null/empty values needed' },
            { pattern: /if\s*\(\s*[^)]+\.length\s*/, message: 'Tests for empty array/string needed' },
            { pattern: /try\s*\{/, message: 'Tests for error handling needed' },
            { pattern: /parseInt|parseFloat|Number\s*\(/, message: 'Tests for invalid number inputs needed' },
            { pattern: /JSON\.parse|JSON\.stringify/, message: 'Tests for invalid JSON needed' },
        ];
        
        const foundEdgeCases: string[] = [];
        
        for (const line of lines) {
            if (token.isCancellationRequested) {
                break;
            }
            
            for (const indicator of edgeCaseIndicators) {
                if (indicator.pattern.test(line) && !foundEdgeCases.includes(indicator.message)) {
                    foundEdgeCases.push(indicator.message);
                }
            }
        }
        
        if (foundEdgeCases.length > 0) {
            issues.push(this.createIssue(
                document,
                symbol.range,
                'info',
                'missing-edge-case-tests',
                `Function '${symbol.name}' may need additional edge case tests`,
                {
                    detail: `Consider testing: ${foundEdgeCases.join(', ')}`,
                    confidence: 0.6,
                }
            ));
        }
    }
    
    private async checkTestFileExists(
        document: vscode.TextDocument,
        issues: ReviewIssue[]
    ): Promise<void> {
        const fileName = path.basename(document.fileName);
        const dirName = path.dirname(document.uri.fsPath);
        const ext = path.extname(fileName);
        const baseName = fileName.replace(ext, '');
        
        const testFilePatterns = [
            `${baseName}.test${ext}`,
            `${baseName}.spec${ext}`,
            `${baseName}_test${ext}`,
            `test_${baseName}${ext}`,
            path.join('__tests__', `${baseName}${ext}`),
            path.join('tests', `${baseName}${ext}`),
        ];
        
        const fs = require('fs');
        let testFileExists = false;
        
        for (const pattern of testFilePatterns) {
            const testPath = path.join(dirName, pattern);
            if (fs.existsSync(testPath)) {
                testFileExists = true;
                break;
            }
            
            const parentDir = path.dirname(dirName);
            const parentTestPath = path.join(parentDir, 'tests', pattern);
            if (fs.existsSync(parentTestPath)) {
                testFileExists = true;
                break;
            }
        }
        
        if (!testFileExists) {
            issues.push(this.createIssue(
                document,
                new vscode.Range(0, 0, 0, 0),
                'info',
                'no-test-file',
                `No test file found for ${fileName}`,
                {
                    detail: 'Consider adding tests for this file to ensure code quality and prevent regressions.',
                    confidence: 0.5,
                }
            ));
        }
    }
}
