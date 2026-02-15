/**
 * Source Aggregator
 * 
 * Aggregates results from multiple sources, normalizes formats,
 * deduplicates content, and scores source credibility.
 */

import * as crypto from 'crypto';
import {
  Source,
  AnySource,
  SourceType,
  AggregatedResults,
  SearchResult,
  WebSource,
  GitHubSource,
  ArXivSource,
  CommunitySource,
  ArchiveSource,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

interface AggregatorConfig {
  maxSourcesPerType: number;
  dedupSimilarityThreshold: number;
  minCredibilityScore: number;
  prioritizeFreshness: boolean;
  domainCredibility: Map<string, number>;
}

const DEFAULT_CONFIG: AggregatorConfig = {
  maxSourcesPerType: 20,
  dedupSimilarityThreshold: 0.85,
  minCredibilityScore: 0.3,
  prioritizeFreshness: true,
  domainCredibility: new Map([
    ['github.com', 0.9],
    ['stackoverflow.com', 0.85],
    ['arxiv.org', 0.95],
    ['docs.microsoft.com', 0.9],
    ['developer.mozilla.org', 0.95],
    ['wikipedia.org', 0.75],
    ['medium.com', 0.6],
    ['dev.to', 0.7],
    ['news.ycombinator.com', 0.75],
    ['reddit.com', 0.5],
  ]),
};

// ============================================================================
// Source Aggregator Class
// ============================================================================

export class SourceAggregator {
  private config: AggregatorConfig;

  constructor(config: Partial<AggregatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Aggregate results from multiple search results
   */
  async aggregate(results: SearchResult[]): Promise<AggregatedResults> {
    const allSources: AnySource[] = [];

    // Process each search result
    for (const result of results) {
      if (result.error) {
        console.warn(`Search error for ${result.sourceType}:`, result.error);
        continue;
      }

      const normalized = result.results.map(source => this.normalizeSource(source));
      const scored = normalized.map(source => this.scoreSource(source));
      const filtered = scored.filter(s => s.credibilityScore >= this.config.minCredibilityScore);
      
      allSources.push(...filtered);
    }

    // Deduplicate sources
    const { sources, duplicates } = this.deduplicateSources(allSources);

    // Sort by credibility and freshness
    const sorted = this.sortSources(sources);

    // Limit per source type
    const limited = this.limitPerType(sorted);

    return {
      sources: limited,
      duplicates,
      sourceStats: {
        byType: this.calculateTypeStats(limited),
        total: allSources.length,
        unique: limited.length,
      },
    };
  }

  /**
   * Normalize any source to common format
   */
  private normalizeSource(source: AnySource): AnySource {
    // Ensure all sources have required fields
    const base: Partial<Source> = {
      id: source.id || this.generateId(source.url),
      fetchDate: source.fetchDate || new Date(),
      credibilityScore: source.credibilityScore || 0.5,
      metadata: source.metadata || {},
    };

    return { ...source, ...base } as AnySource;
  }

  /**
   * Calculate credibility score for a source
   */
  private scoreSource(source: AnySource): AnySource {
    let score = 0.5; // Base score

    // Domain credibility
    if (source.domain) {
      const domainScore = this.config.domainCredibility.get(source.domain);
      if (domainScore) {
        score = score * 0.3 + domainScore * 0.7;
      }
    }

    // Source-type specific scoring
    switch (source.sourceType) {
      case 'github':
        score = this.scoreGitHubSource(source as GitHubSource, score);
        break;
      case 'arxiv':
        score = this.scoreArXivSource(source as ArXivSource, score);
        break;
      case 'community':
        score = this.scoreCommunitySource(source as CommunitySource, score);
        break;
      case 'web':
        score = this.scoreWebSource(source as WebSource, score);
        break;
    }

    // Freshness bonus
    if (this.config.prioritizeFreshness && source.publishDate) {
      const age = Date.now() - source.publishDate.getTime();
      const daysOld = age / (1000 * 60 * 60 * 24);
      const freshnessBonus = Math.max(0, 1 - daysOld / 365) * 0.1;
      score += freshnessBonus;
    }

    // Content quality indicators
    if (source.content) {
      score += this.scoreContentQuality(source.content);
    }

    return {
      ...source,
      credibilityScore: Math.min(1, Math.max(0, score)),
    };
  }

  /**
   * Score GitHub source based on repo metrics
   */
  private scoreGitHubSource(source: GitHubSource, baseScore: number): number {
    let score = baseScore;

    // Stars indicate popularity/quality
    if (source.stars > 10000) score += 0.2;
    else if (source.stars > 1000) score += 0.15;
    else if (source.stars > 100) score += 0.1;
    else if (source.stars > 10) score += 0.05;

    // Forks indicate utility
    if (source.forks > 1000) score += 0.1;
    else if (source.forks > 100) score += 0.05;

    // Recent activity
    const lastUpdate = new Date(source.lastUpdated).getTime();
    const monthsSinceUpdate = (Date.now() - lastUpdate) / (1000 * 60 * 60 * 24 * 30);
    if (monthsSinceUpdate < 1) score += 0.1;
    else if (monthsSinceUpdate < 6) score += 0.05;
    else if (monthsSinceUpdate > 24) score -= 0.1;

    return score;
  }

  /**
   * Score arXiv source based on paper metrics
   */
  private scoreArXivSource(source: ArXivSource, baseScore: number): number {
    let score = baseScore;

    // arXiv papers are generally high quality
    score += 0.1;

    // Has DOI indicates published work
    if (source.doi) score += 0.05;

    // Multiple authors often indicate more rigorous work
    if (source.authors.length > 2) score += 0.02;

    return score;
  }

  /**
   * Score community source based on engagement
   */
  private scoreCommunitySource(source: CommunitySource, baseScore: number): number {
    let score = baseScore;

    // Score based on platform
    switch (source.platform) {
      case 'stackoverflow':
        // Score based on votes and acceptance
        score += Math.min(0.2, source.score / 100);
        if (source.score > 50) score += 0.1;
        break;
      case 'hackernews':
        // HN has high-quality tech discussions
        score += Math.min(0.15, source.score / 100);
        if (source.comments > 50) score += 0.05;
        break;
      case 'reddit':
        // Reddit varies in quality
        score += Math.min(0.1, source.score / 500);
        break;
      case 'devto':
        score += Math.min(0.1, source.score / 100);
        break;
    }

    // Author reputation bonus
    if (source.authorReputation) {
      score += Math.min(0.1, source.authorReputation / 10000);
    }

    return score;
  }

  /**
   * Score web source based on rank and content
   */
  private scoreWebSource(source: WebSource, baseScore: number): number {
    let score = baseScore;

    // Search engine rank (lower is better)
    if (source.rank <= 3) score += 0.15;
    else if (source.rank <= 10) score += 0.1;
    else if (source.rank <= 20) score += 0.05;

    return score;
  }

  /**
   * Score content quality based on heuristics
   */
  private scoreContentQuality(content: string): number {
    let score = 0;
    const length = content.length;

    // Length indicators
    if (length > 5000) score += 0.1;
    else if (length > 2000) score += 0.05;
    else if (length < 200) score -= 0.1;

    // Code blocks indicate technical content
    const codeBlocks = (content.match(/```/g) || []).length / 2;
    if (codeBlocks > 0) score += Math.min(0.1, codeBlocks * 0.02);

    // Links indicate research
    const links = (content.match(/https?:\/\//g) || []).length;
    if (links > 3) score += 0.05;

    // Citations indicate academic quality
    if (content.includes('[') && content.includes(']')) score += 0.03;

    return score;
  }

  /**
   * Deduplicate sources by URL and content similarity
   */
  private deduplicateSources(sources: AnySource[]): { sources: AnySource[]; duplicates: Map<string, string[]> } {
    const seenUrls = new Map<string, string>(); // URL -> source ID
    const seenHashes = new Map<string, string>(); // content hash -> source ID
    const duplicates = new Map<string, string[]>(); // canonical ID -> duplicate IDs
    const unique: AnySource[] = [];

    for (const source of sources) {
      const urlKey = this.normalizeUrl(source.url);
      const contentHash = this.hashContent(source.content);

      // Check URL duplicate
      if (seenUrls.has(urlKey)) {
        const canonicalId = seenUrls.get(urlKey)!;
        this.addDuplicate(duplicates, canonicalId, source.id);
        continue;
      }

      // Check content similarity
      let isDuplicate = false;
      for (const [hash, canonicalId] of Array.from(seenHashes.entries())) {
        const similarity = this.calculateSimilarity(contentHash, hash);
        if (similarity >= this.config.dedupSimilarityThreshold) {
          this.addDuplicate(duplicates, canonicalId, source.id);
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) continue;

      // New unique source
      seenUrls.set(urlKey, source.id);
      seenHashes.set(contentHash, source.id);
      unique.push(source);
    }

    return { sources: unique, duplicates };
  }

  /**
   * Add duplicate to tracking map
   */
  private addDuplicate(duplicates: Map<string, string[]>, canonicalId: string, duplicateId: string): void {
    if (!duplicates.has(canonicalId)) {
      duplicates.set(canonicalId, []);
    }
    duplicates.get(canonicalId)!.push(duplicateId);
  }

  /**
   * Normalize URL for deduplication
   */
  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove tracking parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'ref', 'fbclid'];
      trackingParams.forEach(param => urlObj.searchParams.delete(param));
      // Remove fragment
      urlObj.hash = '';
      return urlObj.toString().toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  /**
   * Hash content for deduplication
   */
  private hashContent(content: string): string {
    // Normalize content: lowercase, remove extra whitespace
    const normalized = content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9\s]/g, '')
      .trim();
    
    return crypto
      .createHash('md5')
      .update(normalized)
      .digest('hex');
  }

  /**
   * Calculate similarity between two content hashes
   * Simple implementation - could use simhash for better results
   */
  private calculateSimilarity(hash1: string, hash2: string): number {
    if (hash1 === hash2) return 1;
    
    // Simple hamming distance for demonstration
    // In production, use proper simhash or minhash
    let matches = 0;
    const length = Math.min(hash1.length, hash2.length);
    for (let i = 0; i < length; i++) {
      if (hash1[i] === hash2[i]) matches++;
    }
    return matches / length;
  }

  /**
   * Sort sources by credibility and freshness
   */
  private sortSources(sources: AnySource[]): AnySource[] {
    return [...sources].sort((a, b) => {
      // Primary: credibility score
      if (b.credibilityScore !== a.credibilityScore) {
        return b.credibilityScore - a.credibilityScore;
      }

      // Secondary: freshness
      if (this.config.prioritizeFreshness) {
        const dateA = a.publishDate || a.fetchDate;
        const dateB = b.publishDate || b.fetchDate;
        return dateB.getTime() - dateA.getTime();
      }

      return 0;
    });
  }

  /**
   * Limit sources per type
   */
  private limitPerType(sources: AnySource[]): AnySource[] {
    const counts = new Map<SourceType, number>();
    const result: AnySource[] = [];

    for (const source of sources) {
      const count = counts.get(source.sourceType) || 0;
      if (count < this.config.maxSourcesPerType) {
        result.push(source);
        counts.set(source.sourceType, count + 1);
      }
    }

    return result;
  }

  /**
   * Calculate source type statistics
   */
  private calculateTypeStats(sources: AnySource[]): Record<SourceType, number> {
    const stats: Partial<Record<SourceType, number>> = {};
    
    for (const source of sources) {
      stats[source.sourceType] = (stats[source.sourceType] || 0) + 1;
    }

    return stats as Record<SourceType, number>;
  }

  /**
   * Generate unique ID for source
   */
  private generateId(url: string): string {
    return crypto
      .createHash('sha256')
      .update(url + Date.now())
      .digest('hex')
      .substring(0, 16);
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Add domain credibility rating
   */
  addDomainCredibility(domain: string, score: number): void {
    this.config.domainCredibility.set(domain, Math.max(0, Math.min(1, score)));
  }

  /**
   * Get credibility score for a domain
   */
  getDomainCredibility(domain: string): number {
    return this.config.domainCredibility.get(domain) || 0.5;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSourceAggregator(config?: Partial<AggregatorConfig>): SourceAggregator {
  return new SourceAggregator(config);
}
