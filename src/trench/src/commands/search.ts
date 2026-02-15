/**
 * Trench CLI - Search Command
 * Multi-source search aggregation
 */

import { CacheManager } from '../cache';
import type { SearchOptions, SearchResult, SearchSource } from '../types/index.js';

/**
 * Search across multiple sources
 */
export async function search(options: SearchOptions): Promise<SearchResult[]> {
  const sources = options.sources || ['web'];
  const results: SearchResult[] = [];
  
  // Check cache first
  const cacheKey = `search:${sources.join(',')}:${options.query}:${options.limit || 10}`;
  const cacheManager = getCacheManager();
  
  if (options.cache !== false && cacheManager) {
    const cached = cacheManager.get<SearchResult[]>(cacheKey);
    if (cached) {
      return cached.data;
    }
  }
  
  // Search each source
  const searchPromises = sources.map(source => searchSource(source, options));
  const sourceResults = await Promise.allSettled(searchPromises);
  
  for (const result of sourceResults) {
    if (result.status === 'fulfilled') {
      results.push(...result.value);
    }
  }
  
  // Sort by relevance and deduplicate
  const uniqueResults = deduplicateResults(results);
  const sortedResults = uniqueResults
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, options.limit || 10);
  
  // Cache results
  if (cacheManager) {
    cacheManager.set(cacheKey, sortedResults, 1800); // 30 min TTL
  }
  
  return sortedResults;
}

/**
 * Search specific source
 */
async function searchSource(source: SearchSource, options: SearchOptions): Promise<SearchResult[]> {
  switch (source) {
    case 'web':
    case 'duckduckgo':
      return searchDuckDuckGo(options);
    case 'bing':
      return searchBing(options);
    case 'brave':
      return searchBrave(options);
    case 'github':
      return searchGitHub(options);
    case 'arxiv':
      return searchArxiv(options);
    case 'hackernews':
      return searchHackerNews(options);
    case 'reddit':
      return searchReddit(options);
    case 'stackoverflow':
      return searchStackOverflow(options);
    default:
      return [];
  }
}

/**
 * DuckDuckGo search (no API key required)
 */
async function searchDuckDuckGo(options: SearchOptions): Promise<SearchResult[]> {
  try {
    // Using DuckDuckGo HTML scraping or instant answer API
    const query = encodeURIComponent(options.query);
    const response = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    const html = await response.text();
    
    // Parse results from HTML
    const results: SearchResult[] = [];
    const resultRegex = /<a rel="nofollow" class="result__a" href="([^"]+)">([^<]+)<\/a>.*?<a class="result__snippet"[^>]*>([^<]+)<\/a>/gs;
    
    let match;
    let count = 0;
    while ((match = resultRegex.exec(html)) !== null && count < (options.limit || 10)) {
      results.push({
        title: cleanHtml(match[2]),
        url: decodeURIComponent(match[1]),
        snippet: cleanHtml(match[3]),
        source: 'duckduckgo',
        relevanceScore: 1 - (count * 0.1),
      });
      count++;
    }
    
    return results;
  } catch (error) {
    console.warn('DuckDuckGo search error:', error);
    return [];
  }
}

/**
 * Bing search (requires API key)
 */
async function searchBing(options: SearchOptions): Promise<SearchResult[]> {
  const apiKey = process.env.TRENCH_BING_API_KEY;
  if (!apiKey) {
    console.warn('Bing API key not configured');
    return [];
  }
  
  try {
    const query = encodeURIComponent(options.query);
    const response = await fetch(
      `https://api.bing.microsoft.com/v7.0/search?q=${query}&count=${options.limit || 10}`,
      {
        headers: { 'Ocp-Apim-Subscription-Key': apiKey }
      }
    );
    
    const data = await response.json() as {
      webPages?: { value: Array<{ name: string; url: string; snippet: string }> }
    };
    
    return (data.webPages?.value || []).map((item, i) => ({
      title: item.name,
      url: item.url,
      snippet: item.snippet,
      source: 'bing',
      relevanceScore: 1 - (i * 0.1),
    }));
  } catch (error) {
    console.warn('Bing search error:', error);
    return [];
  }
}

/**
 * Brave search (requires API key)
 */
async function searchBrave(options: SearchOptions): Promise<SearchResult[]> {
  const apiKey = process.env.TRENCH_BRAVE_API_KEY;
  if (!apiKey) {
    console.warn('Brave API key not configured');
    return [];
  }
  
  try {
    const query = encodeURIComponent(options.query);
    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${query}&count=${options.limit || 10}`,
      {
        headers: { 
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json'
        }
      }
    );
    
    const data = await response.json() as {
      web?: { results: Array<{ title: string; url: string; description: string }> }
    };
    
    return (data.web?.results || []).map((item, i) => ({
      title: item.title,
      url: item.url,
      snippet: item.description,
      source: 'brave',
      relevanceScore: 1 - (i * 0.1),
    }));
  } catch (error) {
    console.warn('Brave search error:', error);
    return [];
  }
}

/**
 * GitHub search
 */
async function searchGitHub(options: SearchOptions): Promise<SearchResult[]> {
  const apiKey = process.env.TRENCH_GITHUB_API_KEY;
  
  try {
    const query = encodeURIComponent(options.query);
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };
    if (apiKey) headers['Authorization'] = `token ${apiKey}`;
    
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${query}&sort=stars&order=desc&per_page=${options.limit || 10}`,
      { headers }
    );
    
    const data = await response.json() as {
      items?: Array<{
        name: string;
        full_name: string;
        html_url: string;
        description: string | null;
        stargazers_count: number;
        language: string | null;
      }>
    };
    
    return (data.items || []).map((item, i) => ({
      title: item.full_name,
      url: item.html_url,
      snippet: `${item.description || 'No description'} ⭐ ${item.stargazers_count} | ${item.language || 'Unknown'}`,
      source: 'github',
      relevanceScore: 1 - (i * 0.1),
      metadata: {
        stars: item.stargazers_count,
        language: item.language,
      },
    }));
  } catch (error) {
    console.warn('GitHub search error:', error);
    return [];
  }
}

/**
 * arXiv search
 */
async function searchArxiv(options: SearchOptions): Promise<SearchResult[]> {
  try {
    const query = encodeURIComponent(options.query);
    const response = await fetch(
      `http://export.arxiv.org/api/query?search_query=all:${query}&start=0&max_results=${options.limit || 10}&sortBy=relevance&sortOrder=descending`
    );
    
    const xml = await response.text();
    
    // Parse XML
    const results: SearchResult[] = [];
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    let match;
    let count = 0;
    
    while ((match = entryRegex.exec(xml)) !== null && count < (options.limit || 10)) {
      const entry = match[1];
      const title = extractXmlTag(entry, 'title');
      const summary = extractXmlTag(entry, 'summary');
      const id = extractXmlTag(entry, 'id');
      
      if (title && id) {
        results.push({
          title: title.replace(/\n/g, ' ').trim(),
          url: id,
          snippet: summary?.substring(0, 200).replace(/\n/g, ' ') + '...' || '',
          source: 'arxiv',
          relevanceScore: 1 - (count * 0.1),
        });
        count++;
      }
    }
    
    return results;
  } catch (error) {
    console.warn('arXiv search error:', error);
    return [];
  }
}

/**
 * Hacker News search
 */
async function searchHackerNews(options: SearchOptions): Promise<SearchResult[]> {
  try {
    const query = encodeURIComponent(options.query);
    const response = await fetch(
      `https://hn.algolia.com/api/v1/search?query=${query}&tags=story&hitsPerPage=${options.limit || 10}`
    );
    
    const data = await response.json() as {
      hits?: Array<{
        title: string;
        url: string | null;
        objectID: string;
        points: number;
        num_comments: number;
        author: string;
      }>
    };
    
    return (data.hits || []).map((item, i) => ({
      title: item.title,
      url: item.url || `https://news.ycombinator.com/item?id=${item.objectID}`,
      snippet: `👤 ${item.author} | ⬆️ ${item.points} | 💬 ${item.num_comments} comments`,
      source: 'hackernews',
      relevanceScore: 1 - (i * 0.1),
      metadata: {
        points: item.points,
        comments: item.num_comments,
        author: item.author,
      },
    }));
  } catch (error) {
    console.warn('Hacker News search error:', error);
    return [];
  }
}

/**
 * Reddit search
 */
async function searchReddit(options: SearchOptions): Promise<SearchResult[]> {
  try {
    const query = encodeURIComponent(options.query);
    const response = await fetch(
      `https://www.reddit.com/search.json?q=${query}&sort=relevance&limit=${options.limit || 10}`,
      {
        headers: { 'User-Agent': 'TrenchCLI/1.0' }
      }
    );
    
    const data = await response.json() as {
      data?: {
        children: Array<{
          data: {
            title: string;
            permalink: string;
            selftext: string;
            score: number;
            num_comments: number;
            subreddit: string;
            author: string;
          }
        }>
      }
    };
    
    return (data.data?.children || []).map((item, i) => ({
      title: item.data.title,
      url: `https://reddit.com${item.data.permalink}`,
      snippet: `r/${item.data.subreddit} | 👤 ${item.data.author} | ⬆️ ${item.data.score} | 💬 ${item.data.num_comments} comments`,
      source: 'reddit',
      relevanceScore: 1 - (i * 0.1),
      metadata: {
        subreddit: item.data.subreddit,
        score: item.data.score,
        comments: item.data.num_comments,
      },
    }));
  } catch (error) {
    console.warn('Reddit search error:', error);
    return [];
  }
}

/**
 * Stack Overflow search
 */
async function searchStackOverflow(options: SearchOptions): Promise<SearchResult[]> {
  try {
    const query = encodeURIComponent(options.query);
    const response = await fetch(
      `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${query}&site=stackoverflow&pagesize=${options.limit || 10}`
    );
    
    const data = await response.json() as {
      items?: Array<{
        title: string;
        link: string;
        score: number;
        answer_count: number;
        is_answered: boolean;
        tags: string[];
      }>
    };
    
    return (data.items || []).map((item, i) => ({
      title: item.title,
      url: item.link,
      snippet: `Score: ${item.score} | Answers: ${item.answer_count} | Tags: ${item.tags.slice(0, 3).join(', ')}`,
      source: 'stackoverflow',
      relevanceScore: 1 - (i * 0.1),
      metadata: {
        score: item.score,
        answers: item.answer_count,
        tags: item.tags,
      },
    }));
  } catch (error) {
    console.warn('Stack Overflow search error:', error);
    return [];
  }
}

/**
 * Deduplicate results by URL
 */
function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter(result => {
    // Normalize URL for comparison
    const normalized = result.url.replace(/^(https?:\/\/)/, '').replace(/\/$/, '');
    if (seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

/**
 * Clean HTML entities
 */
function cleanHtml(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/<[^>]+>/g, '');
}

/**
 * Extract tag from XML
 */
function extractXmlTag(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const match = xml.match(regex);
  return match?.[1];
}

/**
 * Get cache manager
 */
function getCacheManager(): CacheManager | null {
  try {
    const { getCacheManager } = require('../cache');
    return getCacheManager();
  } catch {
    return null;
  }
}
