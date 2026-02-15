/**
 * Search Module for Trench Project
 * Free Search APIs Integration
 * 
 * This module provides unified access to multiple free search sources:
 * - GitHub Search (repos, code, issues, PRs)
 * - arXiv (academic papers)
 * - Web Search (DuckDuckGo, Bing, Google, SearXNG)
 * - Community Search (Hacker News, Reddit, Stack Exchange)
 */

// Main Aggregator
export {
    SearchAggregator,
    searchAggregator,
    AggregatorOptions,
    SourceStatus
} from './searchAggregator';

// GitHub Search
export {
    GitHubSearchProvider,
    githubSearch,
    GitHubSearchOptions,
    GitHubRepoResult,
    GitHubCodeResult,
    GitHubIssueResult
} from './githubSearch';

// arXiv Search
export {
    ArxivSearchProvider,
    arxivSearch,
    ArxivSearchOptions,
    ArxivEntry,
    ArxivCitations
} from './arxivSearch';

// Web Search
export {
    // Aggregator
    WebSearchAggregator,
    webSearch,
    // Individual providers
    DuckDuckGoProvider,
    duckDuckGoSearch,
    BingSearchProvider,
    bingSearch,
    GoogleSearchProvider,
    googleSearch,
    SearxngProvider,
    searxngSearch,
    // Config types
    WebSearchOptions,
    BingSearchConfig,
    GoogleSearchConfig,
    SearxngConfig
} from './webSearch';

// Community Search
export {
    // Aggregator
    CommunitySearchAggregator,
    communitySearch,
    // Individual providers
    HackerNewsProvider,
    hackerNewsSearch,
    RedditProvider,
    redditSearch,
    StackExchangeProvider,
    stackExchangeSearch,
    // Config types
    CommunitySearchOptions,
    HNItem,
    RedditPost,
    SEQuestion
} from './communitySearch';

// Common Types
export {
    SearchResult,
    SearchSource,
    SearchOptions,
    SearchFilters,
    CodePattern,
    SearchProvider,
    RateLimitInfo,
    AggregatedSearchResult
} from './types';

/**
 * Quick Start Examples:
 * 
 * ```typescript
 * import { searchAggregator } from './search';
 * 
 * // Simple search across all sources
 * const results = await searchAggregator.quickSearch('machine learning', 10);
 * 
 * // Smart search (auto-detects query type)
 * const result = await searchAggregator.smartSearch('rust async patterns', 20);
 * 
 * // Search specific sources
 * const codeResults = await searchAggregator.searchCode('quick sort', 'rust', 10);
 * const papers = await searchAggregator.searchAcademic('transformer architecture', 10);
 * 
 * // Use individual providers
 * import { githubSearch, arxivSearch } from './search';
 * 
 * const repos = await githubSearch.search('neural network', { type: 'repositories' });
 * const papers = await arxivSearch.search('quantum computing', { categories: ['quant-ph'] });
 * ```
 */
