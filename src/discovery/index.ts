/**
 * Tree-based File Discovery System
 * 
 * Модуль для интеллектуального обнаружения и поиска файлов в codebase.
 * 
 * Преимущества над традиционным grep-подходом:
 * - Мгновенный доступ к AST через TypeScript Compiler API
 * - Инкрементальные обновления через VS Code file watchers
 * - Глубокое понимание зависимостей через imports/exports analysis
 * - Семантический поиск по типам и использованию
 * - AI-powered выбор релевантных файлов
 */

// ==================== Core Exports ====================

export {
  // Code Tree Builder
  CodeTreeBuilder,
  type TreeBuilderOptions,
  type CodeTree,
  type FileNode,
  type CodeSymbol,
  type SymbolKind,
  type ImportInfo,
  type ExportInfo,
  type DependencyEdge
} from './codeTreeBuilder';

export {
  // Tree Search
  TreeSearch,
  type SearchOptions,
  type SearchResult,
  type MatchType,
  type SearchContext,
  type FuzzyMatch,
  createSearch,
  quickSearch
} from './treeSearch';

export {
  // Smart File Picker
  SmartFilePicker,
  type FilePick,
  type FilePickerOptions,
  type FilePickerContext,
  type AnalyzedIntent,
  type ModelClient,
  createVSCodeModelClient
} from './smartFilePicker';

export {
  // Code Summarizer
  CodeSummarizer,
  type FileSummary,
  type FunctionSummary,
  type ClassSummary,
  type MethodSummary,
  type PropertySummary,
  type TypeSummary,
  type DependencySummary,
  type ImportSummary,
  type ExportSummary,
  type ComplexityMetrics,
  type SummarizerOptions,
  type ParameterSummary,
  createSummarizer,
  quickSummarize
} from './codeSummarizer';

// ==================== Re-exports for convenience ====================

export { CodeTreeBuilder as TreeBuilder } from './codeTreeBuilder';
export { TreeSearch as Search } from './treeSearch';
export { SmartFilePicker as FilePicker } from './smartFilePicker';
export { CodeSummarizer as Summarizer } from './codeSummarizer';

// ==================== Main Discovery Service ====================

import * as vscode from 'vscode';
import { CodeTreeBuilder, CodeTree, TreeBuilderOptions } from './codeTreeBuilder';
import { TreeSearch } from './treeSearch';
import { SmartFilePicker, FilePickerOptions, FilePick, ModelClient } from './smartFilePicker';
import { CodeSummarizer, SummarizerOptions, FileSummary } from './codeSummarizer';
import { EventEmitter } from 'events';

export interface DiscoveryServiceOptions {
  treeBuilder?: TreeBuilderOptions;
  summarizer?: SummarizerOptions;
  modelClient?: ModelClient;
  enableCache?: boolean;
  cacheDir?: string;
}

export interface DiscoveryStatus {
  isReady: boolean;
  isBuilding: boolean;
  fileCount: number;
  symbolCount: number;
  lastUpdate: number;
}

/**
 * Main Discovery Service
 * 
 * Unified interface for all discovery functionality.
 */
export class DiscoveryService extends EventEmitter {
  private treeBuilder: CodeTreeBuilder;
  private treeSearch: TreeSearch;
  private filePicker: SmartFilePicker;
  private summarizer: CodeSummarizer;
  private options: Required<DiscoveryServiceOptions>;
  private isInitialized = false;

  constructor(options: DiscoveryServiceOptions = {}) {
    super();
    
    this.options = {
      treeBuilder: {},
      summarizer: {},
      modelClient: undefined as any,
      enableCache: true,
      cacheDir: '.kimi/discovery',
      ...options
    };

    // Initialize components with placeholder tree
    const emptyTree = this.createEmptyTree();
    
    this.treeBuilder = new CodeTreeBuilder({
      cacheDir: this.options.cacheDir,
      ...this.options.treeBuilder
    });

    this.treeSearch = new TreeSearch(emptyTree);
    this.filePicker = new SmartFilePicker(emptyTree, this.options.modelClient);
    this.summarizer = new CodeSummarizer(emptyTree, {
      cacheDir: this.options.cacheDir,
      ...this.options.summarizer
    });

    this.setupEventForwarding();
  }

  // ==================== Lifecycle ====================

  /**
   * Initialize the discovery service
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.emit('initializing');

    try {
      // Initialize tree builder
      await this.treeBuilder.initialize();
      
      // Update references
      const tree = this.treeBuilder.getTree();
      this.treeSearch.updateTree(tree as CodeTree);
      this.filePicker.updateTree(tree as CodeTree);
      this.summarizer = new CodeSummarizer(tree as CodeTree, this.options.summarizer);
      await this.summarizer.initialize();

      this.isInitialized = true;
      this.emit('ready', this.getStatus());
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Dispose all resources
   */
  dispose(): void {
    this.treeBuilder.dispose();
    this.summarizer.dispose();
    this.filePicker.removeAllListeners();
    this.removeAllListeners();
    this.isInitialized = false;
  }

  // ==================== Search API ====================

  /**
   * Search for symbols
   */
  search(query: string, maxResults = 20) {
    return this.treeSearch.search({ query, maxResults });
  }

  /**
   * Find symbols by name
   */
  findSymbols(name: string) {
    return this.treeBuilder.findSymbolsByName(name);
  }

  /**
   * Find usages of a symbol
   */
  findUsages(symbolId: string) {
    return this.treeSearch.findUsages(symbolId);
  }

  /**
   * Get auto-completion suggestions
   */
  getCompletions(partial: string, maxResults = 20) {
    return this.treeSearch.getCompletions(partial, maxResults);
  }

  // ==================== File Picker API ====================

  /**
   * Pick relevant files for a query
   */
  async pickFiles(options: FilePickerOptions): Promise<FilePick[]> {
    this.ensureInitialized();
    return this.filePicker.pickFiles(options);
  }

  /**
   * Quick file pick
   */
  quickPick(query: string, maxFiles = 10): FilePick[] {
    return this.filePicker.quickPick(query, maxFiles);
  }

  /**
   * Pick files related to a symbol
   */
  pickRelatedFiles(symbolId: string, maxFiles = 10): FilePick[] {
    return this.filePicker.pickRelatedFiles(symbolId, maxFiles);
  }

  /**
   * Pick files for implementing a feature
   */
  async pickForFeature(description: string, maxFiles = 15): Promise<FilePick[]> {
    this.ensureInitialized();
    return this.filePicker.pickForFeature(description, maxFiles);
  }

  // ==================== Summarizer API ====================

  /**
   * Get summary for a file
   */
  async getSummary(filePath: string): Promise<FileSummary | null> {
    this.ensureInitialized();
    return this.summarizer.getSummary(filePath);
  }

  /**
   * Get quick stats for a file
   */
  getQuickStats(filePath: string) {
    return this.summarizer.getQuickStats(filePath);
  }

  /**
   * Search summaries
   */
  searchSummaries(keyword: string) {
    return this.summarizer.searchSummaries(keyword);
  }

  // ==================== Tree API ====================

  /**
   * Get the current code tree
   */
  getTree(): Readonly<CodeTree> {
    return this.treeBuilder.getTree();
  }

  /**
   * Get file dependencies
   */
  getDependencies(filePath: string): string[] {
    return this.treeBuilder.getDependencies(filePath);
  }

  /**
   * Get file dependents
   */
  getDependents(filePath: string): string[] {
    return this.treeBuilder.getDependents(filePath);
  }

  /**
   * Force full rebuild
   */
  async rebuild(): Promise<void> {
    await this.treeBuilder.fullRebuild();
    const tree = this.treeBuilder.getTree();
    this.treeSearch.updateTree(tree as CodeTree);
    this.filePicker.updateTree(tree as CodeTree);
    this.summarizer = new CodeSummarizer(tree as CodeTree, this.options.summarizer);
    await this.summarizer.initialize();
  }

  // ==================== Status ====================

  /**
   * Get current status
   */
  getStatus(): DiscoveryStatus {
    const tree = this.treeBuilder.getTree();
    return {
      isReady: this.isInitialized,
      isBuilding: false, // TODO: track building state
      fileCount: tree.files.size,
      symbolCount: tree.symbols.size,
      lastUpdate: tree.lastFullScan
    };
  }

  /**
   * Update file picker context
   */
  updateContext(context: Parameters<SmartFilePicker['updateContext']>[0]): void {
    this.filePicker.updateContext(context);
  }

  // ==================== Private Methods ====================

  private createEmptyTree(): CodeTree {
    return {
      files: new Map(),
      symbols: new Map(),
      dependencies: [],
      rootPath: '',
      lastFullScan: 0
    };
  }

  private setupEventForwarding(): void {
    // Forward tree builder events
    this.treeBuilder.on('build-started', () => this.emit('build-started'));
    this.treeBuilder.on('build-completed', (data) => this.emit('build-completed', data));
    this.treeBuilder.on('incremental-update-started', () => this.emit('update-started'));
    this.treeBuilder.on('incremental-update-completed', (data) => {
      // Update search and picker with new tree
      const tree = this.treeBuilder.getTree();
      this.treeSearch.updateTree(tree as CodeTree);
      this.filePicker.updateTree(tree as CodeTree);
      this.emit('update-completed', data);
    });

    // Forward summarizer events
    this.summarizer.on('summary-generated', (data) => this.emit('summary-generated', data));
    this.summarizer.on('batch-generation-completed', (data) => this.emit('summaries-completed', data));
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('DiscoveryService not initialized. Call initialize() first.');
    }
  }
}

// ==================== Convenience Functions ====================

/**
 * Create and initialize a discovery service
 */
export async function createDiscoveryService(
  options?: DiscoveryServiceOptions
): Promise<DiscoveryService> {
  const service = new DiscoveryService(options);
  await service.initialize();
  return service;
}

/**
 * Quick search across the codebase
 */
export async function quickDiscover(
  query: string,
  options?: DiscoveryServiceOptions
): Promise<{
  symbols: ReturnType<TreeSearch['search']>;
  files: FilePick[];
}> {
  const service = await createDiscoveryService(options);
  try {
    const symbols = service.search(query);
    const files = service.quickPick(query);
    return { symbols, files };
  } finally {
    service.dispose();
  }
}

// ==================== Constants ====================

export const DISCOVERY_VERSION = '1.0.0';

export const DEFAULT_OPTIONS: Required<DiscoveryServiceOptions> = {
  treeBuilder: {
    cacheDir: '.kimi/cache',
    includePatterns: ['**/*.{ts,tsx,js,jsx}'],
    excludePatterns: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/*.test.{ts,tsx,js,jsx}',
      '**/*.spec.{ts,tsx,js,jsx}'
    ],
    maxFileSize: 1024 * 1024,
    enableJsDoc: true,
    followSymlinks: false
  },
  summarizer: {
    cacheDir: '.kimi/cache/summaries',
    maxSummaryLength: 500,
    generateOnInit: false,
    useAI: false,
    modelClient: undefined as any,
    batchSize: 10,
    maxConcurrent: 3
  },
  modelClient: undefined as any,
  enableCache: true,
  cacheDir: '.kimi/discovery'
};
