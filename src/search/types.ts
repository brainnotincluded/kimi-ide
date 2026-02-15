/**
 * Common types for search modules
 * Trench project - Free Search APIs Integration
 */

export interface SearchResult {
    id: string;
    title: string;
    description: string;
    url: string;
    source: SearchSource;
    relevanceScore: number;
    timestamp?: Date;
    metadata: Record<string, unknown>;
}

export enum SearchSource {
    GITHUB = 'github',
    ARXIV = 'arxiv',
    WEB_DUCKDUCKGO = 'web_duckduckgo',
    WEB_BING = 'web_bing',
    WEB_GOOGLE = 'web_google',
    WEB_SEARXNG = 'web_searxng',
    HACKERNEWS = 'hackernews',
    REDDIT = 'reddit',
    STACKEXCHANGE = 'stackexchange',
    DISCORD = 'discord',
}

export interface SearchOptions {
    maxResults?: number;
    timeout?: number;
    filters?: SearchFilters;
    sortBy?: string; // Allow any string for extensibility
}

export interface SearchFilters {
    dateRange?: {
        from?: Date;
        to?: Date;
    };
    language?: string;
    site?: string;
}

export interface CodePattern {
    type: string;
    name: string;
    content: string;
    language: string;
    lineStart: number;
    lineEnd: number;
}

export interface SearchProvider<T extends SearchOptions = SearchOptions> {
    name: string;
    search(query: string, options?: T): Promise<SearchResult[]>;
    isAvailable(): Promise<boolean>;
    getRateLimitInfo(): RateLimitInfo;
}

export interface RateLimitInfo {
    requestsPerHour: number;
    remainingRequests: number;
    resetTime?: Date;
    authenticated: boolean;
}

export interface AggregatedSearchResult {
    results: SearchResult[];
    totalFound: number;
    sourcesUsed: SearchSource[];
    failedSources: Array<{ source: SearchSource; error: string }>;
    deduplicationStats: {
        totalBefore: number;
        duplicatesRemoved: number;
    };
}
