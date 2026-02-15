import * as marked from 'marked';

export interface RenderOptions {
    highlightCode?: boolean;
    enableMath?: boolean;
    sanitize?: boolean;
}

export class MessageRenderer {
    private _marked: typeof marked;
    private _options: RenderOptions;

    constructor(options: RenderOptions = {}) {
        this._options = {
            highlightCode: true,
            enableMath: false,
            sanitize: true,
            ...options
        };

        // Configure marked with custom renderer
        this._marked = marked;
        this._setupMarked();
    }

    private _setupMarked(): void {
        const renderer = new marked.Renderer();

        // Custom code block renderer
        renderer.code = (code: string, language?: string) => {
            const lang = language || 'text';
            const escapedCode = this._escapeHtml(code);
            
            return `<pre><code class="language-${lang}">${escapedCode}</code></pre>`;
        };

        // Custom inline code renderer
        renderer.codespan = (code: string) => {
            return `<code>${this._escapeHtml(code)}</code>`;
        };

        // Custom link renderer (add target="_blank" for external links)
        renderer.link = (href: string, title: string | null | undefined, text: string) => {
            const titleAttr = title ? ` title="${this._escapeHtml(title)}"` : '';
            const isExternal = href.startsWith('http://') || href.startsWith('https://');
            const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
            
            return `<a href="${href}"${titleAttr}${targetAttr}>${text}</a>`;
        };

        // Custom table renderer for better styling
        renderer.table = (header: string, body: string) => {
            return `<table>\n<thead>\n${header}</thead>\n<tbody>\n${body}</tbody>\n</table>\n`;
        };

        renderer.tablerow = (content: string) => {
            return `<tr>\n${content}</tr>\n`;
        };

        renderer.tablecell = (content: string, flags: {
            header: boolean;
            align: 'center' | 'left' | 'right' | null;
        }) => {
            const type = flags.header ? 'th' : 'td';
            const align = flags.align ? ` align="${flags.align}"` : '';
            return `<${type}${align}>${content}</${type}>\n`;
        };

        // Custom blockquote renderer
        renderer.blockquote = (quote: string) => {
            return `<blockquote>\n${quote}</blockquote>\n`;
        };

        // Custom heading renderer with anchor links
        renderer.heading = (text: string, level: number, raw: string) => {
            const id = raw.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return `<h${level} id="${id}">${text}</h${level}>\n`;
        };

        // Configure marked options
        this._marked.setOptions({
            renderer: renderer,
            gfm: true,
            breaks: true,
            headerIds: true,
            mangle: false,
            sanitize: this._options.sanitize,
            smartLists: true,
            smartypants: true,
            xhtml: false
        });
    }

    /**
     * Render markdown content to HTML
     */
    public render(content: string): string {
        if (!content) {
            return '';
        }

        try {
            // Handle thinking tags (custom format for showing AI thinking process)
            content = this._processThinkingTags(content);

            // Handle tool call syntax
            content = this._processToolCalls(content);

            // Render markdown
            let html = this._marked.parse(content);

            // Post-process for additional features
            html = this._postProcess(html);

            return html;
        } catch (error) {
            console.error('Error rendering message:', error);
            return this._escapeHtml(content);
        }
    }

    /**
     * Render a streaming/partial message (for real-time updates)
     */
    public renderStreaming(content: string, isComplete: boolean = false): string {
        // For streaming content, we might want to handle incomplete markdown differently
        if (!isComplete) {
            // Don't render incomplete code blocks
            content = this._handleIncompleteCodeBlocks(content);
        }
        
        return this.render(content);
    }

    /**
     * Extract code blocks from content
     */
    public extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
        const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
        const blocks: Array<{ language: string; code: string }> = [];
        let match;

        while ((match = codeBlockRegex.exec(content)) !== null) {
            blocks.push({
                language: match[1] || 'text',
                code: match[2].trim()
            });
        }

        return blocks;
    }

    /**
     * Extract the first code block of a specific language
     */
    public extractFirstCodeBlock(content: string, language?: string): { language: string; code: string } | null {
        const blocks = this.extractCodeBlocks(content);
        
        if (language) {
            const block = blocks.find(b => 
                b.language.toLowerCase() === language.toLowerCase()
            );
            return block || null;
        }
        
        return blocks[0] || null;
    }

    /**
     * Format tool call for display
     */
    public formatToolCall(name: string, args: Record<string, any>): string {
        const argsStr = JSON.stringify(args, null, 2);
        return `<tool_call>\n${name}(${argsStr})\n</tool_call>`;
    }

    /**
     * Format tool result for display
     */
    public formatToolResult(result: any, isError: boolean = false): string {
        const resultStr = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        const tag = isError ? 'tool_error' : 'tool_result';
        return `<${tag}>\n${resultStr}\n</${tag}>`;
    }

    /**
     * Truncate content to a maximum length
     */
    public truncate(content: string, maxLength: number, suffix: string = '...'): string {
        if (content.length <= maxLength) {
            return content;
        }
        return content.substring(0, maxLength - suffix.length) + suffix;
    }

    /**
     * Strip markdown formatting to get plain text
     */
    public stripMarkdown(content: string): string {
        // Remove code blocks
        content = content.replace(/```[\s\S]*?```/g, '[Code block]');
        
        // Remove inline code
        content = content.replace(/`([^`]+)`/g, '$1');
        
        // Remove links (keep text)
        content = content.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
        content = content.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');
        
        // Remove images
        content = content.replace(/!\[([^\]]*)\]\([^)]+\)/g, '[Image: $1]');
        
        // Remove emphasis
        content = content.replace(/(\*\*|__)([^*_]+)\1/g, '$2');
        content = content.replace(/(\*|_)([^*_]+)\1/g, '$2');
        content = content.replace(/~~([^~]+)~~/g, '$1');
        
        // Remove HTML tags
        content = content.replace(/<[^>]+>/g, '');
        
        // Remove headings
        content = content.replace(/^#{1,6}\s+/gm, '');
        
        // Remove blockquotes
        content = content.replace(/^>\s?/gm, '');
        
        // Remove list markers
        content = content.replace(/^[\*\-\+]\s+/gm, '');
        content = content.replace(/^\d+\.\s+/gm, '');
        
        // Normalize whitespace
        content = content.replace(/\n{3,}/g, '\n\n');
        
        return content.trim();
    }

    /**
     * Count tokens (approximation)
     */
    public estimateTokens(content: string): number {
        // Rough approximation: ~4 characters per token for English text
        // Code might be different, but this is a reasonable estimate
        return Math.ceil(content.length / 4);
    }

    private _escapeHtml(text: string): string {
        const div = { toString: () => '' }; // Placeholder - we do simple replacement
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private _processThinkingTags(content: string): string {
        // Convert <thinking> tags to blockquotes
        return content.replace(
            /<thinking>([\s\S]*?)<\/thinking>/g,
            '> **Thinking:**\n> $1'
        );
    }

    private _processToolCalls(content: string): string {
        // Convert tool call tags to code blocks
        content = content.replace(
            /<tool_call>([\s\S]*?)<\/tool_call>/g,
            '```json\n// Tool Call\n$1\n```'
        );
        
        content = content.replace(
            /<tool_result>([\s\S]*?)<\/tool_result>/g,
            '```json\n// Tool Result\n$1\n```'
        );
        
        content = content.replace(
            /<tool_error>([\s\S]*?)<\/tool_error>/g,
            '```json\n// Tool Error\n$1\n```'
        );
        
        return content;
    }

    private _handleIncompleteCodeBlocks(content: string): string {
        // Check if there's an unclosed code block
        const codeBlockMatches = content.match(/```/g);
        if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) {
            // Odd number of code block markers means one is unclosed
            content += '\n```';
        }
        return content;
    }

    private _postProcess(html: string): string {
        // Add copy buttons to code blocks (handled in UI, but we can add markers here)
        // Process mermaid diagrams if needed
        // Add syntax highlighting classes
        
        // Ensure code blocks have proper classes for highlighting
        html = html.replace(
            /<pre><code class="language-(\w+)">/g,
            '<pre><code class="hljs language-$1">'
        );

        // Handle task lists
        html = html.replace(
            /<li>\[ \] /g,
            '<li class="task-list-item"><input type="checkbox" disabled> '
        );
        html = html.replace(
            /<li>\[x\] /g,
            '<li class="task-list-item"><input type="checkbox" checked disabled> '
        );

        return html;
    }
}

/**
 * Utility functions for message formatting
 */
export namespace MessageFormatter {
    /**
     * Format a file path for display
     */
    export function formatFilePath(filePath: string, maxLength: number = 50): string {
        if (filePath.length <= maxLength) {
            return filePath;
        }
        
        const parts = filePath.split('/');
        if (parts.length <= 2) {
            return '...' + filePath.slice(-maxLength + 3);
        }
        
        return parts[0] + '/.../' + parts.slice(-2).join('/');
    }

    /**
     * Format a timestamp for display
     */
    export function formatTimestamp(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'just now';
        } else if (diffMins < 60) {
            return `${diffMins}m ago`;
        } else if (diffHours < 24) {
            return `${diffHours}h ago`;
        } else if (diffDays < 7) {
            return `${diffDays}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    /**
     * Create a diff view of code changes
     */
    export function createDiffView(original: string, modified: string): string {
        const originalLines = original.split('\n');
        const modifiedLines = modified.split('\n');
        
        let diff = '```diff\n';
        
        // Simple line-by-line diff (not a proper diff algorithm, but good for display)
        let i = 0, j = 0;
        while (i < originalLines.length || j < modifiedLines.length) {
            if (i >= originalLines.length) {
                diff += `+ ${modifiedLines[j]}\n`;
                j++;
            } else if (j >= modifiedLines.length) {
                diff += `- ${originalLines[i]}\n`;
                i++;
            } else if (originalLines[i] === modifiedLines[j]) {
                diff += `  ${originalLines[i]}\n`;
                i++;
                j++;
            } else {
                diff += `- ${originalLines[i]}\n`;
                diff += `+ ${modifiedLines[j]}\n`;
                i++;
                j++;
            }
        }
        
        diff += '```';
        return diff;
    }

    /**
     * Create a summary of changes
     */
    export function createChangeSummary(original: string, modified: string): string {
        const originalLines = original.split('\n');
        const modifiedLines = modified.split('\n');
        
        let added = 0;
        let removed = 0;
        
        const maxLen = Math.max(originalLines.length, modifiedLines.length);
        for (let i = 0; i < maxLen; i++) {
            if (i >= originalLines.length) {
                added++;
            } else if (i >= modifiedLines.length) {
                removed++;
            } else if (originalLines[i] !== modifiedLines[i]) {
                added++;
                removed++;
            }
        }
        
        return `+${added}/-${removed} lines`;
    }
}
