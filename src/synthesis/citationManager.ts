/**
 * Citation Manager
 * 
 * Formats citations (Perplexity-style: [1], [2]), creates bibliography,
 * links to original sources, and provides archival links (Wayback Machine).
 */

import {
  Source,
  Citation,
  Bibliography,
  AnySource,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

interface CitationManagerConfig {
  style: 'numbered' | 'inline' | 'footnote';
  includeArchiveLinks: boolean;
  archiveProvider: 'wayback' | 'archive.today' | 'ghostarchive';
  maxCitations: number;
}

const DEFAULT_CONFIG: CitationManagerConfig = {
  style: 'numbered',
  includeArchiveLinks: true,
  archiveProvider: 'wayback',
  maxCitations: 100,
};

const ARCHIVE_URLS = {
  wayback: 'https://web.archive.org/web/*/',
  'archive.today': 'https://archive.today/',
  ghostarchive: 'https://ghostarchive.org/archive/',
};

// ============================================================================
// Citation Manager Class
// ============================================================================

export class CitationManager {
  private config: CitationManagerConfig;
  private citationMap: Map<string, number>; // source ID -> citation number
  private citations: Citation[];
  private archivedLinks: Map<string, string>;

  constructor(config: Partial<CitationManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.citationMap = new Map();
    this.citations = [];
    this.archivedLinks = new Map();
  }

  /**
   * Build bibliography from sources
   */
  buildBibliography(sources: AnySource[]): Bibliography {
    this.reset();

    // Sort sources by credibility
    const sortedSources = [...sources].sort(
      (a, b) => b.credibilityScore - a.credibilityScore
    );

    // Create citations
    for (let i = 0; i < sortedSources.length && i < this.config.maxCitations; i++) {
      const source = sortedSources[i];
      const number = i + 1;
      
      this.citationMap.set(source.id, number);
      
      this.citations.push({
        id: source.id,
        number,
        source,
        context: this.extractCitationContext(source),
      });

      // Generate archive link
      if (this.config.includeArchiveLinks) {
        const archiveUrl = this.generateArchiveUrl(source.url);
        this.archivedLinks.set(source.url, archiveUrl);
      }
    }

    return {
      citations: this.citations,
      archivedLinks: this.archivedLinks,
    };
  }

  /**
   * Format citation for inline use
   */
  formatCitation(source: Source): string {
    const number = this.citationMap.get(source.id);
    
    if (!number) {
      // Source not in bibliography, add it
      const newNumber = this.citations.length + 1;
      this.citationMap.set(source.id, newNumber);
      this.citations.push({
        id: source.id,
        number: newNumber,
        source,
        context: this.extractCitationContext(source),
      });
      return this.formatCitationNumber(newNumber);
    }

    return this.formatCitationNumber(number);
  }

  /**
   * Format multiple citations
   */
  formatCitations(sources: Source[]): string {
    const numbers = sources
      .map(s => this.citationMap.get(s.id))
      .filter((n): n is number => n !== undefined)
      .sort((a, b) => a - b);

    if (numbers.length === 0) return '';
    if (numbers.length === 1) return this.formatCitationNumber(numbers[0]);

    // Group consecutive numbers
    const groups = this.groupConsecutive(numbers);
    const formatted = groups.map(g => {
      if (g.length === 1) return `[${g[0]}]`;
      if (g.length === 2) return `[${g[0]}][${g[1]}]`;
      return `[${g[0]}-${g[g.length - 1]}]`;
    });

    return formatted.join('');
  }

  /**
   * Extract citations from content
   */
  extractCitationsFromContent(content: string): Citation[] {
    const citationIds = this.extractCitationIds(content);
    return citationIds
      .map(id => this.citations.find(c => c.number === id))
      .filter((c): c is Citation => c !== undefined);
  }

  /**
   * Get citation by source ID
   */
  getCitation(sourceId: string): Citation | undefined {
    return this.citations.find(c => c.id === sourceId);
  }

  /**
   * Get citation by number
   */
  getCitationByNumber(number: number): Citation | undefined {
    return this.citations.find(c => c.number === number);
  }

  /**
   * Format bibliography as markdown
   */
  formatBibliographyMarkdown(bibliography?: Bibliography): string {
    const bib = bibliography || { citations: this.citations, archivedLinks: this.archivedLinks };
    
    const lines: string[] = ['## References\n'];

    for (const citation of bib.citations) {
      lines.push(this.formatCitationEntry(citation));
    }

    if (this.config.includeArchiveLinks && bib.archivedLinks.size > 0) {
      lines.push('\n### Archived Versions\n');
      for (const [original, archived] of Array.from(bib.archivedLinks.entries())) {
        lines.push(`- [${this.truncateUrl(original)}](${archived})`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Format inline bibliography (for sidebars/footnotes)
   */
  formatInlineBibliography(sourceIds: string[]): string {
    const citations = sourceIds
      .map(id => this.getCitation(id))
      .filter((c): c is Citation => c !== undefined)
      .sort((a, b) => a.number - b.number);

    if (citations.length === 0) return '';

    const lines = citations.map(c => {
      const shortDesc = this.formatShortCitation(c.source);
      return `[${c.number}] ${shortDesc}`;
    });

    return lines.join('; ');
  }

  /**
   * Generate archive URL
   */
  generateArchiveUrl(url: string): string {
    const base = ARCHIVE_URLS[this.config.archiveProvider];
    
    switch (this.config.archiveProvider) {
      case 'wayback':
        return `${base}${url}`;
      case 'archive.today':
      case 'ghostarchive':
        return `${base}${encodeURIComponent(url)}`;
      default:
        return `${base}${url}`;
    }
  }

  /**
   * Update citation style
   */
  setStyle(style: CitationManagerConfig['style']): void {
    this.config.style = style;
  }

  /**
   * Get all citations
   */
  getAllCitations(): Citation[] {
    return [...this.citations];
  }

  /**
   * Get citation count
   */
  getCitationCount(): number {
    return this.citations.length;
  }

  /**
   * Clear all citations
   */
  reset(): void {
    this.citationMap.clear();
    this.citations = [];
    this.archivedLinks.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Format citation number based on style
   */
  private formatCitationNumber(number: number): string {
    switch (this.config.style) {
      case 'numbered':
        return `[${number}]`;
      case 'inline':
        return `(${number})`;
      case 'footnote':
        return `[^${number}]`;
      default:
        return `[${number}]`;
    }
  }

  /**
   * Format full citation entry
   */
  private formatCitationEntry(citation: Citation): string {
    const parts: string[] = [`[${citation.number}]`];
    const source = citation.source;

    // Title
    parts.push(`**${source.title}**`);

    // Author
    if (source.author) {
      parts.push(`— ${source.author}`);
    }

    // Source type indicator
    parts.push(`[${this.getSourceTypeLabel(source.sourceType)}]`);

    // URL
    parts.push(`\n   ${source.url}`);

    // Archive link
    if (this.config.includeArchiveLinks && this.archivedLinks.has(source.url)) {
      const archiveUrl = this.archivedLinks.get(source.url);
      parts.push(`\n   [Archived](${archiveUrl})`);
    }

    return parts.join(' ');
  }

  /**
   * Format short citation
   */
  private formatShortCitation(source: Source): string {
    const parts: string[] = [];

    if (source.author) {
      parts.push(source.author);
    }

    // Truncated title
    const shortTitle = source.title.length > 50 
      ? source.title.substring(0, 50) + '...'
      : source.title;
    parts.push(`"${shortTitle}"`);

    return parts.join(', ');
  }

  /**
   * Get source type label
   */
  private getSourceTypeLabel(type: Source['sourceType']): string {
    const labels: Record<Source['sourceType'], string> = {
      web: 'Web',
      github: 'GitHub',
      arxiv: 'arXiv',
      community: 'Community',
      archive: 'Archive',
      documentation: 'Docs',
    };
    return labels[type] || type;
  }

  /**
   * Extract context for citation
   */
  private extractCitationContext(source: Source): string {
    if (source.snippet) {
      return source.snippet;
    }

    // Extract first meaningful sentence from content
    const content = source.content || '';
    const sentences = content
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 300);

    return sentences[0] || '';
  }

  /**
   * Extract citation IDs from content
   */
  private extractCitationIds(content: string): number[] {
    const ids: number[] = [];
    
    // Match citation patterns
    const patterns = [
      /\[(\d+)\]/g,      // [1], [2]
      /\[(\d+)-(\d+)\]/g, // [1-3]
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[2]) {
          // Range
          const start = parseInt(match[1], 10);
          const end = parseInt(match[2], 10);
          for (let i = start; i <= end; i++) {
            ids.push(i);
          }
        } else {
          ids.push(parseInt(match[1], 10));
        }
      }
    }

    return Array.from(new Set(ids)).sort((a, b) => a - b);
  }

  /**
   * Group consecutive numbers
   */
  private groupConsecutive(numbers: number[]): number[][] {
    if (numbers.length === 0) return [];

    const groups: number[][] = [[numbers[0]]];

    for (let i = 1; i < numbers.length; i++) {
      const lastGroup = groups[groups.length - 1];
      if (numbers[i] === lastGroup[lastGroup.length - 1] + 1) {
        lastGroup.push(numbers[i]);
      } else {
        groups.push([numbers[i]]);
      }
    }

    return groups;
  }

  /**
   * Truncate URL for display
   */
  private truncateUrl(url: string, maxLength: number = 50): string {
    if (url.length <= maxLength) return url;
    return url.substring(0, maxLength - 3) + '...';
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a citation link
 */
export function createCitationLink(citationNumber: number, url: string): string {
  return `[${citationNumber}](${url})`;
}

/**
 * Parse citations from markdown text
 */
export function parseCitationsFromMarkdown(text: string): Array<{ number: number; index: number }> {
  const citations: Array<{ number: number; index: number }> = [];
  const pattern = /\[(\d+)\]/g;
  
  let match;
  while ((match = pattern.exec(text)) !== null) {
    citations.push({
      number: parseInt(match[1], 10),
      index: match.index,
    });
  }

  return citations;
}

/**
 * Validate citation numbers (ensure sequential)
 */
export function validateCitationNumbers(citations: Citation[]): {
  valid: boolean;
  missing: number[];
  duplicates: number[];
} {
  const numbers = citations.map(c => c.number).sort((a, b) => a - b);
  const missing: number[] = [];
  const duplicates: number[] = [];

  // Check for missing numbers
  for (let i = 1; i <= numbers[numbers.length - 1]; i++) {
    if (!numbers.includes(i)) {
      missing.push(i);
    }
  }

  // Check for duplicates
  const seen = new Set<number>();
  for (const num of numbers) {
    if (seen.has(num)) {
      duplicates.push(num);
    }
    seen.add(num);
  }

  return {
    valid: missing.length === 0 && duplicates.length === 0,
    missing,
    duplicates,
  };
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCitationManager(config?: Partial<CitationManagerConfig>): CitationManager {
  return new CitationManager(config);
}
