/**
 * GitHub Search Module
 * Uses GitHub REST API (free tier: 60 req/hour anonymous, 5000 req/hour authenticated)
 * Trench project - Free Search APIs Integration
 */

import { logger } from '../utils/logger';
import {
    SearchResult,
    SearchSource,
    SearchOptions,
    SearchFilters,
    CodePattern,
    SearchProvider,
    RateLimitInfo
} from './types';

// GitHub API base URL
const GITHUB_API_BASE = 'https://api.github.com';

// Rate limit tracking
interface GitHubRateLimit {
    limit: number;
    remaining: number;
    reset: number;
    used: number;
}

export interface GitHubSearchOptions extends SearchOptions {
    type?: 'repositories' | 'code' | 'issues' | 'pulls' | 'users' | 'topics';
    language?: string;
    sort?: 'stars' | 'forks' | 'updated' | 'best-match';
    order?: 'asc' | 'desc';
    stars?: string; // e.g., ">1000"
    created?: string; // e.g., ">2023-01-01"
    user?: string;
    org?: string;
    filename?: string;
    extension?: string;
}

export interface GitHubRepoResult {
    id: number;
    name: string;
    full_name: string;
    description: string | null;
    html_url: string;
    stargazers_count: number;
    forks_count: number;
    language: string | null;
    created_at: string;
    updated_at: string;
    topics: string[];
    owner: {
        login: string;
        avatar_url: string;
    };
}

export interface GitHubCodeResult {
    name: string;
    path: string;
    html_url: string;
    repository: {
        full_name: string;
        html_url: string;
    };
    text_matches?: Array<{
        fragment: string;
        matches: Array<{
            text: string;
            indices: number[];
        }>;
    }>;
}

export interface GitHubIssueResult {
    id: number;
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: string;
    created_at: string;
    updated_at: string;
    user: {
        login: string;
    };
    labels: Array<{
        name: string;
        color: string;
    }>;
    comments: number;
}

export class GitHubSearchProvider implements SearchProvider {
    name = 'GitHub';
    private token: string | undefined;
    private rateLimit: GitHubRateLimit = {
        limit: 60,
        remaining: 60,
        reset: 0,
        used: 0
    };

    constructor(token?: string) {
        this.token = token;
        if (token) {
            this.rateLimit.limit = 5000;
            this.rateLimit.remaining = 5000;
        }
    }

    /**
     * Set GitHub personal access token for higher rate limits
     */
    setToken(token: string): void {
        this.token = token;
        this.rateLimit.limit = 5000;
        this.rateLimit.remaining = 5000;
    }

    /**
     * Check if provider is available
     */
    async isAvailable(): Promise<boolean> {
        try {
            const response = await this.makeRequest('/rate_limit');
            return response.ok;
        } catch {
            return false;
        }
    }

    /**
     * Get current rate limit info
     */
    getRateLimitInfo(): RateLimitInfo {
        return {
            requestsPerHour: this.rateLimit.limit,
            remainingRequests: this.rateLimit.remaining,
            resetTime: new Date(this.rateLimit.reset * 1000),
            authenticated: !!this.token
        };
    }

    /**
     * Main search method
     */
    async search(query: string, options: GitHubSearchOptions = {}): Promise<SearchResult[]> {
        const searchType = options.type || 'repositories';
        
        try {
            switch (searchType) {
                case 'repositories':
                    return await this.searchRepositories(query, options);
                case 'code':
                    return await this.searchCode(query, options);
                case 'issues':
                    return await this.searchIssues(query, options);
                case 'pulls':
                    return await this.searchPullRequests(query, options);
                default:
                    return await this.searchRepositories(query, options);
            }
        } catch (error) {
            logger.error('GitHub search error:', error);
            return [];
        }
    }

    /**
     * Search repositories
     */
    async searchRepositories(query: string, options: GitHubSearchOptions = {}): Promise<SearchResult[]> {
        const searchParams = new URLSearchParams();
        searchParams.append('q', this.buildRepoQuery(query, options));
        searchParams.append('per_page', String(Math.min(options.maxResults || 30, 100)));
        searchParams.append('sort', options.sort || 'best-match');
        searchParams.append('order', options.order || 'desc');

        const response = await this.makeRequest(`/search/repositories?${searchParams.toString()}`);
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this.updateRateLimit(response);

        return (data.items as GitHubRepoResult[]).map(repo => ({
            id: `github-repo-${repo.id}`,
            title: repo.full_name,
            description: repo.description || `⭐ ${repo.stargazers_count} stars • ${repo.language || 'Unknown'}`,
            url: repo.html_url,
            source: SearchSource.GITHUB,
            relevanceScore: this.calculateRepoScore(repo),
            timestamp: new Date(repo.updated_at),
            metadata: {
                stars: repo.stargazers_count,
                forks: repo.forks_count,
                language: repo.language,
                topics: repo.topics,
                created_at: repo.created_at,
                type: 'repository'
            }
        }));
    }

    /**
     * Search code
     */
    async searchCode(query: string, options: GitHubSearchOptions = {}): Promise<SearchResult[]> {
        const searchParams = new URLSearchParams();
        searchParams.append('q', this.buildCodeQuery(query, options));
        searchParams.append('per_page', String(Math.min(options.maxResults || 30, 100)));

        const response = await this.makeRequest(`/search/code?${searchParams.toString()}`);
        
        if (!response.ok) {
            // Code search requires authentication
            if (response.status === 403 && !this.token) {
                logger.warn('GitHub code search requires authentication');
            }
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this.updateRateLimit(response);

        return (data.items as GitHubCodeResult[]).map(code => ({
            id: `github-code-${code.repository.full_name}-${code.path}`,
            title: `${code.repository.full_name}: ${code.name}`,
            description: code.text_matches?.[0]?.fragment?.substring(0, 200) || code.path,
            url: code.html_url,
            source: SearchSource.GITHUB,
            relevanceScore: 0.8,
            metadata: {
                path: code.path,
                repository: code.repository.full_name,
                type: 'code',
                matches: code.text_matches
            }
        }));
    }

    /**
     * Search issues
     */
    async searchIssues(query: string, options: GitHubSearchOptions = {}): Promise<SearchResult[]> {
        const searchParams = new URLSearchParams();
        searchParams.append('q', this.buildIssueQuery(query, options));
        searchParams.append('per_page', String(Math.min(options.maxResults || 30, 100)));
        searchParams.append('sort', 'updated');
        searchParams.append('order', 'desc');

        const response = await this.makeRequest(`/search/issues?${searchParams.toString()}`);
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this.updateRateLimit(response);

        return (data.items as GitHubIssueResult[]).map(issue => ({
            id: `github-issue-${issue.id}`,
            title: issue.title,
            description: issue.body?.substring(0, 300) || `State: ${issue.state} • Comments: ${issue.comments}`,
            url: issue.html_url,
            source: SearchSource.GITHUB,
            relevanceScore: issue.comments > 0 ? 0.7 + Math.min(issue.comments / 100, 0.2) : 0.6,
            timestamp: new Date(issue.updated_at),
            metadata: {
                state: issue.state,
                comments: issue.comments,
                labels: issue.labels.map(l => l.name),
                author: issue.user.login,
                number: issue.number,
                type: 'issue'
            }
        }));
    }

    /**
     * Search pull requests
     */
    async searchPullRequests(query: string, options: GitHubSearchOptions = {}): Promise<SearchResult[]> {
        // Pull requests are issues with type:pr
        return this.searchIssues(query, {
            ...options,
            filters: { ...options.filters }
        });
    }

    /**
     * Get repository contents
     */
    async getRepositoryContents(owner: string, repo: string, path: string = ''): Promise<unknown> {
        const response = await this.makeRequest(`/repos/${owner}/${repo}/contents/${path}`);
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        this.updateRateLimit(response);
        return response.json();
    }

    /**
     * Get file content (decoded)
     */
    async getFileContent(owner: string, repo: string, path: string): Promise<string> {
        const response = await this.makeRequest(`/repos/${owner}/${repo}/contents/${path}`);
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        this.updateRateLimit(response);

        if (data.content && data.encoding === 'base64') {
            return Buffer.from(data.content, 'base64').toString('utf-8');
        }

        return '';
    }

    /**
     * Extract code patterns from repository
     */
    async extractPatterns(owner: string, repo: string, language: string): Promise<CodePattern[]> {
        const patterns: CodePattern[] = [];
        
        try {
            // Get repository tree
            const treeResponse = await this.makeRequest(`/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`);
            if (!treeResponse.ok) return patterns;

            const tree = await treeResponse.json();
            const files = tree.tree.filter((item: { type: string; path: string }) => 
                item.type === 'blob' && this.isCodeFile(item.path, language)
            );

            // Sample files for pattern extraction (limit to avoid rate limits)
            const sampleFiles = files.slice(0, 10);

            for (const file of sampleFiles) {
                try {
                    const content = await this.getFileContent(owner, repo, file.path);
                    const filePatterns = this.analyzeCodePatterns(content, file.path, language);
                    patterns.push(...filePatterns);
                } catch (error) {
                    logger.debug(`Failed to analyze ${file.path}:`, error);
                }
            }
        } catch (error) {
            logger.error('Pattern extraction error:', error);
        }

        return patterns;
    }

    /**
     * Build repository search query
     */
    private buildRepoQuery(query: string, options: GitHubSearchOptions): string {
        const parts = [query];
        
        if (options.language) {
            parts.push(`language:${options.language}`);
        }
        if (options.stars) {
            parts.push(`stars:${options.stars}`);
        }
        if (options.created) {
            parts.push(`created:${options.created}`);
        }
        if (options.user) {
            parts.push(`user:${options.user}`);
        }
        if (options.org) {
            parts.push(`org:${options.org}`);
        }
        if (options.filename) {
            parts.push(`filename:${options.filename}`);
        }

        return parts.join(' ');
    }

    /**
     * Build code search query
     */
    private buildCodeQuery(query: string, options: GitHubSearchOptions): string {
        const parts = [query];
        
        if (options.language) {
            parts.push(`language:${options.language}`);
        }
        if (options.filename) {
            parts.push(`filename:${options.filename}`);
        }
        if (options.extension) {
            parts.push(`extension:${options.extension}`);
        }
        if (options.user) {
            parts.push(`user:${options.user}`);
        }
        if (options.org) {
            parts.push(`org:${options.org}`);
        }

        return parts.join(' ');
    }

    /**
     * Build issue search query
     */
    private buildIssueQuery(query: string, options: GitHubSearchOptions): string {
        const parts = [query];
        
        if (options.type === 'pulls') {
            parts.push('is:pr');
        } else {
            parts.push('is:issue');
        }
        if (options.language) {
            parts.push(`language:${options.language}`);
        }

        return parts.join(' ');
    }

    /**
     * Make authenticated request to GitHub API
     */
    private async makeRequest(endpoint: string): Promise<Response> {
        const url = `${GITHUB_API_BASE}${endpoint}`;
        const headers: Record<string, string> = {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Trench-Search/1.0'
        };

        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, { headers });
        
        // Update rate limit from headers
        const limit = response.headers.get('X-RateLimit-Limit');
        const remaining = response.headers.get('X-RateLimit-Remaining');
        const reset = response.headers.get('X-RateLimit-Reset');
        const used = response.headers.get('X-RateLimit-Used');

        if (limit) this.rateLimit.limit = parseInt(limit, 10);
        if (remaining) this.rateLimit.remaining = parseInt(remaining, 10);
        if (reset) this.rateLimit.reset = parseInt(reset, 10);
        if (used) this.rateLimit.used = parseInt(used, 10);

        return response;
    }

    /**
     * Update rate limit from response
     */
    private updateRateLimit(response: Response): void {
        const limit = response.headers.get('X-RateLimit-Limit');
        const remaining = response.headers.get('X-RateLimit-Remaining');
        
        if (limit) this.rateLimit.limit = parseInt(limit, 10);
        if (remaining) this.rateLimit.remaining = parseInt(remaining, 10);

        logger.debug('GitHub rate limit:', this.rateLimit);
    }

    /**
     * Calculate repository relevance score
     */
    private calculateRepoScore(repo: GitHubRepoResult): number {
        // Base score
        let score = 0.5;

        // Stars factor (logarithmic to avoid extreme bias)
        if (repo.stargazers_count > 0) {
            score += Math.min(Math.log10(repo.stargazers_count) / 10, 0.3);
        }

        // Recent activity bonus
        const daysSinceUpdate = (Date.now() - new Date(repo.updated_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate < 30) {
            score += 0.1;
        }

        // Has description bonus
        if (repo.description) {
            score += 0.05;
        }

        // Has topics bonus
        if (repo.topics && repo.topics.length > 0) {
            score += 0.05;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Check if file is a code file based on extension
     */
    private isCodeFile(path: string, language: string): boolean {
        const extensionMap: Record<string, string[]> = {
            'typescript': ['.ts', '.tsx'],
            'javascript': ['.js', '.jsx', '.mjs'],
            'python': ['.py'],
            'rust': ['.rs'],
            'go': ['.go'],
            'java': ['.java'],
            'c': ['.c', '.h'],
            'cpp': ['.cpp', '.hpp', '.cc'],
            'ruby': ['.rb'],
        };

        const extensions = extensionMap[language.toLowerCase()];
        if (!extensions) return true; // Include all if language not mapped

        return extensions.some(ext => path.toLowerCase().endsWith(ext));
    }

    /**
     * Analyze code for patterns
     */
    private analyzeCodePatterns(content: string, filepath: string, language: string): CodePattern[] {
        const patterns: CodePattern[] = [];
        const lines = content.split('\n');

        // Pattern: Function definitions
        const functionRegexes: Record<string, RegExp> = {
            'typescript': /^(export\s+)?(async\s+)?function\s+(\w+)|^(export\s+)?(async\s+)?(\w+)\s*\([^)]*\)\s*:/,
            'javascript': /^(export\s+)?(async\s+)?function\s+(\w+)|^(export\s+)?(const|let|var)\s+(\w+)\s*=\s*(async\s*)?\(/,
            'python': /^(async\s+)?def\s+(\w+)|^class\s+(\w+)/,
            'rust': /^(pub\s+)?(async\s+)?fn\s+(\w+)|^(pub\s+)?struct\s+(\w+)|^(pub\s+)?enum\s+(\w+)/,
            'go': /^func\s+(\([^)]*\)\s+)?(\w+)|^type\s+(\w+)\s+struct/,
        };

        const regex = functionRegexes[language.toLowerCase()];
        if (regex) {
            lines.forEach((line, index) => {
                const match = line.match(regex);
                if (match) {
                    patterns.push({
                        type: 'function_or_class',
                        name: match[3] || match[6] || match[2] || 'unknown',
                        content: line.trim(),
                        language,
                        lineStart: index + 1,
                        lineEnd: index + 1
                    });
                }
            });
        }

        // Pattern: Imports/Includes
        const importRegexes: Record<string, RegExp> = {
            'typescript': /^(import|export)\s+.+/,
            'javascript': /^(import|const\s+.*=\s*require)\s*.+/,
            'python': /^(import|from)\s+.+/,
            'rust': /^use\s+.+|^extern\s+crate\s+.+/
        };

        const importRegex = importRegexes[language.toLowerCase()];
        if (importRegex) {
            lines.forEach((line, index) => {
                if (importRegex.test(line)) {
                    patterns.push({
                        type: 'import',
                        name: line.trim().substring(0, 50),
                        content: line.trim(),
                        language,
                        lineStart: index + 1,
                        lineEnd: index + 1
                    });
                }
            });
        }

        return patterns;
    }
}

// Export singleton instance
export const githubSearch = new GitHubSearchProvider();
