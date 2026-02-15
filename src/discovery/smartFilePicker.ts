/**
 * Smart File Picker
 * 
 * Умный выбор файлов на основе запроса пользователя.
 * Использует лёгкую модель (kimi-k2.5-lite) для анализа дерева и выбора релевантных файлов.
 */

import * as vscode from 'vscode';
import { CodeTree, FileNode, CodeSymbol, SymbolKind } from './codeTreeBuilder';
import { TreeSearch, SearchResult, SearchOptions } from './treeSearch';
import { EventEmitter } from 'events';

// ==================== Types ====================

export interface FilePick {
  filePath: string;
  relevanceScore: number;
  justification: string;
  matchedSymbols: string[];
  confidence: 'high' | 'medium' | 'low';
}

export interface FilePickerOptions {
  query: string;
  maxFiles?: number;
  useAI?: boolean;
  currentFile?: string;
  contextFiles?: string[];
  minRelevanceScore?: number;
  includeTests?: boolean;
  maxTokens?: number;
}

export interface FilePickerContext {
  recentFiles: string[];
  openFiles: string[];
  cursorPosition?: {
    file: string;
    line: number;
    column: number;
  };
  selection?: string;
}

export interface AnalyzedIntent {
  primaryIntent: string;
  secondaryIntents: string[];
  targetTypes: SymbolKind[];
  relatedConcepts: string[];
  expectedFilePatterns: string[];
}

// ==================== SmartFilePicker Class ====================

export class SmartFilePicker extends EventEmitter {
  private tree: CodeTree;
  private search: TreeSearch;
  private context: FilePickerContext;
  private modelClient?: ModelClient;

  constructor(tree: CodeTree, modelClient?: ModelClient) {
    super();
    this.tree = tree;
    this.search = new TreeSearch(tree);
    this.modelClient = modelClient;
    this.context = {
      recentFiles: [],
      openFiles: []
    };
  }

  /**
   * Update tree reference
   */
  updateTree(tree: CodeTree): void {
    this.tree = tree;
    this.search.updateTree(tree);
  }

  /**
   * Update context information
   */
  updateContext(context: Partial<FilePickerContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Main method: pick relevant files based on query
   */
  async pickFiles(options: FilePickerOptions): Promise<FilePick[]> {
    const startTime = Date.now();
    this.emit('picking-started', { query: options.query });

    try {
      // Step 1: Analyze query intent (using AI if available)
      const intent = await this.analyzeIntent(options.query);
      
      // Step 2: Search for relevant symbols
      const searchResults = this.performSemanticSearch(options, intent);
      
      // Step 3: Score and rank files
      let filePicks = this.scoreFiles(searchResults, options, intent);
      
      // Step 4: AI refinement (if enabled and available)
      if (options.useAI && this.modelClient) {
        filePicks = await this.aiRefinement(filePicks, options, intent);
      }
      
      // Step 5: Add contextual files
      filePicks = this.addContextualFiles(filePicks, options);
      
      // Step 6: Final ranking and limiting
      filePicks = this.finalizePicks(filePicks, options);

      const duration = Date.now() - startTime;
      this.emit('picking-completed', { 
        query: options.query, 
        fileCount: filePicks.length,
        duration 
      });

      return filePicks;
    } catch (error) {
      this.emit('picking-error', { error, query: options.query });
      throw error;
    }
  }

  /**
   * Quick pick without AI - fast path for simple queries
   */
  quickPick(query: string, maxFiles = 10): FilePick[] {
    // Direct symbol search
    const searchResults = this.search.search({
      query,
      maxResults: maxFiles * 3,
      fuzzyThreshold: 0.5
    });

    // Group by file and score
    const fileScores = new Map<string, {
      score: number;
      symbols: CodeSymbol[];
      matchTypes: Set<string>;
    }>();

    for (const result of searchResults) {
      const existing = fileScores.get(result.symbol.filePath);
      if (existing) {
        existing.score += result.score;
        existing.symbols.push(result.symbol);
        existing.matchTypes.add(result.matchType);
      } else {
        fileScores.set(result.symbol.filePath, {
          score: result.score,
          symbols: [result.symbol],
          matchTypes: new Set([result.matchType])
        });
      }
    }

    // Convert to FilePick array
    const picks: FilePick[] = [];
    for (const [filePath, data] of fileScores) {
      const fileNode = this.tree.files.get(filePath);
      if (!fileNode) continue;

      picks.push({
        filePath,
        relevanceScore: Math.min(data.score / data.symbols.length, 1.0),
        justification: this.generateJustification(data.symbols, data.matchTypes, fileNode),
        matchedSymbols: data.symbols.slice(0, 5).map(s => s.name),
        confidence: this.calculateConfidence(data.score, data.matchTypes, data.symbols.length)
      });
    }

    return picks
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxFiles);
  }

  /**
   * Pick files related to a specific symbol
   */
  pickRelatedFiles(symbolId: string, maxFiles = 10): FilePick[] {
    const symbol = this.tree.symbols.get(symbolId);
    if (!symbol) {
      return [];
    }

    // Find related symbols
    const related = this.search.findRelated(symbolId, 2);
    
    // Group by file
    const fileScores = new Map<string, { score: number; symbols: string[] }>();
    
    for (const [relatedId, score] of related) {
      const relatedSymbol = this.tree.symbols.get(relatedId);
      if (!relatedSymbol) continue;

      const existing = fileScores.get(relatedSymbol.filePath);
      if (existing) {
        existing.score += score;
        existing.symbols.push(relatedSymbol.name);
      } else {
        fileScores.set(relatedSymbol.filePath, {
          score,
          symbols: [relatedSymbol.name]
        });
      }
    }

    // Convert to FilePick
    const picks: FilePick[] = [];
    for (const [filePath, data] of fileScores) {
      if (filePath === symbol.filePath) continue; // Skip original file

      const fileNode = this.tree.files.get(filePath);
      if (!fileNode) continue;

      picks.push({
        filePath,
        relevanceScore: data.score,
        justification: `Related to "${symbol.name}" through: ${data.symbols.slice(0, 3).join(', ')}`,
        matchedSymbols: data.symbols,
        confidence: data.score > 0.7 ? 'high' : data.score > 0.4 ? 'medium' : 'low'
      });
    }

    return picks
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxFiles);
  }

  /**
   * Pick files for implementing a feature
   */
  async pickForFeature(featureDescription: string, maxFiles = 15): Promise<FilePick[]> {
    // Use AI to understand what files might be needed
    if (this.modelClient) {
      const intent = await this.analyzeIntent(featureDescription);
      
      // Search for each related concept
      const allResults: SearchResult[] = [];
      for (const concept of intent.relatedConcepts) {
        const results = this.search.search({
          query: concept,
          maxResults: 10,
          kinds: intent.targetTypes
        });
        allResults.push(...results);
      }

      // Also search by file patterns
      for (const pattern of intent.expectedFilePatterns) {
        for (const [filePath, fileNode] of this.tree.files) {
          if (this.matchPattern(filePath, pattern)) {
            // Boost files matching expected patterns
            for (const symbol of fileNode.symbols.values()) {
              allResults.push({
                symbol,
                score: 0.7,
                matchType: 'file-name'
              });
            }
          }
        }
      }

      return this.scoreFiles(allResults, { query: featureDescription, maxFiles }, intent);
    }

    // Fallback to regular pick
    return this.quickPick(featureDescription, maxFiles);
  }

  // ==================== Private Methods ====================

  private async analyzeIntent(query: string): Promise<AnalyzedIntent> {
    // Use AI if available for better intent analysis
    if (this.modelClient) {
      try {
        const prompt = this.buildIntentAnalysisPrompt(query);
        const response = await this.modelClient.complete(prompt, {
          model: 'kimi-k2.5-lite',
          maxTokens: 500,
          temperature: 0.3
        });
        return this.parseIntentResponse(response, query);
      } catch {
        // Fallback to heuristic analysis
      }
    }

    return this.heuristicIntentAnalysis(query);
  }

  private buildIntentAnalysisPrompt(query: string): string {
    return `Analyze this code-related query and extract intent:

Query: "${query}"

Provide analysis in this format:
PrimaryIntent: <main goal>
SecondaryIntents: <comma-separated list>
TargetTypes: <class|interface|function|type|method>
RelatedConcepts: <comma-separated keywords>
ExpectedPatterns: <file patterns like *.service.ts, *controller*>

Analysis:`;
  }

  private parseIntentResponse(response: string, originalQuery: string): AnalyzedIntent {
    const lines = response.split('\n');
    const intent: AnalyzedIntent = {
      primaryIntent: originalQuery,
      secondaryIntents: [],
      targetTypes: [],
      relatedConcepts: [],
      expectedFilePatterns: []
    };

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();

      switch (key.trim()) {
        case 'PrimaryIntent':
          intent.primaryIntent = value || originalQuery;
          break;
        case 'SecondaryIntents':
          intent.secondaryIntents = value.split(',').map(s => s.trim()).filter(Boolean);
          break;
        case 'TargetTypes':
          intent.targetTypes = value.split(',').map(s => s.trim()).filter(Boolean) as SymbolKind[];
          break;
        case 'RelatedConcepts':
          intent.relatedConcepts = value.split(',').map(s => s.trim()).filter(Boolean);
          break;
        case 'ExpectedPatterns':
          intent.expectedFilePatterns = value.split(',').map(s => s.trim()).filter(Boolean);
          break;
      }
    }

    // Fallback values
    if (intent.relatedConcepts.length === 0) {
      intent.relatedConcepts = this.extractKeywords(originalQuery);
    }

    return intent;
  }

  private heuristicIntentAnalysis(query: string): AnalyzedIntent {
    const lowerQuery = query.toLowerCase();
    
    // Detect target types from query
    const targetTypes: SymbolKind[] = [];
    if (lowerQuery.includes('class')) targetTypes.push('class');
    if (lowerQuery.includes('interface')) targetTypes.push('interface');
    if (lowerQuery.includes('function') || lowerQuery.includes('fn')) targetTypes.push('function');
    if (lowerQuery.includes('type')) targetTypes.push('type');
    if (lowerQuery.includes('method')) targetTypes.push('method');

    // Detect file patterns
    const expectedFilePatterns: string[] = [];
    if (lowerQuery.includes('test')) expectedFilePatterns.push('*.test.*', '*.spec.*');
    if (lowerQuery.includes('component')) expectedFilePatterns.push('*.component.*', '*.tsx', '*.jsx');
    if (lowerQuery.includes('service')) expectedFilePatterns.push('*.service.*');
    if (lowerQuery.includes('controller')) expectedFilePatterns.push('*.controller.*', '*Controller*');
    if (lowerQuery.includes('model') || lowerQuery.includes('entity')) {
      expectedFilePatterns.push('*.model.*', '*.entity.*');
    }

    // Extract keywords
    const relatedConcepts = this.extractKeywords(query);

    return {
      primaryIntent: query,
      secondaryIntents: [],
      targetTypes: targetTypes.length > 0 ? targetTypes : ['class', 'function', 'interface'],
      relatedConcepts,
      expectedFilePatterns
    };
  }

  private extractKeywords(query: string): string[] {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare',
      'ought', 'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by',
      'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'under', 'and', 'but', 'or', 'yet', 'so', 'if',
      'because', 'although', 'though', 'while', 'where', 'when', 'that',
      'which', 'who', 'whom', 'whose', 'what', 'this', 'these', 'those',
      'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you',
      'your', 'yours', 'yourself', 'yourselves', 'he', 'him', 'his', 'himself',
      'she', 'her', 'hers', 'herself', 'it', 'its', 'itself', 'they', 'them',
      'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom', 'this',
      'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing'
    ]);

    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  private performSemanticSearch(options: FilePickerOptions, intent: AnalyzedIntent): SearchResult[] {
    const allResults: SearchResult[] = [];

    // Search for primary intent
    allResults.push(...this.search.search({
      query: intent.primaryIntent,
      maxResults: 30,
      kinds: intent.targetTypes.length > 0 ? intent.targetTypes : undefined
    }));

    // Search for related concepts
    for (const concept of intent.relatedConcepts) {
      allResults.push(...this.search.search({
        query: concept,
        maxResults: 10
      }));
    }

    // Search for secondary intents
    for (const secondary of intent.secondaryIntents) {
      allResults.push(...this.search.search({
        query: secondary,
        maxResults: 10
      }));
    }

    return allResults;
  }

  private scoreFiles(
    searchResults: SearchResult[], 
    options: FilePickerOptions, 
    intent: AnalyzedIntent
  ): FilePick[] {
    const fileScores = new Map<string, {
      baseScore: number;
      symbolMatches: Map<string, { symbol: CodeSymbol; score: number; matchType: string }>;
      contextScore: number;
    }>();

    // Aggregate scores by file
    for (const result of searchResults) {
      const filePath = result.symbol.filePath;
      let fileData = fileScores.get(filePath);

      if (!fileData) {
        fileData = {
          baseScore: 0,
          symbolMatches: new Map(),
          contextScore: 0
        };
        fileScores.set(filePath, fileData);
      }

      // Update base score
      fileData.baseScore += result.score;

      // Track symbol matches
      const existingMatch = fileData.symbolMatches.get(result.symbol.id);
      if (!existingMatch || existingMatch.score < result.score) {
        fileData.symbolMatches.set(result.symbol.id, {
          symbol: result.symbol,
          score: result.score,
          matchType: result.matchType
        });
      }

      // Calculate context score
      fileData.contextScore += this.calculateContextScore(result.symbol, options);
    }

    // Calculate pattern matches
    for (const pattern of intent.expectedFilePatterns) {
      for (const [filePath, fileNode] of this.tree.files) {
        if (this.matchPattern(filePath, pattern)) {
          const fileData = fileScores.get(filePath);
          if (fileData) {
            fileData.baseScore *= 1.2; // Boost matching patterns
          }
        }
      }
    }

    // Convert to FilePick array
    const picks: FilePick[] = [];
    for (const [filePath, data] of fileScores) {
      const fileNode = this.tree.files.get(filePath);
      if (!fileNode) continue;

      // Skip test files unless explicitly requested
      if (!options.includeTests && this.isTestFile(filePath)) {
        continue;
      }

      // Calculate final score
      const finalScore = this.calculateFinalScore(data, fileNode, options);

      if (finalScore >= (options.minRelevanceScore || 0.1)) {
        const topSymbols = Array.from(data.symbolMatches.values())
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        picks.push({
          filePath,
          relevanceScore: finalScore,
          justification: this.generateJustification(
            topSymbols.map(s => s.symbol),
            new Set(topSymbols.map(s => s.matchType)),
            fileNode
          ),
          matchedSymbols: topSymbols.map(s => s.symbol.name),
          confidence: this.calculateConfidenceFromScore(finalScore)
        });
      }
    }

    return picks;
  }

  private calculateContextScore(symbol: CodeSymbol, options: FilePickerOptions): number {
    let score = 0;

    // Boost if in current file's context
    if (options.currentFile && symbol.filePath === options.currentFile) {
      score += 0.3;
    }

    // Boost if in open files
    if (this.context.openFiles.includes(symbol.filePath)) {
      score += 0.2;
    }

    // Boost if in recent files
    const recentIndex = this.context.recentFiles.indexOf(symbol.filePath);
    if (recentIndex >= 0) {
      score += 0.1 * (1 - recentIndex / this.context.recentFiles.length);
    }

    // Boost exported symbols
    if (symbol.isExported) {
      score += 0.1;
    }

    return score;
  }

  private calculateFinalScore(
    data: {
      baseScore: number;
      symbolMatches: Map<string, { score: number }>;
      contextScore: number;
    },
    fileNode: FileNode,
    options: FilePickerOptions
  ): number {
    const symbolCount = data.symbolMatches.size;
    const avgSymbolScore = symbolCount > 0 ? data.baseScore / symbolCount : 0;
    
    // Normalize and combine scores
    const normalizedBaseScore = Math.min(avgSymbolScore * Math.log(symbolCount + 1), 1.0);
    const normalizedContextScore = Math.min(data.contextScore, 0.5);

    // File size penalty (prefer medium-sized files)
    const sizePenalty = this.calculateSizePenalty(fileNode.size);

    return (normalizedBaseScore * 0.6 + normalizedContextScore * 0.4) * sizePenalty;
  }

  private calculateSizePenalty(fileSize: number): number {
    // Prefer files between 100 bytes and 50KB
    if (fileSize < 100) return 0.7; // Too small
    if (fileSize > 100000) return 0.6; // Too large
    if (fileSize > 50000) return 0.8; // Getting large
    return 1.0; // Just right
  }

  private async aiRefinement(
    picks: FilePick[], 
    options: FilePickerOptions, 
    intent: AnalyzedIntent
  ): Promise<FilePick[]> {
    if (!this.modelClient || picks.length <= 3) {
      return picks;
    }

    try {
      const prompt = this.buildRefinementPrompt(picks, options, intent);
      const response = await this.modelClient.complete(prompt, {
        model: 'kimi-k2.5-lite',
        maxTokens: options.maxTokens || 1000,
        temperature: 0.2
      });

      return this.parseRefinementResponse(picks, response);
    } catch {
      // Return original picks on error
      return picks;
    }
  }

  private buildRefinementPrompt(
    picks: FilePick[], 
    options: FilePickerOptions, 
    intent: AnalyzedIntent
  ): string {
    const fileList = picks.slice(0, 20).map((pick, i) => {
      const fileNode = this.tree.files.get(pick.filePath);
      const symbols = fileNode 
        ? Array.from(fileNode.symbols.values()).slice(0, 5).map(s => s.name).join(', ')
        : pick.matchedSymbols.join(', ');
      
      return `${i + 1}. ${pick.filePath}
   Symbols: ${symbols}
   Initial Score: ${pick.relevanceScore.toFixed(3)}`;
    }).join('\n');

    return `Given this query: "${options.query}"
And this intent analysis:
- Primary: ${intent.primaryIntent}
- Target Types: ${intent.targetTypes.join(', ')}
- Related Concepts: ${intent.relatedConcepts.join(', ')}

Rank these files by relevance (1-${picks.length}):

${fileList}

Provide ranking as:
RANK: <file number>,<score 0-1>,<brief justification>
(One per line)`;
  }

  private parseRefinementResponse(originalPicks: FilePick[], response: string): FilePick[] {
    const refined: FilePick[] = [];
    const lines = response.split('\n');

    for (const line of lines) {
      const match = line.match(/RANK:\s*(\d+)\s*,\s*([\d.]+)\s*,\s*(.+)/i);
      if (match) {
        const index = parseInt(match[1]) - 1;
        const score = parseFloat(match[2]);
        const justification = match[3].trim();

        if (index >= 0 && index < originalPicks.length) {
          const pick = originalPicks[index];
          refined.push({
            ...pick,
            relevanceScore: score,
            justification: justification || pick.justification
          });
        }
      }
    }

    return refined.length > 0 ? refined : originalPicks;
  }

  private addContextualFiles(picks: FilePick[], options: FilePickerOptions): FilePick[] {
    const pickSet = new Set(picks.map(p => p.filePath));
    const additionalFiles: FilePick[] = [];

    // Add current file if not already included
    if (options.currentFile && !pickSet.has(options.currentFile)) {
      additionalFiles.push({
        filePath: options.currentFile,
        relevanceScore: 0.5,
        justification: 'Current active file',
        matchedSymbols: [],
        confidence: 'high'
      });
    }

    // Add context files
    if (options.contextFiles) {
      for (const ctxFile of options.contextFiles) {
        if (!pickSet.has(ctxFile)) {
          additionalFiles.push({
            filePath: ctxFile,
            relevanceScore: 0.4,
            justification: 'From conversation context',
            matchedSymbols: [],
            confidence: 'medium'
          });
        }
      }
    }

    return [...picks, ...additionalFiles];
  }

  private finalizePicks(picks: FilePick[], options: FilePickerOptions): FilePick[] {
    // Sort by relevance
    picks.sort((a, b) => b.relevanceScore - a.relevanceScore);

    // Remove duplicates
    const seen = new Set<string>();
    const unique: FilePick[] = [];
    
    for (const pick of picks) {
      if (!seen.has(pick.filePath)) {
        seen.add(pick.filePath);
        unique.push(pick);
      }
    }

    // Limit results
    const maxFiles = options.maxFiles || 10;
    return unique.slice(0, maxFiles);
  }

  private generateJustification(
    symbols: CodeSymbol[], 
    matchTypes: Set<string>, 
    fileNode: FileNode
  ): string {
    const parts: string[] = [];

    // Mention match types
    if (matchTypes.has('exact')) {
      parts.push('exact name match');
    } else if (matchTypes.has('prefix')) {
      parts.push('prefix match');
    } else if (matchTypes.has('fuzzy')) {
      parts.push('fuzzy match');
    }

    // Mention matched symbols
    if (symbols.length > 0) {
      const symbolNames = symbols.slice(0, 3).map(s => `"${s.name}"`).join(', ');
      parts.push(`contains ${symbolNames}`);
    }

    // Mention exports
    const exports = fileNode.exports;
    if (exports.length > 0 && symbols.some(s => s.isExported)) {
      parts.push('exports relevant symbols');
    }

    // Build final justification
    if (parts.length === 0) {
      return 'File may be relevant based on content analysis';
    }

    return parts.join('; ');
  }

  private calculateConfidence(
    score: number, 
    matchTypes: Set<string>, 
    symbolCount: number
  ): 'high' | 'medium' | 'low' {
    let confidenceScore = score;

    if (matchTypes.has('exact')) confidenceScore += 0.3;
    if (matchTypes.has('prefix')) confidenceScore += 0.2;
    if (symbolCount > 3) confidenceScore += 0.1;

    if (confidenceScore >= 0.7) return 'high';
    if (confidenceScore >= 0.4) return 'medium';
    return 'low';
  }

  private calculateConfidenceFromScore(score: number): 'high' | 'medium' | 'low' {
    if (score >= 0.7) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  private isTestFile(filePath: string): boolean {
    const lowerPath = filePath.toLowerCase();
    return lowerPath.includes('.test.') || 
           lowerPath.includes('.spec.') ||
           lowerPath.includes('/test/') ||
           lowerPath.includes('/tests/') ||
           lowerPath.includes('/__tests__/');
  }

  private matchPattern(filePath: string, pattern: string): boolean {
    const regex = new RegExp(
      pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.')
    );
    return regex.test(filePath);
  }
}

// ==================== Model Client Interface ====================

export interface ModelClient {
  complete(prompt: string, options: {
    model: string;
    maxTokens: number;
    temperature: number;
  }): Promise<string>;
}

// ==================== Utility Functions ====================

/**
 * Create a simple model client using VS Code's language model API
 */
export function createVSCodeModelClient(): ModelClient {
  return {
    async complete(prompt: string, options): Promise<string> {
      // This would integrate with VS Code's language model API
      // For now, return empty response (heuristics will be used)
      return '';
    }
  };
}
