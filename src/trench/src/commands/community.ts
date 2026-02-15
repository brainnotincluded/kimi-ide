/**
 * Trench CLI - Community Search Command
 * Search Hacker News, Reddit, Dev.to, etc.
 */

import type { CommunitySearchOptions, CommunityResult, CommunitySource } from '../types/index.js';

/**
 * Search community discussions
 */
export async function communitySearch(options: CommunitySearchOptions): Promise<CommunityResult[]> {
  const results: CommunityResult[] = [];
  
  const searchPromises = options.sources.map(source => searchCommunitySource(source, options));
  const sourceResults = await Promise.allSettled(searchPromises);
  
  for (const result of sourceResults) {
    if (result.status === 'fulfilled') {
      results.push(...result.value);
    }
  }
  
  // Sort results
  const sorted = results.sort((a, b) => {
    if (options.sortBy === 'score') {
      return b.score - a.score;
    }
    if (options.sortBy === 'date') {
      return b.postedAt.getTime() - a.postedAt.getTime();
    }
    return 0;
  });
  
  // Filter by score if specified
  if (options.minScore !== undefined) {
    return sorted.filter(r => r.score >= options.minScore!);
  }
  
  return sorted;
}

/**
 * Search specific community source
 */
async function searchCommunitySource(
  source: CommunitySource,
  options: CommunitySearchOptions
): Promise<CommunityResult[]> {
  switch (source) {
    case 'hn':
      return searchHackerNews(options);
    case 'reddit':
      return searchReddit(options);
    case 'lobsters':
      return searchLobsters(options);
    case 'devto':
      return searchDevTo(options);
    case 'twitter':
      return searchTwitter(options);
    default:
      return [];
  }
}

/**
 * Search Hacker News
 */
async function searchHackerNews(options: CommunitySearchOptions): Promise<CommunityResult[]> {
  const timeFilter = getHNTimeFilter(options.timeRange);
  const numericFilters = timeFilter ? `&numericFilters=${timeFilter}` : '';
  
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(options.query)}${numericFilters}&tags=story&hitsPerPage=30`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Hacker News API error: ${response.status}`);
  }
  
  const data = await response.json() as {
    hits: Array<{
      title: string;
      url?: string;
      story_text?: string;
      author: string;
      created_at: string;
      points: number;
      num_comments: number;
      objectID: string;
    }>
  };
  
  return (data.hits || []).map(item => ({
    title: item.title,
    content: item.story_text || '',
    author: item.author,
    url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
    source: 'hn',
    score: item.points,
    commentCount: item.num_comments,
    postedAt: new Date(item.created_at),
  }));
}

/**
 * Get HN time filter
 */
function getHNTimeFilter(range: CommunitySearchOptions['timeRange']): string {
  const now = Math.floor(Date.now() / 1000);
  
  switch (range) {
    case 'day':
      return `created_at_i>${now - 86400}`;
    case 'week':
      return `created_at_i>${now - 604800}`;
    case 'month':
      return `created_at_i>${now - 2592000}`;
    case 'year':
      return `created_at_i>${now - 31536000}`;
    default:
      return '';
  }
}

/**
 * Search Reddit
 */
async function searchReddit(options: CommunitySearchOptions): Promise<CommunityResult[]> {
  const timeParam = getRedditTimeFilter(options.timeRange);
  const sort = options.sortBy === 'score' ? 'top' : 'relevance';
  
  const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(options.query)}&sort=${sort}&t=${timeParam}&limit=25`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'TrenchCLI/1.0 (by /u/trenchcli)'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Reddit API error: ${response.status}`);
  }
  
  const data = await response.json() as {
    data?: {
      children: Array<{
        data: {
          title: string;
          selftext: string;
          author: string;
          permalink: string;
          score: number;
          num_comments: number;
          created_utc: number;
          subreddit: string;
          url: string;
        }
      }>
    }
  };
  
  return (data.data?.children || []).map(item => ({
    title: item.data.title,
    content: item.data.selftext,
    author: item.data.author,
    url: item.data.url.startsWith('/r/') ? `https://reddit.com${item.data.url}` : `https://reddit.com${item.data.permalink}`,
    source: 'reddit',
    score: item.data.score,
    commentCount: item.data.num_comments,
    postedAt: new Date(item.data.created_utc * 1000),
  }));
}

/**
 * Get Reddit time filter
 */
function getRedditTimeFilter(range: CommunitySearchOptions['timeRange']): string {
  switch (range) {
    case 'day':
      return 'day';
    case 'week':
      return 'week';
    case 'month':
      return 'month';
    case 'year':
      return 'year';
    default:
      return 'all';
  }
}

/**
 * Search Lobsters
 */
async function searchLobsters(options: CommunitySearchOptions): Promise<CommunityResult[]> {
  // Lobsters doesn't have a public search API
  // Return empty for now
  return [];
}

/**
 * Search Dev.to
 */
async function searchDevTo(options: CommunitySearchOptions): Promise<CommunityResult[]> {
  const url = `https://dev.to/api/articles?tag=${encodeURIComponent(options.query)}&per_page=30`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Dev.to API error: ${response.status}`);
  }
  
  const data = await response.json() as Array<{
    title: string;
    description: string;
    user: { username: string };
    url: string;
    positive_reactions_count: number;
    comments_count: number;
    published_at: string;
    tags: string[];
  }>;
  
  return data.map(item => ({
    title: item.title,
    content: item.description,
    author: item.user.username,
    url: item.url,
    source: 'devto',
    score: item.positive_reactions_count,
    commentCount: item.comments_count,
    postedAt: new Date(item.published_at),
  }));
}

/**
 * Search Twitter/X
 */
async function searchTwitter(options: CommunitySearchOptions): Promise<CommunityResult[]> {
  // Twitter/X API requires authentication
  // Return empty for now - would need API v2 integration
  const apiKey = process.env.TRENCH_TWITTER_API_KEY;
  
  if (!apiKey) {
    console.warn('Twitter API key not configured');
    return [];
  }
  
  // Would implement Twitter API v2 search here
  return [];
}

/**
 * Get trending discussions
 */
export async function getTrendingDiscussions(
  sources: CommunitySource[] = ['hn', 'reddit'],
  timeRange: CommunitySearchOptions['timeRange'] = 'day'
): Promise<CommunityResult[]> {
  const allResults: CommunityResult[] = [];
  
  for (const source of sources) {
    try {
      const results = await searchCommunitySource(source, {
        query: '',
        sources: [source],
        timeRange,
        sortBy: 'score',
      });
      allResults.push(...results);
    } catch (error) {
      console.warn(`Failed to get trending from ${source}:`, error);
    }
  }
  
  return allResults
    .sort((a, b) => b.score - a.score)
    .slice(0, 50);
}

/**
 * Get comments for a post
 */
export async function getComments(
  url: string,
  source: CommunitySource
): Promise<Array<{ author: string; content: string; score: number }>> {
  switch (source) {
    case 'hn':
      return getHNComments(url);
    case 'reddit':
      return getRedditComments(url);
    default:
      return [];
  }
}

/**
 * Get HN comments
 */
async function getHNComments(url: string): Promise<Array<{ author: string; content: string; score: number }>> {
  // Extract item ID from URL
  const match = url.match(/id=(\d+)/);
  if (!match) return [];
  
  const itemId = match[1];
  const apiUrl = `https://hn.algolia.com/api/v1/items/${itemId}`;
  
  const response = await fetch(apiUrl);
  const data = await response.json() as {
    children?: Array<{
      author: string;
      text: string;
      points?: number;
    }>
  };
  
  return (data.children || []).map(child => ({
    author: child.author,
    content: child.text || '',
    score: child.points || 0,
  }));
}

/**
 * Get Reddit comments
 */
async function getRedditComments(url: string): Promise<Array<{ author: string; content: string; score: number }>> {
  // Convert to JSON endpoint
  const jsonUrl = url.replace(/\/?$/, '.json');
  
  const response = await fetch(jsonUrl, {
    headers: {
      'User-Agent': 'TrenchCLI/1.0'
    }
  });
  
  const data = await response.json() as [unknown, { data?: { children: Array<{ data: { author: string; body: string; score: number } }> } }];
  
  const comments = data[1]?.data?.children || [];
  
  return comments.map(child => ({
    author: child.data.author,
    content: child.data.body,
    score: child.data.score,
  }));
}
