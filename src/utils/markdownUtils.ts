/**
 * Markdown utility functions for Kimi IDE extension
 * Handles markdown rendering, code block extraction, HTML escaping
 */

import * as vscode from 'vscode';
import { logger } from './logger';

export interface CodeBlock {
    language: string | null;
    code: string;
    startIndex: number;
    endIndex: number;
    isComplete: boolean;
}

export interface MarkdownOptions {
    trusted?: boolean;
    supportHtml?: boolean;
}

// Language aliases mapping
const LANGUAGE_ALIASES: Record<string, string> = {
    'js': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescriptreact',
    'jsx': 'javascriptreact',
    'py': 'python',
    'rb': 'ruby',
    'cpp': 'cpp',
    'c++': 'cpp',
    'cs': 'csharp',
    'sh': 'shell',
    'bash': 'shell',
    'zsh': 'shell',
    'yml': 'yaml',
    'md': 'markdown',
    'jsonc': 'json',
};

/**
 * Extract code blocks from markdown text
 */
export function extractCodeBlocks(markdown: string): CodeBlock[] {
    const codeBlocks: CodeBlock[] = [];
    const regex = /```(\w+)?\n([\s\S]*?)(?:```|$)/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(markdown)) !== null) {
        const language = match[1] || null;
        const code = match[2] || '';
        const isComplete = match[0].endsWith('```');

        codeBlocks.push({
            language: normalizeLanguage(language),
            code: code.trimEnd(),
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            isComplete,
        });
    }

    return codeBlocks;
}

/**
 * Extract the first code block of a specific language
 */
export function extractCodeBlockOfLanguage(
    markdown: string,
    language: string
): CodeBlock | null {
    const normalizedTargetLang = normalizeLanguage(language);
    const blocks = extractCodeBlocks(markdown);
    
    return blocks.find(block => block.language === normalizedTargetLang) || null;
}

/**
 * Normalize language identifier
 */
export function normalizeLanguage(language: string | null): string | null {
    if (!language) return null;
    const normalized = language.toLowerCase().trim();
    return LANGUAGE_ALIASES[normalized] || normalized;
}

/**
 * Check if markdown contains incomplete code blocks
 */
export function hasIncompleteCodeBlocks(markdown: string): boolean {
    const blocks = extractCodeBlocks(markdown);
    return blocks.some(block => !block.isComplete);
}

/**
 * Count open code blocks in markdown
 */
export function countOpenCodeBlocks(markdown: string): number {
    const openMatches = markdown.match(/```\w*\n(?!.*?```)/gs);
    return openMatches ? openMatches.length : 0;
}

/**
 * Complete incomplete code blocks by adding closing backticks
 */
export function completeCodeBlocks(markdown: string): string {
    if (!hasIncompleteCodeBlocks(markdown)) {
        return markdown;
    }

    let result = markdown;
    const openCount = countOpenCodeBlocks(markdown);
    
    for (let i = 0; i < openCount; i++) {
        result += '\n```';
    }

    return result;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    };

    return text.replace(/[&<>"']/g, char => htmlEscapes[char]);
}

/**
 * Unescape HTML special characters
 */
export function unescapeHtml(text: string): string {
    const htmlUnescapes: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
    };

    return text.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => htmlUnescapes[entity]);
}

/**
 * Render markdown to HTML string (using VS Code's built-in markdown support)
 */
export async function renderMarkdownToHtml(
    markdown: string,
    options: MarkdownOptions = {}
): Promise<string> {
    const { trusted = false, supportHtml = false } = options;

    try {
        // Use VS Code's markdown rendering if available
        const mdModule = await import('markdown-it');
        const MarkdownIt = (mdModule as any).default || mdModule;
        const markdownIt = MarkdownIt({
            html: supportHtml,
            linkify: true,
            typographer: true,
        });

        // Add syntax highlighting
        markdownIt.use(require('markdown-it-highlightjs'));

        return markdownIt.render(markdown);
    } catch {
        // Fallback to simple rendering
        return simpleMarkdownToHtml(markdown);
    }
}

/**
 * Simple markdown to HTML converter (fallback)
 */
export function simpleMarkdownToHtml(markdown: string): string {
    let html = markdown;

    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Bold and italic
    html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
    html = html.replace(/_(.*?)_/g, '<em>$1</em>');

    // Code blocks
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Blockquotes
    html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Lists
    html = html.replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/^- (.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/^\d+\. (.*$)/gim, '<ol><li>$1</li></ol>');

    // Line breaks
    html = html.replace(/\n/gim, '<br>');

    return html;
}

/**
 * Render markdown to VS Code markdown string
 */
export function createMarkdownString(content: string, supportHtml: boolean = false): vscode.MarkdownString {
    const markdown = new vscode.MarkdownString(content);
    markdown.supportHtml = supportHtml;
    markdown.isTrusted = { enabledCommands: [] };
    return markdown;
}

/**
 * Strip markdown formatting, return plain text
 */
export function stripMarkdown(markdown: string): string {
    let text = markdown;

    // Remove code blocks
    text = text.replace(/```[\s\S]*?```/g, '');
    text = text.replace(/`([^`]+)`/g, '$1');

    // Remove headers
    text = text.replace(/^#{1,6}\s+/gm, '');

    // Remove bold and italic markers
    text = text.replace(/\*\*\*|___/g, '');
    text = text.replace(/\*\*|__/g, '');
    text = text.replace(/\*|_/g, '');

    // Remove link formatting but keep text
    text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

    // Remove blockquotes
    text = text.replace(/^>\s+/gm, '');

    // Remove list markers
    text = text.replace(/^[-*+]\s+/gm, '');
    text = text.replace(/^\d+\.\s+/gm, '');

    return text.trim();
}

/**
 * Truncate markdown while preserving structure
 */
export function truncateMarkdown(markdown: string, maxLength: number): string {
    if (markdown.length <= maxLength) {
        return markdown;
    }

    // Find a good breaking point
    let truncateAt = maxLength;
    
    // Try to end at a paragraph boundary
    const paragraphBreak = markdown.lastIndexOf('\n\n', maxLength);
    if (paragraphBreak > maxLength * 0.5) {
        truncateAt = paragraphBreak;
    } else {
        // Try to end at a sentence
        const sentenceEnd = markdown.lastIndexOf('. ', maxLength);
        if (sentenceEnd > maxLength * 0.7) {
            truncateAt = sentenceEnd + 1;
        }
    }

    let result = markdown.substring(0, truncateAt).trim();
    
    // Complete any incomplete code blocks
    result = completeCodeBlocks(result);
    
    return result + '\n\n*... (truncated)*';
}

/**
 * Format code block with proper language tag
 */
export function formatCodeBlock(code: string, language?: string): string {
    const lang = language ? ` ${normalizeLanguage(language) || language}` : '';
    return `\`\`\`${lang}\n${code}\n\`\`\``;
}

/**
 * Detect language from code content using simple heuristics
 */
export function detectLanguage(code: string): string | null {
    // TypeScript/JavaScript detection
    if (/:\s*(string|number|boolean|any|void|unknown|never)\b/.test(code)) {
        if (/interface\s+\w+\s*\{/.test(code) || /type\s+\w+\s*=/.test(code)) {
            return 'typescript';
        }
    }
    
    if (/\b(const|let|var)\s+\w+\s*:\s*/.test(code)) {
        return 'typescript';
    }

    // Python detection
    if (/^\s*(def|class|import|from)\s+\w+/.test(code) || 
        /\bprint\s*\(/.test(code) ||
        /\bNone\b|\bTrue\b|\bFalse\b/.test(code)) {
        return 'python';
    }

    // Rust detection
    if (/\bfn\s+\w+\s*\(|\bimpl\s+|\bstruct\s+\w+|\buse\s+\w+::/.test(code)) {
        return 'rust';
    }

    // Go detection
    if (/\bfunc\s+\w+\s*\(|\bpackage\s+\w+|\bimport\s+\(/.test(code)) {
        return 'go';
    }

    // Java detection
    if (/\bpublic\s+class\s+|\bprivate\s+|\bprotected\s+/.test(code)) {
        return 'java';
    }

    // HTML detection
    if (/^\s*<[\w!]/.test(code) && />/.test(code)) {
        return 'html';
    }

    // CSS detection
    if (/[.#]\w+\s*\{[^}]*:[^}]*\}/.test(code)) {
        return 'css';
    }

    // JSON detection
    if (/^\s*[\{\[]/.test(code) && /"\w+":/.test(code)) {
        return 'json';
    }

    // Shell detection
    if (/^\s*(#![\/]bin\/(bash|sh)|export\s+|source\s+|echo\s+)/m.test(code)) {
        return 'shell';
    }

    // SQL detection
    if (/\b(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP)\s+/i.test(code)) {
        return 'sql';
    }

    return null;
}

/**
 * Clean up markdown response from AI
 * - Remove thinking/reasoning sections if any
 * - Normalize line endings
 * - Trim extra whitespace
 */
export function cleanMarkdownResponse(markdown: string): string {
    let cleaned = markdown;

    // Normalize line endings
    cleaned = cleaned.replace(/\r\n/g, '\n');
    cleaned = cleaned.replace(/\r/g, '\n');

    // Remove common AI response wrappers
    cleaned = cleaned.replace(/^\s*Here\s+(?:is|are)\s+.*?:\s*/i, '');
    cleaned = cleaned.replace(/\s*I\s+hope\s+this\s+helps.*$/i, '');
    cleaned = cleaned.replace(/\s*Let\s+me\s+know\s+if\s+.*$/i, '');

    // Trim extra whitespace
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    
    return cleaned.trim();
}

/**
 * Split markdown by headers
 */
export function splitByHeaders(markdown: string): Array<{ level: number; title: string; content: string }> {
    const sections: Array<{ level: number; title: string; content: string }> = [];
    const headerRegex = /^(#{1,6})\s+(.+)$/gm;
    
    let lastIndex = 0;
    let currentLevel = 0;
    let currentTitle = '';
    let match: RegExpExecArray | null;

    while ((match = headerRegex.exec(markdown)) !== null) {
        if (lastIndex < match.index) {
            const content = markdown.substring(lastIndex, match.index).trim();
            if (sections.length > 0) {
                sections[sections.length - 1].content = content;
            } else if (content) {
                // Content before first header
                sections.push({ level: 0, title: '', content });
            }
        }

        currentLevel = match[1].length;
        currentTitle = match[2].trim();
        sections.push({ level: currentLevel, title: currentTitle, content: '' });
        lastIndex = match.index + match[0].length;
    }

    // Add remaining content to last section
    if (sections.length > 0) {
        sections[sections.length - 1].content = markdown.substring(lastIndex).trim();
    }

    return sections;
}
