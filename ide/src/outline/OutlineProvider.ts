/**
 * OutlineProvider
 * Main provider for document and workspace symbols
 * Supports multiple languages through language-specific parsers
 */

import {
  DocumentSymbol,
  WorkspaceSymbol,
  SymbolKind,
  SymbolFilter,
  SymbolSortOptions,
  Position,
  Location,
  NavigationTarget,
  ParseResult,
  LanguageSupport,
  OutlineOptions,
} from './types';
// Parsers temporarily disabled
// import { TypeScriptParser } from './parsers/TypeScriptParser';
// import { PythonParser } from './parsers/PythonParser';
// import { GoParser } from './parsers/GoParser';
// import { RustParser } from './parsers/RustParser';
// import { JavaParser } from './parsers/JavaParser';

export interface Parser {
  languageId: string;
  parseDocument(uri: string, content: string): Promise<ParseResult>;
  parseWorkspace?(workspacePath: string, query: string): Promise<WorkspaceSymbol[]>;
  isSupported(uri: string): boolean;
}

/**
 * OutlineProvider - main class for symbol management
 */
export class OutlineProvider {
  private parsers: Map<string, Parser> = new Map();
  private documentCache: Map<string, { symbols: DocumentSymbol[]; timestamp: number }> = new Map();
  private workspaceCache: Map<string, { symbols: WorkspaceSymbol[]; timestamp: number }> = new Map();
  private cacheTTL: number = 30000; // 30 seconds

  constructor() {
    this.registerDefaultParsers();
  }

  /**
   * Register built-in parsers
   */
  private registerDefaultParsers(): void {
    // Parsers temporarily disabled
    // this.registerParser(new TypeScriptParser());
    // this.registerParser(new PythonParser());
    // this.registerParser(new GoParser());
    // this.registerParser(new RustParser());
    // this.registerParser(new JavaParser());
  }

  /**
   * Register a parser
   */
  registerParser(parser: Parser): void {
    this.parsers.set(parser.languageId, parser);
  }

  /**
   * Unregister a parser
   */
  unregisterParser(languageId: string): void {
    this.parsers.delete(languageId);
  }

  /**
   * Get parser for a file
   */
  private getParser(uri: string): Parser | undefined {
    const languageId = this.getLanguageIdFromUri(uri);
    return this.parsers.get(languageId);
  }

  /**
   * Get language ID from file URI
   */
  private getLanguageIdFromUri(uri: string): string {
    const ext = uri.split('.').pop()?.toLowerCase();
    
    const extMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescriptreact',
      'js': 'javascript',
      'jsx': 'javascriptreact',
      'py': 'python',
      'go': 'go',
      'rs': 'rust',
      'java': 'java',
    };

    return extMap[ext || ''] || 'plaintext';
  }

  /**
   * Get document symbols for a file
   */
  async getDocumentSymbols(uri: string, content?: string): Promise<DocumentSymbol[]> {
    // Check cache
    const cached = this.documentCache.get(uri);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.symbols;
    }

    // Get parser
    const parser = this.getParser(uri);
    if (!parser) {
      return [];
    }

    // If content not provided, we need to fetch it
    // This would typically be done via a file service
    if (!content) {
      throw new Error('Content required for parsing. Use fetchDocumentContent().');
    }

    // Parse document
    const result = await parser.parseDocument(uri, content);
    
    // Cache result
    this.documentCache.set(uri, {
      symbols: result.symbols,
      timestamp: Date.now(),
    });

    return result.symbols;
  }

  /**
   * Get workspace symbols
   */
  async getWorkspaceSymbols(query: string, workspacePath: string): Promise<WorkspaceSymbol[]> {
    // Check cache for empty query (all symbols)
    const cacheKey = `${workspacePath}::${query}`;
    const cached = this.workspaceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return this.filterWorkspaceSymbols(cached.symbols, query);
    }

    const allSymbols: WorkspaceSymbol[] = [];

    // Collect symbols from all parsers that support workspace symbols
    for (const parser of this.parsers.values()) {
      if (parser.parseWorkspace) {
        try {
          const symbols = await parser.parseWorkspace(workspacePath, query);
          allSymbols.push(...symbols);
        } catch (error) {
          console.warn(`Failed to get workspace symbols from ${parser.languageId}:`, error);
        }
      }
    }

    // Cache results
    this.workspaceCache.set(cacheKey, {
      symbols: allSymbols,
      timestamp: Date.now(),
    });

    return this.filterWorkspaceSymbols(allSymbols, query);
  }

  /**
   * Filter workspace symbols by query
   */
  private filterWorkspaceSymbols(symbols: WorkspaceSymbol[], query: string): WorkspaceSymbol[] {
    if (!query) return symbols;

    const lowerQuery = query.toLowerCase();
    
    return symbols
      .map(sym => {
        const nameScore = this.scoreMatch(lowerQuery, sym.name.toLowerCase());
        const containerScore = sym.containerName 
          ? this.scoreMatch(lowerQuery, sym.containerName.toLowerCase()) * 0.8
          : 0;
        
        return { ...sym, score: Math.max(nameScore, containerScore) };
      })
      .filter(sym => (sym.score || 0) > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  /**
   * Score a match
   */
  private scoreMatch(query: string, text: string): number {
    if (text === query) return 100;
    if (text.startsWith(query)) return 80;
    if (text.includes(query)) return 40;

    // Fuzzy match
    let qi = 0;
    for (let ti = 0; qi < query.length && ti < text.length; ti++) {
      if (query[qi] === text[ti]) qi++;
    }
    return qi === query.length ? 20 : 0;
  }

  /**
   * Go to symbol location
   */
  async goToSymbol(uri: string, position: Position): Promise<NavigationTarget | undefined> {
    const symbols = await this.getDocumentSymbols(uri);
    const target = this.findSymbolAtPosition(symbols, position);
    
    if (target && uri) {
      return {
        uri,
        range: target.selectionRange || target.range,
      };
    }

    return undefined;
  }

  /**
   * Find symbol at position
   */
  private findSymbolAtPosition(
    symbols: DocumentSymbol[],
    position: Position
  ): DocumentSymbol | undefined {
    for (const symbol of symbols) {
      if (this.isPositionInRange(position, symbol.range)) {
        // Check children first for more specific match
        if (symbol.children?.length) {
          const childMatch = this.findSymbolAtPosition(symbol.children, position);
          if (childMatch) return childMatch;
        }
        return symbol;
      }
    }
    return undefined;
  }

  /**
   * Check if position is in range
   */
  private isPositionInRange(position: Position, range: { start: Position; end: Position }): boolean {
    const afterStart = position.line > range.start.line ||
      (position.line === range.start.line && position.character >= range.start.character);
    const beforeEnd = position.line < range.end.line ||
      (position.line === range.end.line && position.character <= range.end.character);
    return afterStart && beforeEnd;
  }

  /**
   * Get breadcrumbs for a position
   */
  async getBreadcrumbs(uri: string, position: Position): Promise<DocumentSymbol[]> {
    const symbols = await this.getDocumentSymbols(uri);
    return this.buildBreadcrumbPath(symbols, position);
  }

  /**
   * Build breadcrumb path
   */
  private buildBreadcrumbPath(
    symbols: DocumentSymbol[],
    position: Position,
    path: DocumentSymbol[] = []
  ): DocumentSymbol[] {
    for (const symbol of symbols) {
      if (this.isPositionInRange(position, symbol.range)) {
        const newPath = [...path, symbol];
        
        if (symbol.children?.length) {
          const childPath = this.buildBreadcrumbPath(symbol.children, position, newPath);
          if (childPath.length > newPath.length) return childPath;
        }
        
        return newPath;
      }
    }
    return path;
  }

  /**
   * Sort symbols
   */
  sortSymbols(symbols: DocumentSymbol[], options: SymbolSortOptions): DocumentSymbol[] {
    const sorted = [...symbols];
    const dir = options.direction === 'desc' ? -1 : 1;

    switch (options.by) {
      case 'name':
        sorted.sort((a, b) => dir * a.name.localeCompare(b.name));
        break;
      case 'type':
        sorted.sort((a, b) => dir * a.kind.localeCompare(b.kind));
        break;
      case 'accessibility':
        const order = { public: 0, protected: 1, private: 2, internal: 3 };
        sorted.sort((a, b) => {
          const aVal = order[a.accessibility || 'public'];
          const bVal = order[b.accessibility || 'public'];
          return dir * (aVal - bVal);
        });
        break;
      case 'position':
      default:
        sorted.sort((a, b) => {
          const aLine = a.range?.start?.line ?? 0;
          const bLine = b.range?.start?.line ?? 0;
          return dir * (aLine - bLine);
        });
        break;
    }

    return sorted;
  }

  /**
   * Filter symbols
   */
  filterSymbols(symbols: DocumentSymbol[], filter: SymbolFilter): DocumentSymbol[] {
    return symbols.filter(sym => {
      // Filter by kind
      if (filter.kinds?.length && !filter.kinds.includes(sym.kind)) {
        return false;
      }

      // Filter by query
      if (filter.query) {
        const query = filter.query.toLowerCase();
        const nameMatch = sym.name.toLowerCase().includes(query);
        const detailMatch = sym.detail?.toLowerCase().includes(query);
        if (!nameMatch && !detailMatch) return false;
      }

      // Filter by accessibility
      if (filter.onlyPublic && sym.accessibility && sym.accessibility !== 'public') {
        return false;
      }

      // Filter deprecated
      if (filter.hideDeprecated && sym.tags?.includes('deprecated')) {
        return false;
      }

      return true;
    }).map(sym => ({
      ...sym,
      children: sym.children ? this.filterSymbols(sym.children, filter) : undefined,
    }));
  }

  /**
   * Clear cache for a file
   */
  invalidateCache(uri?: string): void {
    if (uri) {
      this.documentCache.delete(uri);
    } else {
      this.documentCache.clear();
      this.workspaceCache.clear();
    }
  }

  /**
   * Check if language is supported
   */
  isLanguageSupported(uri: string): boolean {
    return !!this.getParser(uri);
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages(): string[] {
    return Array.from(this.parsers.keys());
  }
}

// Export singleton instance
export const outlineProvider = new OutlineProvider();
export default outlineProvider;
