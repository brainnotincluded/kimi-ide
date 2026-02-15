/**
 * Trench CLI - Main Exports
 * 
 * Trench is a powerful CLI tool for search, research, archiving, and analysis.
 * Think of it as Perplexity for the terminal.
 * 
 * @example
 * ```typescript
 * import { search, research, archive, analyze } from 'trench-cli';
 * 
 * // Search across multiple sources
 * const results = await search({
 *   query: 'React Server Components',
 *   sources: ['web', 'github'],
 *   limit: 10
 * });
 * 
 * // Deep research with synthesis
 * const research = await research({
 *   query: 'AI safety',
 *   depth: 'comprehensive'
 * });
 * ```
 */

// Core exports
export { ConfigManager, initConfig, getConfigManager } from './config';
export { CacheManager, DiskCache, initCache, initDiskCache } from './cache';
export { OutputFormatter, createFormatter, formatters } from './outputFormatter';
export { McpIntegration, startMcpServer, trenchMcpTools, generateKimiMcpConfig } from './mcpIntegration';

// Command exports
export { search } from './commands/search';
export { research } from './commands/research';
export { archive } from './commands/archive';
export { analyze } from './commands/analyze';
export { remix } from './commands/remix';
export { codeSearch, searchRepositories, getTrending } from './commands/code';
export { paperSearch, searchPubMed, getPaperById, getPopularPapers } from './commands/papers';
export { communitySearch, getTrendingDiscussions, getComments } from './commands/community';

// Type exports
export type * from './types/index.js';

// Re-export specific types for convenience
export type {
  // Search types
  SearchResult,
  SearchOptions,
  SearchFilters,
  SearchSource,
  
  // Research types
  ResearchOptions,
  ResearchResult,
  
  // Archive types
  ArchiveOptions,
  ArchiveResult,
  ArchiveManifest,
  ArchivedPage,
  ArchivedAsset,
  
  // Analysis types
  AnalysisOptions,
  AnalysisResult,
  SiteStructure,
  ContentAnalysis,
  TechStack,
  SiteScores,
  KeywordFreq,
  HeadingStructure,
  ImageAnalysis,
  
  // Remix types
  RemixOptions,
  RemixResult,
  RemixTheme,
  
  // Code types
  CodeSearchOptions,
  CodeSearchResult,
  Repository,
  CodeFile,
  CodeMatch,
  
  // Paper types
  PaperSearchOptions,
  PaperResult,
  
  // Community types
  CommunitySearchOptions,
  CommunityResult,
  CommunitySource,
  Comment,
  
  // Output types
  OutputFormat,
  OutputOptions,
  
  // Cache types
  CacheEntry,
  CacheStats,
  
  // Config types
  TrenchConfig,
  ApiKeys,
  DefaultSettings,
  CacheSettings,
  OutputSettings,
  McpSettings,
  
  // MCP types
  McpTool,
  McpParameter,
  McpServerConfig,
  
  // Error types
  TrenchError,
  
  // Progress types
  ProgressInfo,
  ProgressCallback,
} from './types';

// Version
export const VERSION = '1.0.0';

// Re-export for convenience
export { Command as CLICommand } from 'commander';
