/**
 * Query Planner
 * 
 * Breaks down complex questions into sub-queries, determines required sources,
 * plans parallel search, and prioritizes sources.
 */

import {
  QueryPlan,
  SubQuery,
  SourceType,
  SearchDepth,
} from './types';
import * as crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

interface QueryPlannerConfig {
  maxSubQueries: number;
  defaultSources: SourceType[];
  prioritizeRecent: boolean;
  parallelThreshold: number;
}

const DEFAULT_CONFIG: QueryPlannerConfig = {
  maxSubQueries: 5,
  defaultSources: ['web', 'github', 'documentation'],
  prioritizeRecent: true,
  parallelThreshold: 3,
};

// Source type recommendations based on query patterns
const SOURCE_RECOMMENDATIONS: Array<{
  patterns: RegExp[];
  sources: SourceType[];
  priority: number;
}> = [
  {
    patterns: [/code\s*example/i, /implement/i, /library/i, /package/i, /npm/i, /pip/i],
    sources: ['github', 'documentation', 'web'],
    priority: 1,
  },
  {
    patterns: [/research/i, /paper/i, /study/i, /algorithm/i, /neural/i, /model/i, /arxiv/i],
    sources: ['arxiv', 'web'],
    priority: 1,
  },
  {
    patterns: [/opinion/i, /best\s*practice/i, /experience/i, /should\s*i/i, /recommend/i],
    sources: ['community', 'web'],
    priority: 1,
  },
  {
    patterns: [/error/i, /bug/i, /issue/i, /fix/i, /troubleshoot/i, /problem/i],
    sources: ['github', 'community', 'web'],
    priority: 1,
  },
  {
    patterns: [/api/i, /documentation/i, /reference/i, /manual/i],
    sources: ['documentation', 'web'],
    priority: 1,
  },
  {
    patterns: [/tutorial/i, /learn/i, /how\s*to/i, /getting\s*started/i, /guide/i],
    sources: ['web', 'documentation', 'community'],
    priority: 1,
  },
];

// Query decomposition patterns
const QUERY_DECOMPOSITION_PATTERNS = [
  {
    pattern: /\b(vs|versus|compared?\s+to|or|difference\s+between)\b/i,
    type: 'comparison',
    splitFn: (query: string) => {
      const parts = query.split(/\b(vs|versus|compared?\s+to|or)\b/i);
      if (parts.length >= 3) {
        return [
          `What is ${parts[0].trim()}?`,
          `What is ${parts[2].trim()}?`,
          `Compare ${parts[0].trim()} and ${parts[2].trim()}`,
        ];
      }
      return [query];
    },
  },
  {
    pattern: /\b(how\s+does|how\s+is|how\s+do)\b/i,
    type: 'mechanism',
    splitFn: (query: string) => {
      return [
        query,
        query.replace(/\b(how\s+does|how\s+is|how\s+do)\b/i, 'What is'),
        query.replace(/\b(how\s+does|how\s+is|how\s+do)\b/i, 'Why is'),
      ];
    },
  },
  {
    pattern: /\b(pros?\s+and\s+cons?|advantages?\s+and\s+disadvantages?)\b/i,
    type: 'evaluation',
    splitFn: (query: string) => {
      const base = query.replace(/\b(pros?\s+and\s+cons?|advantages?\s+and\s+disadvantages?)\b/i, '').trim();
      return [
        `What are the advantages of ${base}?`,
        `What are the disadvantages of ${base}?`,
        `What is ${base}?`,
      ];
    },
  },
  {
    pattern: /\b(best|top|recommended)\b/i,
    type: 'recommendation',
    splitFn: (query: string) => {
      return [
        query,
        query.replace(/\b(best|top|recommended)\b/i, 'popular'),
        query.replace(/\b(best|top|recommended)\b/i, 'alternative'),
      ];
    },
  },
];

// ============================================================================
// Query Planner Class
// ============================================================================

export class QueryPlanner {
  private config: QueryPlannerConfig;

  constructor(config: Partial<QueryPlannerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Plan search strategy for a query
   */
  async planQuery(query: string, depth: SearchDepth): Promise<QueryPlan> {
    // Analyze query intent
    const intent = this.analyzeIntent(query);

    // Determine required sources
    const requiredSources = this.determineSources(query, intent);

    // Break down into sub-queries
    const subQueries = this.decomposeQuery(query, intent, depth);

    // Calculate estimated time
    const estimatedTime = this.estimateSearchTime(subQueries, requiredSources, depth);

    // Determine priority
    const priority = this.determinePriority(query, depth);

    return {
      originalQuery: query,
      subQueries,
      requiredSources,
      priority,
      estimatedTime,
    };
  }

  /**
   * Determine if query needs parallel search
   */
  shouldSearchParallel(plan: QueryPlan): boolean {
    return plan.subQueries.length >= this.config.parallelThreshold;
  }

  /**
   * Prioritize sources for a query
   */
  prioritizeSources(sources: SourceType[], query: string): SourceType[] {
    const scored = sources.map(source => ({
      source,
      score: this.scoreSourceForQuery(source, query),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .map(s => s.source);
  }

  /**
   * Optimize sub-queries for execution
   */
  optimizeSubQueries(subQueries: SubQuery[]): SubQuery[] {
    // Remove duplicates
    const unique = new Map<string, SubQuery>();
    
    for (const sq of subQueries) {
      const key = sq.query.toLowerCase().trim();
      if (!unique.has(key)) {
        unique.set(key, sq);
      }
    }

    // Sort by dependency order
    const sorted = this.topologicalSort(Array.from(unique.values()));

    // Limit count
    return sorted.slice(0, this.config.maxSubQueries);
  }

  /**
   * Estimate search cost (in tokens/time)
   */
  estimateSearchCost(plan: QueryPlan): {
    estimatedTokens: number;
    estimatedTime: number;
    estimatedCost: number;
  } {
    const baseTokensPerQuery = 1000;
    const tokensPerSource = 500;

    const estimatedTokens = plan.subQueries.length * baseTokensPerQuery +
      plan.requiredSources.length * tokensPerSource;

    const estimatedTime = plan.estimatedTime;

    // Rough cost estimation (relative units)
    const estimatedCost = estimatedTokens / 1000 * 0.01;

    return {
      estimatedTokens,
      estimatedTime,
      estimatedCost,
    };
  }

  /**
   * Generate search queries for a source type
   */
  generateSourceQueries(query: string, sourceType: SourceType): string[] {
    const baseQueries = this.decomposeQuery(query, this.analyzeIntent(query), 'standard')
      .map(sq => sq.query);

    switch (sourceType) {
      case 'github':
        return baseQueries.map(q => this.adaptForGitHub(q));
      case 'arxiv':
        return baseQueries.map(q => this.adaptForArXiv(q));
      case 'community':
        return baseQueries.map(q => this.adaptForCommunity(q));
      default:
        return baseQueries;
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Analyze query intent
   */
  private analyzeIntent(query: string): {
    type: string;
    entities: string[];
    needsCode: boolean;
    needsRecent: boolean;
  } {
    const lower = query.toLowerCase();
    
    // Detect intent type
    let type = 'general';
    for (const pattern of QUERY_DECOMPOSITION_PATTERNS) {
      if (pattern.pattern.test(query)) {
        type = pattern.type;
        break;
      }
    }

    // Extract entities (simplified)
    const entities = this.extractEntities(query);

    // Detect code needs
    const needsCode = /\b(code|function|class|method|api|implementation)\b/i.test(lower);

    // Detect recency needs
    const needsRecent = /\b(latest|recent|new|current|202[0-9])\b/i.test(lower);

    return { type, entities, needsCode, needsRecent };
  }

  /**
   * Determine required sources for a query
   */
  private determineSources(query: string, intent: ReturnType<typeof this.analyzeIntent>): SourceType[] {
    const sources = new Set<SourceType>(this.config.defaultSources);

    // Add sources based on patterns
    for (const recommendation of SOURCE_RECOMMENDATIONS) {
      if (recommendation.patterns.some(p => p.test(query))) {
        for (const source of recommendation.sources) {
          sources.add(source);
        }
      }
    }

    // Add sources based on intent
    if (intent.needsCode) {
      sources.add('github');
      sources.add('documentation');
    }

    if (intent.type === 'research') {
      sources.add('arxiv');
    }

    return this.prioritizeSources(Array.from(sources), query);
  }

  /**
   * Decompose query into sub-queries
   */
  private decomposeQuery(
    query: string,
    intent: ReturnType<typeof this.analyzeIntent>,
    depth: SearchDepth
  ): SubQuery[] {
    const subQueries: SubQuery[] = [];

    // Try pattern-based decomposition
    for (const pattern of QUERY_DECOMPOSITION_PATTERNS) {
      if (pattern.pattern.test(query)) {
        const queries = pattern.splitFn(query);
        for (let i = 0; i < queries.length; i++) {
          subQueries.push({
            id: this.generateId(),
            query: queries[i],
            intent: pattern.type,
            requiredSources: this.determineSources(queries[i], intent),
            dependencies: i > 0 ? [subQueries[subQueries.length - 1]?.id] : undefined,
          });
        }
        break;
      }
    }

    // If no pattern matched, create variations
    if (subQueries.length === 0) {
      subQueries.push({
        id: this.generateId(),
        query,
        intent: intent.type,
        requiredSources: this.determineSources(query, intent),
      });

      // Add related queries based on depth
      if (depth === 'standard' || depth === 'comprehensive') {
        subQueries.push({
          id: this.generateId(),
          query: `${query} explained`,
          intent: 'explanation',
          requiredSources: ['web', 'documentation'],
          dependencies: [subQueries[0].id],
        });
      }

      if (depth === 'comprehensive') {
        subQueries.push({
          id: this.generateId(),
          query: `${query} examples`,
          intent: 'examples',
          requiredSources: ['github', 'web'],
          dependencies: [subQueries[0].id],
        });

        subQueries.push({
          id: this.generateId(),
          query: `${query} best practices`,
          intent: 'best_practices',
          requiredSources: ['community', 'documentation'],
          dependencies: [subQueries[0].id],
        });
      }
    }

    return this.optimizeSubQueries(subQueries);
  }

  /**
   * Score a source type for a query
   */
  private scoreSourceForQuery(source: SourceType, query: string): number {
    let score = 0.5;

    // Check recommendations
    for (const rec of SOURCE_RECOMMENDATIONS) {
      if (rec.sources.includes(source) && rec.patterns.some(p => p.test(query))) {
        score += 0.3 * rec.priority;
      }
    }

    // Source-specific bonuses
    switch (source) {
      case 'documentation':
        if (/\b(api|reference|doc|manual)\b/i.test(query)) score += 0.2;
        break;
      case 'github':
        if (/\b(code|implementation|example|repo)\b/i.test(query)) score += 0.2;
        break;
      case 'arxiv':
        if (/\b(research|paper|algorithm|theory)\b/i.test(query)) score += 0.2;
        break;
      case 'community':
        if (/\b(opinion|experience|recommend|should)\b/i.test(query)) score += 0.2;
        break;
    }

    return Math.min(1, score);
  }

  /**
   * Estimate search time
   */
  private estimateSearchTime(
    subQueries: SubQuery[],
    sources: SourceType[],
    depth: SearchDepth
  ): number {
    const baseTime = 2; // seconds per query
    const sourceMultiplier = sources.length * 0.5;

    let depthMultiplier = 1;
    switch (depth) {
      case 'quick':
        depthMultiplier = 0.5;
        break;
      case 'comprehensive':
        depthMultiplier = 2;
        break;
    }

    return subQueries.length * baseTime * sourceMultiplier * depthMultiplier;
  }

  /**
   * Determine search priority
   */
  private determinePriority(query: string, depth: SearchDepth): QueryPlan['priority'] {
    if (depth === 'comprehensive') return 'thoroughness';
    if (depth === 'quick') return 'speed';
    
    // Check if query implies urgency
    if (/\b(urgent|asap|quick|fast)\b/i.test(query)) {
      return 'speed';
    }

    return 'balanced';
  }

  /**
   * Extract entities from query
   */
  private extractEntities(query: string): string[] {
    // Simple entity extraction
    const entities: string[] = [];
    
    // Capitalized words
    const capitalized = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g);
    if (capitalized) {
      entities.push(...capitalized);
    }

    // Quoted phrases
    const quoted = query.match(/"([^"]+)"/g);
    if (quoted) {
      entities.push(...quoted.map(q => q.slice(1, -1)));
    }

    return Array.from(new Set(entities));
  }

  /**
   * Adapt query for GitHub search
   */
  private adaptForGitHub(query: string): string {
    return query
      .replace(/\bhow\s+to\b/gi, '')
      .replace(/\bwhat\s+is\b/gi, '')
      .trim();
  }

  /**
   * Adapt query for arXiv search
   */
  private adaptForArXiv(query: string): string {
    return query
      .replace(/\bhow\s+(?:does|do)\b/gi, '')
      .replace(/\bwhat\s+is\b/gi, '')
      .trim();
  }

  /**
   * Adapt query for community search
   */
  private adaptForCommunity(query: string): string {
    return query;
  }

  /**
   * Topological sort of sub-queries based on dependencies
   */
  private topologicalSort(subQueries: SubQuery[]): SubQuery[] {
    const visited = new Set<string>();
    const result: SubQuery[] = [];

    const visit = (sq: SubQuery) => {
      if (visited.has(sq.id)) return;
      visited.add(sq.id);

      // Visit dependencies first
      if (sq.dependencies) {
        for (const depId of sq.dependencies) {
          const dep = subQueries.find(q => q.id === depId);
          if (dep) visit(dep);
        }
      }

      result.push(sq);
    };

    for (const sq of subQueries) {
      visit(sq);
    }

    return result;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if query is complex enough to need decomposition
 */
export function isComplexQuery(query: string): boolean {
  const words = query.split(/\s+/).length;
  const hasMultipleQuestions = (query.match(/\?/g) || []).length > 1;
  const hasConjunctions = /\b(and|or|but|however|although)\b/i.test(query);

  return words > 10 || hasMultipleQuestions || hasConjunctions;
}

/**
 * Extract keywords from query for source selection
 */
export function extractQueryKeywords(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !isStopWord(w));
}

/**
 * Check if word is a stop word
 */
function isStopWord(word: string): boolean {
  const stopWords = new Set([
    'what', 'when', 'where', 'which', 'who', 'whom', 'whose', 'why', 'how',
    'this', 'that', 'these', 'those', 'with', 'from', 'they', 'have', 'been',
    'were', 'said', 'each', 'would', 'there', 'could', 'should',
  ]);
  return stopWords.has(word);
}

/**
 * Merge multiple query plans
 */
export function mergeQueryPlans(plans: QueryPlan[]): QueryPlan {
  const allSubQueries = plans.flatMap(p => p.subQueries);
  const allSources = Array.from(new Set(plans.flatMap(p => p.requiredSources)));

  // Remove duplicate sub-queries
  const uniqueQueries = new Map<string, SubQuery>();
  for (const sq of allSubQueries) {
    const key = sq.query.toLowerCase().trim();
    if (!uniqueQueries.has(key)) {
      uniqueQueries.set(key, sq);
    }
  }

  return {
    originalQuery: plans[0]?.originalQuery || '',
    subQueries: Array.from(uniqueQueries.values()),
    requiredSources: allSources,
    priority: 'balanced',
    estimatedTime: plans.reduce((sum, p) => sum + p.estimatedTime, 0),
  };
}

// ============================================================================
// Factory Function
// ============================================================================

export function createQueryPlanner(config?: Partial<QueryPlannerConfig>): QueryPlanner {
  return new QueryPlanner(config);
}
