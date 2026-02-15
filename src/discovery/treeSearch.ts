/**
 * Tree Search
 * 
 * Быстрый поиск по дереву codebase с поддержкой:
 * - Fuzzy matching по symbol names
 * - Semantic search (по типам, по usage)
 * - Relevance scoring
 * - Ranked results
 */

import { CodeTree, CodeSymbol, SymbolKind, FileNode, DependencyEdge } from './codeTreeBuilder';

// ==================== Types ====================

export interface SearchResult {
  symbol: CodeSymbol;
  score: number;
  matchType: MatchType;
  matchedText?: string;
  context?: SearchContext;
}

export type MatchType = 
  | 'exact' 
  | 'prefix' 
  | 'fuzzy' 
  | 'camelCase' 
  | 'acronym'
  | 'semantic-type'
  | 'semantic-usage'
  | 'file-name';

export interface SearchContext {
  lineText: string;
  surroundingLines: string[];
  fileName: string;
  imports?: string[];
  exports?: string[];
}

export interface SearchOptions {
  query: string;
  kinds?: SymbolKind[];
  files?: string[];
  includeImports?: boolean;
  includeExports?: boolean;
  maxResults?: number;
  minScore?: number;
  fuzzyThreshold?: number;
  semanticSearch?: boolean;
  searchInComments?: boolean;
}

export interface FuzzyMatch {
  isMatch: boolean;
  score: number;
  matchedIndices: number[];
}

// ==================== TreeSearch Class ====================

export class TreeSearch {
  private tree: CodeTree;
  private symbolIndex: Map<string, string[]> = new Map(); // word -> symbol ids
  private trigramIndex: Map<string, Set<string>> = new Map(); // trigram -> symbol ids

  constructor(tree: CodeTree) {
    this.tree = tree;
    this.buildIndices();
  }

  /**
   * Update the tree reference (call this when tree is rebuilt)
   */
  updateTree(tree: CodeTree): void {
    this.tree = tree;
    this.buildIndices();
  }

  /**
   * Main search method
   */
  search(options: SearchOptions): SearchResult[] {
    const {
      query,
      kinds,
      files,
      maxResults = 50,
      minScore = 0.1,
      semanticSearch = true
    } = options;

    if (!query.trim()) {
      return [];
    }

    const results = new Map<string, SearchResult>();

    // 1. Exact and prefix matching
    this.addExactMatches(query, results, options);

    // 2. Fuzzy matching
    this.addFuzzyMatches(query, results, options);

    // 3. CamelCase matching
    this.addCamelCaseMatches(query, results, options);

    // 4. Acronym matching
    this.addAcronymMatches(query, results, options);

    // 5. Semantic search
    if (semanticSearch) {
      this.addSemanticMatches(query, results, options);
    }

    // Filter by kinds
    if (kinds && kinds.length > 0) {
      for (const [id, result] of results) {
        if (!kinds.includes(result.symbol.kind)) {
          results.delete(id);
        }
      }
    }

    // Filter by files
    if (files && files.length > 0) {
      const fileSet = new Set(files.map(f => f.toLowerCase()));
      for (const [id, result] of results) {
        if (!fileSet.has(result.symbol.filePath.toLowerCase())) {
          results.delete(id);
        }
      }
    }

    // Convert to array, filter by score, and sort
    let sortedResults = Array.from(results.values())
      .filter(r => r.score >= minScore)
      .sort((a, b) => b.score - a.score);

    // Add context
    sortedResults = sortedResults.map(r => ({
      ...r,
      context: this.buildContext(r.symbol)
    }));

    // Limit results
    return sortedResults.slice(0, maxResults);
  }

  /**
   * Search by type (semantic search)
   */
  searchByType(typeQuery: string, maxResults = 20): SearchResult[] {
    const results: SearchResult[] = [];

    for (const symbol of this.tree.symbols.values()) {
      if (symbol.signature && symbol.signature.includes(typeQuery)) {
        const score = this.calculateTypeMatchScore(symbol.signature, typeQuery);
        results.push({
          symbol,
          score,
          matchType: 'semantic-type'
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  /**
   * Find all usages of a symbol
   */
  findUsages(symbolId: string): CodeSymbol[] {
    const symbol = this.tree.symbols.get(symbolId);
    if (!symbol) {
      return [];
    }

    const usages: CodeSymbol[] = [];
    const symbolName = symbol.name;

    for (const other of this.tree.symbols.values()) {
      if (other.id === symbolId) continue;

      // Check if this symbol references the target
      const fileNode = this.tree.files.get(other.filePath);
      if (fileNode) {
        for (const imp of fileNode.imports) {
          if (imp.specifiers.includes(symbolName) || imp.defaultImport === symbolName) {
            usages.push(other);
            break;
          }
        }
      }
    }

    return usages;
  }

  /**
   * Find symbols related to a given symbol (by dependencies)
   */
  findRelated(symbolId: string, maxDepth = 2): Map<string, number> {
    const related = new Map<string, number>();
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number; score: number }> = 
      [{ id: symbolId, depth: 0, score: 1.0 }];

    while (queue.length > 0) {
      const { id, depth, score } = queue.shift()!;
      
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);

      const symbol = this.tree.symbols.get(id);
      if (!symbol) continue;

      // Same file symbols
      for (const other of this.tree.symbols.values()) {
        if (other.filePath === symbol.filePath && other.id !== id) {
          const currentScore = related.get(other.id) || 0;
          related.set(other.id, Math.max(currentScore, score * 0.9));
        }
      }

      // Parent and children
      if (symbol.parent) {
        const currentScore = related.get(symbol.parent) || 0;
        related.set(symbol.parent, Math.max(currentScore, score * 0.95));
        queue.push({ id: symbol.parent, depth: depth + 1, score: score * 0.95 });
      }

      for (const childId of symbol.children) {
        const currentScore = related.get(childId) || 0;
        related.set(childId, Math.max(currentScore, score * 0.95));
        queue.push({ id: childId, depth: depth + 1, score: score * 0.95 });
      }

      // Dependencies
      const fileNode = this.tree.files.get(symbol.filePath);
      if (fileNode) {
        for (const depPath of fileNode.dependencies) {
          const depFile = this.tree.files.get(depPath);
          if (depFile) {
            for (const depSymbol of depFile.symbols.values()) {
              const currentScore = related.get(depSymbol.id) || 0;
              related.set(depSymbol.id, Math.max(currentScore, score * 0.7));
            }
          }
        }
      }
    }

    related.delete(symbolId);
    return related;
  }

  /**
   * Find symbols in a specific file
   */
  searchInFile(filePath: string, query: string): SearchResult[] {
    const normalizedPath = filePath.toLowerCase();
    const fileSymbols: CodeSymbol[] = [];

    for (const symbol of this.tree.symbols.values()) {
      if (symbol.filePath.toLowerCase() === normalizedPath) {
        fileSymbols.push(symbol);
      }
    }

    const results: SearchResult[] = [];
    const lowerQuery = query.toLowerCase();

    for (const symbol of fileSymbols) {
      const score = this.calculateMatchScore(symbol.name, lowerQuery);
      if (score > 0) {
        results.push({
          symbol,
          score: score * 1.2, // Boost for same-file matches
          matchType: 'file-name'
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Get auto-completion suggestions
   */
  getCompletions(partial: string, maxResults = 20): SearchResult[] {
    if (partial.length < 2) {
      return [];
    }

    const results: SearchResult[] = [];
    const lowerPartial = partial.toLowerCase();

    for (const symbol of this.tree.symbols.values()) {
      if (symbol.name.toLowerCase().startsWith(lowerPartial)) {
        const score = this.calculateCompletionScore(symbol.name, partial);
        results.push({
          symbol,
          score,
          matchType: 'prefix'
        });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);
  }

  // ==================== Private Methods ====================

  private buildIndices(): void {
    this.symbolIndex.clear();
    this.trigramIndex.clear();

    for (const symbol of this.tree.symbols.values()) {
      // Index by words
      const words = this.tokenize(symbol.name);
      for (const word of words) {
        const existing = this.symbolIndex.get(word) || [];
        existing.push(symbol.id);
        this.symbolIndex.set(word, existing);
      }

      // Index by trigrams for fuzzy search
      const trigrams = this.getTrigrams(symbol.name.toLowerCase());
      for (const trigram of trigrams) {
        const existing = this.trigramIndex.get(trigram) || new Set();
        existing.add(symbol.id);
        this.trigramIndex.set(trigram, existing);
      }

      // Index JSDoc if available
      if (symbol.jsDoc) {
        const docWords = this.tokenize(symbol.jsDoc);
        for (const word of docWords) {
          const existing = this.symbolIndex.get(word) || [];
          existing.push(symbol.id);
          this.symbolIndex.set(word, existing);
        }
      }
    }
  }

  private tokenize(text: string): string[] {
    // Split by non-alphanumeric characters and camelCase
    const words = text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(w => w.length > 0);
    return [...new Set(words)];
  }

  private getTrigrams(text: string): string[] {
    const trigrams: string[] = [];
    for (let i = 0; i <= text.length - 3; i++) {
      trigrams.push(text.substring(i, i + 3));
    }
    return trigrams;
  }

  private addExactMatches(
    query: string, 
    results: Map<string, SearchResult>, 
    options: SearchOptions
  ): void {
    const lowerQuery = query.toLowerCase();

    for (const symbol of this.tree.symbols.values()) {
      const lowerName = symbol.name.toLowerCase();
      
      if (lowerName === lowerQuery) {
        results.set(symbol.id, {
          symbol,
          score: 1.0,
          matchType: 'exact',
          matchedText: symbol.name
        });
      } else if (lowerName.startsWith(lowerQuery)) {
        const existing = results.get(symbol.id);
        const score = 0.8 + (0.2 * (query.length / symbol.name.length));
        if (!existing || existing.score < score) {
          results.set(symbol.id, {
            symbol,
            score,
            matchType: 'prefix',
            matchedText: symbol.name.substring(0, query.length)
          });
        }
      }
    }
  }

  private addFuzzyMatches(
    query: string, 
    results: Map<string, SearchResult>, 
    options: SearchOptions
  ): void {
    const threshold = options.fuzzyThreshold || 0.6;
    const queryTrigrams = this.getTrigrams(query.toLowerCase());
    const candidateScores = new Map<string, number>();

    // Find candidates using trigram index
    for (const trigram of queryTrigrams) {
      const candidates = this.trigramIndex.get(trigram);
      if (candidates) {
        for (const symbolId of candidates) {
          candidateScores.set(symbolId, (candidateScores.get(symbolId) || 0) + 1);
        }
      }
    }

    // Score candidates
    for (const [symbolId, trigramScore] of candidateScores) {
      if (results.has(symbolId)) continue;

      const symbol = this.tree.symbols.get(symbolId);
      if (!symbol) continue;

      const fuzzyMatch = this.fuzzyMatch(symbol.name, query);
      if (fuzzyMatch.isMatch && fuzzyMatch.score >= threshold) {
        results.set(symbolId, {
          symbol,
          score: fuzzyMatch.score * 0.7,
          matchType: 'fuzzy'
        });
      }
    }
  }

  private addCamelCaseMatches(
    query: string, 
    results: Map<string, SearchResult>, 
    options: SearchOptions
  ): void {
    const queryParts = this.getCamelCaseParts(query);
    if (queryParts.length < 2) return;

    for (const symbol of this.tree.symbols.values()) {
      if (results.has(symbol.id)) continue;

      const symbolParts = this.getCamelCaseParts(symbol.name);
      let matchCount = 0;

      for (const queryPart of queryParts) {
        for (const symbolPart of symbolParts) {
          if (symbolPart.toLowerCase().startsWith(queryPart.toLowerCase())) {
            matchCount++;
            break;
          }
        }
      }

      if (matchCount === queryParts.length) {
        const score = 0.6 + (0.3 * (matchCount / Math.max(queryParts.length, symbolParts.length)));
        results.set(symbol.id, {
          symbol,
          score,
          matchType: 'camelCase'
        });
      }
    }
  }

  private addAcronymMatches(
    query: string, 
    results: Map<string, SearchResult>, 
    options: SearchOptions
  ): void {
    if (query.length < 2) return;

    const upperQuery = query.toUpperCase();

    for (const symbol of this.tree.symbols.values()) {
      if (results.has(symbol.id)) continue;

      const acronym = this.getAcronym(symbol.name);
      if (acronym.startsWith(upperQuery)) {
        const score = 0.5 + (0.4 * (query.length / acronym.length));
        results.set(symbol.id, {
          symbol,
          score,
          matchType: 'acronym'
        });
      }
    }
  }

  private addSemanticMatches(
    query: string, 
    results: Map<string, SearchResult>, 
    options: SearchOptions
  ): void {
    // Search by type signatures
    if (options.includeImports || options.includeExports) {
      const typeResults = this.searchByType(query, 10);
      for (const result of typeResults) {
        const existing = results.get(result.symbol.id);
        if (!existing || existing.score < result.score) {
          results.set(result.symbol.id, result);
        }
      }
    }
  }

  private fuzzyMatch(text: string, pattern: string): FuzzyMatch {
    const m = text.length;
    const n = pattern.length;
    
    if (n === 0) return { isMatch: true, score: 1.0, matchedIndices: [] };
    if (m === 0) return { isMatch: false, score: 0, matchedIndices: [] };

    // Dynamic programming approach for fuzzy matching
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    const matchIndices: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(null));

    for (let i = 0; i <= m; i++) {
      dp[i][0] = 1;
    }

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (text[i - 1].toLowerCase() === pattern[j - 1].toLowerCase()) {
          dp[i][j] = dp[i - 1][j - 1] * (this.isWordBoundary(text, i - 1) ? 1.2 : 0.9);
          matchIndices[i][j] = i - 1;
        } else {
          dp[i][j] = dp[i - 1][j] * 0.9;
        }
      }
    }

    const score = dp[m][n];
    const isMatch = score > 0.3;

    // Backtrack to find matched indices
    const matchedIndices: number[] = [];
    let i = m, j = n;
    while (i > 0 && j > 0) {
      if (matchIndices[i][j] !== null) {
        matchedIndices.unshift(matchIndices[i][j]);
        j--;
      }
      i--;
    }

    return { isMatch, score, matchedIndices };
  }

  private isWordBoundary(text: string, index: number): boolean {
    if (index === 0) return true;
    const prev = text[index - 1];
    const curr = text[index];
    return (/[a-z]/.test(prev) && /[A-Z]/.test(curr)) || 
           (/[a-zA-Z]/.test(prev) && /[0-9]/.test(curr)) ||
           prev === '_' || prev === '-';
  }

  private getCamelCaseParts(text: string): string[] {
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .split(/\s+/)
      .filter(p => p.length > 0);
  }

  private getAcronym(text: string): string {
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .split(/\s+|[_-]/)
      .map(part => part[0]?.toUpperCase() || '')
      .join('');
  }

  private calculateMatchScore(name: string, query: string): number {
    const lowerName = name.toLowerCase();
    
    if (lowerName === query) return 1.0;
    if (lowerName.startsWith(query)) return 0.8;
    if (lowerName.includes(query)) return 0.6;
    
    const fuzzyMatch = this.fuzzyMatch(name, query);
    return fuzzyMatch.score * 0.5;
  }

  private calculateCompletionScore(name: string, partial: string): number {
    const lowerName = name.toLowerCase();
    const lowerPartial = partial.toLowerCase();
    
    if (lowerName.startsWith(lowerPartial)) {
      return 1.0 - (name.length - partial.length) * 0.01;
    }
    return 0;
  }

  private calculateTypeMatchScore(signature: string, typeQuery: string): number {
    const lowerSig = signature.toLowerCase();
    const lowerQuery = typeQuery.toLowerCase();
    
    if (lowerSig === lowerQuery) return 1.0;
    if (lowerSig.startsWith(lowerQuery)) return 0.8;
    if (lowerSig.includes(lowerQuery)) return 0.6;
    return 0.3;
  }

  private buildContext(symbol: CodeSymbol): SearchContext {
    const fileNode = this.tree.files.get(symbol.filePath);
    
    return {
      lineText: '', // Would need to read file content
      surroundingLines: [],
      fileName: symbol.filePath.split('/').pop() || '',
      imports: fileNode?.imports.map(i => i.source),
      exports: fileNode?.exports.map(e => e.name)
    };
  }
}

// ==================== Utility Functions ====================

/**
 * Create a search instance from a code tree
 */
export function createSearch(tree: CodeTree): TreeSearch {
  return new TreeSearch(tree);
}

/**
 * Quick search function for simple use cases
 */
export function quickSearch(tree: CodeTree, query: string, maxResults = 20): SearchResult[] {
  const search = new TreeSearch(tree);
  return search.search({ query, maxResults });
}
