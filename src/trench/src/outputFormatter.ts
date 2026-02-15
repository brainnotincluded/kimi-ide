/**
 * Trench CLI - Output Formatting
 * Supports Markdown, JSON, HTML, and Interactive terminal output
 */

import * as chalk from 'chalk';
import * as Table from 'cli-table3';
import type { OutputFormat, OutputOptions } from './types';

/**
 * Output formatter class
 */
export class OutputFormatter {
  private format: OutputFormat;
  private colors: boolean;
  private verbose: boolean;

  constructor(options: OutputOptions) {
    this.format = options.format;
    this.colors = options.colors ?? true;
    this.verbose = options.verbose ?? false;
  }

  /**
   * Format and output data
   */
  formatOutput(data: unknown): string {
    switch (this.format) {
      case 'json':
        return this.formatJson(data);
      case 'html':
        return this.formatHtml(data);
      case 'interactive':
        return this.formatInteractive(data);
      case 'markdown':
      default:
        return this.formatMarkdown(data);
    }
  }

  /**
   * Format as JSON
   */
  private formatJson(data: unknown): string {
    return JSON.stringify(data, null, 2);
  }

  /**
   * Format as Markdown
   */
  private formatMarkdown(data: unknown): string {
    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.objectToMarkdown(item)).join('\n\n---\n\n');
    }

    if (typeof data === 'object' && data !== null) {
      return this.objectToMarkdown(data);
    }

    return String(data);
  }

  /**
   * Convert object to Markdown
   */
  private objectToMarkdown(obj: Record<string, unknown>, depth: number = 0): string {
    const indent = '  '.repeat(depth);
    let markdown = '';

    for (const [key, value] of Object.entries(obj)) {
      const displayKey = this.formatKey(key);
      
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'string') {
        if (value.includes('\n')) {
          markdown += `${indent}## ${displayKey}\n\n${value}\n\n`;
        } else {
          markdown += `${indent}**${displayKey}:** ${value}\n\n`;
        }
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        markdown += `${indent}**${displayKey}:** ${value}\n\n`;
      } else if (value instanceof Date) {
        markdown += `${indent}**${displayKey}:** ${value.toISOString()}\n\n`;
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          continue;
        }
        markdown += `${indent}## ${displayKey}\n\n`;
        for (const item of value) {
          if (typeof item === 'object' && item !== null) {
            markdown += `${indent}- ${this.summarizeObject(item)}\n`;
          } else {
            markdown += `${indent}- ${item}\n`;
          }
        }
        markdown += '\n';
      } else if (typeof value === 'object') {
        markdown += `${indent}## ${displayKey}\n\n`;
        markdown += this.objectToMarkdown(value as Record<string, unknown>, depth + 1);
      }
    }

    return markdown;
  }

  /**
   * Format key for display
   */
  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ');
  }

  /**
   * Summarize object for list view
   */
  private summarizeObject(obj: Record<string, unknown>): string {
    const title = obj.title || obj.name || obj.url || obj.key || 'Item';
    const snippet = obj.snippet || obj.description || obj.abstract || '';
    
    if (snippet) {
      return `${title} - ${String(snippet).substring(0, 100)}...`;
    }
    return String(title);
  }

  /**
   * Format as HTML
   */
  private formatHtml(data: unknown): string {
    const content = this.generateHtmlContent(data);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Trench Report</title>
  <style>
    :root {
      --bg-color: #1a1a2e;
      --text-color: #eee;
      --accent-color: #0f3460;
      --highlight: #e94560;
      --border-color: #16213e;
    }
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h1, h2, h3 {
      color: var(--highlight);
      margin: 1.5rem 0 1rem;
    }
    
    .header {
      border-bottom: 2px solid var(--highlight);
      padding-bottom: 1rem;
      margin-bottom: 2rem;
    }
    
    .card {
      background: var(--accent-color);
      border-radius: 8px;
      padding: 1.5rem;
      margin: 1rem 0;
      border: 1px solid var(--border-color);
    }
    
    .meta {
      color: #888;
      font-size: 0.9rem;
    }
    
    a {
      color: #4fbdba;
      text-decoration: none;
    }
    
    a:hover {
      text-decoration: underline;
    }
    
    .tag {
      display: inline-block;
      background: var(--highlight);
      color: white;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.8rem;
      margin-right: 0.5rem;
    }
    
    pre {
      background: #0a0a0a;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
    }
    
    code {
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 0.9rem;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
    }
    
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }
    
    th {
      color: var(--highlight);
      font-weight: 600;
    }
    
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin: 1rem 0;
    }
    
    .stat-card {
      background: var(--border-color);
      padding: 1rem;
      border-radius: 8px;
      text-align: center;
    }
    
    .stat-value {
      font-size: 2rem;
      color: var(--highlight);
      font-weight: bold;
    }
    
    .stat-label {
      color: #888;
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 Trench Report</h1>
    <p class="meta">Generated on ${new Date().toLocaleString()}</p>
  </div>
  
  ${content}
  
  <footer style="margin-top: 3rem; padding-top: 1rem; border-top: 1px solid var(--border-color); color: #666; font-size: 0.85rem;">
    Generated by Trench CLI
  </footer>
</body>
</html>`;
  }

  /**
   * Generate HTML content from data
   */
  private generateHtmlContent(data: unknown): string {
    if (typeof data === 'string') {
      return `<p>${this.escapeHtml(data)}</p>`;
    }

    if (Array.isArray(data)) {
      return data.map((item, i) => `
        <div class="card">
          <div class="meta">#${i + 1}</div>
          ${this.generateHtmlContent(item)}
        </div>
      `).join('');
    }

    if (typeof data === 'object' && data !== null) {
      return Object.entries(data).map(([key, value]) => {
        if (value === null || value === undefined) return '';
        
        const displayKey = this.formatKey(key);
        
        if (typeof value === 'string') {
          if (value.startsWith('http')) {
            return `<p><strong>${displayKey}:</strong> <a href="${value}" target="_blank">${value}</a></p>`;
          }
          return `<p><strong>${displayKey}:</strong> ${this.escapeHtml(value)}</p>`;
        }
        
        if (typeof value === 'number' || typeof value === 'boolean') {
          return `<p><strong>${displayKey}:</strong> ${value}</p>`;
        }
        
        if (value instanceof Date) {
          return `<p><strong>${displayKey}:</strong> ${value.toLocaleString()}</p>`;
        }
        
        if (Array.isArray(value)) {
          return `
            <h3>${displayKey}</h3>
            <ul>
              ${value.map(v => `<li>${this.generateHtmlContent(v)}</li>`).join('')}
            </ul>
          `;
        }
        
        return `
          <h3>${displayKey}</h3>
          <div class="card">
            ${this.generateHtmlContent(value)}
          </div>
        `;
      }).join('');
    }

    return `<p>${String(data)}</p>`;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Format as interactive terminal output
   */
  private formatInteractive(data: unknown): string {
    if (!this.colors) {
      return this.formatMarkdown(data);
    }

    if (typeof data === 'string') {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map((item, i) => this.formatInteractiveItem(item, i)).join('\n\n');
    }

    if (typeof data === 'object' && data !== null) {
      return this.formatInteractiveItem(data);
    }

    return String(data);
  }

  /**
   * Format single item for interactive display
   */
  private formatInteractiveItem(item: unknown, index?: number): string {
    if (typeof item !== 'object' || item === null) {
      return String(item);
    }

    const obj = item as Record<string, unknown>;
    let output = '';

    // Header
    if (index !== undefined) {
      output += chalk.cyan(`\n${'─'.repeat(60)}\n`);
      output += chalk.yellow.bold(`  #${index + 1}`);
      if (obj.title || obj.name) {
        output += ' ' + chalk.white.bold(String(obj.title || obj.name));
      }
      output += '\n';
      output += chalk.cyan(`${'─'.repeat(60)}\n`);
    }

    // Content
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'title' || key === 'name') continue; // Already shown in header
      
      const displayKey = this.formatKey(key);
      const keyColor = chalk.blue.bold;
      
      if (value === null || value === undefined) {
        continue;
      }

      if (typeof value === 'string') {
        if (value.startsWith('http')) {
          output += `  ${keyColor(displayKey)}: ${chalk.underline.cyan(value)}\n`;
        } else if (value.length > 100) {
          output += `  ${keyColor(displayKey)}:\n`;
          output += chalk.gray(value.substring(0, 100) + '...') + '\n';
        } else {
          output += `  ${keyColor(displayKey)}: ${value}\n`;
        }
      } else if (typeof value === 'number') {
        output += `  ${keyColor(displayKey)}: ${chalk.yellow(value)}\n`;
      } else if (typeof value === 'boolean') {
        output += `  ${keyColor(displayKey)}: ${value ? chalk.green('✓') : chalk.red('✗')}\n`;
      } else if (value instanceof Date) {
        output += `  ${keyColor(displayKey)}: ${chalk.magenta(value.toLocaleString())}\n`;
      } else if (Array.isArray(value)) {
        output += `  ${keyColor(displayKey)}: ${chalk.gray(`[${value.length} items]`)}\n`;
        if (value.length > 0 && this.verbose) {
          for (const v of value.slice(0, 3)) {
            output += `    ${chalk.gray('•')} ${this.summarizeValue(v)}\n`;
          }
          if (value.length > 3) {
            output += chalk.gray(`    ... and ${value.length - 3} more\n`);
          }
        }
      } else if (typeof value === 'object') {
        output += `  ${keyColor(displayKey)}: ${chalk.gray('[object]')}\n`;
      }
    }

    return output;
  }

  /**
   * Summarize value for display
   */
  private summarizeValue(value: unknown): string {
    if (typeof value === 'string') {
      return value.length > 50 ? value.substring(0, 50) + '...' : value;
    }
    if (typeof value === 'object' && value !== null) {
      const title = (value as Record<string, unknown>).title;
      const name = (value as Record<string, unknown>).name;
      if (typeof title === 'string') {
        return title;
      }
      if (typeof name === 'string') {
        return name;
      }
      return JSON.stringify(value).substring(0, 50);
    }
    return String(value);
  }

  /**
   * Create a table from data
   */
  createTable(headers: string[], rows: unknown[][]): string {
    if (this.format === 'json') {
      return JSON.stringify(rows.map(row => {
        const obj: Record<string, unknown> = {};
        headers.forEach((h, i) => obj[h] = row[i]);
        return obj;
      }), null, 2);
    }

    if (this.format === 'interactive' && this.colors) {
      const table = new Table({
        head: headers.map(h => chalk.cyan.bold(h)),
        style: { head: [], border: [] },
      });
      
      rows.forEach(row => {
        table.push(row.map(cell => String(cell)));
      });
      
      return table.toString();
    }

    // Markdown table
    let markdown = '| ' + headers.join(' | ') + ' |\n';
    markdown += '| ' + headers.map(() => '---').join(' | ') + ' |\n';
    
    rows.forEach(row => {
      markdown += '| ' + row.map(cell => String(cell).replace(/\|/g, '\\|')).join(' | ') + ' |\n';
    });
    
    return markdown;
  }

  /**
   * Format progress bar
   */
  formatProgress(percent: number, width: number = 30): string {
    const filled = Math.round((percent / 100) * width);
    const empty = width - filled;
    
    if (this.colors) {
      const bar = chalk.green('█'.repeat(filled)) + chalk.gray('░'.repeat(empty));
      return `[${bar}] ${percent.toFixed(1)}%`;
    }
    
    return `[${'='.repeat(filled)}${' '.repeat(empty)}] ${percent.toFixed(1)}%`;
  }

  /**
   * Format error message
   */
  formatError(message: string, code?: string): string {
    if (this.colors) {
      return chalk.red.bold('✗ Error') + (code ? chalk.gray(` [${code}]`) : '') + ': ' + message;
    }
    return `✗ Error${code ? ` [${code}]` : ''}: ${message}`;
  }

  /**
   * Format success message
   */
  formatSuccess(message: string): string {
    if (this.colors) {
      return chalk.green.bold('✓') + ' ' + message;
    }
    return `✓ ${message}`;
  }

  /**
   * Format warning message
   */
  formatWarning(message: string): string {
    if (this.colors) {
      return chalk.yellow.bold('⚠') + ' ' + message;
    }
    return `⚠ ${message}`;
  }

  /**
   * Format info message
   */
  formatInfo(message: string): string {
    if (this.colors) {
      return chalk.blue('ℹ') + ' ' + message;
    }
    return `ℹ ${message}`;
  }

  /**
   * Print header
   */
  printHeader(title: string): string {
    if (this.colors) {
      return '\n' + chalk.cyan.bold('═'.repeat(60)) + '\n' +
             chalk.cyan.bold('  ' + title) + '\n' +
             chalk.cyan.bold('═'.repeat(60)) + '\n';
    }
    return `\n${'='.repeat(60)}\n  ${title}\n${'='.repeat(60)}\n`;
  }

  /**
   * Print section
   */
  printSection(title: string): string {
    if (this.colors) {
      return '\n' + chalk.yellow.bold('▸ ' + title) + '\n';
    }
    return `\n▸ ${title}\n`;
  }

  /**
   * Get format type
   */
  getFormat(): OutputFormat {
    return this.format;
  }

  /**
   * Set format type
   */
  setFormat(format: OutputFormat): void {
    this.format = format;
  }
}

/**
 * Create formatter from options
 */
export function createFormatter(options: OutputOptions): OutputFormatter {
  return new OutputFormatter(options);
}

/**
 * Quick format helpers
 */
export const formatters = {
  json: (data: unknown): string => JSON.stringify(data, null, 2),
  
  markdown: (data: unknown): string => {
    const formatter = new OutputFormatter({ format: 'markdown', colors: false });
    return formatter.formatOutput(data);
  },
  
  html: (data: unknown): string => {
    const formatter = new OutputFormatter({ format: 'html', colors: false });
    return formatter.formatOutput(data);
  },
  
  interactive: (data: unknown, colors: boolean = true): string => {
    const formatter = new OutputFormatter({ format: 'interactive', colors });
    return formatter.formatOutput(data);
  },
};
