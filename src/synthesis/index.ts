/**
 * Research Synthesis Engine for Trench
 * 
 * A comprehensive system for aggregating information from multiple sources,
 * cross-referencing facts, detecting contradictions, and synthesizing
 * well-cited answers.
 * 
 * @example
 * ```typescript
 * import { synthesize, createSynthesisEngine } from './synthesis';
 * 
 * const result = await synthesize({
 *   query: "How does Vercel Edge Caching work?",
 *   sources: ['web', 'github', 'arxiv'],
 *   depth: 'comprehensive'
 * });
 * 
 * console.log(result.markdown);
 * ```
 */

// ============================================================================
// Exports
// ============================================================================

// Types
export * from './types';

// Core Components
export { SourceAggregator, createSourceAggregator } from './sourceAggregator';
export { CrossReferencer, createCrossReferencer } from './crossReferencer';
export { FactExtractor, createFactExtractor } from './factExtractor';
export { ConfidenceScorer, createConfidenceScorer } from './confidenceScorer';
export { SynthesisEngine, createSynthesisEngine } from './synthesisEngine';
export { CitationManager, createCitationManager } from './citationManager';
export { QueryPlanner, createQueryPlanner } from './queryPlanner';

// ============================================================================
// High-Level API
// ============================================================================

import {
  SynthesisOptions,
  SynthesisResult,
  SearchResult,
  SearchDepth,
  SourceType,
  AnySource,
  Fact,
  Contradiction,
  Consensus,
} from './types';

import { SourceAggregator } from './sourceAggregator';
import { CrossReferencer } from './crossReferencer';
import { FactExtractor } from './factExtractor';
import { ConfidenceScorer } from './confidenceScorer';
import { SynthesisEngine } from './synthesisEngine';
import { CitationManager } from './citationManager';
import { QueryPlanner } from './queryPlanner';

// ============================================================================
// Configuration
// ============================================================================

export interface SynthesizeConfig {
  /** Search function for web sources */
  searchWeb?: (query: string) => Promise<SearchResult>;
  /** Search function for GitHub */
  searchGitHub?: (query: string) => Promise<SearchResult>;
  /** Search function for arXiv */
  searchArXiv?: (query: string) => Promise<SearchResult>;
  /** Search function for community sources */
  searchCommunity?: (query: string) => Promise<SearchResult>;
  /** Search function for archived sources */
  searchArchive?: (query: string) => Promise<SearchResult>;
  /** Fetch function for retrieving source content */
  fetchContent?: (url: string) => Promise<string>;
  /** Default search depth */
  defaultDepth?: SearchDepth;
  /** Maximum results per source type */
  maxResults?: number;
  /** Whether to include contradictions in output */
  includeContradictions?: boolean;
  /** Whether to include confidence scores */
  includeConfidenceScores?: boolean;
  /** Whether to include archived links */
  includeArchivedLinks?: boolean;
  /** Citation style */
  citationStyle?: 'numbered' | 'inline' | 'footnote';
}

const DEFAULT_CONFIG: Partial<SynthesizeConfig> = {
  defaultDepth: 'standard',
  maxResults: 20,
  includeContradictions: true,
  includeConfidenceScores: true,
  includeArchivedLinks: true,
  citationStyle: 'numbered',
};

// ============================================================================
// Main Synthesize Function
// ============================================================================

export interface SynthesizeInput {
  /** The query to research */
  query: string;
  /** Source types to search */
  sources: SourceType[];
  /** Search depth level */
  depth?: SearchDepth;
  /** Maximum results to return */
  maxResults?: number;
}

export interface SynthesizeOutput {
  /** The synthesized answer in markdown format */
  markdown: string;
  /** Structured synthesis result */
  result: SynthesisResult;
  /** Sources used in the synthesis */
  sources: AnySource[];
  /** Extracted facts */
  facts: Fact[];
  /** Detected contradictions */
  contradictions: Contradiction[];
  /** Established consensus points */
  consensus: Consensus[];
  /** Overall confidence score (0-1) */
  confidence: number;
}

/**
 * Main synthesis function - research and synthesize answer
 * 
 * @example
 * ```typescript
 * const result = await synthesize({
 *   query: "How does Vercel Edge Caching work?",
 *   sources: ['web', 'github', 'documentation'],
 *   depth: 'comprehensive'
 * });
 * 
 * console.log(result.markdown);
 * // Returns markdown with citations, confidence scores, key takeaways
 * ```
 */
export async function synthesize(
  input: SynthesizeInput,
  config: SynthesizeConfig = {}
): Promise<SynthesizeOutput> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const depth = input.depth || mergedConfig.defaultDepth || 'standard';

  // Initialize components
  const queryPlanner = new QueryPlanner();
  const sourceAggregator = new SourceAggregator();
  const factExtractor = new FactExtractor();
  const crossReferencer = new CrossReferencer();
  const confidenceScorer = new ConfidenceScorer();
  const citationManager = new CitationManager({
    style: mergedConfig.citationStyle || 'numbered',
    includeArchiveLinks: mergedConfig.includeArchivedLinks || true,
  });
  const synthesisEngine = new SynthesisEngine(citationManager, confidenceScorer, {
    citationStyle: mergedConfig.citationStyle || 'numbered',
    includeConfidenceScores: mergedConfig.includeConfidenceScores || true,
    includeContradictions: mergedConfig.includeContradictions || true,
  });

  // Step 1: Plan the query
  const plan = await queryPlanner.planQuery(input.query, depth);

  // Step 2: Search across sources
  const searchResults = await executeSearches(plan, input.sources, mergedConfig);

  // Step 3: Aggregate and deduplicate sources
  const aggregated = await sourceAggregator.aggregate(searchResults);

  // Step 4: Fetch content for sources (if fetch function provided)
  if (mergedConfig.fetchContent) {
    for (const source of aggregated.sources) {
      try {
        source.content = await mergedConfig.fetchContent(source.url);
      } catch (error) {
        console.warn(`Failed to fetch content for ${source.url}:`, error);
      }
    }
  }

  // Step 5: Extract facts from sources
  const allFacts: Fact[] = [];
  for (const source of aggregated.sources) {
    if (source.content) {
      const facts = await factExtractor.extractFromSource(source);
      allFacts.push(...facts);
    }
  }

  // Step 6: Cross-reference facts
  const { crossReferences, contradictions, consensus } = await crossReferencer.crossReference(
    allFacts,
    aggregated.sources
  );

  // Step 7: Synthesize final answer
  const synthesisResult = await synthesisEngine.synthesize(
    input.query,
    aggregated.sources,
    allFacts,
    contradictions,
    consensus,
    depth
  );

  // Step 8: Render markdown
  const markdown = synthesisEngine.renderMarkdown(synthesisResult);

  return {
    markdown,
    result: synthesisResult,
    sources: aggregated.sources,
    facts: allFacts,
    contradictions,
    consensus,
    confidence: synthesisResult.confidence.overall,
  };
}

/**
 * Quick synthesis with minimal configuration
 * 
 * @example
 * ```typescript
 * const answer = await synthesizeQuick("What is React?");
 * console.log(answer);
 * ```
 */
export async function synthesizeQuick(
  query: string,
  config: SynthesizeConfig = {}
): Promise<string> {
  const result = await synthesize(
    {
      query,
      sources: ['web', 'documentation'],
      depth: 'quick',
    },
    config
  );
  return result.markdown;
}

/**
 * Comprehensive synthesis with all sources
 * 
 * @example
 * ```typescript
 * const result = await synthesizeComprehensive("Latest advances in LLMs");
 * console.log(result.markdown);
 * ```
 */
export async function synthesizeComprehensive(
  query: string,
  config: SynthesizeConfig = {}
): Promise<SynthesizeOutput> {
  return synthesize(
    {
      query,
      sources: ['web', 'github', 'arxiv', 'community', 'documentation'],
      depth: 'comprehensive',
    },
    config
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Execute searches based on query plan
 */
async function executeSearches(
  plan: import('./types').QueryPlan,
  requestedSources: SourceType[],
  config: SynthesizeConfig
): Promise<import('./types').SearchResult[]> {
  const results: import('./types').SearchResult[] = [];
  const searchFunctions: Record<SourceType, ((query: string) => Promise<SearchResult>) | undefined> = {
    web: config.searchWeb,
    github: config.searchGitHub,
    arxiv: config.searchArXiv,
    community: config.searchCommunity,
    archive: config.searchArchive,
    documentation: config.searchWeb, // Often same as web search
  };

  // Execute searches for each source type
  for (const sourceType of requestedSources) {
    const searchFn = searchFunctions[sourceType];
    if (!searchFn) continue;

    // Generate queries for this source type
    const planner = new QueryPlanner();
    const queries = planner.generateSourceQueries(plan.originalQuery, sourceType);

    // Execute searches in parallel
    const searchPromises = queries.map(async query => {
      try {
        return await searchFn(query);
      } catch (error) {
        return {
          sourceType,
          query,
          results: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    });

    const searchResults = await Promise.all(searchPromises);
    results.push(...searchResults);
  }

  return results;
}

// ============================================================================
// Advanced API
// ============================================================================

/**
 * Research Synthesis Engine - Full control over the synthesis process
 */
export class ResearchSynthesisEngine {
  private aggregator: SourceAggregator;
  private crossReferencer: CrossReferencer;
  private factExtractor: FactExtractor;
  private confidenceScorer: ConfidenceScorer;
  private synthesisEngine: SynthesisEngine;
  private citationManager: CitationManager;
  private queryPlanner: QueryPlanner;

  constructor(config: SynthesizeConfig = {}) {
    this.aggregator = new SourceAggregator();
    this.crossReferencer = new CrossReferencer();
    this.factExtractor = new FactExtractor();
    this.confidenceScorer = new ConfidenceScorer();
    this.citationManager = new CitationManager({
      style: config.citationStyle || 'numbered',
      includeArchiveLinks: config.includeArchivedLinks ?? true,
    });
    this.synthesisEngine = new SynthesisEngine(
      this.citationManager,
      this.confidenceScorer,
      {
        citationStyle: config.citationStyle || 'numbered',
        includeConfidenceScores: config.includeConfidenceScores ?? true,
        includeContradictions: config.includeContradictions ?? true,
      }
    );
    this.queryPlanner = new QueryPlanner();
  }

  /**
   * Plan a research query
   */
  async plan(query: string, depth: SearchDepth = 'standard') {
    return this.queryPlanner.planQuery(query, depth);
  }

  /**
   * Aggregate sources from search results
   */
  async aggregate(results: import('./types').SearchResult[]) {
    return this.aggregator.aggregate(results);
  }

  /**
   * Extract facts from sources
   */
  async extractFacts(sources: AnySource[]) {
    const facts: Fact[] = [];
    for (const source of sources) {
      if (source.content) {
        const extracted = await this.factExtractor.extractFromSource(source);
        facts.push(...extracted);
      }
    }
    return facts;
  }

  /**
   * Cross-reference facts
   */
  async crossReference(facts: Fact[], sources: AnySource[]) {
    return this.crossReferencer.crossReference(facts, sources);
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(
    sources: AnySource[],
    facts: Fact[],
    contradictions: Contradiction[],
    consensus: Consensus[]
  ) {
    return this.confidenceScorer.calculateSynthesisConfidence(
      sources,
      facts,
      contradictions,
      consensus
    );
  }

  /**
   * Synthesize final answer
   */
  async synthesize(
    query: string,
    sources: AnySource[],
    facts: Fact[],
    contradictions: Contradiction[],
    consensus: Consensus[],
    depth: SearchDepth
  ) {
    return this.synthesisEngine.synthesize(
      query,
      sources,
      facts,
      contradictions,
      consensus,
      depth
    );
  }

  /**
   * Render result as markdown
   */
  renderMarkdown(result: SynthesisResult): string {
    return this.synthesisEngine.renderMarkdown(result);
  }
}

// ============================================================================
// Utility Exports
// ============================================================================

export {
  isComplexQuery,
  extractQueryKeywords,
  mergeQueryPlans,
} from './queryPlanner';

export {
  createCitationLink,
  parseCitationsFromMarkdown,
  validateCitationNumbers,
} from './citationManager';
