/**
 * Kimi IDE - Performance Reviewer
 * Проверяет performance issues, memory leaks, inefficient algorithms
 */

import * as vscode from 'vscode';
import { BaseReviewer } from './baseReviewer';
import { ReviewIssue, ReviewCategory } from '../types';
import { logger } from '../../utils/logger';

interface PerformancePattern {
    name: string;
    regex: RegExp;
    languages: string[];
    severity: ReviewIssue['severity'];
    message: string;
    description?: string;
    complexity?: string;
}

export class PerformanceReviewer extends BaseReviewer {
    readonly id = 'performance';
    readonly name = 'Performance Analyzer';
    readonly category: ReviewCategory = 'performance';
    
    private performancePatterns: PerformancePattern[] = [
        // Memory leaks
        {
            name: 'event-listener-leak',
            regex: /addEventListener\s*\(\s*['"`][^'"`]+['"`]\s*,\s*function/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Event listener may cause memory leak if not removed',
            description: 'Event listeners added without corresponding removeEventListener can cause memory leaks, especially in SPAs.',
        },
        {
            name: 'missing-cleanup-useEffect',
            regex: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*addEventListener/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'useEffect may need cleanup function',
            description: 'useEffect hooks that add event listeners, intervals, or subscriptions should return a cleanup function.',
        },
        {
            name: 'setinterval-no-clear',
            regex: /setInterval\s*\(/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'setInterval should be cleared to prevent memory leaks',
            description: 'Always store the interval ID and clear it when the component unmounts or is no longer needed.',
        },
        {
            name: 'subscription-leak',
            regex: /\.subscribe\s*\(/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Subscription may cause memory leak if not unsubscribed',
            description: 'RxJS or Observable subscriptions should be unsubscribed when no longer needed.',
        },
        
        // Inefficient DOM operations
        {
            name: 'inefficient-dom-query',
            regex: /document\.(?:getElementById|getElementsByClassName|querySelector)\s*\([^)]+\)/g,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'DOM query inside function/loop - consider caching the result',
            description: 'Repeated DOM queries can be expensive. Cache the result in a variable if used multiple times.',
        },
        {
            name: 'forced-reflow',
            regex: /(?:offsetHeight|offsetWidth|clientHeight|clientWidth|scrollHeight|scrollWidth|getBoundingClientRect)\s*.*=.*(?:style\.|classList\.)/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Reading layout properties after style changes causes forced reflow',
            description: 'Accessing layout properties (offsetHeight, etc.) after modifying styles forces the browser to recalculate layout.',
        },
        {
            name: 'innerHTML-in-loop',
            regex: /for\s*\([^)]*\)\s*\{[^}]*\.innerHTML\s*\+?=/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Modifying innerHTML in a loop is inefficient',
            description: 'Multiple DOM updates in a loop cause multiple reflows. Build the string and set innerHTML once, or use DocumentFragment.',
        },
        
        // React-specific performance
        {
            name: 'anonymous-function-render',
            regex: /render\s*\(\s*\)\s*\{[^}]*=>\s*\{/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'Anonymous function in render can cause unnecessary re-renders',
            description: 'Creating functions in render creates new references on each render, causing child components to re-render.',
        },
        {
            name: 'object-literal-render',
            regex: /render\s*\(\s*\)\s*\{[^}]*style\s*=\s*\{\s*\{/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'Object literal in render can cause unnecessary re-renders',
            description: 'Creating object literals in render creates new references on each render. Define outside component or use memo.',
        },
        {
            name: 'array-literal-render',
            regex: /render\s*\(\s*\)\s*\{[^}]*=\s*\[[^\]]*\]/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'Array literal in render can cause unnecessary re-renders',
            description: 'Creating array literals in render creates new references on each render. Define outside component or use useMemo.',
        },
        {
            name: 'useEffect-missing-deps',
            regex: /useEffect\s*\(\s*\(\s*\)\s*=>\s*\{[^}]*\}\s*\)/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'useEffect missing dependency array',
            description: 'useEffect without a dependency array runs on every render. Add [] for mount-only or proper dependencies.',
        },
        {
            name: 'useCallback-missing-deps',
            regex: /useCallback\s*\([^,]+\s*,\s*\[\s*\]\s*\)/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'useCallback with empty dependency array may capture stale values',
            description: 'useCallback with [] captures initial values. Ensure this is intentional, or add proper dependencies.',
        },
        
        // JavaScript/TypeScript performance
        {
            name: 'array-includes-indexof',
            regex: /\.indexOf\s*\([^)]+\)\s*[!]==?\s*-?1/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'Consider using Array.prototype.includes()',
            description: 'arr.includes(x) is more readable than arr.indexOf(x) !== -1.',
        },
        {
            name: 'inefficient-array-iteration',
            regex: /for\s*\(\s*let\s+\w+\s*=\s*0\s*;\s*\w+\s*<\s*\w+\.length\s*;\s*\w+\+\+\s*\)/,
            languages: ['javascript', 'typescript'],
            severity: 'hint',
            message: 'Array length is accessed on each iteration',
            description: 'Cache array.length in a variable for better performance: for (let i = 0, len = arr.length; i < len; i++)',
        },
        {
            name: 'array-concat-spread',
            regex: /\[\s*\.\.\.\w+\s*,\s*\.\.\.\w+\s*\]/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'Multiple spreads create intermediate arrays',
            description: 'Using multiple spreads [...a, ...b, ...c] creates intermediate arrays. Consider concat() for large arrays.',
        },
        {
            name: 'large-object-spread',
            regex: /\{\s*\.\.\.\w+\s*,\s*\.\.\.\w+\s*\}/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'Multiple object spreads can be slow for large objects',
            description: 'Object spread operations have O(n) complexity. Avoid excessive spreading in hot paths.',
        },
        {
            name: 'array-find-loop',
            regex: /for\s*\([^)]*\)\s*\{[^}]*if\s*\([^)]*\)\s*\{[^}]*return/,
            languages: ['javascript', 'typescript'],
            severity: 'hint',
            message: 'Consider using Array.prototype.find()',
            description: 'Manual loops to find an element can be replaced with arr.find() for better readability.',
        },
        {
            name: 'json-parse-stringify-clone',
            regex: /JSON\.parse\s*\(\s*JSON\.stringify\s*\(/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'JSON.parse(JSON.stringify()) for cloning is inefficient',
            description: 'This approach is slow, loses functions and Date objects, and can throw on circular references. Use structuredClone or a proper clone library.',
        },
        {
            name: 'object-keys-iteration',
            regex: /Object\.(?:keys|entries|values)\s*\([^)]+\)\.forEach/,
            languages: ['javascript', 'typescript'],
            severity: 'hint',
            message: 'Consider using for...in or Object.entries() with for...of',
            description: 'Creating an intermediate array with Object.keys() uses extra memory. Use for...in for simple iteration.',
        },
        {
            name: 'regex-in-loop',
            regex: /for\s*\([^)]*\)\s*\{[^}]*\/[^/]+\/[^}]*\.\s*(?:match|test|replace)/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'Creating regex in loop - consider defining outside',
            description: 'Regex literals outside loops are compiled once. Inside loops, they may be compiled each iteration.',
        },
        {
            name: 'await-in-loop',
            regex: /for\s*(?:await|\([^)]*\))\s*\{[^}]*await\s+/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'await inside loop may be slower than Promise.all()',
            description: 'Sequential awaits in loops process one item at a time. Consider Promise.all() for parallel execution if order doesn\'t matter.',
        },
        
        // Algorithmic complexity
        {
            name: 'nested-loop-potential-on2',
            regex: /for\s*\([^)]*\)\s*\{[^{}]*for\s*\([^)]*\)/,
            languages: ['javascript', 'typescript', 'python', 'java', 'c', 'cpp'],
            severity: 'info',
            message: 'Nested loops detected - O(n²) complexity',
            description: 'Nested loops can lead to quadratic time complexity. Consider if this is necessary or if data structures can be optimized.',
            complexity: 'O(n²)',
        },
        {
            name: 'triple-nested-loop',
            regex: /for\s*\([^)]*\)\s*\{[^{}]*for\s*\([^)]*\)\s*\{[^{}]*for\s*\([^)]*\)/,
            languages: ['javascript', 'typescript', 'python', 'java', 'c', 'cpp'],
            severity: 'warning',
            message: 'Triple nested loops - O(n³) complexity',
            description: 'Triple nested loops have cubic time complexity and should be avoided for large datasets.',
            complexity: 'O(n³)',
        },
        
        // Python performance
        {
            name: 'python-list-concat-loop',
            regex: /for\s+\w+\s+in\s+[^:]+:[^:]*\w+\s*\+?=\s*\[/,
            languages: ['python'],
            severity: 'warning',
            message: 'List concatenation in loop is O(n²)',
            description: 'Using + or += to build lists in a loop is quadratic. Use list.append() or list comprehension instead.',
            complexity: 'O(n²)',
        },
        {
            name: 'python-string-concat-loop',
            regex: /for\s+\w+\s+in\s+[^:]+:[^:]*\w+\s*\+?=\s*['"`]/,
            languages: ['python'],
            severity: 'warning',
            message: 'String concatenation in loop is inefficient',
            description: 'String concatenation in loops creates many intermediate strings. Use str.join() or io.StringIO.',
        },
        {
            name: 'python-in-list',
            regex: /if\s+\w+\s+in\s+\[/,
            languages: ['python'],
            severity: 'info',
            message: 'Consider using a set for O(1) lookup',
            description: 'Checking membership in a list is O(n). Use a set for O(1) average case lookup if order doesn\'t matter.',
        },
        {
            name: 'python-dict-get-default',
            regex: /if\s+\w+\s+in\s+\w+:\s*\n\s*\w+\s*=\s*\w+\[\w+\]\s*\n\s*else:\s*\n\s*\w+\s*=/,
            languages: ['python'],
            severity: 'hint',
            message: 'Consider using dict.get() with default value',
            description: 'dict.get(key, default) is more concise and efficient than checking membership first.',
        },
        
        // Database performance (N+1)
        {
            name: 'potential-n-plus-one',
            regex: /for\s*\([^)]*\)\s*\{[^}]*\.(?:find|findOne|query|get|fetch)/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Potential N+1 query problem',
            description: 'Making database queries inside loops can cause N+1 query problems. Consider eager loading or batch queries.',
        },
        {
            name: 'no-limit-query',
            regex: /\.(?:find|query|select)\s*\([^)]*\)(?!.*limit)(?!.*take)/,
            languages: ['javascript', 'typescript'],
            severity: 'info',
            message: 'Database query without limit',
            description: 'Queries without a limit may return large datasets. Consider adding a limit for pagination.',
        },
        
        // File I/O
        {
            name: 'sync-file-operation',
            regex: /fs\.\w+Sync\s*\(/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'Synchronous file operation blocks the event loop',
            description: 'Synchronous file operations block other operations. Use async versions in production servers.',
        },
        {
            name: 'readFile-in-loop',
            regex: /for\s*\([^)]*\)\s*\{[^}]*fs\.read/,
            languages: ['javascript', 'typescript'],
            severity: 'warning',
            message: 'File read inside loop - consider reading once outside',
            description: 'Reading files inside loops is inefficient. Read once before the loop if possible.',
        },
    ];
    
    protected getSupportedLanguages(): string[] {
        return ['javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'go'];
    }
    
    protected async performReview(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): Promise<ReviewIssue[]> {
        const issues: ReviewIssue[] = [];
        const text = document.getText();
        const lines = text.split('\n');
        
        // Get applicable patterns
        const applicablePatterns = this.performancePatterns.filter(
            p => p.languages.includes(document.languageId)
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
                    
                    issues.push(this.createIssue(
                        document,
                        range,
                        pattern.severity,
                        pattern.name,
                        pattern.message,
                        {
                            detail: pattern.description,
                            confidence: 0.8,
                        }
                    ));
                }
            }
        }
        
        // Check for function-level performance issues
        await this.checkFunctionPerformance(document, issues, token);
        
        return issues;
    }
    
    private async checkFunctionPerformance(
        document: vscode.TextDocument,
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
            
            const checkSymbol = async (symbol: vscode.DocumentSymbol) => {
                if (token.isCancellationRequested) {
                    return;
                }
                
                const functionText = document.getText(symbol.range);
                
                // Check function complexity (simple line count heuristic)
                const lineCount = symbol.range.end.line - symbol.range.start.line;
                if (lineCount > 50) {
                    issues.push(this.createIssue(
                        document,
                        symbol.range,
                        'info',
                        'function-too-long',
                        `Function '${symbol.name}' is ${lineCount} lines long`,
                        {
                            detail: 'Consider breaking this function into smaller, more focused functions for better readability and testability.',
                            confidence: 0.7,
                        }
                    ));
                }
                
                // Check for too many parameters
                const paramMatch = functionText.match(/\(([^)]*)\)/);
                if (paramMatch) {
                    const params = paramMatch[1].split(',').filter(p => p.trim());
                    if (params.length > 5) {
                        issues.push(this.createIssue(
                            document,
                            new vscode.Range(
                                symbol.range.start.line,
                                0,
                                symbol.range.start.line,
                                100
                            ),
                            'info',
                            'too-many-parameters',
                            `Function '${symbol.name}' has ${params.length} parameters`,
                            {
                                detail: 'Functions with many parameters are harder to use. Consider using an options object or builder pattern.',
                                confidence: 0.75,
                            }
                        ));
                    }
                }
                
                // Recursively check children
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
            logger.debug('Could not get document symbols for performance review:', error);
        }
    }
}
