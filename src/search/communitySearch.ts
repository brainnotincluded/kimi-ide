/**
 * Community Search Module
 * Searches developer communities and forums
 * - Hacker News Algolia API (free)
 * - Reddit via Pushshift/Reddit API
 * - Stack Exchange API (free with rate limits)
 * - Discord (via bot API if available)
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

export interface CommunitySearchOptions extends SearchOptions {
    communities?: ('hackernews' | 'reddit' | 'stackoverflow' | 'discord')[];
    timeRange?: 'day' | 'week' | 'month' | 'year' | 'all';
}

// Hacker News types
export interface HNItem {
    objectID: string;
    title: string;
    url?: string;
    story_text?: string;
    author: string;
    created_at: string;
    points: number;
    num_comments: number;
    _tags: string[];
}

// Reddit types
export interface RedditPost {
    id: string;
    title: string;
    selftext: string;
    author: string;
    subreddit: string;
    url: string;
    permalink: string;
    created_utc: number;
    score: number;
    num_comments: number;
    is_self: boolean;
}

// Stack Exchange types
export interface SEQuestion {
    question_id: number;
    title: string;
    body: string;
    link: string;
    score: number;
    answer_count: number;
    view_count: number;
    creation_date: number;
    last_activity_date: number;
    tags: string[];
    owner: {
        display_name: string;
    };
    is_answered: boolean;
}

/**
 * Hacker News Search Provider (Algolia API)
 * Free, no authentication required
 */
export class HackerNewsProvider implements SearchProvider {
    name = 'Hacker News';
    private endpoint = 'https://hn.algolia.com/api/v1';
    private lastRequestTime = 0;
    private readonly minDelayMs = 100; // Be nice to the API

    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.endpoint}/search?query=test&tags=story`);
            return response.ok;
        } catch {
            return false;
        }
    }

    getRateLimitInfo(): RateLimitInfo {
        return {
            requestsPerHour: 36000, // Algolia allows generous limits
            remainingRequests: 10000,
            authenticated: false
        };
    }

    async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        const communityOptions = options as CommunitySearchOptions;
        await this.waitForRateLimit();

        try {
            const params = new URLSearchParams();
            params.append('query', query);
            params.append('tags', 'story');
            params.append('hitsPerPage', String(Math.min(options.maxResults || 20, 50)));

            // Date filtering
            if (communityOptions.timeRange && communityOptions.timeRange !== 'all') {
                const now = Math.floor(Date.now() / 1000);
                const seconds: Record<string, number> = {
                    'day': 86400,
                    'week': 604800,
                    'month': 2592000,
                    'year': 31536000
                };
                const timeRange = communityOptions.timeRange!;
                if (seconds[timeRange]) {
                    params.append('numericFilters', `created_at_i>${now - seconds[timeRange]}`);
                }
            }

            const response = await fetch(`${this.endpoint}/search?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`HN API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            return this.parseResults(data.hits as HNItem[], query);
        } catch (error) {
            logger.error('Hacker News search error:', error);
            return [];
        }
    }

    async searchComments(query: string, storyId?: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        await this.waitForRateLimit();

        try {
            const params = new URLSearchParams();
            params.append('query', query);
            params.append('tags', 'comment');
            if (storyId) {
                params.append('tags', `story_${storyId}`);
            }
            params.append('hitsPerPage', String(Math.min(options.maxResults || 20, 50)));

            const response = await fetch(`${this.endpoint}/search?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`HN API error: ${response.status}`);
            }

            const data = await response.json() as any;
            return this.parseCommentResults(data.hits as HNItem[], query);
        } catch (error) {
            logger.error('HN comments search error:', error);
            return [];
        }
    }

    async getTopStories(limit: number = 30): Promise<SearchResult[]> {
        await this.waitForRateLimit();

        try {
            const response = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
            const storyIds = await response.json() as number[];
            
            const topIds = storyIds.slice(0, limit);
            const stories: HNItem[] = [];

            for (const id of topIds) {
                await this.waitForRateLimit();
                const storyResponse = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
                const story = await storyResponse.json() as any;
                if (story && story.type === 'story') {
                    stories.push({
                        objectID: String(story.id),
                        title: story.title,
                        url: story.url,
                        author: story.by,
                        created_at: new Date(story.time * 1000).toISOString(),
                        points: story.score || 0,
                        num_comments: story.descendants || 0,
                        _tags: ['story']
                    });
                }
            }

            return this.parseResults(stories, '');
        } catch (error) {
            logger.error('HN top stories error:', error);
            return [];
        }
    }

    private parseResults(items: HNItem[], query: string): SearchResult[] {
        return items.map((item, index) => ({
            id: `hn-${item.objectID}`,
            title: item.title,
            description: item.story_text?.substring(0, 300) || `${item.points} points • ${item.num_comments} comments • by ${item.author}`,
            url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
            source: SearchSource.HACKERNEWS,
            relevanceScore: this.calculateScore(item, index),
            timestamp: new Date(item.created_at),
            metadata: {
                type: 'story',
                author: item.author,
                points: item.points,
                commentCount: item.num_comments,
                hnUrl: `https://news.ycombinator.com/item?id=${item.objectID}`
            }
        }));
    }

    private parseCommentResults(items: HNItem[], query: string): SearchResult[] {
        return items.map((item, index) => ({
            id: `hn-comment-${item.objectID}`,
            title: `Comment by ${item.author}`,
            description: item.story_text?.substring(0, 300) || '',
            url: `https://news.ycombinator.com/item?id=${item.objectID}`,
            source: SearchSource.HACKERNEWS,
            relevanceScore: this.calculateScore(item, index),
            timestamp: new Date(item.created_at),
            metadata: {
                type: 'comment',
                author: item.author,
                parentId: item._tags.find(t => t.startsWith('story_'))?.replace('story_', '')
            }
        }));
    }

    private calculateScore(item: HNItem, index: number): number {
        let score = 0.6 - (index * 0.02);
        
        // Engagement factors
        if (item.points > 0) {
            score += Math.min(item.points / 1000, 0.2);
        }
        if (item.num_comments > 0) {
            score += Math.min(item.num_comments / 200, 0.1);
        }

        return Math.min(score, 1.0);
    }

    private async waitForRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minDelayMs) {
            await new Promise(resolve => setTimeout(resolve, this.minDelayMs - timeSinceLastRequest));
        }

        this.lastRequestTime = Date.now();
    }
}

/**
 * Reddit Search Provider
 * Uses Reddit's JSON API (no auth needed for read-only)
 */
export class RedditProvider implements SearchProvider {
    name = 'Reddit';
    private endpoint = 'https://www.reddit.com';
    private userAgent = 'TrenchSearchBot/1.0 (by /u/trenchsearch)';

    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.endpoint}/r/programming.json?limit=1`, {
                headers: { 'User-Agent': this.userAgent }
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    getRateLimitInfo(): RateLimitInfo {
        return {
            requestsPerHour: 600, // Reddit allows 60 requests/minute
            remainingRequests: 300,
            authenticated: false
        };
    }

    async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        const communityOptions = options as CommunitySearchOptions;
        try {
            const params = new URLSearchParams();
            params.append('q', query);
            params.append('limit', String(Math.min(options.maxResults || 25, 100)));
            params.append('sort', options.sortBy === 'date' ? 'new' : options.sortBy === 'score' ? 'top' : 'relevance');
            params.append('type', 'link');

            // Time range
            if (communityOptions.timeRange) {
                const t: Record<string, string> = {
                    'day': 'day',
                    'week': 'week',
                    'month': 'month',
                    'year': 'year',
                    'all': 'all'
                };
                params.append('t', t[communityOptions.timeRange] || 'all');
            }

            const response = await fetch(`${this.endpoint}/search.json?${params.toString()}`, {
                headers: { 
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Reddit API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as any;
            return this.parseResults(data.data?.children || [], query);
        } catch (error) {
            logger.error('Reddit search error:', error);
            return [];
        }
    }

    async searchSubreddit(subreddit: string, query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        try {
            const params = new URLSearchParams();
            params.append('q', query);
            params.append('limit', String(Math.min(options.maxResults || 25, 100)));
            params.append('restrict_sr', '1');
            params.append('sort', 'relevance');

            const response = await fetch(`${this.endpoint}/r/${subreddit}/search.json?${params.toString()}`, {
                headers: { 
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Reddit API error: ${response.status}`);
            }

            const data = await response.json() as any;
            return this.parseResults(data.data?.children || [], query);
        } catch (error) {
            logger.error('Reddit subreddit search error:', error);
            return [];
        }
    }

    async getSubredditPosts(subreddit: string, sort: 'hot' | 'new' | 'top' = 'hot', limit: number = 25): Promise<SearchResult[]> {
        try {
            const response = await fetch(`${this.endpoint}/r/${subreddit}/${sort}.json?limit=${limit}`, {
                headers: { 
                    'User-Agent': this.userAgent,
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Reddit API error: ${response.status}`);
            }

            const data = await response.json();
            return this.parseResults(data.data?.children || [], '');
        } catch (error) {
            logger.error('Reddit subreddit posts error:', error);
            return [];
        }
    }

    private parseResults(children: Array<{ data: RedditPost }>): SearchResult[] {
        return children.map((child, index) => {
            const post = child.data;
            return {
                id: `reddit-${post.id}`,
                title: post.title,
                description: post.selftext?.substring(0, 300) || `r/${post.subreddit} • ${post.score} upvotes • ${post.num_comments} comments`,
                url: post.url.startsWith('/r/') ? `https://reddit.com${post.url}` : post.url,
                source: SearchSource.REDDIT,
                relevanceScore: this.calculateScore(post, index),
                timestamp: new Date(post.created_utc * 1000),
                metadata: {
                    type: post.is_self ? 'self' : 'link',
                    subreddit: post.subreddit,
                    author: post.author,
                    score: post.score,
                    commentCount: post.num_comments,
                    permalink: `https://reddit.com${post.permalink}`
                }
            };
        });
    }

    private calculateScore(post: RedditPost, index: number): number {
        let score = 0.6 - (index * 0.02);

        // Engagement
        if (post.score > 0) {
            score += Math.min(post.score / 5000, 0.2);
        }
        if (post.num_comments > 0) {
            score += Math.min(post.num_comments / 500, 0.1);
        }



        return Math.min(score, 1.0);
    }
}

/**
 * Stack Exchange Search Provider
 * Free API with rate limits (10000 requests/day for registered apps)
 */
export class StackExchangeProvider implements SearchProvider {
    name = 'Stack Exchange';
    private endpoint = 'https://api.stackexchange.com/2.3';
    private key: string | null = null;
    private defaultSite = 'stackoverflow';

    configure(key?: string): void {
        this.key = key || null;
    }

    async isAvailable(): Promise<boolean> {
        try {
            const response = await fetch(`${this.endpoint}/info?site=stackoverflow`);
            return response.ok;
        } catch {
            return false;
        }
    }

    getRateLimitInfo(): RateLimitInfo {
        return {
            requestsPerHour: this.key ? 10000 : 300, // 300 for unregistered
            remainingRequests: this.key ? 10000 : 100,
            authenticated: !!this.key
        };
    }

    async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        const communityOptions = options as CommunitySearchOptions;
        return this.searchSite(this.defaultSite, query, options);
    }

    async searchSite(site: string, query: string, options: CommunitySearchOptions = {}): Promise<SearchResult[]> {
        try {
            const params = new URLSearchParams();
            params.append('site', site);
            params.append('intitle', query);
            params.append('pagesize', String(Math.min(options.maxResults || 20, 100)));
            params.append('order', 'desc');
            params.append('sort', options.sortBy === 'date' ? 'creation' : 'relevance');
            params.append('filter', 'withbody'); // Include body in results

            if (this.key) {
                params.append('key', this.key);
            }

            const response = await fetch(`${this.endpoint}/search/advanced?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`Stack Exchange API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.error_message) {
                throw new Error(`Stack Exchange API error: ${data.error_message}`);
            }

            return this.parseResults(data.items as SEQuestion[], query, site);
        } catch (error) {
            logger.error('Stack Exchange search error:', error);
            return [];
        }
    }

    async searchByTag(site: string, tags: string[], options: SearchOptions = {}): Promise<SearchResult[]> {
        try {
            const params = new URLSearchParams();
            params.append('site', site);
            params.append('tagged', tags.join(';'));
            params.append('pagesize', String(Math.min(options.maxResults || 20, 100)));
            params.append('order', 'desc');
            params.append('sort', 'creation');

            if (this.key) {
                params.append('key', this.key);
            }

            const response = await fetch(`${this.endpoint}/questions?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`Stack Exchange API error: ${response.status}`);
            }

            const data = await response.json();
            return this.parseResults(data.items as SEQuestion[], '', site);
        } catch (error) {
            logger.error('Stack Exchange tag search error:', error);
            return [];
        }
    }

    async getUnanswered(site: string = 'stackoverflow', options: SearchOptions = {}): Promise<SearchResult[]> {
        try {
            const params = new URLSearchParams();
            params.append('site', site);
            params.append('pagesize', String(Math.min(options.maxResults || 20, 100)));
            params.append('order', 'desc');
            params.append('sort', 'creation');

            if (this.key) {
                params.append('key', this.key);
            }

            const response = await fetch(`${this.endpoint}/questions/unanswered?${params.toString()}`);

            if (!response.ok) {
                throw new Error(`Stack Exchange API error: ${response.status}`);
            }

            const data = await response.json();
            return this.parseResults(data.items as SEQuestion[], '', site);
        } catch (error) {
            logger.error('Stack Exchange unanswered error:', error);
            return [];
        }
    }

    private parseResults(items: SEQuestion[], site: string): SearchResult[] {
        // Remove HTML tags from body
        const stripHtml = (html: string): string => {
            return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        };

        return items.map((item, index) => ({
            id: `se-${site}-${item.question_id}`,
            title: item.title,
            description: stripHtml(item.body).substring(0, 300),
            url: item.link,
            source: SearchSource.STACKEXCHANGE,
            relevanceScore: this.calculateScore(item, query, index),
            timestamp: new Date(item.creation_date * 1000),
            metadata: {
                type: 'question',
                site,
                score: item.score,
                answerCount: item.answer_count,
                viewCount: item.view_count,
                tags: item.tags,
                isAnswered: item.is_answered,
                author: item.owner?.display_name
            }
        }));
    }

    private calculateScore(item: SEQuestion, index: number): number {
        let score = 0.6 - (index * 0.02);

        // Engagement
        if (item.score > 0) {
            score += Math.min(item.score / 100, 0.15);
        }
        if (item.answer_count > 0) {
            score += Math.min(item.answer_count / 10, 0.1);
        }
        if (item.is_answered) {
            score += 0.1;
        }



        return Math.min(score, 1.0);
    }
}

/**
 * Community Search Aggregator
 */
export class CommunitySearchAggregator implements SearchProvider {
    name = 'Community Search Aggregator';
    private providers: Map<string, SearchProvider> = new Map();

    constructor() {
        this.providers.set('hackernews', new HackerNewsProvider());
        this.providers.set('reddit', new RedditProvider());
        this.providers.set('stackoverflow', new StackExchangeProvider());
    }

    configureStackExchange(key: string): void {
        (this.providers.get('stackoverflow') as StackExchangeProvider).configure(key);
    }

    async isAvailable(): Promise<boolean> {
        for (const [, provider] of this.providers) {
            if (await provider.isAvailable()) {
                return true;
            }
        }
        return false;
    }

    getRateLimitInfo(): RateLimitInfo {
        let totalRemaining = 0;
        let maxRequests = 0;
        let authenticated = false;

        for (const [, provider] of this.providers) {
            const info = provider.getRateLimitInfo();
            totalRemaining += info.remainingRequests;
            maxRequests = Math.max(maxRequests, info.requestsPerHour);
            authenticated = authenticated || info.authenticated;
        }

        return {
            requestsPerHour: maxRequests,
            remainingRequests: totalRemaining,
            authenticated
        };
    }

    async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        const communityOptions = options as CommunitySearchOptions;
        const communities = options.communities || ['hackernews', 'reddit', 'stackoverflow'];
        const allResults: SearchResult[] = [];

        for (const community of communities) {
            const provider = this.providers.get(community);
            if (!provider) continue;

            try {
                if (await provider.isAvailable()) {
                    const results = await provider.search(query, options);
                    allResults.push(...results);
                }
            } catch (error) {
                logger.warn(`Community provider ${community} failed:`, error);
            }
        }

        // Sort by relevance
        allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return allResults.slice(0, options.maxResults || 30);
    }

    /**
     * Get trending topics across communities
     */
    async getTrending(community: 'hackernews' | 'reddit' | 'stackoverflow', subOptions?: string): Promise<SearchResult[]> {
        switch (community) {
            case 'hackernews':
                return (this.providers.get('hackernews') as HackerNewsProvider).getTopStories(30);
            case 'reddit':
                return (this.providers.get('reddit') as RedditProvider).getSubredditPosts(subOptions || 'programming', 'hot', 30);
            case 'stackoverflow':
                return (this.providers.get('stackoverflow') as StackExchangeProvider).getUnanswered('stackoverflow', { maxResults: 30 });
            default:
                return [];
        }
    }
}

// Export singleton instances
export const hackerNewsSearch = new HackerNewsProvider();
export const redditSearch = new RedditProvider();
export const stackExchangeSearch = new StackExchangeProvider();
export const communitySearch = new CommunitySearchAggregator();
