/**
 * Trench CLI - Type Definitions
 */

// Search Types
export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: SearchSource;
  relevanceScore: number;
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  query: string;
  sources?: SearchSource[];
  limit?: number;
  offset?: number;
  filters?: SearchFilters;
  cache?: boolean;
}

export interface SearchFilters {
  language?: string;
  dateRange?: { start?: Date; end?: Date };
  site?: string;
  fileType?: string;
}

export type SearchSource = 
  | 'web'
  | 'github'
  | 'arxiv'
  | 'hackernews'
  | 'reddit'
  | 'stackoverflow'
  | 'duckduckgo'
  | 'bing'
  | 'brave';

// Research Types
export interface ResearchOptions {
  query: string;
  depth: 'quick' | 'standard' | 'comprehensive';
  maxSources?: number;
  synthesize?: boolean;
  followLinks?: boolean;
}

export interface ResearchResult {
  query: string;
  summary: string;
  sources: SearchResult[];
  keyFindings: string[];
  relatedTopics: string[];
  confidence: number;
  generatedAt: Date;
}

// Archive Types
export interface ArchiveOptions {
  url: string;
  outputDir: string;
  fullAssets?: boolean;
  javascript?: boolean;
  depth?: number;
  excludePatterns?: string[];
  maxPages?: number;
}

export interface ArchiveResult {
  url: string;
  outputDir: string;
  pagesArchived: number;
  assetsDownloaded: number;
  errors: string[];
  manifest: ArchiveManifest;
  completedAt: Date;
}

export interface ArchiveManifest {
  version: string;
  rootUrl: string;
  pages: ArchivedPage[];
  assets: ArchivedAsset[];
}

export interface ArchivedPage {
  url: string;
  filePath: string;
  title: string;
  archivedAt: Date;
  links: string[];
}

export interface ArchivedAsset {
  url: string;
  filePath: string;
  type: 'image' | 'css' | 'js' | 'font' | 'other';
  size: number;
}

// Analysis Types
export interface AnalysisOptions {
  target: string;
  type: 'structure' | 'content' | 'tech' | 'full';
  outputFormat: OutputFormat;
}

export interface AnalysisResult {
  target: string;
  type: string;
  structure?: SiteStructure;
  content?: ContentAnalysis;
  tech?: TechStack;
  scores: SiteScores;
  recommendations: string[];
}

export interface SiteStructure {
  pages: number;
  depth: number;
  internalLinks: number;
  externalLinks: number;
  brokenLinks: string[];
}

export interface ContentAnalysis {
  wordCount: number;
  readabilityScore: number;
  topKeywords: KeywordFreq[];
  headings: HeadingStructure;
  images: ImageAnalysis[];
}

export interface KeywordFreq {
  keyword: string;
  count: number;
  density: number;
}

export interface HeadingStructure {
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  hierarchy: string[];
}

export interface ImageAnalysis {
  url: string;
  alt: string;
  hasAlt: boolean;
  dimensions?: { width: number; height: number };
}

export interface TechStack {
  frameworks: string[];
  libraries: string[];
  analytics: string[];
  hosting?: string;
  cdn?: string[];
  server?: string;
}

export interface SiteScores {
  seo: number;
  performance: number;
  accessibility: number;
  bestPractices: number;
}

// Remix Types
export interface RemixOptions {
  archivePath: string;
  theme: RemixTheme;
  outputDir: string;
  deploy?: boolean;
  customStyles?: Record<string, string>;
}

export type RemixTheme = 
  | 'modern'
  | 'minimal'
  | 'docs'
  | 'docusaurus'
  | 'vitepress'
  | 'mkdocs'
  | 'custom';

export interface RemixResult {
  archivePath: string;
  outputDir: string;
  theme: RemixTheme;
  pagesGenerated: number;
  assetsProcessed: number;
  deployUrl?: string;
  buildTime: number;
}

// Code Search Types
export interface CodeSearchOptions {
  query: string;
  language?: string;
  minStars?: number;
  maxStars?: number;
  createdAfter?: Date;
  updatedAfter?: Date;
  sortBy: 'relevance' | 'stars' | 'updated';
  order: 'asc' | 'desc';
}

export interface CodeSearchResult {
  repository: Repository;
  file: CodeFile;
  matches: CodeMatch[];
  relevance: number;
}

export interface Repository {
  name: string;
  owner: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  description: string;
  updatedAt: Date;
}

export interface CodeFile {
  path: string;
  url: string;
  language: string;
  size: number;
}

export interface CodeMatch {
  lineNumber: number;
  content: string;
  context: string[];
}

// Paper Search Types
export interface PaperSearchOptions {
  query: string;
  since?: Date;
  until?: Date;
  authors?: string[];
  categories?: string[];
  sortBy: 'relevance' | 'date' | 'citations';
  maxResults: number;
}

export interface PaperResult {
  title: string;
  authors: string[];
  abstract: string;
  url: string;
  pdfUrl?: string;
  publishedAt: Date;
  categories: string[];
  citationCount?: number;
  source: 'arxiv' | 'semantic_scholar' | 'pubmed';
}

// Community Search Types
export interface CommunitySearchOptions {
  query: string;
  sources: CommunitySource[];
  timeRange: 'day' | 'week' | 'month' | 'year' | 'all';
  minScore?: number;
  sortBy: 'relevance' | 'score' | 'date';
}

export type CommunitySource = 'hn' | 'reddit' | 'lobsters' | 'devto' | 'twitter';

export interface CommunityResult {
  title: string;
  content: string;
  author: string;
  url: string;
  source: CommunitySource;
  score: number;
  commentCount: number;
  postedAt: Date;
  topComments?: Comment[];
}

export interface Comment {
  author: string;
  content: string;
  score: number;
  replies?: Comment[];
}

// Output Types
export type OutputFormat = 'markdown' | 'json' | 'html' | 'interactive';

export interface OutputOptions {
  format: OutputFormat;
  colors?: boolean;
  verbose?: boolean;
  output?: string;
}

// Cache Types
export interface CacheEntry<T> {
  data: T;
  createdAt: Date;
  expiresAt: Date;
  key: string;
  hitCount: number;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
}

// Config Types
export interface TrenchConfig {
  version: string;
  apiKeys: ApiKeys;
  defaults: DefaultSettings;
  cache: CacheSettings;
  output: OutputSettings;
  mcp: McpSettings;
}

export interface ApiKeys {
  github?: string;
  bing?: string;
  brave?: string;
  serpapi?: string;
  openai?: string;
  anthropic?: string;
}

export interface DefaultSettings {
  searchProvider: SearchSource;
  outputFormat: OutputFormat;
  maxResults: number;
  researchDepth: 'quick' | 'standard' | 'comprehensive';
  language: string;
}

export interface CacheSettings {
  enabled: boolean;
  directory: string;
  defaultTtl: number;
  maxSize: number;
  compression: boolean;
}

export interface OutputSettings {
  colors: boolean;
  pager: boolean;
  maxWidth: number;
  dateFormat: string;
}

export interface McpSettings {
  enabled: boolean;
  port: number;
  host: string;
  allowedOrigins: string[];
}

// MCP Types
export interface McpTool {
  name: string;
  description: string;
  parameters: McpParameter[];
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface McpParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  default?: unknown;
}

export interface McpServerConfig {
  name: string;
  version: string;
  tools: McpTool[];
}

// Error Types
export class TrenchError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TrenchError';
  }
}

// Progress Types
export interface ProgressInfo {
  current: number;
  total: number;
  message: string;
  percent: number;
}

export type ProgressCallback = (progress: ProgressInfo) => void;
