/**
 * Trench CLI - Research Command
 * Deep research with AI synthesis like Perplexity
 */

import type { ResearchOptions, ResearchResult, SearchResult } from '../types/index.js';
import { search } from './search';

/**
 * Perform deep research with synthesis
 */
export async function research(options: ResearchOptions): Promise<ResearchResult> {
  const startTime = Date.now();
  
  // Determine search parameters based on depth
  const searchConfig = getSearchConfig(options.depth);
  
  // Search across multiple sources
  const searchResults = await search({
    query: options.query,
    sources: ['web', 'github', 'arxiv'],
    limit: searchConfig.maxSources,
    cache: true,
  });
  
  // Fetch content from top results
  const contents = await fetchContents(searchResults.slice(0, searchConfig.pagesToFetch));
  
  // Synthesize findings
  const synthesis = await synthesizeResearch(options.query, searchResults, contents);
  
  return {
    query: options.query,
    summary: synthesis.summary,
    sources: searchResults.slice(0, 10),
    keyFindings: synthesis.keyFindings,
    relatedTopics: synthesis.relatedTopics,
    confidence: calculateConfidence(searchResults.length, contents.length),
    generatedAt: new Date(),
  };
}

/**
 * Get search configuration based on depth
 */
function getSearchConfig(depth: ResearchOptions['depth']) {
  switch (depth) {
    case 'quick':
      return { maxSources: 10, pagesToFetch: 3 };
    case 'comprehensive':
      return { maxSources: 50, pagesToFetch: 15 };
    case 'standard':
    default:
      return { maxSources: 25, pagesToFetch: 8 };
  }
}

/**
 * Fetch content from URLs
 */
async function fetchContents(results: SearchResult[]): Promise<Array<{ url: string; content: string }>> {
  const contents: Array<{ url: string; content: string }> = [];
  
  await Promise.all(
    results.map(async (result) => {
      try {
        const content = await fetchPageContent(result.url);
        if (content) {
          contents.push({ url: result.url, content });
        }
      } catch (error) {
        // Skip failed fetches
      }
    })
  );
  
  return contents;
}

/**
 * Fetch and extract page content
 */
async function fetchPageContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TrenchBot/1.0)'
      }
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) return null;
    
    const html = await response.text();
    return extractTextFromHtml(html);
  } catch {
    return null;
  }
}

/**
 * Extract text from HTML
 */
function extractTextFromHtml(html: string): string {
  // Remove scripts and styles
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, '');
  
  // Extract main content areas
  const mainMatch = text.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                   text.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
                   text.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  
  if (mainMatch) {
    text = mainMatch[1];
  }
  
  // Convert to text
  text = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  // Limit length
  return text.substring(0, 10000);
}

/**
 * Synthesize research findings
 */
async function synthesizeResearch(
  query: string,
  sources: SearchResult[],
  contents: Array<{ url: string; content: string }>
): Promise<{
  summary: string;
  keyFindings: string[];
  relatedTopics: string[];
}> {
  // If we have an LLM API key, use it for synthesis
  const openaiKey = process.env.TRENCH_OPENAI_API_KEY;
  const anthropicKey = process.env.TRENCH_ANTHROPIC_API_KEY;
  
  if (openaiKey || anthropicKey) {
    try {
      return await synthesizeWithLLM(query, sources, contents, openaiKey, anthropicKey);
    } catch (error) {
      console.warn('LLM synthesis failed, falling back to heuristic synthesis');
    }
  }
  
  // Fallback to heuristic synthesis
  return synthesizeHeuristically(query, sources, contents);
}

/**
 * Synthesize using LLM
 */
async function synthesizeWithLLM(
  query: string,
  sources: SearchResult[],
  contents: Array<{ url: string; content: string }>,
  openaiKey?: string,
  anthropicKey?: string
): Promise<{
  summary: string;
  keyFindings: string[];
  relatedTopics: string[];
}> {
  const prompt = buildSynthesisPrompt(query, sources, contents);
  
  if (anthropicKey) {
    // Use Claude
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-sonnet-20240229',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    
    const data = await response.json() as {
      content: Array<{ text: string }>
    };
    
    return parseSynthesisResponse(data.content[0]?.text || '');
  }
  
  if (openaiKey) {
    // Use OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
      }),
    });
    
    const data = await response.json() as {
      choices: Array<{ message: { content: string } }>
    };
    
    return parseSynthesisResponse(data.choices[0]?.message?.content || '');
  }
  
  throw new Error('No LLM API key available');
}

/**
 * Build synthesis prompt
 */
function buildSynthesisPrompt(
  query: string,
  sources: SearchResult[],
  contents: Array<{ url: string; content: string }>
): string {
  const contentSummary = contents
    .map((c, i) => `Source ${i + 1} (${c.url}):\n${c.content.substring(0, 2000)}...`)
    .join('\n\n---\n\n');
  
  return `You are a research assistant. Based on the following sources, provide a comprehensive answer to the query.

Query: ${query}

Sources:
${contentSummary}

Please provide:
1. A concise summary (2-3 paragraphs)
2. 5-7 key findings as bullet points
3. 3-5 related topics for further research

Format your response as:
SUMMARY:
[Your summary here]

KEY_FINDINGS:
- Finding 1
- Finding 2
...

RELATED_TOPICS:
- Topic 1
- Topic 2
...`;
}

/**
 * Parse synthesis response
 */
function parseSynthesisResponse(text: string): {
  summary: string;
  keyFindings: string[];
  relatedTopics: string[];
} {
  const summaryMatch = text.match(/SUMMARY:?\s*\n?([\s\S]*?)(?=KEY_FINDINGS|KEY FINDINGS|$)/i);
  const findingsMatch = text.match(/KEY_?FINDINGS:?\s*\n?([\s\S]*?)(?=RELATED_TOPICS|RELATED TOPICS|$)/i);
  const topicsMatch = text.match(/RELATED_?TOPICS:?\s*\n?([\s\S]*?)$/i);
  
  const summary = summaryMatch?.[1]?.trim() || text.substring(0, 500);
  
  const keyFindings = findingsMatch?.[1]
    ?.split('\n')
    .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
    .map(line => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean) || [];
  
  const relatedTopics = topicsMatch?.[1]
    ?.split('\n')
    .filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'))
    .map(line => line.replace(/^[-•]\s*/, '').trim())
    .filter(Boolean) || [];
  
  return { summary, keyFindings, relatedTopics };
}

/**
 * Heuristic synthesis without LLM
 */
function synthesizeHeuristically(
  query: string,
  sources: SearchResult[],
  contents: Array<{ url: string; content: string }>
): {
  summary: string;
  keyFindings: string[];
  relatedTopics: string[];
} {
  // Generate summary from sources
  const sourceList = sources.slice(0, 5).map(s => `- ${s.title}`).join('\n');
  const summary = `Based on ${sources.length} sources found for "${query}":\n\n${sourceList}`;
  
  // Extract key findings from snippets
  const keyFindings = sources
    .slice(0, 7)
    .map(s => s.snippet)
    .filter(s => s.length > 20);
  
  // Generate related topics from source metadata
  const relatedTopics = [...new Set(
    sources
      .flatMap(s => s.title.split(/[\s\-:]+/).filter(w => w.length > 4))
      .slice(0, 5)
  )];
  
  return { summary, keyFindings, relatedTopics };
}

/**
 * Calculate confidence score
 */
function calculateConfidence(sourceCount: number, contentCount: number): number {
  const sourceScore = Math.min(sourceCount / 10, 1) * 0.5;
  const contentScore = Math.min(contentCount / 5, 1) * 0.5;
  return Math.round((sourceScore + contentScore) * 100) / 100;
}
