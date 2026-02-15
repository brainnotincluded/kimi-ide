/**
 * BaseParser
 * Abstract base class for language parsers
 */

import { DocumentSymbol, WorkspaceSymbol, ParseResult, Position, Range, SymbolKind, SymbolTag } from '../types';

export abstract class BaseParser {
  abstract readonly languageId: string;
  abstract readonly fileExtensions: string[];

  /**
   * Check if this parser supports the given URI
   */
  isSupported(uri: string): boolean {
    const ext = uri.split('.').pop()?.toLowerCase();
    return ext ? this.fileExtensions.includes(ext) : false;
  }

  /**
   * Parse document and extract symbols
   */
  abstract parseDocument(uri: string, content: string): Promise<ParseResult>;

  /**
   * Parse workspace for symbols (optional)
   */
  parseWorkspace?(workspacePath: string, query: string): Promise<WorkspaceSymbol[]>;

  /**
   * Create a Position object
   */
  protected createPosition(line: number, character: number): Position {
    return { line, character };
  }

  /**
   * Create a Range object
   */
  protected createRange(startLine: number, startChar: number, endLine: number, endChar: number): Range {
    return {
      start: this.createPosition(startLine, startChar),
      end: this.createPosition(endLine, endChar),
    };
  }

  /**
   * Create a DocumentSymbol
   */
  protected createSymbol(
    name: string,
    kind: SymbolKind,
    range: Range,
    options?: {
      detail?: string;
      selectionRange?: Range;
      children?: DocumentSymbol[];
      tags?: SymbolTag[];
      accessibility?: 'public' | 'private' | 'protected' | 'internal';
    }
  ): DocumentSymbol {
    return {
      name,
      kind,
      range,
      selectionRange: options?.selectionRange || range,
      detail: options?.detail,
      children: options?.children,
      tags: options?.tags,
      accessibility: options?.accessibility,
    };
  }

  /**
   * Parse JSDoc/Docstring comments for documentation
   */
  protected extractDocumentation(comment: string): string {
    // Remove comment markers
    return comment
      .replace(/^\/\*\*?\s*/, '')
      .replace(/\*\/\s*$/, '')
      .replace(/^\s*\*\s?/gm, '')
      .replace(/^\s*\/\/\/?\s?/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract modifiers from code
   */
  protected extractModifiers(code: string): {
    isStatic: boolean;
    isAsync: boolean;
    isAbstract: boolean;
    isDeprecated: boolean;
    accessibility?: 'public' | 'private' | 'protected' | 'internal';
  } {
    const modifiers = {
      isStatic: /\bstatic\b/.test(code),
      isAsync: /\basync\b/.test(code),
      isAbstract: /\babstract\b/.test(code),
      isDeprecated: /\b@deprecated\b/.test(code),
    };

    let accessibility: 'public' | 'private' | 'protected' | 'internal' | undefined;
    if (/\bprivate\b/.test(code)) accessibility = 'private';
    else if (/\bprotected\b/.test(code)) accessibility = 'protected';
    else if (/\binternal\b/.test(code)) accessibility = 'internal';
    else if (/\bpublic\b/.test(code)) accessibility = 'public';

    return { ...modifiers, accessibility };
  }

  /**
   * Build tags array from modifiers
   */
  protected buildTags(modifiers: {
    isStatic: boolean;
    isAsync: boolean;
    isAbstract: boolean;
    isDeprecated: boolean;
  }): SymbolTag[] {
    const tags: SymbolTag[] = [];
    if (modifiers.isStatic) tags.push('static');
    if (modifiers.isAsync) tags.push('async');
    if (modifiers.isAbstract) tags.push('abstract');
    if (modifiers.isDeprecated) tags.push('deprecated');
    return tags;
  }

  /**
   * Simple line counter for error recovery
   */
  protected getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length - 1;
  }

  /**
   * Get column number from index
   */
  protected getColumn(content: string, index: number): number {
    const lastNewline = content.lastIndexOf('\n', index);
    return lastNewline === -1 ? index : index - lastNewline - 1;
  }

  /**
   * Simple hash for caching
   */
  protected hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(16);
  }
}

export default BaseParser;
