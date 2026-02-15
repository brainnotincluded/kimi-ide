/**
 * Web Search Module
 * Multiple free search sources with fallback
 * - DuckDuckGo HTML scraping (no API key needed)
 * - Bing Web Search API (free tier: 1000 queries/month)
 * - Google Custom Search (free tier: 100 queries/day)
 * - SearXNG self-hosted option
 * Trench project - Free Search APIs Integration
 */

import { logger } from '../utils/logger';
import {
    SearchResult,
    SearchSource,
    SearchOptions,
    SearchProvider,
    RateLimitInfo
} from './types';

export interface WebSearchOptions extends SearchOptions {
    source?: 'duckduckgo' | 'bing' | 'google' | 'searxng';
    safeSearch?: 'off' | 'moderate' | 'strict';
    timeRange?: 'day' | 'week' | 'month' | 'year';
}

export interface BingSearchConfig {
    apiKey: string;
    endpoint?: string;
}

export interface GoogleSearchConfig {
    apiKey: string;
    cx: string; // Custom Search Engine ID
}

export interface SearxngConfig {
    baseUrl: string; // e.g., "http://localhost:8080" or "https://searx.example.com"
}

// DuckDuckGo result structure
interface DuckDuckGoResult {
    title: string;
    description: string;
    url: string;
}

export class DuckDuckGoProvider implements SearchProvider {
    name = 'DuckDuckGo';
    private userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch('https://duckduckgo.com/html/?q=test', {
                headers: { 'User-Agent': this.getRandomUserAgent() }
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    getRateLimitInfo(): RateLimitInfo {
        return {
            requestsPerHour: 100, // Conservative estimate for scraping
            remainingRequests: 50,
            authenticated: false
        };
    }

    async search(query: string, options: WebSearchOptions = {}): Promise<SearchResult[]> {
        try {
            // DuckDuckGo HTML interface
            const searchUrl = this.buildSearchUrl(query, options);
            
            const response = await fetch(searchUrl, {
                headers: {
                    'User-Agent': this.getRandomUserAgent(),
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Referer': 'https://duckduckgo.com/'
                }
            });

            if (!response.ok) {
                throw new Error(`DuckDuckGo error: ${response.status}`);
            }

            const html = await response.text();
            return this.parseHtmlResults(html, query);
        } catch (error) {
            logger.error('DuckDuckGo search error:', error);
            return [];
        }
    }

    private buildSearchUrl(query: string, options: WebSearchOptions): string {
        const params = new URLSearchParams();
        params.append('q', query);
        params.append('kl', 'us-en'); // Region
        
        if (options.safeSearch === 'strict') {
            params.append('kp', '1');
        } else if (options.safeSearch === 'off') {
            params.append('kp', '-1');
        }

        if (options.timeRange) {
            const timeParam: Record<string, string> = {
                'day': 'd',
                'week': 'w',
                'month': 'm',
                'year': 'y'
            };
            if (timeParam[options.timeRange]) {
                params.append('df', timeParam[options.timeRange]);
            }
        }

        return `https://html.duckduckgo.com/html/?${params.toString()}`;
    }

    private parseHtmlResults(html: string, query: string): SearchResult[] {
        const results: SearchResult[] = [];
        
        // Parse result blocks
        // DuckDuckGo HTML structure: .result elements
        const resultRegex = /<div class="result[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>/g;
        let match;
        let index = 0;

        while ((match = resultRegex.exec(html)) !== null && index < 20) {
            const resultHtml = match[0];
            
            try {
                const titleMatch = resultHtml.match(/<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/);
                const snippetMatch = resultHtml.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
                const urlMatch = resultHtml.match(/<a[^>]*href="([^"]+)"/);

                if (titleMatch && urlMatch) {
                    const title = this.cleanHtml(titleMatch[1]);
                    const description = snippetMatch ? this.cleanHtml(snippetMatch[1]) : '';
                    let url = urlMatch[1];

                    // Decode DuckDuckGo redirect URLs
                    if (url.startsWith('//duckduckgo.com/l/?')) {
                        const urlParam = url.match(/uddg=([^&]+)/);
                        if (urlParam) {
                            url = decodeURIComponent(urlParam[1]);
                        }
                    }

                    results.push({
                        id: `ddg-${index}-${Date.now()}`,
                        title,
                        description,
                        url,
                        source: SearchSource.WEB_DUCKDUCKGO,
                        relevanceScore: this.calculateScore(title, description, query, index),
                        timestamp: new Date(),
                        metadata: { type: 'web' }
                    });
                    index++;
                }
            } catch (error) {
                logger.debug('Failed to parse result:', error);
            }
        }

        return results;
    }

    private cleanHtml(html: string): string {
        return html
            .replace(/<[^>]+>/g, '')
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#x27;/g, "'")
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private calculateScore(title: string, description: string, query: string, index: number): number {
        const queryLower = query.toLowerCase();
        const titleLower = title.toLowerCase();
        const descLower = description.toLowerCase();

        let score = 0.7 - (index * 0.03); // Position-based decay

        if (titleLower.includes(queryLower)) score += 0.2;
        if (descLower.includes(queryLower)) score += 0.1;

        return Math.max(0.1, Math.min(score, 1.0));
    }

    private getRandomUserAgent(): string {
        return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    }
}

export class BingSearchProvider implements SearchProvider {
    name = 'Bing';
    private apiKey: string | null = null;
    private endpoint = 'https://api.bing.microsoft.com/v7.0/search';

    configure(config: BingSearchConfig): void {
        this.apiKey = config.apiKey;
        if (config.endpoint) {
            this.endpoint = config.endpoint;
        }
    }

    async isAvailable(): Promise<boolean> {
        if (!this.apiKey) return false;
        try {
            const response = await fetch(`${this.endpoint}?q=test&count=1`, {
                headers: { 'Ocp-Apim-Subscription-Key': this.apiKey }
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    getRateLimitInfo(): RateLimitInfo {
        return {
            requestsPerHour: this.apiKey ? 1000 : 0, // Free tier: 1000/month
            remainingRequests: this.apiKey ? 1000 : 0,
            authenticated: !!this.apiKey
        };
    }

    async search(query: string, options: WebSearchOptions = {}): Promise<SearchResult[]> {
        if (!this.apiKey) {
            logger.warn('Bing Search API key not configured');
            return [];
        }

        try {
            const params = new URLSearchParams();
            params.append('q', query);
            params.append('count', String(Math.min(options.maxResults || 10, 50)));
            params.append('offset', '0');
            params.append('mkt', 'en-US');
            params.append('safeSearch', options.safeSearch || 'moderate');

            if (options.timeRange) {
                const freshness: Record<string, string> = {
                    'day': 'Day',
                    'week': 'Week',
                    'month': 'Month',
                    'year': 'Year'
                };
                if (freshness[options.timeRange]) {
                    params.append('freshness', freshness[options.timeRange]);
                }
            }

            const response = await fetch(`${this.endpoint}?${params.toString()}`, {
                headers: {
                    'Ocp-Apim-Subscription-Key': this.apiKey,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Bing API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return this.parseResults(data, query);
        } catch (error) {
            logger.error('Bing search error:', error);
            return [];
        }
    }

    private parseResults(data: any, query: string): SearchResult[] {
        const results: SearchResult[] = [];
        const webPages = data.webPages?.value || [];

        webPages.forEach((page: any, index: number) => {
            results.push({
                id: `bing-${page.id || index}`,
                title: page.name,
                description: page.snippet,
                url: page.url,
                source: SearchSource.WEB_BING,
                relevanceScore: 0.8 - (index * 0.05),
                timestamp: new Date(),
                metadata: {
                    type: 'web',
                    displayUrl: page.displayUrl,
                    deepLinks: page.deepLinks
                }
            });
        });

        return results;
    }
}

export class GoogleSearchProvider implements SearchProvider {
    name = 'Google';
    private apiKey: string | null = null;
    private cx: string | null = null;
    private endpoint = 'https://www.googleapis.com/customsearch/v1';

    configure(config: GoogleSearchConfig): void {
        this.apiKey = config.apiKey;
        this.cx = config.cx;
    }

    async isAvailable(): Promise<boolean> {
        if (!this.apiKey || !this.cx) return false;
        try {
            const response = await fetch(
                `${this.endpoint}?key=${this.apiKey}&cx=${this.cx}&q=test&num=1`
            );
            return response.ok;
        } catch {
            return false;
        }
    }

    getRateLimitInfo(): RateLimitInfo {
        return {
            requestsPerHour: this.apiKey ? 100 : 0, // Free tier: 100/day
            remainingRequests: this.apiKey ? 100 : 0,
            authenticated: !!this.apiKey
        };
    }

    async search(query: string, options: WebSearchOptions = {}): Promise<SearchResult[]> {
        if (!this.apiKey || !this.cx) {
            logger.warn('Google Custom Search not configured (API key and CX required)');
            return [];
        }

        try {
            const params = new URLSearchParams();
            params.append('key', this.apiKey);
            params.append('cx', this.cx);
            params.append('q', query);
            params.append('num', String(Math.min(options.maxResults || 10, 10)));

            if (options.safeSearch === 'strict') {
                params.append('safe', 'high');
            } else if (options.safeSearch === 'off') {
                params.append('safe', 'off');
            } else {
                params.append('safe', 'medium');
            }

            if (options.timeRange) {
                const dateRestrict: Record<string, string> = {
                    'day': 'd1',
                    'week': 'w1',
                    'month': 'm1',
                    'year': 'y1'
                };
                if (dateRestrict[options.timeRange]) {
                    params.append('dateRestrict', dateRestrict[options.timeRange]);
                }
            }

            const response = await fetch(`${this.endpoint}?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`Google API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return this.parseResults(data, query);
        } catch (error) {
            logger.error('Google search error:', error);
            return [];
        }
    }

    private parseResults(data: any, query: string): SearchResult[] {
        const results: SearchResult[] = [];
        const items = data.items || [];

        items.forEach((item: any, index: number) => {
            results.push({
                id: `google-${index}`,
                title: item.title,
                description: item.snippet,
                url: item.link,
                source: SearchSource.WEB_GOOGLE,
                relevanceScore: 0.85 - (index * 0.05),
                timestamp: new Date(),
                metadata: {
                    type: 'web',
                    displayLink: item.displayLink,
                    formattedUrl: item.formattedUrl,
                    htmlSnippet: item.htmlSnippet,
                    htmlTitle: item.htmlTitle
                }
            });
        });

        return results;
    }
}

export class SearxngProvider implements SearchProvider {
    name = 'SearXNG';
    private baseUrl: string | null = null;

    configure(config: SearxngConfig): void {
        this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    }

    async isAvailable(): Promise<boolean> {
        if (!this.baseUrl) return false;
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return response.ok;
        } catch {
            // Try search endpoint as fallback
            try {
                const response = await fetch(`${this.baseUrl}/search?q=test&format=json`);
                return response.ok;
            } catch {
                return false;
            }
        }
    }

    getRateLimitInfo(): RateLimitInfo {
        return {
            requestsPerHour: this.baseUrl ? 3600 : 0, // Depends on instance
            remainingRequests: this.baseUrl ? 1000 : 0,
            authenticated: false
        };
    }

    async search(query: string, options: WebSearchOptions = {}): Promise<SearchResult[]> {
        if (!this.baseUrl) {
            logger.warn('SearXNG base URL not configured');
            return [];
        }

        try {
            const params = new URLSearchParams();
            params.append('q', query);
            params.append('format', 'json');
            params.append('language', 'en-US');
            
            const limit = Math.min(options.maxResults || 10, 50);

            if (options.safeSearch === 'strict') {
                params.append('safesearch', '2');
            } else if (options.safeSearch === 'off') {
                params.append('safesearch', '0');
            } else {
                params.append('safesearch', '1');
            }

            if (options.timeRange) {
                const timeRange: Record<string, string> = {
                    'day': 'day',
                    'week': 'week',
                    'month': 'month',
                    'year': 'year'
                };
                if (timeRange[options.timeRange]) {
                    params.append('time_range', timeRange[options.timeRange]);
                }
            }

            const response = await fetch(`${this.baseUrl}/search?${params.toString()}`, {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`SearXNG error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return this.parseResults(data, query, limit);
        } catch (error) {
            logger.error('SearXNG search error:', error);
            return [];
        }
    }

    private parseResults(data: any, query: string, limit: number): SearchResult[] {
        const results: SearchResult[] = [];
        const items = data.results || [];

        items.slice(0, limit).forEach((item: any, index: number) => {
            results.push({
                id: `searxng-${item.url || index}`,
                title: item.title,
                description: item.content,
                url: item.url,
                source: SearchSource.WEB_SEARXNG,
                relevanceScore: item.score ? item.score / 10 : (0.8 - index * 0.05),
                timestamp: item.publishedDate ? new Date(item.publishedDate) : new Date(),
                metadata: {
                    type: 'web',
                    engine: item.engine,
                    category: item.category,
                    positions: item.positions
                }
            });
        });

        return results;
    }
}

/**
 * Web Search Aggregator - tries multiple sources with fallback
 */
export class WebSearchAggregator implements SearchProvider {
    name = 'Web Search Aggregator';
    private providers: Map<string, SearchProvider> = new Map();
    private priority: string[] = ['duckduckgo', 'searxng', 'bing', 'google'];

    constructor() {
        this.providers.set('duckduckgo', new DuckDuckGoProvider());
        this.providers.set('bing', new BingSearchProvider());
        this.providers.set('google', new GoogleSearchProvider());
        this.providers.set('searxng', new SearxngProvider());
    }

    configureBing(config: BingSearchConfig): void {
        (this.providers.get('bing') as BingSearchProvider).configure(config);
    }

    configureGoogle(config: GoogleSearchConfig): void {
        (this.providers.get('google') as GoogleSearchProvider).configure(config);
    }

    configureSearxng(config: SearxngConfig): void {
        (this.providers.get('searxng') as SearxngProvider).configure(config);
    }

    setPriority(priority: string[]): void {
        this.priority = priority;
    }

    async isAvailable(): Promise<boolean> {
        for (const key of this.priority) {
            const provider = this.providers.get(key);
            if (provider && await provider.isAvailable()) {
                return true;
            }
        }
        return false;
    }

    getRateLimitInfo(): RateLimitInfo {
        // Return info for highest priority available provider
        for (const key of this.priority) {
            const provider = this.providers.get(key);
            if (provider) {
                const info = provider.getRateLimitInfo();
                if (info.remainingRequests > 0) {
                    return info;
                }
            }
        }
        return {
            requestsPerHour: 0,
            remainingRequests: 0,
            authenticated: false
        };
    }

    async search(query: string, options: WebSearchOptions = {}): Promise<SearchResult[]> {
        // Try specific source if requested
        if (options.source && this.providers.has(options.source)) {
            const provider = this.providers.get(options.source)!;
            if (await provider.isAvailable()) {
                return provider.search(query, options);
            }
        }

        // Try providers in priority order with fallback
        for (const key of this.priority) {
            const provider = this.providers.get(key);
            if (!provider) continue;

            try {
                if (await provider.isAvailable()) {
                    const results = await provider.search(query, options);
                    if (results.length > 0) {
                        logger.debug(`Web search using ${key}: ${results.length} results`);
                        return results;
                    }
                }
            } catch (error) {
                logger.warn(`Provider ${key} failed:`, error);
            }
        }

        logger.error('All web search providers failed');
        return [];
    }

    /**
     * Search with all available providers and merge results
     */
    async searchAll(query: string, options: WebSearchOptions = {}): Promise<SearchResult[]> {
        const allResults: SearchResult[] = [];
        const seenUrls = new Set<string>();

        for (const key of this.priority) {
            const provider = this.providers.get(key);
            if (!provider) continue;

            try {
                if (await provider.isAvailable()) {
                    const results = await provider.search(query, {
                        ...options,
                        maxResults: Math.ceil((options.maxResults || 10) / 2)
                    });

                    for (const result of results) {
                        const normalizedUrl = this.normalizeUrl(result.url);
                        if (!seenUrls.has(normalizedUrl)) {
                            seenUrls.add(normalizedUrl);
                            allResults.push(result);
                        }
                    }
                }
            } catch (error) {
                logger.warn(`Provider ${key} failed:`, error);
            }
        }

        // Sort by relevance
        allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return allResults.slice(0, options.maxResults || 10);
    }

    private normalizeUrl(url: string): string {
        return url
            .replace(/^https?:\/\//, '')
            .replace(/\/$/, '')
            .toLowerCase();
    }
}

// Export singleton instances
export const duckDuckGoSearch = new DuckDuckGoProvider();
export const bingSearch = new BingSearchProvider();
export const googleSearch = new GoogleSearchProvider();
export const searxngSearch = new SearxngProvider();
export const webSearch = new WebSearchAggregator();
