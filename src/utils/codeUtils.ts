/**
 * Code utility functions for Kimi IDE
 * Handles code analysis, manipulation, and formatting
 */

import { logger } from './logger';

/**
 * Extract import statements from code
 */
export function extractImports(code: string): string[] {
    const imports: string[] = [];
    const lines = code.split('\n');
    
    for (const line of lines) {
        const trimmed = line.trim();
        // Match ES6 imports
        if (trimmed.startsWith('import ')) {
            imports.push(trimmed);
        }
        // Match CommonJS requires
        else if (trimmed.match(/^const\s+.*?=\s+require\(/)) {
            imports.push(trimmed);
        }
    }
    
    return imports;
}

/**
 * Get the leading whitespace (indentation) of a line
 */
export function getIndentation(line: string): string {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
}

/**
 * Detect the indentation style used in code
 */
export function detectIndentation(code: string): { type: 'spaces' | 'tabs'; indent: string; size: number } {
    const lines = code.split('\n');
    const indentCounts: Map<string, number> = new Map();
    
    for (const line of lines) {
        const indent = getIndentation(line);
        if (indent) {
            indentCounts.set(indent, (indentCounts.get(indent) || 0) + 1);
        }
    }
    
    // Find most common indent
    let mostCommon = '';
    let maxCount = 0;
    for (const [indent, count] of indentCounts) {
        if (count > maxCount) {
            mostCommon = indent;
            maxCount = count;
        }
    }
    
    if (mostCommon.includes('\t')) {
        return { type: 'tabs', indent: '\t', size: mostCommon.length };
    }
    
    const spaceCount = mostCommon.length || 4;
    return { type: 'spaces', indent: ' '.repeat(spaceCount), size: spaceCount };
}

/**
 * Normalize indentation in code
 */
export function normalizeIndentation(
    code: string,
    targetType: 'spaces' | 'tabs',
    targetSize: number = 4
): string {
    const detected = detectIndentation(code);
    if (detected.type === targetType && detected.size === targetSize) {
        return code;
    }
    
    const lines = code.split('\n');
    const normalized = lines.map(line => {
        const currentIndent = getIndentation(line);
        if (!currentIndent) return line;
        
        // Convert to spaces first
        let spaces = currentIndent;
        if (detected.type === 'tabs') {
            spaces = currentIndent.replace(/\t/g, ' '.repeat(detected.size));
        }
        
        // Calculate indent level
        const indentLevel = Math.floor(spaces.length / detected.size);
        
        // Convert to target
        if (targetType === 'tabs') {
            return '\t'.repeat(indentLevel) + line.trimStart();
        } else {
            return ' '.repeat(indentLevel * targetSize) + line.trimStart();
        }
    });
    
    return normalized.join('\n');
}

/**
 * Check if a line is a comment
 */
export function isComment(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || 
           trimmed.startsWith('/*') || 
           trimmed.startsWith('*') ||
           trimmed.startsWith('#');
}

/**
 * Check if a line is empty or whitespace only
 */
export function isEmptyOrWhitespace(line: string): boolean {
    return line.trim().length === 0;
}

/**
 * Count lines in code
 */
export function countLines(code: string): number {
    if (code === '') return 1;
    return code.split('\n').length;
}

/**
 * Truncate code to maximum number of lines
 */
export function truncateCode(code: string, maxLines: number): string {
    const lines = code.split('\n');
    if (lines.length <= maxLines) {
        return code;
    }
    
    const half = Math.floor(maxLines / 2);
    const first = lines.slice(0, half).join('\n');
    const last = lines.slice(-half).join('\n');
    
    return `${first}\n// ... truncated ...\n${last}`;
}

/**
 * Escape special regex characters
 */
export function escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert camelCase to snake_case
 */
export function camelToSnake(str: string): string {
    return str
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
}

/**
 * Convert snake_case to camelCase
 */
export function snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert kebab-case to camelCase
 */
export function kebabToCamel(str: string): string {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert camelCase to kebab-case
 */
export function camelToKebab(str: string): string {
    return str
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/^-/, '');
}

/**
 * Extract function definitions from code
 */
export function extractFunctions(code: string): Array<{
    name: string;
    params: string[];
    startLine: number;
    endLine: number;
}> {
    const functions: Array<{ name: string; params: string[]; startLine: number; endLine: number }> = [];
    const lines = code.split('\n');
    
    // Match function declarations, arrow functions, and methods
    const functionRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/;
    const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/;
    const methodRegex = /(?:async\s+)?(\w+)\s*\(([^)]*)\)\s*{/;
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;
        
        if ((match = line.match(functionRegex)) || 
            (match = line.match(arrowRegex)) ||
            (match = line.match(methodRegex))) {
            functions.push({
                name: match[1],
                params: match[2].split(',').map(p => p.trim()).filter(Boolean),
                startLine: i,
                endLine: i, // Would need proper brace matching for accurate end
            });
        }
    }
    
    return functions;
}

/**
 * Get the context around a specific line
 */
export function getContext(
    code: string,
    targetLine: number,
    contextLines: number = 5
): string {
    const lines = code.split('\n');
    const start = Math.max(0, targetLine - contextLines);
    const end = Math.min(lines.length, targetLine + contextLines + 1);
    
    return lines.slice(start, end).join('\n');
}

/**
 * Find matching brace pairs
 */
export function findBracePairs(code: string): Array<{ open: number; close: number }> {
    const pairs: Array<{ open: number; close: number }> = [];
    const stack: number[] = [];
    
    for (let i = 0; i < code.length; i++) {
        if (code[i] === '{') {
            stack.push(i);
        } else if (code[i] === '}') {
            const open = stack.pop();
            if (open !== undefined) {
                pairs.push({ open, close: i });
            }
        }
    }
    
    return pairs;
}

/**
 * Check if code is valid TypeScript/JavaScript syntax
 */
export function isValidSyntax(code: string): boolean {
    try {
        // Basic syntax check - look for common errors
        const bracePairs = findBracePairs(code);
        const openBraces = (code.match(/{/g) || []).length;
        const closeBraces = (code.match(/}/g) || []).length;
        
        if (openBraces !== closeBraces) {
            return false;
        }
        
        const openParens = (code.match(/\(/g) || []).length;
        const closeParens = (code.match(/\)/g) || []).length;
        
        if (openParens !== closeParens) {
            return false;
        }
        
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get the complexity score of a function
 */
export function getComplexityScore(code: string): number {
    let score = 0;
    
    // Count control flow statements
    const controlFlow = [
        /\bif\b/g,
        /\belse\s+if\b/g,
        /\bfor\b/g,
        /\bwhile\b/g,
        /\bdo\b/g,
        /\bswitch\b/g,
        /\bcase\b/g,
        /\bcatch\b/g,
        /\?\s*[^:?]+\s*:/g, // ternary
    ];
    
    for (const pattern of controlFlow) {
        const matches = code.match(pattern);
        if (matches) {
            score += matches.length;
        }
    }
    
    // Count logical operators
    const logicalOps = (code.match(/&&|\|\|/g) || []).length;
    score += logicalOps;
    
    return score;
}

/**
 * Format a code snippet for display
 */
export function formatCodeSnippet(code: string, maxLength: number = 100): string {
    const lines = code.split('\n');
    let formatted = lines.slice(0, 3).join('\n');
    
    if (lines.length > 3) {
        formatted += `\n... (${lines.length - 3} more lines)`;
    }
    
    if (formatted.length > maxLength) {
        formatted = formatted.substring(0, maxLength - 3) + '...';
    }
    
    return formatted;
}
