import * as vscode from 'vscode';

/**
 * Get the indentation of a line
 */
export function getIndentation(line: string): string {
    const match = line.match(/^(\s*)/);
    return match ? match[1] : '';
}

/**
 * Detect the indentation style of a document
 */
export function detectIndentation(document: vscode.TextDocument): {
    style: 'tabs' | 'spaces';
    size: number;
} {
    let spacesCount = 0;
    let tabsCount = 0;
    const indentSizes: number[] = [];

    for (let i = 0; i < Math.min(document.lineCount, 100); i++) {
        const line = document.lineAt(i).text;
        if (line.trim().length === 0) continue;

        const match = line.match(/^(\s*)/);
        if (match && match[1].length > 0) {
            const indent = match[1];
            if (indent.includes('\t')) {
                tabsCount++;
            } else {
                spacesCount++;
                indentSizes.push(indent.length);
            }
        }
    }

    if (tabsCount > spacesCount) {
        return { style: 'tabs', size: 1 };
    }

    // Calculate most common space indentation
    if (indentSizes.length > 0) {
        const size = mode(indentSizes);
        return { style: 'spaces', size: size || 4 };
    }

    return { style: 'spaces', size: 4 };
}

/**
 * Calculate mode of an array
 */
function mode(numbers: number[]): number {
    const counts = new Map<number, number>();
    let maxCount = 0;
    let maxNum = numbers[0];

    for (const num of numbers) {
        const count = (counts.get(num) || 0) + 1;
        counts.set(num, count);
        if (count > maxCount) {
            maxCount = count;
            maxNum = num;
        }
    }

    return maxNum;
}

/**
 * Normalize indentation in code
 */
export function normalizeIndentation(
    code: string,
    targetIndent: string,
    currentIndent?: string
): string {
    const lines = code.split('\n');
    
    if (!currentIndent) {
        // Detect current indentation from first non-empty line
        for (const line of lines) {
            if (line.trim().length > 0) {
                currentIndent = getIndentation(line);
                break;
            }
        }
    }

    if (!currentIndent || currentIndent === targetIndent) {
        return code;
    }

    return lines
        .map((line) => {
            if (line.startsWith(currentIndent!)) {
                return targetIndent + line.slice(currentIndent!.length);
            }
            return line;
        })
        .join('\n');
}

/**
 * Get surrounding context of a range
 */
export function getSurroundingContext(
    document: vscode.TextDocument,
    range: vscode.Range,
    linesBefore: number = 10,
    linesAfter: number = 10
): { before: string; after: string; fullRange: vscode.Range } {
    const contextStartLine = Math.max(0, range.start.line - linesBefore);
    const contextEndLine = Math.min(
        document.lineCount - 1,
        range.end.line + linesAfter
    );

    const beforeRange = new vscode.Range(
        new vscode.Position(contextStartLine, 0),
        new vscode.Position(range.start.line, 0)
    );

    const afterRange = new vscode.Range(
        new vscode.Position(range.end.line + 1, 0),
        new vscode.Position(
            contextEndLine,
            document.lineAt(contextEndLine).text.length
        )
    );

    return {
        before: document.getText(beforeRange),
        after: document.getText(afterRange),
        fullRange: new vscode.Range(
            new vscode.Position(contextStartLine, 0),
            new vscode.Position(
                contextEndLine,
                document.lineAt(contextEndLine).text.length
            )
        ),
    };
}

/**
 * Extract the most relevant section of code for context
 */
export function extractRelevantContext(
    document: vscode.TextDocument,
    range: vscode.Range,
    maxChars: number = 2000
): string {
    const fullText = document.getText();
    const selectedText = document.getText(range);
    
    if (fullText.length <= maxChars) {
        return fullText;
    }

    // Try to get surrounding context
    const charsBefore = Math.floor((maxChars - selectedText.length) / 2);
    const startOffset = Math.max(0, document.offsetAt(range.start) - charsBefore);
    const endOffset = Math.min(
        fullText.length,
        document.offsetAt(range.end) + charsBefore
    );

    let context = fullText.slice(startOffset, endOffset);

    // Add ellipsis if truncated
    if (startOffset > 0) {
        context = '// ... (truncated)\n' + context;
    }
    if (endOffset < fullText.length) {
        context = context + '\n// ... (truncated)';
    }

    return context;
}

/**
 * Check if code is likely incomplete
 */
export function isIncompleteCode(code: string): boolean {
    const openBraces = (code.match(/{/g) || []).length;
    const closeBraces = (code.match(/}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;

    return (
        openBraces !== closeBraces ||
        openParens !== closeParens ||
        openBrackets !== closeBrackets
    );
}

/**
 * Format language ID for display
 */
export function formatLanguageName(languageId: string): string {
    const languageNames: Record<string, string> = {
        typescript: 'TypeScript',
        javascript: 'JavaScript',
        python: 'Python',
        java: 'Java',
        cpp: 'C++',
        csharp: 'C#',
        go: 'Go',
        rust: 'Rust',
        ruby: 'Ruby',
        php: 'PHP',
        swift: 'Swift',
        kotlin: 'Kotlin',
        scala: 'Scala',
        r: 'R',
        matlab: 'MATLAB',
        sql: 'SQL',
        html: 'HTML',
        css: 'CSS',
        scss: 'SCSS',
        sass: 'Sass',
        less: 'Less',
        json: 'JSON',
        yaml: 'YAML',
        xml: 'XML',
        markdown: 'Markdown',
    };

    return languageNames[languageId] || languageId.toUpperCase();
}

/**
 * Clean up markdown code blocks from AI response
 */
export function extractCodeFromMarkdown(content: string): string {
    // Check for fenced code blocks
    const fencedMatch = content.match(/```[\w]*\n?([\s\S]*?)```/);
    if (fencedMatch) {
        return fencedMatch[1].trim();
    }

    // Check for inline code
    if (content.startsWith('`') && content.endsWith('`')) {
        return content.slice(1, -1).trim();
    }

    return content.trim();
}

/**
 * Generate a diff between two texts
 */
export function generateDiff(
    original: string,
    modified: string,
    contextLines: number = 3
): string {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    
    const result: string[] = [];
    result.push('--- Original');
    result.push('+++ Modified');
    result.push('');

    let oldLine = 1;
    let newLine = 1;

    const maxLen = Math.max(originalLines.length, modifiedLines.length);
    
    for (let i = 0; i < maxLen; i++) {
        const orig = originalLines[i];
        const mod = modifiedLines[i];

        if (i >= originalLines.length) {
            result.push(`+${mod}`);
            newLine++;
        } else if (i >= modifiedLines.length) {
            result.push(`-${orig}`);
            oldLine++;
        } else if (orig !== mod) {
            result.push(`-${orig}`);
            result.push(`+${mod}`);
            oldLine++;
            newLine++;
        } else {
            result.push(` ${orig}`);
            oldLine++;
            newLine++;
        }
    }

    return result.join('\n');
}
