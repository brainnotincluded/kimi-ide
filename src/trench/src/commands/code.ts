/**
 * Trench CLI - Code Search Command
 * GitHub code search with filters
 */

import type { CodeSearchOptions, CodeSearchResult, Repository, CodeFile, CodeMatch } from '../types/index.js';

/**
 * Search code on GitHub
 */
export async function codeSearch(options: CodeSearchOptions): Promise<CodeSearchResult[]> {
  const apiKey = process.env.TRENCH_GITHUB_API_KEY;
  
  // Build GitHub search query
  const query = buildSearchQuery(options);
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'TrenchCLI/1.0',
  };
  
  if (apiKey) {
    headers['Authorization'] = `token ${apiKey}`;
  }
  
  try {
    const response = await fetch(
      `https://api.github.com/search/code?q=${encodeURIComponent(query)}&sort=${options.sortBy}&order=${options.order}&per_page=30`,
      { headers }
    );
    
    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('GitHub API rate limit exceeded. Set TRENCH_GITHUB_API_KEY for higher limits.');
      }
      throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const data = await response.json() as {
      items: Array<{
        name: string;
        path: string;
        html_url: string;
        repository: {
          full_name: string;
          html_url: string;
          description: string | null;
          stargazers_count: number;
          forks_count: number;
          language: string | null;
          updated_at: string;
        };
        text_matches?: Array<{
          fragment: string;
          matches: Array<{ text: string }>;
        }>;
      }>
    };
    
    return (data.items || []).map((item, index) => {
      const repo: Repository = {
        name: item.repository.full_name.split('/')[1],
        owner: item.repository.full_name.split('/')[0],
        url: item.repository.html_url,
        stars: item.repository.stargazers_count,
        forks: item.repository.forks_count,
        language: item.repository.language || 'Unknown',
        description: item.repository.description || '',
        updatedAt: new Date(item.repository.updated_at),
      };
      
      const file: CodeFile = {
        path: item.path,
        url: item.html_url,
        language: detectLanguage(item.name),
        size: 0, // Would need separate API call
      };
      
      const matches: CodeMatch[] = (item.text_matches || []).map((match, i) => ({
        lineNumber: extractLineNumber(match.fragment, i),
        content: match.fragment,
        context: match.matches.map(m => m.text),
      }));
      
      return {
        repository: repo,
        file,
        matches,
        relevance: 1 - (index * 0.03),
      };
    });
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to search GitHub code');
  }
}

/**
 * Build GitHub search query
 */
function buildSearchQuery(options: CodeSearchOptions): string {
  const parts: string[] = [options.query];
  
  if (options.language) {
    parts.push(`language:${options.language}`);
  }
  
  if (options.minStars !== undefined) {
    parts.push(`stars:>=${options.minStars}`);
  }
  
  if (options.maxStars !== undefined) {
    parts.push(`stars:<=${options.maxStars}`);
  }
  
  if (options.createdAfter) {
    const date = options.createdAfter.toISOString().split('T')[0];
    parts.push(`created:>=${date}`);
  }
  
  if (options.updatedAfter) {
    const date = options.updatedAfter.toISOString().split('T')[0];
    parts.push(`pushed:>=${date}`);
  }
  
  return parts.join(' ');
}

/**
 * Detect programming language from filename
 */
function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  const langMap: Record<string, string> = {
    'js': 'JavaScript',
    'ts': 'TypeScript',
    'jsx': 'JSX',
    'tsx': 'TSX',
    'py': 'Python',
    'rb': 'Ruby',
    'go': 'Go',
    'rs': 'Rust',
    'java': 'Java',
    'kt': 'Kotlin',
    'scala': 'Scala',
    'c': 'C',
    'cpp': 'C++',
    'cc': 'C++',
    'h': 'C/C++',
    'hpp': 'C++',
    'cs': 'C#',
    'php': 'PHP',
    'swift': 'Swift',
    'm': 'Objective-C',
    'r': 'R',
    'jl': 'Julia',
    'ex': 'Elixir',
    'exs': 'Elixir',
    'elm': 'Elm',
    'hs': 'Haskell',
    'lua': 'Lua',
    'vim': 'Vim Script',
    'sh': 'Shell',
    'bash': 'Shell',
    'zsh': 'Shell',
    'fish': 'Shell',
    'ps1': 'PowerShell',
    'sql': 'SQL',
    'md': 'Markdown',
    'json': 'JSON',
    'yaml': 'YAML',
    'yml': 'YAML',
    'toml': 'TOML',
    'xml': 'XML',
    'html': 'HTML',
    'css': 'CSS',
    'scss': 'SCSS',
    'sass': 'Sass',
    'less': 'Less',
    'dockerfile': 'Dockerfile',
    'tf': 'Terraform',
    'hcl': 'HCL',
  };
  
  return ext ? (langMap[ext] || ext.toUpperCase()) : 'Unknown';
}

/**
 * Extract line number from fragment
 */
function extractLineNumber(fragment: string, index: number): number {
  // GitHub doesn't provide exact line numbers in search results
  // Return a placeholder based on index
  return (index + 1) * 10;
}

/**
 * Search repositories
 */
export async function searchRepositories(
  query: string,
  options: {
    language?: string;
    minStars?: number;
    sort?: 'stars' | 'updated' | 'relevance';
  } = {}
): Promise<Repository[]> {
  const apiKey = process.env.TRENCH_GITHUB_API_KEY;
  
  const parts: string[] = [query];
  if (options.language) parts.push(`language:${options.language}`);
  if (options.minStars) parts.push(`stars:>=${options.minStars}`);
  
  const searchQuery = parts.join(' ');
  
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'TrenchCLI/1.0',
  };
  
  if (apiKey) {
    headers['Authorization'] = `token ${apiKey}`;
  }
  
  const response = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(searchQuery)}&sort=${options.sort || 'stars'}&order=desc&per_page=30`,
    { headers }
  );
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`);
  }
  
  const data = await response.json() as {
    items: Array<{
      full_name: string;
      html_url: string;
      description: string | null;
      stargazers_count: number;
      forks_count: number;
      language: string | null;
      updated_at: string;
    }>
  };
  
  return (data.items || []).map(item => ({
    name: item.full_name.split('/')[1],
    owner: item.full_name.split('/')[0],
    url: item.html_url,
    stars: item.stargazers_count,
    forks: item.forks_count,
    language: item.language || 'Unknown',
    description: item.description || '',
    updatedAt: new Date(item.updated_at),
  }));
}

/**
 * Get trending repositories
 */
export async function getTrending(
  language?: string,
  since: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<Repository[]> {
  // GitHub doesn't have a direct trending API
  // Use search with date filter as approximation
  const dateFilter = getDateFilter(since);
  
  return searchRepositories('stars:>100', {
    language,
    sort: 'stars',
  });
}

/**
 * Get date filter for trending
 */
function getDateFilter(since: 'daily' | 'weekly' | 'monthly'): string {
  const date = new Date();
  
  switch (since) {
    case 'daily':
      date.setDate(date.getDate() - 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() - 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() - 1);
      break;
  }
  
  return date.toISOString().split('T')[0];
}
