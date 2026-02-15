/**
 * Kimi IDE - Style Reviewer
 * Проверяет соответствие code style, naming conventions, consistency
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { BaseReviewer } from './baseReviewer';
import { ReviewIssue, ReviewCategory } from '../types';
import { logger } from '../../utils/logger';

interface NamingConvention {
    pattern: RegExp;
    description: string;
    validExample: string;
}

interface LanguageConventions {
    camelCase: NamingConvention;
    PascalCase: NamingConvention;
    snake_case: NamingConvention;
    SCREAMING_SNAKE_CASE: NamingConvention;
    kebabCase: NamingConvention;
}

const namingConventions: Record<string, LanguageConventions> = {
    javascript: {
        camelCase: { pattern: /^[a-z][a-zA-Z0-9]*$/, description: 'camelCase', validExample: 'myVariable' },
        PascalCase: { pattern: /^[A-Z][a-zA-Z0-9]*$/, description: 'PascalCase', validExample: 'MyClass' },
        snake_case: { pattern: /^[a-z][a-z0-9_]*$/, description: 'snake_case', validExample: 'my_variable' },
        SCREAMING_SNAKE_CASE: { pattern: /^[A-Z][A-Z0-9_]*$/, description: 'SCREAMING_SNAKE_CASE', validExample: 'MY_CONSTANT' },
        kebabCase: { pattern: /^[a-z][a-z0-9-]*$/, description: 'kebab-case', validExample: 'my-file' },
    },
    typescript: {
        camelCase: { pattern: /^[a-z][a-zA-Z0-9]*$/, description: 'camelCase', validExample: 'myVariable' },
        PascalCase: { pattern: /^[A-Z][a-zA-Z0-9]*$/, description: 'PascalCase', validExample: 'MyClass' },
        snake_case: { pattern: /^[a-z][a-z0-9_]*$/, description: 'snake_case', validExample: 'my_variable' },
        SCREAMING_SNAKE_CASE: { pattern: /^[A-Z][A-Z0-9_]*$/, description: 'SCREAMING_SNAKE_CASE', validExample: 'MY_CONSTANT' },
        kebabCase: { pattern: /^[a-z][a-z0-9-]*$/, description: 'kebab-case', validExample: 'my-file' },
    },
    python: {
        camelCase: { pattern: /^[a-z][a-zA-Z0-9]*$/, description: 'camelCase', validExample: 'myVariable' },
        PascalCase: { pattern: /^[A-Z][a-zA-Z0-9]*$/, description: 'PascalCase', validExample: 'MyClass' },
        snake_case: { pattern: /^[a-z][a-z0-9_]*$/, description: 'snake_case', validExample: 'my_variable' },
        SCREAMING_SNAKE_CASE: { pattern: /^[A-Z][A-Z0-9_]*$/, description: 'SCREAMING_SNAKE_CASE', validExample: 'MY_CONSTANT' },
        kebabCase: { pattern: /^[a-z][a-z0-9-]*$/, description: 'kebab-case', validExample: 'my-file' },
    },
};

export class StyleReviewer extends BaseReviewer {
    readonly id = 'style';
    readonly name = 'Style Checker';
    readonly category: ReviewCategory = 'style';
    
    private styleRules = [
        {
            name: 'trailing-whitespace',
            check: (line: string) => /[ \t]+$/.test(line),
            message: 'Line has trailing whitespace',
            severity: 'hint' as const,
        },
        {
            name: 'multiple-empty-lines',
            check: (line: string, prevLine: string | undefined) => 
                line.trim() === '' && prevLine?.trim() === '',
            message: 'Multiple consecutive empty lines',
            severity: 'hint' as const,
        },
        {
            name: 'mixed-tabs-spaces',
            check: (line: string) => /^\s*(\t+ +| +\t+)/.test(line),
            message: 'Line uses mixed tabs and spaces for indentation',
            severity: 'warning' as const,
        },
        {
            name: 'line-too-long',
            check: (line: string) => line.length > 120,
            message: 'Line exceeds 120 characters',
            severity: 'info' as const,
        },
        {
            name: 'todo-comment',
            check: (line: string) => /\/\/\s*TODO|#\s*TODO|\*\s*TODO/i.test(line),
            message: 'TODO comment found',
            severity: 'info' as const,
        },
        {
            name: 'fixme-comment',
            check: (line: string) => /\/\/\s*FIXME|#\s*FIXME|\*\s*FIXME/i.test(line),
            message: 'FIXME comment found - needs attention',
            severity: 'warning' as const,
        },
        {
            name: 'hack-comment',
            check: (line: string) => /\/\/\s*HACK|#\s*HACK|\*\s*HACK/i.test(line),
            message: 'HACK comment found - should be refactored',
            severity: 'warning' as const,
        },
        {
            name: 'console-log',
            check: (line: string) => /console\.(log|warn|error|debug)\s*\(/.test(line),
            message: 'Console statement found - consider removing for production',
            severity: 'info' as const,
        },
        {
            name: 'debugger-statement',
            check: (line: string) => /;?\s*debugger\s*;?/.test(line),
            message: 'Debugger statement should be removed',
            severity: 'error' as const,
        },
    ];
    
    protected getSupportedLanguages(): string[] {
        return ['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go', 'rust'];
    }
    
    protected async performReview(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<ReviewIssue[]> {
        const issues: ReviewIssue[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        // Check style rules
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            if (token.isCancellationRequested) {
                break;
            }
            
            const line = lines[lineIndex];
            const prevLine = lineIndex > 0 ? lines[lineIndex - 1] : undefined;
            
            for (const rule of this.styleRules) {
                if (rule.check(line, prevLine)) {
                    const range = new vscode.Range(
                        lineIndex,
                        0,
                        lineIndex,
                        line.length
                    );
                    
                    issues.push(this.createIssue(
                        document,
                        range,
                        rule.severity,
                        rule.name,
                        rule.message,
                        {
                            confidence: 0.9,
                        }
                    ));
                }
            }
            
            // Check naming conventions
            await this.checkNamingConventions(document, lineIndex, line, issues);
        }
        
        // Check file-level patterns
        await this.checkFilePatterns(document, issues, token);
        
        return issues;
    }
    
    private async checkNamingConventions(
        document: vscode.TextDocument,
        lineIndex: number,
        line: string,
        issues: ReviewIssue[]
    ): Promise<void> {
        const conventions = namingConventions[document.languageId];
        if (!conventions) {
            return;
        }
        
        // Skip comments and strings
        const codeOnly = this.extractCode(line);
        
        // Check class names (should be PascalCase)
        const classPattern = /class\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
        let match: RegExpExecArray | null;
        
        while ((match = classPattern.exec(codeOnly)) !== null) {
            const name = match[1];
            if (!conventions.PascalCase.pattern.test(name)) {
                const range = new vscode.Range(
                    lineIndex,
                    match.index + 6, // After 'class '
                    lineIndex,
                    match.index + 6 + name.length
                );
                
                issues.push(this.createIssue(
                    document,
                    range,
                    'info',
                    'naming-convention-class',
                    `Class name '${name}' should be in PascalCase`,
                    {
                        detail: `Example: ${conventions.PascalCase.validExample}`,
                        confidence: 0.8,
                    }
                ));
            }
        }
        
        // Check interface names (TypeScript - should be PascalCase)
        if (document.languageId === 'typescript') {
            const interfacePattern = /interface\s+([A-Za-z_$][A-Za-z0-9_$]*)/g;
            
            while ((match = interfacePattern.exec(codeOnly)) !== null) {
                const name = match[1];
                if (!conventions.PascalCase.pattern.test(name)) {
                    const range = new vscode.Range(
                        lineIndex,
                        match.index + 10, // After 'interface '
                        lineIndex,
                        match.index + 10 + name.length
                    );
                    
                    issues.push(this.createIssue(
                        document,
                        range,
                        'info',
                        'naming-convention-interface',
                        `Interface name '${name}' should be in PascalCase`,
                        {
                            detail: `Example: ${conventions.PascalCase.validExample}`,
                            confidence: 0.8,
                        }
                    ));
                }
            }
        }
        
        // Check function names (should be camelCase)
        const functionPattern = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)|const\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*[=:]/g;
        
        while ((match = functionPattern.exec(codeOnly)) !== null) {
            const name = match[1] || match[2];
            if (!name) continue;
            
            // Skip if it looks like a constant (all caps or starts with _)
            if (/^[A-Z_]+$/.test(name) || name.startsWith('_')) {
                continue;
            }
            
            if (!conventions.camelCase.pattern.test(name)) {
                const range = new vscode.Range(
                    lineIndex,
                    match.index,
                    lineIndex,
                    match.index + match[0].indexOf(name) + name.length - (match[0].includes('=') || match[0].includes(':') ? 0 : 0)
                );
                
                issues.push(this.createIssue(
                    document,
                    range,
                    'info',
                    'naming-convention-function',
                    `Function name '${name}' should be in camelCase`,
                    {
                        detail: `Example: ${conventions.camelCase.validExample}`,
                        confidence: 0.75,
                    }
                ));
            }
        }
        
        // Check const declarations for SCREAMING_SNAKE_CASE (constants)
        const constPattern = /const\s+([A-Z_][A-Z0-9_]*)\s*=/g;
        
        while ((match = constPattern.exec(codeOnly)) !== null) {
            const name = match[1];
            if (!conventions.SCREAMING_SNAKE_CASE.pattern.test(name)) {
                const range = new vscode.Range(
                    lineIndex,
                    match.index + 6,
                    lineIndex,
                    match.index + 6 + name.length
                );
                
                issues.push(this.createIssue(
                    document,
                    range,
                    'hint',
                    'naming-convention-constant',
                    `Consider using SCREAMING_SNAKE_CASE for constant '${name}'`,
                    {
                        detail: `Example: ${conventions.SCREAMING_SNAKE_CASE.validExample}`,
                        confidence: 0.6,
                    }
                ));
            }
        }
    }
    
    private async checkFilePatterns(
        document: vscode.TextDocument,
        issues: ReviewIssue[],
        token: vscode.CancellationToken
    ): Promise<void> {
        const fileName = path.basename(document.fileName);
        const filePath = document.uri.fsPath;
        
        // Check file naming convention based on language
        const conventions = namingConventions[document.languageId];
        if (conventions) {
            // Check for kebab-case in file names (common convention)
            if (fileName.includes('_') && !fileName.includes('-')) {
                const range = new vscode.Range(0, 0, 0, 0);
                
                issues.push(this.createIssue(
                    document,
                    range,
                    'hint',
                    'file-naming',
                    `File name '${fileName}' uses underscores. Consider using kebab-case.`,
                    {
                        detail: `Example: ${conventions.kebabCase.validExample}.ts`,
                        confidence: 0.5,
                    }
                ));
            }
        }
        
        // Check for inconsistent file extensions
        if (document.languageId === 'typescript' && fileName.endsWith('.js')) {
            const range = new vscode.Range(0, 0, 0, 0);
            
            issues.push(this.createIssue(
                document,
                range,
                'warning',
                'file-extension-mismatch',
                `TypeScript file has .js extension`,
                {
                    confidence: 0.95,
                }
            ));
        }
        
        // Check file size
        const lineCount = document.lineCount;
        if (lineCount > 500) {
            const range = new vscode.Range(0, 0, 0, 0);
            
            issues.push(this.createIssue(
                document,
                range,
                'info',
                'file-too-large',
                `File has ${lineCount} lines. Consider splitting into smaller modules.`,
                {
                    confidence: 0.7,
                }
            ));
        }
    }
    
    private extractCode(line: string): string {
        // Remove single-line comments
        let code = line.replace(/\/\/.*$/, '');
        
        // Remove string literals (simplified)
        code = code.replace(/['"`][^'"`]*['"`]/g, '""');
        
        return code;
    }
}
