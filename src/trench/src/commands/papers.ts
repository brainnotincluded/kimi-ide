/**
 * Trench CLI - Papers Search Command
 * Academic paper search from arXiv, Semantic Scholar, etc.
 */

import type { PaperSearchOptions, PaperResult } from '../types/index.js';

/**
 * Search academic papers
 */
export async function paperSearch(options: PaperSearchOptions): Promise<PaperResult[]> {
  const results: PaperResult[] = [];
  
  // Search arXiv
  try {
    const arxivResults = await searchArxiv(options);
    results.push(...arxivResults);
  } catch (error) {
    console.warn('arXiv search failed:', error);
  }
  
  // Search Semantic Scholar if API key available
  if (process.env.TRENCH_SEMANTIC_SCHOLAR_API_KEY) {
    try {
      const ssResults = await searchSemanticScholar(options);
      results.push(...ssResults);
    } catch (error) {
      console.warn('Semantic Scholar search failed:', error);
    }
  }
  
  // Sort and deduplicate
  const sorted = results
    .sort((a, b) => {
      if (options.sortBy === 'date') {
        return b.publishedAt.getTime() - a.publishedAt.getTime();
      }
      if (options.sortBy === 'citations' && a.citationCount !== undefined && b.citationCount !== undefined) {
        return b.citationCount - a.citationCount;
      }
      return 0;
    })
    .slice(0, options.maxResults);
  
  return sorted;
}

/**
 * Search arXiv
 */
async function searchArxiv(options: PaperSearchOptions): Promise<PaperResult[]> {
  const queryParts: string[] = [];
  
  // Main query
  if (options.query) {
    queryParts.push(`all:${options.query}`);
  }
  
  // Categories
  if (options.categories && options.categories.length > 0) {
    for (const cat of options.categories) {
      queryParts.push(`cat:${cat}`);
    }
  }
  
  // Authors
  if (options.authors && options.authors.length > 0) {
    for (const author of options.authors) {
      queryParts.push(`au:${author}`);
    }
  }
  
  // Date range
  if (options.since || options.until) {
    const dateParts: string[] = [];
    if (options.since) {
      dateParts.push(options.since.toISOString().split('T')[0].replace(/-/g, ''));
    }
    if (options.until) {
      dateParts.push(options.until.toISOString().split('T')[0].replace(/-/g, ''));
    }
    queryParts.push(`submittedDate:[${dateParts.join(' TO ')}]`);
  }
  
  const query = queryParts.join(' AND ');
  const maxResults = Math.min(options.maxResults, 100);
  
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(query)}&start=0&max_results=${maxResults}&sortBy=${options.sortBy === 'date' ? 'submittedDate' : 'relevance'}&sortOrder=descending`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`arXiv API error: ${response.status}`);
  }
  
  const xml = await response.text();
  
  return parseArxivResults(xml);
}

/**
 * Parse arXiv XML results
 */
function parseArxivResults(xml: string): PaperResult[] {
  const results: PaperResult[] = [];
  
  // Split entries
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    
    // Extract fields
    const title = extractXmlValue(entry, 'title')?.replace(/\n/g, ' ').trim();
    const id = extractXmlValue(entry, 'id');
    const published = extractXmlValue(entry, 'published');
    const summary = extractXmlValue(entry, 'summary');
    const pdfLink = extractXmlAttribute(entry, 'link', 'title', 'pdf', 'href');
    
    // Extract authors
    const authorMatches = entry.match(/<author>[\s\S]*?<\/author>/g) || [];
    const authors = authorMatches.map(a => {
      const nameMatch = a.match(/<name>([^<]+)<\/name>/);
      return nameMatch?.[1] || '';
    }).filter(Boolean);
    
    // Extract categories
    const categoryMatches = entry.match(/<category[^>]*term="([^"]+)"/g) || [];
    const categories = categoryMatches.map(m => {
      const termMatch = m.match(/term="([^"]+)"/);
      return termMatch?.[1] || '';
    }).filter(Boolean);
    
    if (title && id) {
      results.push({
        title,
        authors,
        abstract: summary || '',
        url: id,
        pdfUrl: pdfLink || id.replace('/abs/', '/pdf/') + '.pdf',
        publishedAt: new Date(published || Date.now()),
        categories,
        source: 'arxiv',
      });
    }
  }
  
  return results;
}

/**
 * Search Semantic Scholar
 */
async function searchSemanticScholar(options: PaperSearchOptions): Promise<PaperResult[]> {
  const apiKey = process.env.TRENCH_SEMANTIC_SCHOLAR_API_KEY;
  
  const query = options.query;
  const fields = 'title,authors,year,abstract,citationCount,url,openAccessPdf';
  const limit = Math.min(options.maxResults, 100);
  
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&fields=${fields}&limit=${limit}`;
  
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`Semantic Scholar API error: ${response.status}`);
  }
  
  const data = await response.json() as {
    data?: Array<{
      paperId: string;
      title: string;
      authors: Array<{ name: string }>;
      year: number;
      abstract?: string;
      citationCount?: number;
      url?: string;
      openAccessPdf?: { url: string };
    }>
  };
  
  return (data.data || []).map(item => ({
    title: item.title,
    authors: item.authors.map(a => a.name),
    abstract: item.abstract || '',
    url: item.url || `https://semanticscholar.org/paper/${item.paperId}`,
    pdfUrl: item.openAccessPdf?.url,
    publishedAt: new Date(item.year, 0, 1),
    categories: [],
    citationCount: item.citationCount,
    source: 'semantic_scholar',
  }));
}

/**
 * Search PubMed
 */
export async function searchPubMed(
  query: string,
  maxResults: number = 10
): Promise<PaperResult[]> {
  // First, search for IDs
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${maxResults}&retmode=json`;
  
  const searchResponse = await fetch(searchUrl);
  const searchData = await searchResponse.json() as {
    esearchresult?: { idlist: string[] }
  };
  
  const ids = searchData.esearchresult?.idlist || [];
  
  if (ids.length === 0) return [];
  
  // Fetch details for each ID
  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(',')}&retmode=xml`;
  
  const fetchResponse = await fetch(fetchUrl);
  const xml = await fetchResponse.text();
  
  return parsePubMedResults(xml);
}

/**
 * Parse PubMed XML results
 */
function parsePubMedResults(xml: string): PaperResult[] {
  const results: PaperResult[] = [];
  
  // Split PubmedArticle entries
  const articleRegex = /<PubmedArticle>[\s\S]*?<\/PubmedArticle>/g;
  let match;
  
  while ((match = articleRegex.exec(xml)) !== null) {
    const article = match[0];
    
    // Extract title
    const titleMatch = article.match(/<ArticleTitle>([^<]*)<\/ArticleTitle>/);
    const title = titleMatch?.[1]?.trim();
    
    // Extract abstract
    const abstractMatch = article.match(/<AbstractText[^>]*>([^<]*)<\/AbstractText>/);
    const abstract = abstractMatch?.[1] || '';
    
    // Extract authors
    const authorMatches = article.match(/<LastName>([^<]+)<\/LastName>\s*<ForeName>([^<]+)<\/ForeName>/g) || [];
    const authors = authorMatches.map(m => {
      const last = m.match(/<LastName>([^<]+)<\/LastName>/)?.[1];
      const fore = m.match(/<ForeName>([^<]+)<\/ForeName>/)?.[1];
      return fore && last ? `${fore} ${last}` : (last || fore || '');
    }).filter(Boolean);
    
    // Extract PMID
    const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/);
    const pmid = pmidMatch?.[1];
    
    // Extract year
    const yearMatch = article.match(/<PubDate>.*?<Year>(\d{4})<\/Year>.*?<\/PubDate>/);
    const year = yearMatch?.[1];
    
    if (title && pmid) {
      results.push({
        title,
        authors,
        abstract,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        publishedAt: year ? new Date(year, 0, 1) : new Date(),
        categories: [],
        source: 'pubmed',
      });
    }
  }
  
  return results;
}

/**
 * Extract XML value
 */
function extractXmlValue(xml: string, tag: string): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const match = xml.match(regex);
  return match?.[1]?.trim();
}

/**
 * Extract XML attribute
 */
function extractXmlAttribute(
  xml: string,
  tag: string,
  attrName: string,
  attrValue: string,
  targetAttr: string
): string | undefined {
  const regex = new RegExp(`<${tag}[^>]*${attrName}="${attrValue}"[^>]*${targetAttr}="([^"]+)"[^>]*>`);
  const match = xml.match(regex);
  return match?.[1];
}

/**
 * Get paper by ID
 */
export async function getPaperById(
  id: string,
  source: 'arxiv' | 'semantic_scholar' | 'pubmed'
): Promise<PaperResult | null> {
  switch (source) {
    case 'arxiv':
      const arxivUrl = `http://export.arxiv.org/api/query?id_list=${id}`;
      const arxivResponse = await fetch(arxivUrl);
      const arxivXml = await arxivResponse.text();
      const arxivResults = parseArxivResults(arxivXml);
      return arxivResults[0] || null;
      
    case 'semantic_scholar':
      // Would need paper ID lookup
      return null;
      
    case 'pubmed':
      const results = await searchPubMed(id, 1);
      return results[0] || null;
      
    default:
      return null;
  }
}

/**
 * Get popular papers in category
 */
export async function getPopularPapers(
  category: string,
  limit: number = 10
): Promise<PaperResult[]> {
  // Search recent highly-cited papers
  const since = new Date();
  since.setFullYear(since.getFullYear() - 1);
  
  return paperSearch({
    query: category,
    since,
    sortBy: 'citations',
    maxResults: limit,
  });
}
