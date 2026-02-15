/**
 * Code Summarizer
 * 
 * Создаёт краткие summary для файлов кода.
 * Использует fast model для генерации описаний.
 * Кеширует summaries на диске.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CodeTree, FileNode, CodeSymbol, SymbolKind } from './codeTreeBuilder';
import { EventEmitter } from 'events';

// ==================== Types ====================

export interface FileSummary {
  filePath: string;
  overview: string;
  purpose: string;
  keyFunctions: FunctionSummary[];
  keyClasses: ClassSummary[];
  keyTypes: TypeSummary[];
  dependencies: DependencySummary;
  complexity: ComplexityMetrics;
  generatedAt: number;
  version: string;
}

export interface FunctionSummary {
  name: string;
  signature: string;
  description: string;
  parameters: ParameterSummary[];
  returns?: string;
  isExported: boolean;
  isAsync: boolean;
  isPure: boolean;
  lineNumber: number;
}

export interface ClassSummary {
  name: string;
  description: string;
  extends?: string;
  implements: string[];
  methods: MethodSummary[];
  properties: PropertySummary[];
  isExported: boolean;
  lineNumber: number;
}

export interface MethodSummary {
  name: string;
  signature: string;
  description: string;
  visibility: 'public' | 'protected' | 'private';
  isStatic: boolean;
  isAsync: boolean;
  isAbstract: boolean;
}

export interface PropertySummary {
  name: string;
  type?: string;
  description: string;
  visibility: 'public' | 'protected' | 'private';
  isStatic: boolean;
  isReadonly: boolean;
}

export interface TypeSummary {
  name: string;
  kind: 'interface' | 'type' | 'enum';
  description: string;
  definition: string;
  isExported: boolean;
}

export interface DependencySummary {
  imports: ImportSummary[];
  exports: ExportSummary[];
  externalDependencies: string[];
  internalDependencies: string[];
}

export interface ImportSummary {
  source: string;
  items: string[];
  isTypeOnly: boolean;
}

export interface ExportSummary {
  name: string;
  kind: SymbolKind;
  isDefault: boolean;
}

export interface ComplexityMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  functionCount: number;
  classCount: number;
  averageFunctionLength: number;
}

export interface SummarizerOptions {
  cacheDir?: string;
  maxSummaryLength?: number;
  generateOnInit?: boolean;
  useAI?: boolean;
  modelClient?: ModelClient;
  batchSize?: number;
  maxConcurrent?: number;
}

export interface ModelClient {
  complete(prompt: string, options: {
    model: string;
    maxTokens: number;
    temperature: number;
  }): Promise<string>;
}

// ==================== CodeSummarizer Class ====================

export class CodeSummarizer extends EventEmitter {
  private tree: CodeTree;
  private options: Required<SummarizerOptions>;
  private summaries: Map<string, FileSummary> = new Map();
  private cacheFilePath: string;
  private modelClient?: ModelClient;
  private isGenerating = false;

  private static readonly DEFAULT_OPTIONS: Required<SummarizerOptions> = {
    cacheDir: '.kimi/cache/summaries',
    maxSummaryLength: 500,
    generateOnInit: false,
    useAI: false,
    modelClient: undefined as any,
    batchSize: 10,
    maxConcurrent: 3
  };

  constructor(tree: CodeTree, options: SummarizerOptions = {}) {
    super();
    this.tree = tree;
    this.options = { ...CodeSummarizer.DEFAULT_OPTIONS, ...options };
    this.modelClient = options.modelClient;
    this.cacheFilePath = path.join(this.options.cacheDir, 'summaries-cache.json');
  }

  // ==================== Public API ====================

  /**
   * Initialize summarizer - load from cache
   */
  async initialize(): Promise<void> {
    await this.loadFromCache();
    
    if (this.options.generateOnInit) {
      await this.generateAllSummaries();
    }
  }

  /**
   * Get summary for a file (generate if not cached)
   */
  async getSummary(filePath: string): Promise<FileSummary | null> {
    const normalizedPath = path.normalize(filePath);
    
    // Check memory cache
    if (this.summaries.has(normalizedPath)) {
      return this.summaries.get(normalizedPath)!;
    }

    // Get file node
    const fileNode = this.tree.files.get(normalizedPath);
    if (!fileNode) {
      return null;
    }

    // Generate summary
    const summary = await this.generateSummary(fileNode);
    if (summary) {
      this.summaries.set(normalizedPath, summary);
      await this.saveToCache();
    }

    return summary;
  }

  /**
   * Get summary from cache only (don't generate)
   */
  getCachedSummary(filePath: string): FileSummary | null {
    return this.summaries.get(path.normalize(filePath)) || null;
  }

  /**
   * Generate summary for a specific file
   */
  async generateSummary(fileNode: FileNode): Promise<FileSummary | null> {
    try {
      this.emit('generating-summary', { filePath: fileNode.path });

      // Build summary from AST
      const summary = this.buildSummaryFromAST(fileNode);

      // Enhance with AI if available
      if (this.options.useAI && this.modelClient) {
        const aiSummary = await this.generateAISummary(fileNode, summary);
        if (aiSummary) {
          summary.overview = aiSummary.overview || summary.overview;
          summary.purpose = aiSummary.purpose || summary.purpose;
        }
      }

      this.emit('summary-generated', { filePath: fileNode.path });
      return summary;
    } catch (error) {
      this.emit('summary-error', { filePath: fileNode.path, error });
      return null;
    }
  }

  /**
   * Generate summaries for all files
   */
  async generateAllSummaries(): Promise<void> {
    if (this.isGenerating) {
      return;
    }

    this.isGenerating = true;
    this.emit('batch-generation-started', { totalFiles: this.tree.files.size });

    try {
      const files = Array.from(this.tree.files.values());
      const batches = this.chunkArray(files, this.options.batchSize);

      let processed = 0;
      for (const batch of batches) {
        // Process batch concurrently
        await Promise.all(
          batch.map(fileNode => this.generateSummary(fileNode).then(summary => {
            if (summary) {
              this.summaries.set(fileNode.path, summary);
            }
            processed++;
          }))
        );

        this.emit('batch-progress', { processed, total: files.length });
        
        // Save progress periodically
        if (processed % (this.options.batchSize * 3) === 0) {
          await this.saveToCache();
        }
      }

      await this.saveToCache();
      this.emit('batch-generation-completed', { totalFiles: processed });
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * Update summary for a file (called when file changes)
   */
  async updateSummary(filePath: string): Promise<void> {
    const normalizedPath = path.normalize(filePath);
    const fileNode = this.tree.files.get(normalizedPath);
    
    if (fileNode) {
      const summary = await this.generateSummary(fileNode);
      if (summary) {
        this.summaries.set(normalizedPath, summary);
        await this.saveToCache();
      }
    } else {
      this.summaries.delete(normalizedPath);
      await this.saveToCache();
    }
  }

  /**
   * Get quick stats for a file
   */
  getQuickStats(filePath: string): ComplexityMetrics | null {
    const normalizedPath = path.normalize(filePath);
    const fileNode = this.tree.files.get(normalizedPath);
    
    if (!fileNode) {
      return null;
    }

    return this.calculateComplexity(fileNode);
  }

  /**
   * Search summaries by keyword
   */
  searchSummaries(keyword: string): FileSummary[] {
    const lowerKeyword = keyword.toLowerCase();
    const results: FileSummary[] = [];

    for (const summary of this.summaries.values()) {
      if (summary.overview.toLowerCase().includes(lowerKeyword) ||
          summary.purpose.toLowerCase().includes(lowerKeyword) ||
          summary.keyFunctions.some(f => f.description.toLowerCase().includes(lowerKeyword)) ||
          summary.keyClasses.some(c => c.description.toLowerCase().includes(lowerKeyword))) {
        results.push(summary);
      }
    }

    return results;
  }

  /**
   * Get all summaries
   */
  getAllSummaries(): FileSummary[] {
    return Array.from(this.summaries.values());
  }

  /**
   * Invalidate cache
   */
  invalidateCache(): void {
    this.summaries.clear();
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.removeAllListeners();
  }

  // ==================== Private Methods ====================

  private buildSummaryFromAST(fileNode: FileNode): FileSummary {
    const symbols = Array.from(fileNode.symbols.values());
    
    // Categorize symbols
    const functions = symbols.filter(s => s.kind === 'function');
    const classes = symbols.filter(s => s.kind === 'class');
    const interfaces = symbols.filter(s => s.kind === 'interface');
    const types = symbols.filter(s => s.kind === 'type');
    const enums = symbols.filter(s => s.kind === 'enum');

    // Build function summaries
    const functionSummaries = functions.map(f => this.summarizeFunction(f));

    // Build class summaries
    const classSummaries = classes.map(c => this.summarizeClass(c, symbols));

    // Build type summaries
    const typeSummaries = [
      ...interfaces.map(i => this.summarizeType(i, 'interface')),
      ...types.map(t => this.summarizeType(t, 'type')),
      ...enums.map(e => this.summarizeType(e, 'enum'))
    ];

    // Calculate complexity
    const complexity = this.calculateComplexity(fileNode);

    // Build dependency summary
    const dependencySummary = this.summarizeDependencies(fileNode);

    // Generate overview
    const overview = this.generateOverview(fileNode, {
      functions: functionSummaries,
      classes: classSummaries,
      types: typeSummaries
    });

    // Generate purpose description
    const purpose = this.generatePurpose(fileNode, functionSummaries, classSummaries);

    return {
      filePath: fileNode.path,
      overview,
      purpose,
      keyFunctions: functionSummaries,
      keyClasses: classSummaries,
      keyTypes: typeSummaries,
      dependencies: dependencySummary,
      complexity,
      generatedAt: Date.now(),
      version: '1.0'
    };
  }

  private summarizeFunction(symbol: CodeSymbol): FunctionSummary {
    const jsDoc = this.parseJsDoc(symbol.jsDoc);
    
    return {
      name: symbol.name,
      signature: symbol.signature || `${symbol.name}()`,
      description: jsDoc.description || this.generateFunctionDescription(symbol),
      parameters: jsDoc.params,
      returns: jsDoc.returns,
      isExported: symbol.isExported,
      isAsync: symbol.modifiers.includes('async'),
      isPure: this.isPureFunction(symbol),
      lineNumber: symbol.line
    };
  }

  private summarizeClass(classSymbol: CodeSymbol, allSymbols: CodeSymbol[]): ClassSummary {
    const jsDoc = this.parseJsDoc(classSymbol.jsDoc);
    const childSymbols = allSymbols.filter(s => s.parent === classSymbol.id);
    
    const methods = childSymbols
      .filter(s => s.kind === 'method')
      .map(m => ({
        name: m.name,
        signature: m.signature || `${m.name}()`,
        description: this.parseJsDoc(m.jsDoc).description || '',
        visibility: this.getVisibility(m),
        isStatic: m.modifiers.includes('static'),
        isAsync: m.modifiers.includes('async'),
        isAbstract: m.modifiers.includes('abstract')
      }));

    const properties = childSymbols
      .filter(s => s.kind === 'property')
      .map(p => ({
        name: p.name,
        type: this.extractTypeFromSignature(p.signature),
        description: this.parseJsDoc(p.jsDoc).description || '',
        visibility: this.getVisibility(p),
        isStatic: p.modifiers.includes('static'),
        isReadonly: p.modifiers.includes('readonly')
      }));

    return {
      name: classSymbol.name,
      description: jsDoc.description || `Class ${classSymbol.name}`,
      extends: this.extractExtends(classSymbol),
      implements: this.extractImplements(classSymbol),
      methods,
      properties,
      isExported: classSymbol.isExported,
      lineNumber: classSymbol.line
    };
  }

  private summarizeType(symbol: CodeSymbol, kind: 'interface' | 'type' | 'enum'): TypeSummary {
    const jsDoc = this.parseJsDoc(symbol.jsDoc);
    
    return {
      name: symbol.name,
      kind,
      description: jsDoc.description || `${kind} ${symbol.name}`,
      definition: symbol.signature || symbol.name,
      isExported: symbol.isExported
    };
  }

  private summarizeDependencies(fileNode: FileNode): DependencySummary {
    const imports: ImportSummary[] = fileNode.imports.map(imp => ({
      source: imp.source,
      items: imp.specifiers,
      isTypeOnly: imp.isTypeOnly
    }));

    const exports: ExportSummary[] = fileNode.exports.map(exp => ({
      name: exp.name,
      kind: this.inferExportKind(exp.name, fileNode),
      isDefault: exp.isDefault
    }));

    const externalDeps = [...new Set(
      fileNode.imports
        .filter(imp => !imp.source.startsWith('.') && !imp.source.startsWith('/'))
        .map(imp => imp.source.split('/')[0])
    )];

    const internalDeps = [...fileNode.dependencies];

    return {
      imports,
      exports,
      externalDependencies: externalDeps,
      internalDependencies: internalDeps
    };
  }

  private calculateComplexity(fileNode: FileNode): ComplexityMetrics {
    const symbols = Array.from(fileNode.symbols.values());
    const functions = symbols.filter(s => s.kind === 'function' || s.kind === 'method');
    const classes = symbols.filter(s => s.kind === 'class');

    const totalFunctionLines = functions.reduce((sum, f) => 
      sum + (f.endLine - f.line + 1), 0);

    return {
      linesOfCode: fileNode.size,
      cyclomaticComplexity: this.estimateCyclomaticComplexity(functions),
      cognitiveComplexity: this.estimateCognitiveComplexity(functions),
      functionCount: functions.length,
      classCount: classes.length,
      averageFunctionLength: functions.length > 0 ? totalFunctionLines / functions.length : 0
    };
  }

  private parseJsDoc(jsDoc?: string): {
    description: string;
    params: ParameterSummary[];
    returns?: string;
  } {
    if (!jsDoc) {
      return { description: '', params: [] };
    }

    const lines = jsDoc.split('\n');
    let description = '';
    const params: ParameterSummary[] = [];
    let returns: string | undefined;

    for (const line of lines) {
      const trimmed = line.replace(/^\s*\*\s?/, '').trim();
      
      if (trimmed.startsWith('@param')) {
        const match = trimmed.match(/@param\s+(?:\{[^}]+\}\s+)?(\w+)\s*-?\s*(.*)/);
        if (match) {
          params.push({
            name: match[1],
            type: undefined,
            description: match[2]
          });
        }
      } else if (trimmed.startsWith('@returns') || trimmed.startsWith('@return')) {
        returns = trimmed.replace(/@returns?\s*/, '');
      } else if (!trimmed.startsWith('@') && trimmed.length > 0 && !description) {
        description = trimmed.replace(/^\/\*\*?\s*/, '').replace(/\*\/\s*$/, '');
      }
    }

    return { description, params, returns };
  }

  private generateOverview(
    fileNode: FileNode,
    data: {
      functions: FunctionSummary[];
      classes: ClassSummary[];
      types: TypeSummary[];
    }
  ): string {
    const parts: string[] = [];
    const fileName = path.basename(fileNode.path);

    parts.push(`File: ${fileName}`);

    if (data.classes.length > 0) {
      parts.push(`Contains ${data.classes.length} class(es): ${data.classes.map(c => c.name).join(', ')}`);
    }

    if (data.functions.length > 0) {
      const exportedFunctions = data.functions.filter(f => f.isExported);
      if (exportedFunctions.length > 0) {
        parts.push(`Exports ${exportedFunctions.length} function(s): ${exportedFunctions.map(f => f.name).join(', ')}`);
      }
    }

    if (data.types.length > 0) {
      parts.push(`Defines ${data.types.length} type(s): ${data.types.map(t => t.name).join(', ')}`);
    }

    return parts.join('. ');
  }

  private generatePurpose(
    fileNode: FileNode,
    functions: FunctionSummary[],
    classes: ClassSummary[]
  ): string {
    // Infer purpose from file name and content
    const fileName = path.basename(fileNode.path, path.extname(fileNode.path));
    
    if (fileName.includes('util') || fileName.includes('helper')) {
      return 'Utility functions and helpers';
    }
    
    if (fileName.includes('service')) {
      return 'Service layer for business logic';
    }
    
    if (fileName.includes('controller')) {
      return 'Request handling and routing logic';
    }
    
    if (fileName.includes('model') || fileName.includes('entity')) {
      return 'Data models and type definitions';
    }
    
    if (fileName.includes('component')) {
      return 'UI component implementation';
    }
    
    if (fileName.includes('hook')) {
      return 'Custom React hooks';
    }
    
    if (fileName.includes('test') || fileName.includes('spec')) {
      return 'Test suites and specifications';
    }

    if (classes.length > 0) {
      return `Provides ${classes.length} class implementation(s)`;
    }

    if (functions.length > 0) {
      const exportedCount = functions.filter(f => f.isExported).length;
      return `Provides ${exportedCount} exported function(s)`;
    }

    return 'Module definitions';
  }

  private generateFunctionDescription(symbol: CodeSymbol): string {
    const name = symbol.name;
    
    // Pattern-based description generation
    if (name.startsWith('get') || name.startsWith('fetch')) {
      return `Retrieves ${this.camelCaseToWords(name.replace(/^(get|fetch)/, ''))}`;
    }
    
    if (name.startsWith('set') || name.startsWith('update')) {
      return `Updates ${this.camelCaseToWords(name.replace(/^(set|update)/, ''))}`;
    }
    
    if (name.startsWith('create') || name.startsWith('make')) {
      return `Creates ${this.camelCaseToWords(name.replace(/^(create|make)/, ''))}`;
    }
    
    if (name.startsWith('delete') || name.startsWith('remove')) {
      return `Removes ${this.camelCaseToWords(name.replace(/^(delete|remove)/, ''))}`;
    }
    
    if (name.startsWith('is') || name.startsWith('has') || name.startsWith('can')) {
      return `Checks ${this.camelCaseToWords(name.replace(/^(is|has|can)/, ''))}`;
    }
    
    if (name.startsWith('handle')) {
      return `Handles ${this.camelCaseToWords(name.replace(/^handle/, ''))}`;
    }
    
    if (name.startsWith('on')) {
      return `Event handler for ${this.camelCaseToWords(name.replace(/^on/, ''))}`;
    }

    return `Function ${name}`;
  }

  private async generateAISummary(
    fileNode: FileNode, 
    baseSummary: FileSummary
  ): Promise<Partial<FileSummary> | null> {
    if (!this.modelClient) {
      return null;
    }

    try {
      const prompt = this.buildSummaryPrompt(fileNode, baseSummary);
      const response = await this.modelClient.complete(prompt, {
        model: 'kimi-k2.5-lite',
        maxTokens: 300,
        temperature: 0.3
      });

      return this.parseAISummaryResponse(response);
    } catch {
      return null;
    }
  }

  private buildSummaryPrompt(fileNode: FileNode, baseSummary: FileSummary): string {
    const symbols = Array.from(fileNode.symbols.values())
      .slice(0, 20)
      .map(s => `${s.kind} ${s.name}${s.signature || ''}`)
      .join('\n');

    const imports = fileNode.imports.map(i => i.source).join(', ');

    return `Summarize this TypeScript/JavaScript file:

File: ${path.basename(fileNode.path)}
Imports: ${imports || 'none'}

Symbols:
${symbols}

Provide:
1. One-sentence overview
2. Main purpose (one line)

Summary:`;
  }

  private parseAISummaryResponse(response: string): Partial<FileSummary> {
    const lines = response.split('\n').filter(l => l.trim());
    
    return {
      overview: lines[0] || '',
      purpose: lines[1] || lines[0] || ''
    };
  }

  private isPureFunction(symbol: CodeSymbol): boolean {
    // Heuristic: pure functions typically don't have side effects
    const impureIndicators = ['console.', 'fetch', 'axios', 'http', 'fs.', 'db.', 'database'];
    return !impureIndicators.some(indicator => 
      symbol.jsDoc?.includes(indicator) || symbol.signature?.includes(indicator)
    );
  }

  private getVisibility(symbol: CodeSymbol): 'public' | 'protected' | 'private' {
    if (symbol.modifiers.includes('private')) return 'private';
    if (symbol.modifiers.includes('protected')) return 'protected';
    return 'public';
  }

  private extractTypeFromSignature(signature?: string): string | undefined {
    if (!signature) return undefined;
    const match = signature.match(/:\s*(.+)$/);
    return match ? match[1] : undefined;
  }

  private extractExtends(symbol: CodeSymbol): string | undefined {
    // This would require parsing the class declaration more deeply
    // For now, return undefined
    return undefined;
  }

  private extractImplements(symbol: CodeSymbol): string[] {
    // This would require parsing the class declaration more deeply
    return [];
  }

  private inferExportKind(name: string, fileNode: FileNode): SymbolKind {
    const symbol = Array.from(fileNode.symbols.values()).find(s => s.name === name);
    return symbol?.kind || 'variable';
  }

  private estimateCyclomaticComplexity(functions: CodeSymbol[]): number {
    // Simplified estimation based on function count
    return functions.length * 2;
  }

  private estimateCognitiveComplexity(functions: CodeSymbol[]): number {
    // Simplified estimation
    return functions.length * 3;
  }

  private camelCaseToWords(str: string): string {
    return str
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toLowerCase())
      .trim();
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private async loadFromCache(): Promise<void> {
    try {
      if (!fs.existsSync(this.cacheFilePath)) {
        return;
      }

      const data = await fs.promises.readFile(this.cacheFilePath, 'utf-8');
      const parsed = JSON.parse(data);

      if (Array.isArray(parsed.summaries)) {
        for (const summary of parsed.summaries) {
          this.summaries.set(summary.filePath, summary);
        }
      }

      this.emit('cache-loaded', { count: this.summaries.size });
    } catch (error) {
      this.emit('cache-error', { error });
    }
  }

  private async saveToCache(): Promise<void> {
    try {
      await fs.promises.mkdir(this.options.cacheDir, { recursive: true });
      
      const data = {
        summaries: Array.from(this.summaries.values()),
        savedAt: Date.now()
      };

      await fs.promises.writeFile(
        this.cacheFilePath,
        JSON.stringify(data, null, 2),
        'utf-8'
      );

      this.emit('cache-saved', { count: this.summaries.size });
    } catch (error) {
      this.emit('cache-error', { error });
    }
  }
}

// ==================== Utility Functions ====================

export interface ParameterSummary {
  name: string;
  type?: string;
  description: string;
}

/**
 * Create a summarizer instance
 */
export function createSummarizer(tree: CodeTree, options?: SummarizerOptions): CodeSummarizer {
  return new CodeSummarizer(tree, options);
}

/**
 * Quick summary for a single file
 */
export async function quickSummarize(
  tree: CodeTree, 
  filePath: string
): Promise<FileSummary | null> {
  const summarizer = new CodeSummarizer(tree);
  return summarizer.getSummary(filePath);
}
