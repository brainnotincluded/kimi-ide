/**
 * Search Aggregator Module
 * Combines results from all search providers with deduplication and ranking
 * Trench project - Free Search APIs Integration
 */

import { logger } from '../utils/logger';
import {
    SearchResult,
    SearchSource,
    SearchOptions,
    AggregatedSearchResult,
    SearchProvider,
    RateLimitInfo
} from './types';

import { githubSearch, GitHubSearchProvider } from './githubSearch';
import { arxivSearch, ArxivSearchProvider } from './arxivSearch';
import { 
    webSearch, 
    WebSearchAggregator, 
    duckDuckGoSearch,
    DuckDuckGoProvider,
    BingSearchProvider,
    GoogleSearchProvider,
    SearxngProvider
} from './webSearch';
import { 
    communitySearch, 
    CommunitySearchAggregator,
    hackerNewsSearch,
    HackerNewsProvider,
    RedditProvider,
    StackExchangeProvider
} from './communitySearch';

export interface AggregatorOptions extends SearchOptions {
    sources?: SearchSource[];
    deduplicate?: boolean;
    sourceWeights?: Partial<Record<SearchSource, number>>;
    timeoutPerSource?: number;
    parallel?: boolean;
}

export interface SourceStatus {
    source: SearchSource;
    available: boolean;
    rateLimit: RateLimitInfo;
    lastError?: string;
}

/**
 * Search Aggregator - Main entry point for all search functionality
 */
export class SearchAggregator {
    private providers: Map<SearchSource, SearchProvider> = new Map();
    private sourceWeights: Record<SearchSource, number> = {
        [SearchSource.GITHUB]: 1.0,
        [SearchSource.ARXIV]: 0.9,
        [SearchSource.WEB_DUCKDUCKGO]: 0.8,
        [SearchSource.WEB_BING]: 0.85,
        [SearchSource.WEB_GOOGLE]: 0.9,
        [SearchSource.WEB_SEARXNG]: 0.85,
        [SearchSource.HACKERNEWS]: 0.7,
        [SearchSource.REDDIT]: 0.65,
        [SearchSource.STACKEXCHANGE]: 0.75,
        [SearchSource.DISCORD]: 0.6,
    };

    constructor() {
        // Register all providers
        this.providers.set(SearchSource.GITHUB, githubSearch);
        this.providers.set(SearchSource.ARXIV, arxivSearch);
        this.providers.set(SearchSource.WEB_DUCKDUCKGO, duckDuckGoSearch);
        this.providers.set(SearchSource.HACKERNEWS, hackerNewsSearch);
        
        // Aggregators handle multiple sub-sources
        this.providers.set(SearchSource.WEB_BING, webSearch);
        this.providers.set(SearchSource.WEB_GOOGLE, webSearch);
        this.providers.set(SearchSource.WEB_SEARXNG, webSearch);
        this.providers.set(SearchSource.REDDIT, communitySearch);
        this.providers.set(SearchSource.STACKEXCHANGE, communitySearch);
    }

    /**
     * Configure source weights for ranking
     */
    setSourceWeights(weights: Partial<Record<SearchSource, number>>): void {
        this.sourceWeights = { ...this.sourceWeights, ...weights };
    }

    /**
     * Get all registered providers
     */
    getProviders(): Map<SearchSource, SearchProvider> {
        return new Map(this.providers);
    }

    /**
     * Get specific provider
     */
    getProvider(source: SearchSource): SearchProvider | undefined {
        return this.providers.get(source);
    }

    /**
     * Get GitHub provider (for code-specific operations)
     */
    getGitHubProvider(): GitHubSearchProvider {
        return githubSearch;
    }

    /**
     * Get arXiv provider (for academic paper operations)
     */
    getArxivProvider(): ArxivSearchProvider {
        return arxivSearch;
    }

    /**
     * Get Web Search provider (for web-specific operations)
     */
    getWebProvider(): WebSearchAggregator {
        return webSearch;
    }

    /**
     * Get Community Search provider
     */
    getCommunityProvider(): CommunitySearchAggregator {
        return communitySearch;
    }

    /**
     * Check status of all sources
     */
    async getSourcesStatus(): Promise<SourceStatus[]> {
        const statuses: SourceStatus[] = [];

        for (const [source, provider] of this.providers) {
            try {
                const available = await provider.isAvailable();
                const rateLimit = provider.getRateLimitInfo();
                statuses.push({ source, available, rateLimit });
            } catch (error) {
                statuses.push({
                    source,
                    available: false,
                    rateLimit: { requestsPerHour: 0, remainingRequests: 0, authenticated: false },
                    lastError: error instanceof Error ? error.message : String(error)
                });
            }
        }

        return statuses;
    }

    /**
     * Get only available sources
     */
    async getAvailableSources(): Promise<SearchSource[]> {
        const statuses = await this.getSourcesStatus();
        return statuses
            .filter(s => s.available && s.rateLimit.remainingRequests > 0)
            .map(s => s.source);
    }

    /**
     * Main search method - searches across all configured sources
     */
    async search(query: string, options: AggregatorOptions = {}): Promise<AggregatedSearchResult> {
        const sources = options.sources || await this.getAvailableSources();
        const deduplicate = options.deduplicate !== false;
        const timeoutPerSource = options.timeoutPerSource || 10000;
        const parallel = options.parallel !== false;

        const results: SearchResult[] = [];
        const sourcesUsed: SearchSource[] = [];
        const failedSources: Array<{ source: SearchSource; error: string }> = [];

        if (parallel) {
            // Search all sources in parallel with timeout
            const searchPromises = sources.map(source => 
                this.searchWithTimeout(source, query, options, timeoutPerSource)
            );

            const searchResults = await Promise.allSettled(searchPromises);

            searchResults.forEach((result, index) => {
                const source = sources[index];
                if (result.status === 'fulfilled') {
                    if (result.value.results.length > 0) {
                        results.push(...result.value.results);
                        sourcesUsed.push(source);
                    }
                    if (result.value.error) {
                        failedSources.push({ source, error: result.value.error });
                    }
                } else {
                    failedSources.push({ source, error: result.reason?.message || 'Unknown error' });
                }
            });
        } else {
            // Search sequentially
            for (const source of sources) {
                try {
                    const provider = this.providers.get(source);
                    if (!provider) continue;

                    const sourceResults = await provider.search(query, options);
                    if (sourceResults.length > 0) {
                        results.push(...sourceResults);
                        sourcesUsed.push(source);
                    }
                } catch (error) {
                    failedSources.push({
                        source,
                        error: error instanceof Error ? error.message : String(error)
                    });
                }
            }
        }

        const totalBefore = results.length;

        // Deduplicate if enabled
        let finalResults = results;
        if (deduplicate) {
            finalResults = this.deduplicateResults(results);
        }

        // Rank results
        finalResults = this.rankResults(finalResults, query, options.sourceWeights);

        // Limit to maxResults
        const maxResults = options.maxResults || 50;
        finalResults = finalResults.slice(0, maxResults);

        return {
            results: finalResults,
            totalFound: results.length,
            sourcesUsed,
            failedSources,
            deduplicationStats: {
                totalBefore,
                duplicatesRemoved: totalBefore - finalResults.length
            }
        };
    }

    /**
     * Search specific sources
     */
    async searchSources(
        sources: SearchSource[],
        query: string,
        options: SearchOptions = {}
    ): Promise<SearchResult[]> {
        const result = await this.search(query, {
            ...options,
            sources,
            deduplicate: true
        });
        return result.results;
    }

    /**
     * Quick search with sensible defaults
     */
    async quickSearch(query: string, maxResults: number = 10): Promise<SearchResult[]> {
        const result = await this.search(query, {
            maxResults,
            deduplicate: true,
            parallel: true,
            timeoutPerSource: 5000
        });
        return result.results;
    }

    /**
     * Code search - focuses on GitHub
     */
    async searchCode(query: string, language?: string, maxResults: number = 20): Promise<SearchResult[]> {
        try {
            const github = this.getGitHubProvider();
            const results = await github.search(query, {
                type: 'code',
                language,
                maxResults
            });
            return results;
        } catch (error) {
            logger.error('Code search error:', error);
            return [];
        }
    }

    /**
     * Academic search - focuses on arXiv
     */
    async searchAcademic(query: string, maxResults: number = 20): Promise<SearchResult[]> {
        try {
            const arxiv = this.getArxivProvider();
            const results = await arxiv.search(query, { maxResults });
            return results;
        } catch (error) {
            logger.error('Academic search error:', error);
            return [];
        }
    }

    /**
     * Web search only
     */
    async searchWeb(query: string, maxResults: number = 20): Promise<SearchResult[]> {
        try {
            const web = this.getWebProvider();
            const results = await web.search(query, { maxResults });
            return results;
        } catch (error) {
            logger.error('Web search error:', error);
            return [];
        }
    }

    /**
     * Community search only
     */
    async searchCommunity(query: string, maxResults: number = 20): Promise<SearchResult[]> {
        try {
            const community = this.getCommunityProvider();
            const results = await community.search(query, { maxResults });
            return results;
        } catch (error) {
            logger.error('Community search error:', error);
            return [];
        }
    }

    /**
     * Smart search - automatically selects best sources based on query
     */
    async smartSearch(query: string, maxResults: number = 20): Promise<AggregatedSearchResult> {
        const queryLower = query.toLowerCase();
        let sources: SearchSource[];

        // Detect query type and select appropriate sources
        if (this.isCodeQuery(queryLower)) {
            // Code-related query
            sources = [
                SearchSource.GITHUB,
                SearchSource.STACKEXCHANGE,
                SearchSource.WEB_DUCKDUCKGO
            ];
        } else if (this.isAcademicQuery(queryLower)) {
            // Academic/research query
            sources = [
                SearchSource.ARXIV,
                SearchSource.WEB_DUCKDUCKGO,
                SearchSource.HACKERNEWS
            ];
        } else if (this.isDiscussionQuery(queryLower)) {
            // Discussion/opinion query
            sources = [
                SearchSource.HACKERNEWS,
                SearchSource.REDDIT,
                SearchSource.STACKEXCHANGE
            ];
        } else {
            // General query - use all sources
            sources = await this.getAvailableSources();
        }

        return this.search(query, {
            sources,
            maxResults,
            deduplicate: true,
            parallel: true
        });
    }

    /**
     * Search with timeout
     */
    private async searchWithTimeout(
        source: SearchSource,
        query: string,
        options: SearchOptions,
        timeout: number
    ): Promise<{ results: SearchResult[]; error?: string }> {
        const provider = this.providers.get(source);
        if (!provider) {
            return { results: [], error: 'Provider not found' };
        }

        try {
            const searchPromise = provider.search(query, options);
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), timeout);
            });

            const results = await Promise.race([searchPromise, timeoutPromise]);
            return { results };
        } catch (error) {
            return {
                results: [],
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Deduplicate results based on URL similarity
     */
    private deduplicateResults(results: SearchResult[]): SearchResult[] {
        const seen = new Map<string, SearchResult>();
        const duplicates: SearchResult[] = [];

        for (const result of results) {
            const key = this.generateDeduplicationKey(result);
            
            if (seen.has(key)) {
                const existing = seen.get(key)!;
                // Keep the one with higher relevance score
                if (result.relevanceScore > existing.relevanceScore) {
                    duplicates.push(existing);
                    seen.set(key, result);
                } else {
                    duplicates.push(result);
                }
            } else {
                seen.set(key, result);
            }
        }

        // Log deduplication stats
        if (duplicates.length > 0) {
            logger.debug(`Deduplicated ${duplicates.length} results`);
        }

        return Array.from(seen.values());
    }

    /**
     * Generate deduplication key from result
     */
    private generateDeduplicationKey(result: SearchResult): string {
        // Normalize URL
        let url = result.url
            .toLowerCase()
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '')
            .replace(/[?#].*$/, ''); // Remove query and fragment

        // Special handling for specific sources
        if (result.source === SearchSource.GITHUB) {
            // Normalize GitHub URLs to repo level
            const ghMatch = url.match(/github\.com\/([^\/]+\/[^\/]+)/);
            if (ghMatch) {
                return `github:${ghMatch[1]}`;
            }
        }

        if (result.source === SearchSource.ARXIV) {
            // Normalize arXiv IDs
            const arxivMatch = url.match(/arxiv\.org\/abs\/(\d+\.\d+)/);
            if (arxivMatch) {
                return `arxiv:${arxivMatch[1]}`;
            }
        }

        // Generic URL deduplication
        return url;
    }

    /**
     * Rank results by relevance
     */
    private rankResults(
        results: SearchResult[],
        query: string,
        customWeights?: Partial<Record<SearchSource, number>>
    ): SearchResult[] {
        const weights = { ...this.sourceWeights, ...customWeights };
        const queryLower = query.toLowerCase();
        const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

        return results
            .map(result => {
                // Calculate base score with source weight
                const sourceWeight = weights[result.source] || 0.5;
                let score = result.relevanceScore * sourceWeight;

                // Boost exact title matches
                const titleLower = result.title.toLowerCase();
                if (titleLower.includes(queryLower)) {
                    score += 0.2;
                }

                // Boost for query term frequency in title
                const termMatches = queryTerms.filter(term => titleLower.includes(term)).length;
                score += (termMatches / queryTerms.length) * 0.1;

                // Boost recent results
                if (result.timestamp) {
                    const daysOld = (Date.now() - result.timestamp.getTime()) / (1000 * 60 * 60 * 24);
                    if (daysOld < 30) {
                        score += 0.05;
                    } else if (daysOld < 365) {
                        score += 0.02;
                    }
                }

                return { ...result, relevanceScore: Math.min(score, 1.0) };
            })
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
    }

    /**
     * Detect if query is code-related
     */
    private isCodeQuery(query: string): boolean {
        const codeKeywords = [
            'code', 'function', 'class', 'method', 'api', 'library',
            'github', 'repository', 'npm', 'pip', 'cargo', 'gem',
            'javascript', 'typescript', 'python', 'rust', 'go', 'java',
            'react', 'vue', 'angular', 'node', 'django', 'flask',
            'error', 'bug', 'exception', 'stack trace', 'debug',
            'algorithm', 'data structure', 'pattern', 'refactor'
        ];
        return codeKeywords.some(kw => query.includes(kw));
    }

    /**
     * Detect if query is academic/research-related
     */
    private isAcademicQuery(query: string): boolean {
        const academicKeywords = [
            'paper', 'research', 'study', 'arxiv', 'journal',
            'algorithm', 'neural', 'machine learning', 'deep learning',
            'ai', 'artificial intelligence', 'nlp', 'computer vision',
            'theorem', 'proof', 'equation', 'model', 'dataset',
            'survey', 'review', 'benchmark', 'sota', 'state of the art'
        ];
        return academicKeywords.some(kw => query.includes(kw));
    }

    /**
     * Detect if query is discussion/opinion-related
     */
    private isDiscussionQuery(query: string): boolean {
        const discussionKeywords = [
            'opinion', 'thoughts', 'discussion', 'vs', 'versus',
            'compare', 'comparison', 'recommend', 'best', 'worst',
            'experience', 'review', 'how to', 'tutorial', 'guide',
            'help', 'question', 'ask', 'advice', 'tips'
        ];
        return discussionKeywords.some(kw => query.includes(kw));
    }
}

// Export singleton instance
export const searchAggregator = new SearchAggregator();

// Convenience exports
export {
    githubSearch,
    arxivSearch,
    webSearch,
    communitySearch,
    duckDuckGoSearch,
    hackerNewsSearch
};

// Re-export types
export * from './types';
export * from './githubSearch';
export * from './arxivSearch';
export * from './webSearch';
export * from './communitySearch';
