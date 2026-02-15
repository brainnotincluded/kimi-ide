/**
 * Fact Extractor
 * 
 * Extracts structured claims from text, finds numbers, dates, names,
 * extracts code examples, quotations, and methodologies from academic papers.
 */

import {
  Source,
  Fact,
  StructuredClaim,
  ArXivSource,
} from './types';
import * as crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

interface FactExtractorConfig {
  maxFactsPerSource: number;
  minClaimLength: number;
  maxClaimLength: number;
  extractCode: boolean;
  extractQuotes: boolean;
  extractStatistics: boolean;
}

const DEFAULT_CONFIG: FactExtractorConfig = {
  maxFactsPerSource: 50,
  minClaimLength: 20,
  maxClaimLength: 500,
  extractCode: true,
  extractQuotes: true,
  extractStatistics: true,
};

// ============================================================================
// Fact Extractor Class
// ============================================================================

export class FactExtractor {
  private config: FactExtractorConfig;

  constructor(config: Partial<FactExtractorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Extract facts from a source
   */
  async extractFromSource(source: Source): Promise<Fact[]> {
    const facts: Fact[] = [];
    const content = source.content;

    // Extract different types of facts
    facts.push(...this.extractStatements(content, source.id));
    facts.push(...this.extractStatistics(content, source.id));
    facts.push(...this.extractDates(content, source.id));
    facts.push(...this.extractNamedEntities(content, source.id));
    
    if (this.config.extractCode) {
      facts.push(...this.extractCodeExamples(content, source.id));
    }
    
    if (this.config.extractQuotes) {
      facts.push(...this.extractQuotations(content, source.id));
    }

    // Special handling for academic papers
    if (source.sourceType === 'arxiv') {
      facts.push(...this.extractFromAcademicPaper(source as ArXivSource));
    }

    // Limit facts per source
    return facts
      .sort((a, b) => this.scoreFact(b) - this.scoreFact(a))
      .slice(0, this.config.maxFactsPerSource);
  }

  /**
   * Extract structured claims from text
   */
  async extractClaims(text: string, sourceId: string): Promise<StructuredClaim[]> {
    const claims: StructuredClaim[] = [];

    // Extract subject-predicate-object triples
    const sentences = this.splitIntoSentences(text);

    for (const sentence of sentences) {
      const claim = this.parseClaim(sentence, sourceId);
      if (claim) {
        claims.push(claim);
      }
    }

    return claims;
  }

  /**
   * Extract statements/claims from text
   */
  private extractStatements(content: string, sourceId: string): Fact[] {
    const facts: Fact[] = [];
    const sentences = this.splitIntoSentences(content);

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      
      if (this.isValidClaim(sentence)) {
        const context = this.getContext(sentences, i);
        
        facts.push({
          id: this.generateId(),
          claim: sentence,
          type: 'statement',
          sourceId,
          context,
          position: this.findPosition(content, sentence),
          extractedAt: new Date(),
          metadata: {
            numbers: this.extractNumbers(sentence),
          },
        });
      }
    }

    return facts;
  }

  /**
   * Extract statistics from text
   */
  private extractStatistics(content: string, sourceId: string): Fact[] {
    const facts: Fact[] = [];
    
    // Patterns for statistics
    const patterns = [
      // Percentages
      /(\d+(?:\.\d+)?)\s*%\s*(?:of\s+)?([^\.]+)/gi,
      // Ratios
      /(\d+)\s*:\s*(\d+)\s*([^\.]+)/gi,
      // Comparisons with numbers
      /(\d+(?:\.\d+)?)\s*(times|x|fold)\s*(more|less|faster|slower|higher|lower)\s*(?:than)?([^\.]+)/gi,
      // Averages/means
      /(?:average|mean|median)\s*(?:of\s+)?(\d+(?:\.\d+)?)\s*([^\.]+)/gi,
      // Ranges
      /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*([^\.]+)/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const claim = match[0].trim();
        if (this.isValidClaim(claim)) {
          facts.push({
            id: this.generateId(),
            claim,
            type: 'statistic',
            sourceId,
            context: this.getSurroundingText(content, match.index, 200),
            position: { start: match.index, end: match.index + claim.length },
            extractedAt: new Date(),
            metadata: {
              numbers: this.extractNumbers(claim),
            },
          });
        }
      }
    }

    return facts;
  }

  /**
   * Extract dates from text
   */
  private extractDates(content: string, sourceId: string): Fact[] {
    const facts: Fact[] = [];
    
    // Date patterns
    const patterns = [
      // ISO dates
      /\b(\d{4}-\d{2}-\d{2})\b/g,
      // Month Day, Year
      /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4})\b/gi,
      // Month Year
      /\b((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/gi,
      // Year only (for recent years)
      /\b((?:19|20)\d{2})\b/g,
      // Relative dates
      /\b(\d{1,2}\s+(?:days?|weeks?|months?|years?)\s+(?:ago|from now))\b/gi,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const dateStr = match[1];
        const sentence = this.getContainingSentence(content, match.index);
        
        facts.push({
          id: this.generateId(),
          claim: sentence || `Date: ${dateStr}`,
          type: 'date',
          sourceId,
          context: this.getSurroundingText(content, match.index, 150),
          position: { start: match.index, end: match.index + dateStr.length },
          extractedAt: new Date(),
          metadata: {
            dates: [this.parseDate(dateStr)].filter(Boolean) as Date[],
          },
        });
      }
    }

    return facts;
  }

  /**
   * Extract named entities from text
   */
  private extractNamedEntities(content: string, sourceId: string): Fact[] {
    const facts: Fact[] = [];

    // Person names (simplified patterns)
    const namePatterns = [
      // Capitalized words that could be names
      /\b([A-Z][a-z]+\s+[A-Z][a-z]+)\b/g,
      // Names with titles
      /\b((?:Dr|Mr|Ms|Mrs|Prof)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
      // Organizations
      /\b((?:[A-Z][a-z]*\s*)+(?:Inc|Corp|LLC|Ltd|Company|Organization|Institute|University|Foundation))\b/g,
      // Products/Technologies
      /\b((?:[A-Z][a-zA-Z]*\s*)+(?:Framework|Library|Platform|API|SDK|Tool|Engine))\b/g,
    ];

    for (const pattern of namePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const entity = match[1];
        const sentence = this.getContainingSentence(content, match.index);
        
        if (sentence && this.isValidClaim(sentence)) {
          facts.push({
            id: this.generateId(),
            claim: sentence,
            type: 'name',
            sourceId,
            context: this.getSurroundingText(content, match.index, 150),
            position: { start: match.index, end: match.index + entity.length },
            extractedAt: new Date(),
            metadata: {
              entities: [entity],
            },
          });
        }
      }
    }

    return facts;
  }

  /**
   * Extract code examples from text
   */
  private extractCodeExamples(content: string, sourceId: string): Fact[] {
    const facts: Fact[] = [];

    // Code block patterns
    const patterns = [
      // Fenced code blocks
      /```(\w+)?\n([\s\S]*?)```/g,
      // Inline code
      /`([^`]+)`/g,
      // Indented code blocks (4+ spaces)
      /^(?:    |\t)(.+)$/gm,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const code = match[2] || match[1];
        const language = match[1] || this.detectLanguage(code);
        
        if (code.length > 10) {
          facts.push({
            id: this.generateId(),
            claim: `Code example in ${language || 'unknown'}`,
            type: 'code',
            sourceId,
            context: this.getSurroundingText(content, match.index, 100),
            position: { start: match.index, end: match.index + match[0].length },
            extractedAt: new Date(),
            metadata: {
              codeLanguage: language || 'unknown',
            },
          });
        }
      }
    }

    return facts;
  }

  /**
   * Extract quotations from text
   */
  private extractQuotations(content: string, sourceId: string): Fact[] {
    const facts: Fact[] = [];

    // Quotation patterns
    const patterns = [
      // Double quotes
      /"([^"]{10,500})"/g,
      // Single quotes (for shorter quotes)
      /'([^']{20,200})'/g,
      // Blockquotes
      /^>\s*(.+)$/gm,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const quote = match[1].trim();
        
        if (quote.length >= 20 && quote.length <= 500) {
          facts.push({
            id: this.generateId(),
            claim: `"${quote}"`,
            type: 'quote',
            sourceId,
            context: this.getSurroundingText(content, match.index, 150),
            position: { start: match.index, end: match.index + match[0].length },
            extractedAt: new Date(),
            metadata: {},
          });
        }
      }
    }

    return facts;
  }

  /**
   * Extract information from academic papers
   */
  private extractFromAcademicPaper(source: ArXivSource): Fact[] {
    const facts: Fact[] = [];
    const content = source.content;

    // Extract methodology
    const methodologyPatterns = [
      /methodology[\s\S]{0,1000}?((?:We|Our|The authors?)\s+(?:use|employ|adopt|propose|introduce)[^\.]+\.)/i,
      /approach[\s\S]{0,500}?((?:We|Our|The authors?)\s+(?:present|describe|detail)[^\.]+\.)/i,
      /experimental setup[\s\S]{0,1000}?((?:We|Our|The authors?)\s+(?:conduct|perform|run)[^\.]+\.)/i,
    ];

    for (const pattern of methodologyPatterns) {
      const match = content.match(pattern);
      if (match) {
        facts.push({
          id: this.generateId(),
          claim: match[1].trim(),
          type: 'methodology',
          sourceId: source.id,
          context: match[0],
          position: { start: match.index || 0, end: (match.index || 0) + match[0].length },
          extractedAt: new Date(),
          metadata: {
            entities: source.authors,
          },
        });
      }
    }

    // Extract findings/results
    const findingsPatterns = [
      /results\s+(?:show|demonstrate|indicate)[\s\S]{0,500}?((?:We|Our|The authors?)\s+(?:find|observe|achieve|obtain)[^\.]+\.)/i,
      /conclusion[\s\S]{0,500}?((?:We|Our|The authors?)\s+(?:conclude|find|show)[^\.]+\.)/i,
    ];

    for (const pattern of findingsPatterns) {
      const match = content.match(pattern);
      if (match) {
        facts.push({
          id: this.generateId(),
          claim: match[1].trim(),
          type: 'statement',
          sourceId: source.id,
          context: match[0],
          position: { start: match.index || 0, end: (match.index || 0) + match[0].length },
          extractedAt: new Date(),
          metadata: {
            entities: source.authors,
          },
        });
      }
    }

    return facts;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Parse a claim into structured format
   */
  private parseClaim(sentence: string, sourceId: string): StructuredClaim | null {
    // Simple SVO parsing
    // Look for patterns like: "X is Y", "X has Y", "X supports Y"
    const patterns = [
      /^(\w+(?:\s+\w+){0,5})\s+(is|are|was|were)\s+(?!not)([^\.]+)/i,
      /^(\w+(?:\s+\w+){0,5})\s+(has|have)\s+(?!no|not)([^\.]+)/i,
      /^(\w+(?:\s+\w+){0,5})\s+(supports|enables|allows|provides)\s+([^\.]+)/i,
      /^(\w+(?:\s+\w+){0,5})\s+(increases|decreases|improves|reduces)\s+([^\.]+)/i,
    ];

    for (const pattern of patterns) {
      const match = sentence.match(pattern);
      if (match) {
        return {
          id: this.generateId(),
          subject: match[1].trim(),
          predicate: match[2].trim(),
          object: match[3].trim(),
          confidence: 0.7,
          sources: [sourceId],
          contradictions: [],
          supports: [],
        };
      }
    }

    return null;
  }

  /**
   * Check if a sentence is a valid claim
   */
  private isValidClaim(sentence: string): boolean {
    const trimmed = sentence.trim();
    
    // Length check
    if (trimmed.length < this.config.minClaimLength) return false;
    if (trimmed.length > this.config.maxClaimLength) return false;

    // Must start with uppercase or number
    if (!/^[A-Z0-9]/.test(trimmed)) return false;

    // Must end with period, question mark, or exclamation
    if (!/[.!?]$/.test(trimmed)) return false;

    // Filter out questions
    if (trimmed.endsWith('?')) return false;

    // Filter out very short words-only sentences
    if (trimmed.split(/\s+/).length < 4) return false;

    // Filter out sentences with too many special characters
    const specialChars = (trimmed.match(/[^\w\s.!?,-]/g) || []).length;
    if (specialChars / trimmed.length > 0.2) return false;

    return true;
  }

  /**
   * Score a fact for relevance
   */
  private scoreFact(fact: Fact): number {
    let score = 0.5;

    // Longer claims might be more informative
    const wordCount = fact.claim.split(/\s+/).length;
    score += Math.min(0.2, wordCount / 50);

    // Statistics and numbers add credibility
    if (fact.metadata.numbers && fact.metadata.numbers.length > 0) {
      score += 0.1;
    }

    // Dates add timeliness
    if (fact.metadata.dates && fact.metadata.dates.length > 0) {
      score += 0.05;
    }

    // Named entities add specificity
    if (fact.metadata.entities && fact.metadata.entities.length > 0) {
      score += 0.05;
    }

    // Type-specific bonuses
    switch (fact.type) {
      case 'statistic':
        score += 0.1;
        break;
      case 'methodology':
        score += 0.15;
        break;
      case 'code':
        score += 0.05;
        break;
    }

    return Math.min(1, score);
  }

  /**
   * Split text into sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting
    return text
      .replace(/([.!?])\s+/g, '$1\n')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * Get context around a sentence
   */
  private getContext(sentences: string[], index: number): string {
    const start = Math.max(0, index - 1);
    const end = Math.min(sentences.length, index + 2);
    return sentences.slice(start, end).join(' ');
  }

  /**
   * Find position of text in content
   */
  private findPosition(content: string, text: string): { start: number; end: number } {
    const start = content.indexOf(text);
    return { start, end: start + text.length };
  }

  /**
   * Get text surrounding a position
   */
  private getSurroundingText(content: string, position: number, radius: number): string {
    const start = Math.max(0, position - radius);
    const end = Math.min(content.length, position + radius);
    return content.substring(start, end).trim();
  }

  /**
   * Get containing sentence
   */
  private getContainingSentence(content: string, position: number): string {
    // Find sentence boundaries
    const before = content.substring(0, position);
    const after = content.substring(position);

    const sentenceStart = before.lastIndexOf('.') + 1;
    const sentenceEnd = after.indexOf('.');

    if (sentenceEnd === -1) return '';

    return content.substring(sentenceStart, position + sentenceEnd + 1).trim();
  }

  /**
   * Extract numbers from text
   */
  private extractNumbers(text: string): number[] {
    const matches = text.match(/-?\d+(?:\.\d+)?/g);
    return matches ? matches.map(Number) : [];
  }

  /**
   * Parse date string
   */
  private parseDate(dateStr: string): Date | null {
    try {
      const date = new Date(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }

  /**
   * Detect programming language from code
   */
  private detectLanguage(code: string): string | null {
    const indicators: Record<string, RegExp[]> = {
      typescript: [/:\s*\w+/, /interface\s+\w+/, /type\s+\w+\s*=/],
      javascript: [/const\s+\w+\s*=/, /function\s+\w+/, /=>/],
      python: [/def\s+\w+\s*\(/, /import\s+\w+/, /:\s*\n\s+/],
      rust: [/fn\s+\w+/, /let\s+mut/, /impl\s+/],
      go: [/func\s+\w+/, /package\s+\w+/, /:=/],
      java: [/public\s+class/, /private\s+\w+/, /System\.out/],
      cpp: [/#include/, /std::/, /int\s+main\s*\(/],
      bash: [/#!\/bin\/bash/, /echo\s+/, /\$\w+/],
      sql: [/SELECT\s+.*\s+FROM/i, /INSERT\s+INTO/i, /CREATE\s+TABLE/i],
    };

    for (const [lang, patterns] of Object.entries(indicators)) {
      if (patterns.some(p => p.test(code))) {
        return lang;
      }
    }

    return null;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return crypto.randomUUID();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createFactExtractor(config?: Partial<FactExtractorConfig>): FactExtractor {
  return new FactExtractor(config);
}
