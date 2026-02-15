/**
 * Kimi IDE - Semantic Reviewer
 * Проверяет логику кода, ищет потенциальные баги и edge cases
 */

import * as vscode from 'vscode';
import { BaseReviewer } from './baseReviewer';
import { ReviewIssue, ReviewCategory } from '../types';
import { logger } from '../../utils/logger';

interface Pattern {
    name: string;
    regex: RegExp;
    languages: string[];
    severity: ReviewIssue['severity'];
    message: string;
    suggestion?: string;
}

export class SemanticReviewer extends BaseReviewer {
    readonly id = 'semantic';
    readonly name = 'Semantic Analyzer';
    readonly category: ReviewCategory = 'semantic';
    
    private patterns: Pattern[] = [
        // Common logic errors
        {
            name: 'assignment-in-condition',
            regex: /if\s*\(\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*=\s*[^=]/,
            languages: ['javascript', 'typescript', 'java', 'c', 'cpp'],
            severity: 'warning',
            message: 'Possible assignment in condition. Did you mean to use === or ==?',
            suggestion: 'Use === or == for comparison, or wrap assignment in parentheses',
        },
        {
            name: 'double-equals',
            regex: /[^=!]==[^=]/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'Using == instead of === can lead to unexpected type coercion',
            suggestion: 'Use === for strict equality comparison',
        },
        {
            name: 'undefined-check',
            regex: /typeof\s+[^=]+==\s*['"]undefined['"]/,
            languages: ['javascript', 'typescript'],
            severity: 'hint',
            message: 'Consider using strict equality (===) for undefined checks',
        },
        {
            name: 'empty-catch',
            regex: /catch\s*\([^)]*\)\s*\{\s*\}/,
            languages: ['javascript', 'typescript', 'java', 'c', 'cpp'],
            severity: 'warning',
            message: 'Empty catch block silently ignores errors',
            suggestion: 'Add error logging or handling in the catch block',
        },
        {
            name: 'promise-no-await',
            regex: /new\s+Promise\s*\(/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'Promise constructor used. Ensure proper error handling.',
        },
        {
            name: 'settimeout-string',
            regex: /setTimeout\s*\(\s*['"`]/,
            languages: ['javascript', 'typescript'],
            severity: 'error',
            message: 'setTimeout with string argument is unsafe (eval-like)',
            suggestion: 'Use a function reference instead of a string',
        },
        {
            name: 'null-check-before-typeof',
            regex: /typeof\s+[^=]+!==?\s*['"]undefined['"]\s*&&\s*[^=]+!==?\s*null/,
            languages: ['javascript', 'typescript'],
            severity: 'hint',
            message: 'typeof check already handles null case in some contexts',
        },
        {
            name: 'array-indexof-negative',
            regex: /\.indexOf\([^)]+\)\s*>=?\s*0/,
            languages: ['javascript', 'typescript', 'java'],
            severity: 'hint',
            message: 'Consider using includes() or indexOf(...) !== -1 for clarity',
        },
        {
            name: 'floating-point-equality',
            regex: /[0-9]+\.[0-9]+\s*===?\s*/,
            languages: ['javascript', 'typescript', 'python', 'java', 'c', 'cpp'],
            severity: 'warning',
            message: 'Direct equality comparison with floating point numbers can be unreliable',
            suggestion: 'Use an epsilon value for floating point comparisons',
        },
        {
            name: 'unused-loop-variable',
            regex: /for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*</,
            languages: ['javascript', 'typescript'],
            severity: 'hint',
            message: 'Ensure loop variable is actually used inside the loop',
        },
        {
            name: 'suspicious-semicolon',
            regex: /if\s*\([^)]*\)\s*;\s*\n/,
            languages: ['javascript', 'typescript', 'java', 'c', 'cpp'],
            severity: 'error',
            message: 'Suspicious semicolon after if statement',
            suggestion: 'Remove the semicolon or add braces for clarity',
        },
        {
            name: 'comparison-to-itself',
            regex: /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*===?\s*\1\b/,
            languages: ['javascript', 'typescript', 'python', 'java', 'c', 'cpp'],
            severity: 'warning',
            message: 'Comparison of a variable to itself always has the same result',
        },
        {
            name: 'unreachable-code',
            regex: /return[^;]*;\s*[^}\s]/,
            languages: ['javascript', 'typescript', 'java', 'c', 'cpp'],
            severity: 'warning',
            message: 'Code after return statement may be unreachable',
        },
        {
            name: 'implicit-any',
            regex: /:\s*any\s*[;,=)]/,
            languages: ['typescript'],
            severity: 'info',
            message: 'Using explicit \'any\' type reduces type safety',
            suggestion: 'Consider using a more specific type',
        },
        {
            name: 'non-null-assertion',
            regex: /![.,;)\]}\s]/,
            languages: ['typescript'],
            severity: 'warning',
            message: 'Non-null assertion (!) bypasses type checking',
            suggestion: 'Add proper null checks or use optional chaining (?.)',
        },
        {
            name: 'optional-chain-length',
            regex: /\?\?\s*\.length/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Optional chaining with .length may return undefined instead of 0',
            suggestion: 'Use (arr?.length ?? 0) for a safe length check',
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
        
        // Get applicable patterns for this language
        const applicablePatterns = this.patterns.filter(
            p => p.languages.length === 0 || p.languages.includes(document.languageId)
        );
        
        for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
            if (token.isCancellationRequested) {
                break;
            }
            
            const line = lines[lineIndex];
            
            for (const pattern of applicablePatterns) {
                pattern.regex.lastIndex = 0;
                
                let match: RegExpExecArray | null;
                while ((match = pattern.regex.exec(line)) !== null) {
                    const startChar = match.index;
                    const endChar = startChar + match[0].length;
                    
                    const range = new vscode.Range(
                        lineIndex,
                        startChar,
                        lineIndex,
                        endChar
                    );
                    
                    const issue = this.createIssue(
                        document,
                        range,
                        pattern.severity,
                        pattern.name,
                        pattern.message,
                        {
                            detail: pattern.suggestion,
                            confidence: 0.85,
                        }
                    );
                    
                    // Add quick fix if suggestion available
                    if (pattern.suggestion) {
                        issue.quickFixes = [{
                            id: `fix-${issue.id}`,
                            title: `Fix: ${pattern.suggestion}`,
                            description: pattern.suggestion,
                            isPreferred: true,
                            edit: new vscode.WorkspaceEdit(),
                        }];
                    }
                    
                    issues.push(issue);
                }
            }
            
            // Check for specific complex patterns
            await this.checkComplexPatterns(document, lineIndex, line, issues, token);
        }
        
        // Check for function-level patterns
        await this.checkFunctionPatterns(document, issues, token);
        
        return issues;
    }
    
    private async checkComplexPatterns(
        document: vscode.TextDocument,
        lineIndex: number,
        line: string,
        issues: ReviewIssue[],
        token: vscode.CancellationToken
    ): Promise<void> {
        // Check for potential null/undefined access patterns
        if (document.languageId === 'javascript' || document.languageId === 'typescript') {
            // Check for direct property access after optional chain
            const optionalChainPattern = /(\w+\?\.[\w.]+)\.(\w+)/g;
            let match: RegExpExecArray | null;
            
            while ((match = optionalChainPattern.exec(line)) !== null) {
                const fullMatch = match[0];
                const optionalPart = match[1];
                
                // Check if this is potentially unsafe
                if (!line.includes('?.') || !optionalPart.includes('?.')) {
                    continue;
                }
                
                const range = new vscode.Range(
                    lineIndex,
                    match.index,
                    lineIndex,
                    match.index + fullMatch.length
                );
                
                issues.push(this.createIssue(
                    document,
                    range,
                    'warning',
                    'potential-null-access',
                    `Property access after optional chain may fail if the optional chain returns undefined`,
                    {
                        detail: `Consider using optional chaining for '${match[2]}' or add a null check`,
                        confidence: 0.75,
                    }
                ));
            }
        }
        
        // Check for missing await in async context
        if ((document.languageId === 'javascript' || document.languageId === 'typescript') && 
            line.includes('async')) {
            const functionMatch = line.match(/async\s+function\s+(\w+)/) || 
                                  line.match(/async\s+(\w+)\s*\(/);
            if (functionMatch) {
                // Will check body in function-level patterns
            }
        }
    }
    
    private async checkFunctionPatterns(
        document: vscode.TextDocument,
        issues: ReviewIssue[],
        token: vscode.CancellationToken
    ): Promise<void> {
        const text = document.getText();
        
        // Try to get document symbols
        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );
            
            if (!symbols) {
                return;
            }
            
            const checkSymbol = async (symbol: vscode.DocumentSymbol) => {
                if (token.isCancellationRequested) {
                    return;
                }
                
                // Check async functions for missing await
                if (symbol.kind === vscode.SymbolKind.Function ||
                    symbol.kind === vscode.SymbolKind.Method) {
                    await this.checkAsyncFunction(document, symbol, issues);
                }
                
                // Check recursion depth
                if (symbol.children.length > 0) {
                    for (const child of symbol.children) {
                        await checkSymbol(child);
                    }
                }
            };
            
            for (const symbol of symbols) {
                await checkSymbol(symbol);
            }
            
        } catch (error) {
            logger.debug('Could not get document symbols for semantic review:', error);
        }
    }
    
    private async checkAsyncFunction(
        document: vscode.TextDocument,
        symbol: vscode.DocumentSymbol,
        issues: ReviewIssue[]
    ): Promise<void> {
        const functionText = document.getText(symbol.range);
        
        // Check for async function
        if (!functionText.includes('async')) {
            return;
        }
        
        // Look for promise-returning calls without await
        const lines = functionText.split('\n');
        const promisePatterns = [
            /(\w+)\s*\(\s*[^)]*\)\s*[;)]/g, // Function calls
        ];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Simple heuristic: common promise-returning functions
            const suspiciousCalls = [
                'fetch', 'axios', 'request', 'query', 'find', 'findOne',
                'findMany', 'create', 'update', 'delete', 'save',
            ];
            
            for (const call of suspiciousCalls) {
                const regex = new RegExp(`\\b${call}\\s*\\(`, 'g');
                let match: RegExpExecArray | null;
                
                while ((match = regex.exec(line)) !== null) {
                    // Check if already awaited
                    const beforeCall = line.substring(0, match.index).trim();
                    if (beforeCall.endsWith('await') || beforeCall.endsWith('void')) {
                        continue;
                    }
                    
                    // Check if it's being returned or assigned
                    const afterCall = line.substring(match.index + match[0].length);
                    if (afterCall.includes('.then') || afterCall.includes('.catch')) {
                        continue;
                    }
                    
                    const range = new vscode.Range(
                        symbol.range.start.line + i,
                        match.index,
                        symbol.range.start.line + i,
                        match.index + match[0].length
                    );
                    
                    issues.push(this.createIssue(
                        document,
                        range,
                        'info',
                        'possible-missing-await',
                        `Possible missing 'await' for async call '${call}'`,
                        {
                            detail: 'If this function returns a Promise, you may need to await it',
                            confidence: 0.6,
                        }
                    ));
                }
            }
        }
    }
}
