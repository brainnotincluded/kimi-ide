/**
 * Kimi IDE - Code Review Utilities
 * Вспомогательные функции для системы ревью
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { ReviewIssue, ReviewCategory, ReviewSeverity, ReviewSummary } from './types';

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a hash for an issue (for deduplication)
 */
export function generateIssueHash(
    category: ReviewCategory,
    fileUri: vscode.Uri,
    range: vscode.Range,
    message: string
): string {
    const data = `${category}:${fileUri.toString()}:${range.start.line}:${range.start.character}:${message}`;
    return crypto.createHash('md5').update(data).digest('hex');
}

/**
 * Calculate content hash for a document
 */
export function calculateContentHash(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Convert review severity to VS Code diagnostic severity
 */
export function toDiagnosticSeverity(severity: ReviewSeverity): vscode.DiagnosticSeverity {
    switch (severity) {
        case 'error':
            return vscode.DiagnosticSeverity.Error;
        case 'warning':
            return vscode.DiagnosticSeverity.Warning;
        case 'info':
            return vscode.DiagnosticSeverity.Information;
        case 'hint':
            return vscode.DiagnosticSeverity.Hint;
        default:
            return vscode.DiagnosticSeverity.Information;
    }
}

/**
 * Convert VS Code diagnostic severity to review severity
 */
export function fromDiagnosticSeverity(severity: vscode.DiagnosticSeverity): ReviewSeverity {
    switch (severity) {
        case vscode.DiagnosticSeverity.Error:
            return 'error';
        case vscode.DiagnosticSeverity.Warning:
            return 'warning';
        case vscode.DiagnosticSeverity.Information:
            return 'info';
        case vscode.DiagnosticSeverity.Hint:
            return 'hint';
        default:
            return 'info';
    }
}

/**
 * Create a review summary from issues
 */
export function createSummary(issues: ReviewIssue[]): ReviewSummary {
    const byCategory = {
        semantic: 0,
        style: 0,
        security: 0,
        performance: 0,
        test: 0,
        maintainability: 0,
    };

    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let hintCount = 0;
    let hasAutoFixes = 0;

    for (const issue of issues) {
        byCategory[issue.category]++;
        
        switch (issue.severity) {
            case 'error':
                errorCount++;
                break;
            case 'warning':
                warningCount++;
                break;
            case 'info':
                infoCount++;
                break;
            case 'hint':
                hintCount++;
                break;
        }

        if (issue.quickFixes && issue.quickFixes.length > 0) {
            hasAutoFixes++;
        }
    }

    const totalIssues = issues.length;
    
    // Calculate score (simple algorithm: start with 100, deduct points)
    let score = 100;
    score -= errorCount * 10;
    score -= warningCount * 5;
    score -= infoCount * 1;
    score = Math.max(0, Math.min(100, score));

    return {
        totalIssues,
        errorCount,
        warningCount,
        infoCount,
        hintCount,
        byCategory,
        hasAutoFixes,
        score,
    };
}

/**
 * Check if a file matches patterns
 */
export function matchesPatterns(
    filePath: string,
    includePatterns: string[],
    excludePatterns: string[]
): boolean {
    // Check exclude patterns first
    for (const pattern of excludePatterns) {
        if (minimatch(filePath, pattern)) {
            return false;
        }
    }

    // If no include patterns, include all
    if (includePatterns.length === 0) {
        return true;
    }

    // Check include patterns
    for (const pattern of includePatterns) {
        if (minimatch(filePath, pattern)) {
            return true;
        }
    }

    return false;
}

/**
 * Simple minimatch implementation for pattern matching
 */
function minimatch(path: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
        .replace(/\*\*/g, '{{GLOBSTAR}}')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '.')
        .replace(/\{\{GLOBSTAR\}\}/g, '.*');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
}

/**
 * Get the range of a specific line
 */
export function getLineRange(document: vscode.TextDocument, line: number): vscode.Range {
    const lineText = document.lineAt(line);
    return new vscode.Range(line, 0, line, lineText.text.length);
}

/**
 * Get the range of multiple lines
 */
export function getLinesRange(
    document: vscode.TextDocument,
    startLine: number,
    endLine: number
): vscode.Range {
    const start = new vscode.Position(startLine, 0);
    const endLineText = document.lineAt(endLine);
    const end = new vscode.Position(endLine, endLineText.text.length);
    return new vscode.Range(start, end);
}

/**
 * Extract context around a range
 */
export function extractContext(
    document: vscode.TextDocument,
    range: vscode.Range,
    linesBefore: number = 3,
    linesAfter: number = 3
): string {
    const startLine = Math.max(0, range.start.line - linesBefore);
    const endLine = Math.min(document.lineCount - 1, range.end.line + linesAfter);
    
    const contextRange = getLinesRange(document, startLine, endLine);
    return document.getText(contextRange);
}

/**
 * Find the indentation of a line
 */
export function getIndentation(line: string): string {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
    if (ms < 1000) {
        return `${ms}ms`;
    }
    if (ms < 60000) {
        return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * Truncate a string to a maximum length
 */
export function truncate(str: string, maxLength: number, suffix: string = '...'): string {
    if (str.length <= maxLength) {
        return str;
    }
    return str.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Escape special regex characters
 */
export function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a position is within a range
 */
export function isPositionInRange(position: vscode.Position, range: vscode.Range): boolean {
    return range.contains(position);
}

/**
 * Get the symbol at a position
 */
export async function getSymbolAtPosition(
    document: vscode.TextDocument,
    position: vscode.Position
): Promise<vscode.DocumentSymbol | undefined> {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
        'vscode.executeDocumentSymbolProvider',
        document.uri
    );
    
    if (!symbols) {
        return undefined;
    }
    
    function findSymbol(
        symbols: vscode.DocumentSymbol[],
        position: vscode.Position
    ): vscode.DocumentSymbol | undefined {
        for (const symbol of symbols) {
            if (symbol.range.contains(position)) {
                const child = findSymbol(symbol.children, position);
                return child || symbol;
            }
        }
        return undefined;
    }
    
    return findSymbol(symbols, position);
}

/**
 * Debounce a function
 */
export function debounce<T extends (...args: any[]) => any>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | undefined;
    
    return (...args: Parameters<T>) => {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => fn(...args), delay);
    };
}

/**
 * Throttle a function
 */
export function throttle<T extends (...args: any[]) => any>(
    fn: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle = false;
    
    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            fn(...args);
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
            }, limit);
        }
    };
}
