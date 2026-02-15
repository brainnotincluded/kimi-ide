/**
 * arXiv Search Module
 * Uses arXiv API (completely free, no authentication required)
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

// arXiv API base URL
const ARXIV_API_BASE = 'http://export.arxiv.org/api';

export interface ArxivSearchOptions extends SearchOptions {
    searchField?: 'all' | 'title' | 'author' | 'abstract' | 'comment' | 'journal_reference' | 'subject_category' | 'report_number' | 'id_list';
    sortOrder?: 'ascending' | 'descending';
    startDate?: Date;
    endDate?: Date;
    categories?: string[]; // e.g., ['cs.AI', 'cs.LG', 'math.NT']
}

export interface ArxivEntry {
    id: string;
    title: string;
    summary: string;
    authors: string[];
    published: string;
    updated: string;
    categories: string[];
    primaryCategory: string;
    doi?: string;
    journalRef?: string;
    comment?: string;
    links: Array<{
        href: string;
        type: string;
        title?: string;
    }>;
    pdfUrl?: string;
}

export interface ArxivCitations {
    paperId: string;
    citations: Array<{
        paperId: string;
        title: string;
        authors: string[];
        year: number;
    }>;
    references: Array<{
        paperId: string;
        title: string;
        authors: string[];
        year: number;
    }>;
}

export class ArxivSearchProvider implements SearchProvider {
    name = 'arXiv';
    private lastRequestTime = 0;
    private readonly minDelayMs = 3000; // arXiv recommends 3 seconds between requests

    /**
     * Check if provider is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            // Simple query to check availability
            await this.waitForRateLimit();
            const response = await fetch(`${ARXIV_API_BASE}/query?search_query=all:test&max_results=1`, {
                method: 'GET'
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get rate limit info (arXiv doesn't have strict rate limits but recommends courtesy delays)
     */
    getRateLimitInfo(): RateLimitInfo {
        return {
            requestsPerHour: 1200, // Based on 3 second delay
            remainingRequests: 1000, // Effectively unlimited with proper delays
            authenticated: false
        };
    }

    /**
     * Main search method
     */
    async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        const arxivOptions = options as ArxivSearchOptions;
        await this.waitForRateLimit();

        try {
            const searchParams = this.buildSearchParams(query, arxivOptions);
            const url = `${ARXIV_API_BASE}/query?${searchParams.toString()}`;

            logger.debug('arXiv search URL:', url);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/atom+xml'
                }
            });

            if (!response.ok) {
                throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
            }

            const xmlText = await response.text();
            const entries = this.parseAtomFeed(xmlText);

            return entries.map(entry => ({
                id: entry.id,
                title: this.cleanText(entry.title),
                description: this.truncateText(this.cleanText(entry.summary), 500),
                url: entry.id,
                source: SearchSource.ARXIV,
                relevanceScore: this.calculateRelevanceScore(entry, query),
                timestamp: new Date(entry.published),
                metadata: {
                    authors: entry.authors,
                    categories: entry.categories,
                    primaryCategory: entry.primaryCategory,
                    published: entry.published,
                    updated: entry.updated,
                    pdfUrl: entry.pdfUrl,
                    doi: entry.doi,
                    journalRef: entry.journalRef,
                    comment: entry.comment,
                    type: 'paper'
                }
            }));
        } catch (error) {
            logger.error('arXiv search error:', error);
            return [];
        }
    }

    /**
     * Search by arXiv ID
     */
    async searchById(id: string): Promise<ArxivEntry | null> {
        await this.waitForRateLimit();

        try {
            // Normalize ID (remove version if present)
            const normalizedId = id.replace(/v\d+$/, '');
            const url = `${ARXIV_API_BASE}/query?id_list=${normalizedId}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`arXiv API error: ${response.status}`);
            }

            const xmlText = await response.text();
            const entries = this.parseAtomFeed(xmlText);

            return entries[0] || null;
        } catch (error) {
            logger.error('arXiv ID search error:', error);
            return null;
        }
    }

    /**
     * Download PDF by arXiv ID
     * Returns the PDF URL (actual download would be handled by caller)
     */
    getPdfUrl(id: string): string {
        // Normalize ID
        const normalizedId = id.replace(/^https?:\/\/arxiv\.org\/abs\//, '').replace(/v\d+$/, '');
        return `https://arxiv.org/pdf/${normalizedId}.pdf`;
    }

    /**
     * Fetch paper categories
     */
    async getCategories(): Promise<Array<{ name: string; description: string }>> {
        // arXiv categories are static, return common ones
        return [
            { name: 'cs.AI', description: 'Artificial Intelligence' },
            { name: 'cs.CL', description: 'Computation and Language (NLP)' },
            { name: 'cs.CV', description: 'Computer Vision' },
            { name: 'cs.LG', description: 'Machine Learning' },
            { name: 'cs.RO', description: 'Robotics' },
            { name: 'cs.SE', description: 'Software Engineering' },
            { name: 'cs.DB', description: 'Databases' },
            { name: 'cs.DC', description: 'Distributed Computing' },
            { name: 'cs.NI', description: 'Networking and Internet Architecture' },
            { name: 'cs.OS', description: 'Operating Systems' },
            { name: 'cs.PL', description: 'Programming Languages' },
            { name: 'cs.AR', description: 'Hardware Architecture' },
            { name: 'cs.CR', description: 'Cryptography and Security' },
            { name: 'cs.DS', description: 'Data Structures and Algorithms' },
            { name: 'cs.GT', description: 'Game Theory' },
            { name: 'cs.HC', description: 'Human-Computer Interaction' },
            { name: 'cs.IR', description: 'Information Retrieval' },
            { name: 'cs.IT', description: 'Information Theory' },
            { name: 'cs.MA', description: 'Multiagent Systems' },
            { name: 'cs.MM', description: 'Multimedia' },
            { name: 'cs.NE', description: 'Neural and Evolutionary Computing' },
            { name: 'cs.NI', description: 'Networking and Internet Architecture' },
            { name: 'cs.PF', description: 'Performance' },
            { name: 'cs.SC', description: 'Symbolic Computation' },
            { name: 'math.NT', description: 'Number Theory' },
            { name: 'math.CO', description: 'Combinatorics' },
            { name: 'math.ST', description: 'Statistics' },
            { name: 'physics.comp-ph', description: 'Computational Physics' },
            { name: 'q-bio.QM', description: 'Quantitative Methods' },
            { name: 'q-fin.ST', description: 'Statistical Finance' },
            { name: 'stat.ML', description: 'Machine Learning (Statistics)' },
        ];
    }

    /**
     * Search by category
     */
    async searchByCategory(category: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        const arxivOptions: ArxivSearchOptions = {
            ...options,
            searchField: 'subject_category'
        };
        return this.search(`cat:${category}`, arxivOptions);
    }

    /**
     * Search by author
     */
    async searchByAuthor(author: string, options: SearchOptions = {}): Promise<SearchResult[]> {
        const arxivOptions: ArxivSearchOptions = {
            ...options,
            searchField: 'author'
        };
        return this.search(author, arxivOptions);
    }

    /**
     * Get recent papers in a category
     */
    async getRecentPapers(category: string, maxResults: number = 10): Promise<SearchResult[]> {
        const twoWeeksAgo = new Date();
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

        return this.search(`cat:${category}`, {
            maxResults,
            startDate: twoWeeksAgo,
            sortBy: 'submittedDate' as any,
            sortOrder: 'descending'
        });
    }

    /**
     * Build search parameters
     */
    private buildSearchParams(query: string, options: ArxivSearchOptions): URLSearchParams {
        const params = new URLSearchParams();

        // Build search query
        const searchField = options.searchField || 'all';
        params.append('search_query', `${searchField}:${query}`);

        // Add category filters
        if (options.categories && options.categories.length > 0) {
            const categoryQuery = options.categories.map(cat => `cat:${cat}`).join('+OR+');
            params.set('search_query', `${params.get('search_query')}+AND+(${categoryQuery})`);
        }

        // Add date range
        if (options.startDate) {
            const dateStr = options.startDate.toISOString().split('T')[0];
            params.set('search_query', `${params.get('search_query')}+AND+submittedDate:[${dateStr}+TO+*]`);
        }

        // Pagination
        params.append('start', '0');
        params.append('max_results', String(Math.min(options.maxResults || 10, 100)));

        // Sorting
        params.append('sortBy', options.sortBy || 'relevance');
        params.append('sortOrder', options.sortOrder || 'descending');

        return params;
    }

    /**
     * Parse Atom feed XML
     */
    private parseAtomFeed(xmlText: string): ArxivEntry[] {
        const entries: ArxivEntry[] = [];
        
        // Simple XML parsing using regex (for lightweight usage)
        // For production, consider using a proper XML parser like fast-xml-parser
        const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
        let match;

        while ((match = entryRegex.exec(xmlText)) !== null) {
            const entryXml = match[1];
            
            try {
                const entry = this.parseEntry(entryXml);
                entries.push(entry);
            } catch (error) {
                logger.debug('Failed to parse entry:', error);
            }
        }

        return entries;
    }

    /**
     * Parse individual entry
     */
    private parseEntry(entryXml: string): ArxivEntry {
        // Extract ID
        const idMatch = entryXml.match(/<id>([^<]+)<\/id>/);
        const id = idMatch ? idMatch[1] : '';

        // Extract title
        const titleMatch = entryXml.match(/<title>([\s\S]*?)<\/title>/);
        const title = titleMatch ? this.cleanText(titleMatch[1]) : '';

        // Extract summary
        const summaryMatch = entryXml.match(/<summary>([\s\S]*?)<\/summary>/);
        const summary = summaryMatch ? this.cleanText(summaryMatch[1]) : '';

        // Extract authors
        const authorMatches = entryXml.match(/<author>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<\/author>/g);
        const authors = authorMatches ? authorMatches.map(a => {
            const nameMatch = a.match(/<name>([^<]+)<\/name>/);
            return nameMatch ? this.cleanText(nameMatch[1]) : '';
        }) : [];

        // Extract published date
        const publishedMatch = entryXml.match(/<published>([^<]+)<\/published>/);
        const published = publishedMatch ? publishedMatch[1] : '';

        // Extract updated date
        const updatedMatch = entryXml.match(/<updated>([^<]+)<\/updated>/);
        const updated = updatedMatch ? updatedMatch[1] : published;

        // Extract categories
        const categoryMatches = entryXml.match(/<category term="([^"]+)"/g);
        const categories = categoryMatches ? categoryMatches.map(c => {
            const termMatch = c.match(/term="([^"]+)"/);
            return termMatch ? termMatch[1] : '';
        }) : [];

        // Primary category
        const primaryCategoryMatch = entryXml.match(/<arxiv:primary_category xmlns:arxiv="http:\/\/arxiv.org\/schemas\/atom" term="([^"]+)"/);
        const primaryCategory = primaryCategoryMatch ? primaryCategoryMatch[1] : (categories[0] || '');

        // Extract DOI
        const doiMatch = entryXml.match(/<arxiv:doi xmlns:arxiv="http:\/\/arxiv.org\/schemas\/atom">([^<]+)<\/arxiv:doi>/);
        const doi = doiMatch ? doiMatch[1] : undefined;

        // Extract journal reference
        const journalRefMatch = entryXml.match(/<arxiv:journal_ref xmlns:arxiv="http:\/\/arxiv.org\/schemas\/atom">([^<]+)<\/arxiv:journal_ref>/);
        const journalRef = journalRefMatch ? this.cleanText(journalRefMatch[1]) : undefined;

        // Extract comment
        const commentMatch = entryXml.match(/<arxiv:comment xmlns:arxiv="http:\/\/arxiv.org\/schemas\/atom">([^<]+)<\/arxiv:comment>/);
        const comment = commentMatch ? this.cleanText(commentMatch[1]) : undefined;

        // Extract links
        const linkMatches = entryXml.match(/<link[^>]+>/g);
        const links: ArxivEntry['links'] = [];
        let pdfUrl: string | undefined;

        if (linkMatches) {
            for (const link of linkMatches) {
                const hrefMatch = link.match(/href="([^"]+)"/);
                const typeMatch = link.match(/type="([^"]+)"/);
                const titleMatch = link.match(/title="([^"]+)"/);
                const relMatch = link.match(/rel="([^"]+)"/);

                if (hrefMatch) {
                    const href = hrefMatch[1];
                    const type = typeMatch ? typeMatch[1] : 'text/html';
                    const title = titleMatch ? titleMatch[1] : undefined;

                    links.push({ href, type, title });

                    // Find PDF link
                    if (type === 'application/pdf' || href.includes('.pdf')) {
                        pdfUrl = href;
                    }
                    if (relMatch && relMatch[1] === 'alternate' && href.includes('/pdf/')) {
                        pdfUrl = href;
                    }
                }
            }
        }

        // Construct PDF URL if not found in links
        if (!pdfUrl && id) {
            const arxivId = id.replace(/https?:\/\/arxiv\.org\/abs\//, '');
            pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
        }

        return {
            id,
            title,
            summary,
            authors,
            published,
            updated,
            categories,
            primaryCategory,
            doi,
            journalRef,
            comment,
            links,
            pdfUrl
        };
    }

    /**
     * Clean text (remove extra whitespace, newlines)
     */
    private cleanText(text: string): string {
        return text
            .replace(/\s+/g, ' ')
            .replace(/^\s+|\s+$/g, '');
    }

    /**
     * Truncate text to specified length
     */
    private truncateText(text: string, maxLength: number): string {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    /**
     * Calculate relevance score
     */
    private calculateRelevanceScore(entry: ArxivEntry, query: string): number {
        const queryLower = query.toLowerCase();
        const titleLower = entry.title.toLowerCase();
        const summaryLower = entry.summary.toLowerCase();

        let score = 0.5;

        // Title match is more important
        if (titleLower.includes(queryLower)) {
            score += 0.3;
            // Exact title match
            if (titleLower === queryLower) {
                score += 0.1;
            }
        }

        // Summary match
        if (summaryLower.includes(queryLower)) {
            score += 0.1;
        }

        // Recent papers get a slight boost
        const daysSincePublished = (Date.now() - new Date(entry.published).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSincePublished < 365) {
            score += 0.05;
        }

        // Has DOI/journal reference indicates peer-reviewed
        if (entry.doi || entry.journalRef) {
            score += 0.05;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Wait for rate limit (courtesy delay)
     */
    private async waitForRateLimit(): Promise<void> {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minDelayMs) {
            const delay = this.minDelayMs - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.lastRequestTime = Date.now();
    }
}

// Export singleton instance
export const arxivSearch = new ArxivSearchProvider();
