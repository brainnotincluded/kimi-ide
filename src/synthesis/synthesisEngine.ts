/**
 * Synthesis Engine
 * 
 * Structures information by topics, generates answer outline,
 * selects best sources for each point, generates markdown answer
 * with inline citations, adds "Further Reading" and highlights
 * "Key Takeaways" and "Contradictions".
 */

import {
  Source,
  Fact,
  SynthesisOptions,
  SynthesisResult,
  Outline,
  OutlineSection,
  Section,
  Contradiction,
  Consensus,
  ConfidenceScore,
  AnySource,
  SearchDepth,
} from './types';
import { CitationManager } from './citationManager';
import { ConfidenceScorer } from './confidenceScorer';

// ============================================================================
// Configuration
// ============================================================================

interface SynthesisConfig {
  maxSections: number;
  maxKeyTakeaways: number;
  minFactsPerSection: number;
  citationStyle: 'numbered' | 'inline' | 'footnote';
  includeConfidenceScores: boolean;
  includeContradictions: boolean;
  maxWordsPerSection: number;
}

const DEPTH_CONFIG: Record<SearchDepth, Partial<SynthesisConfig>> = {
  quick: {
    maxSections: 3,
    maxKeyTakeaways: 3,
    maxWordsPerSection: 200,
  },
  standard: {
    maxSections: 5,
    maxKeyTakeaways: 5,
    maxWordsPerSection: 400,
  },
  comprehensive: {
    maxSections: 8,
    maxKeyTakeaways: 7,
    maxWordsPerSection: 600,
  },
};

const DEFAULT_CONFIG: SynthesisConfig = {
  maxSections: 5,
  maxKeyTakeaways: 5,
  minFactsPerSection: 2,
  citationStyle: 'numbered',
  includeConfidenceScores: true,
  includeContradictions: true,
  maxWordsPerSection: 400,
};

// ============================================================================
// Synthesis Engine Class
// ============================================================================

export class SynthesisEngine {
  private config: SynthesisConfig;
  private citationManager: CitationManager;
  private confidenceScorer: ConfidenceScorer;

  constructor(
    citationManager: CitationManager,
    confidenceScorer: ConfidenceScorer,
    config: Partial<SynthesisConfig> = {}
  ) {
    this.citationManager = citationManager;
    this.confidenceScorer = confidenceScorer;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Synthesize information into a structured answer
   */
  async synthesize(
    query: string,
    sources: AnySource[],
    facts: Fact[],
    contradictions: Contradiction[],
    consensus: Consensus[],
    depth: SearchDepth
  ): Promise<SynthesisResult> {
    const startTime = Date.now();
    
    // Apply depth-specific config
    this.applyDepthConfig(depth);

    // Generate outline
    const outline = this.generateOutline(query, facts, sources);

    // Generate sections
    const sections = await this.generateSections(outline, facts, sources);

    // Extract key takeaways
    const keyTakeaways = this.extractKeyTakeaways(facts, consensus);

    // Calculate overall confidence
    const confidence = this.confidenceScorer.calculateSynthesisConfidence(
      sources,
      facts,
      contradictions,
      consensus
    );

    // Build bibliography
    const bibliography = this.citationManager.buildBibliography(sources);

    const processingTime = Date.now() - startTime;

    return {
      query,
      outline,
      sections,
      keyTakeaways,
      contradictions: this.config.includeContradictions ? contradictions : [],
      bibliography,
      confidence,
      metadata: {
        sourcesUsed: sources.length,
        totalFacts: facts.length,
        processingTime,
        generatedAt: new Date(),
      },
    };
  }

  /**
   * Generate outline for the answer
   */
  private generateOutline(query: string, facts: Fact[], sources: Source[]): Outline {
    // Group facts by topic/theme
    const topics = this.clusterFactsByTopic(facts);

    // Generate sections from topics
    const sections: OutlineSection[] = [];

    // Always include overview
    sections.push({
      id: 'overview',
      title: 'Overview',
      keyPoints: this.extractKeyPointsForTopic(topics[0] || [], 3),
      sourceIds: this.getRelevantSourceIds(topics[0] || [], sources),
      estimatedLength: 150,
    });

    // Add topic sections
    for (let i = 1; i < topics.length && sections.length < this.config.maxSections; i++) {
      const topic = topics[i];
      const title = this.inferTopicTitle(topic);
      
      sections.push({
        id: `section-${i}`,
        title,
        keyPoints: this.extractKeyPointsForTopic(topic, 4),
        sourceIds: this.getRelevantSourceIds(topic, sources),
        estimatedLength: this.config.maxWordsPerSection,
      });
    }

    return {
      title: this.generateTitle(query),
      sections,
    };
  }

  /**
   * Generate content sections
   */
  private async generateSections(
    outline: Outline,
    facts: Fact[],
    sources: Source[]
  ): Promise<Section[]> {
    const sections: Section[] = [];

    for (const outlineSection of outline.sections) {
      const sectionFacts = facts.filter(f => 
        outlineSection.sourceIds.includes(f.sourceId)
      );

      if (sectionFacts.length < this.config.minFactsPerSection) {
        continue;
      }

      const content = await this.generateSectionContent(
        outlineSection,
        sectionFacts,
        sources
      );

      const sectionCitations = this.citationManager.extractCitationsFromContent(content);
      
      // Calculate section confidence
      const sectionConfidence = this.confidenceScorer.calculateSynthesisConfidence(
        sources.filter(s => outlineSection.sourceIds.includes(s.id)),
        sectionFacts,
        [],
        []
      ).overall;

      sections.push({
        id: outlineSection.id,
        title: outlineSection.title,
        content,
        citations: sectionCitations,
        confidence: sectionConfidence,
      });
    }

    return sections;
  }

  /**
   * Generate content for a section
   */
  private async generateSectionContent(
    outlineSection: OutlineSection,
    facts: Fact[],
    sources: Source[]
  ): Promise<string> {
    const parts: string[] = [];
    const usedSources = new Set<string>();

    // Group facts by type
    const factsByType = this.groupFactsByType(facts);

    // Add definitions/statements first
    if (factsByType.statement) {
      const statements = factsByType.statement.slice(0, 3);
      for (const fact of statements) {
        const source = sources.find(s => s.id === fact.sourceId);
        if (source) {
          const citation = this.citationManager.formatCitation(source);
          parts.push(this.synthesizeSentence(fact.claim, citation));
          usedSources.add(source.id);
        }
      }
    }

    // Add statistics
    if (factsByType.statistic) {
      const stats = factsByType.statistic.slice(0, 2);
      for (const fact of stats) {
        const source = sources.find(s => s.id === fact.sourceId);
        if (source) {
          const citation = this.citationManager.formatCitation(source);
          parts.push(this.synthesizeSentence(fact.claim, citation));
          usedSources.add(source.id);
        }
      }
    }

    // Add code examples
    if (factsByType.code) {
      const codeFact = factsByType.code[0];
      const source = sources.find(s => s.id === codeFact.sourceId);
      if (source) {
        parts.push(`\n**Example:**\n\n\`\`\`${codeFact.metadata.codeLanguage || ''}\n${this.extractCodeFromContext(codeFact.context)}\n\`\`\``);
        usedSources.add(source.id);
      }
    }

    // Add quotes
    if (factsByType.quote) {
      const quoteFact = factsByType.quote[0];
      const source = sources.find(s => s.id === quoteFact.sourceId);
      if (source) {
        parts.push(`\n> ${quoteFact.claim}\n> — ${source.author || source.title}`);
        usedSources.add(source.id);
      }
    }

    // Ensure word count limit
    let content = parts.join('\n\n');
    content = this.limitWordCount(content, this.config.maxWordsPerSection);

    return content;
  }

  /**
   * Extract key takeaways
   */
  private extractKeyTakeaways(facts: Fact[], consensus: Consensus[]): string[] {
    const takeaways: string[] = [];

    // From consensus
    for (const c of consensus.slice(0, Math.floor(this.config.maxKeyTakeaways / 2))) {
      takeaways.push(c.claim);
    }

    // From high-confidence facts
    const highConfidenceFacts = facts
      .filter(f => f.type === 'statement' || f.type === 'statistic')
      .slice(0, this.config.maxKeyTakeaways - takeaways.length);

    for (const fact of highConfidenceFacts) {
      if (!takeaways.some(t => this.isSimilarClaim(t, fact.claim))) {
        takeaways.push(fact.claim);
      }
    }

    return takeaways.slice(0, this.config.maxKeyTakeaways);
  }

  /**
   * Render synthesis as markdown
   */
  renderMarkdown(result: SynthesisResult): string {
    const parts: string[] = [];

    // Title
    parts.push(`# ${result.outline.title}\n`);

    // Confidence badge
    if (this.config.includeConfidenceScores) {
      const indicator = this.confidenceScorer.getConfidenceIndicator(result.confidence.overall);
      const label = this.confidenceScorer.getConfidenceLabel(result.confidence.overall);
      parts.push(`> ${indicator} **Confidence:** ${label} (${Math.round(result.confidence.overall * 100)}%)\n`);
    }

    // Key Takeaways
    if (result.keyTakeaways.length > 0) {
      parts.push('## Key Takeaways\n');
      for (const takeaway of result.keyTakeaways) {
        parts.push(`- ${takeaway}`);
      }
      parts.push('');
    }

    // Sections
    for (const section of result.sections) {
      parts.push(`## ${section.title}`);
      if (this.config.includeConfidenceScores) {
        const indicator = this.confidenceScorer.getConfidenceIndicator(section.confidence);
        parts.push(`<small>${indicator} Section confidence: ${Math.round(section.confidence * 100)}%</small>`);
      }
      parts.push('');
      parts.push(section.content);
      parts.push('');
    }

    // Contradictions
    if (this.config.includeContradictions && result.contradictions.length > 0) {
      parts.push('## ⚠️ Contradictions & Disagreements\n');
      parts.push('Some sources present conflicting information:\n');
      
      for (const contradiction of result.contradictions.slice(0, 5)) {
        parts.push(`- **${contradiction.severity.toUpperCase()}**: Sources disagree on this point`);
      }
      parts.push('');
    }

    // Further Reading
    parts.push('## Further Reading\n');
    const sortedSources = [...result.bibliography.citations]
      .sort((a, b) => b.source.credibilityScore - a.source.credibilityScore)
      .slice(0, 5);
    
    for (const citation of sortedSources) {
      parts.push(`${citation.number}. [${citation.source.title}](${citation.source.url})`);
      if (citation.source.author) {
        parts.push(`   - Author: ${citation.source.author}`);
      }
    }
    parts.push('');

    // Bibliography
    parts.push('## References\n');
    for (const citation of result.bibliography.citations) {
      parts.push(`[${citation.number}] ${citation.source.title} — ${citation.source.url}`);
    }

    // Metadata
    parts.push('\n---\n');
    parts.push(`*Generated: ${result.metadata.generatedAt.toLocaleString()}*`);
    parts.push(`*Sources: ${result.metadata.sourcesUsed} | Facts: ${result.metadata.totalFacts}*`);

    return parts.join('\n');
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Cluster facts by topic
   */
  private clusterFactsByTopic(facts: Fact[]): Fact[][] {
    // Simple clustering based on keyword overlap
    const clusters: Fact[][] = [];
    const assigned = new Set<string>();

    for (const fact of facts) {
      if (assigned.has(fact.id)) continue;

      const cluster: Fact[] = [fact];
      assigned.add(fact.id);

      const factKeywords = this.extractKeywords(fact.claim);

      for (const other of facts) {
        if (assigned.has(other.id)) continue;

        const otherKeywords = this.extractKeywords(other.claim);
        const overlap = this.calculateKeywordOverlap(factKeywords, otherKeywords);

        if (overlap > 0.3) {
          cluster.push(other);
          assigned.add(other.id);
        }
      }

      clusters.push(cluster);
    }

    // Sort by size
    return clusters.sort((a, b) => b.length - a.length);
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): Set<string> {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !this.isStopWord(w));
    
    return new Set(words);
  }

  /**
   * Check if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'this', 'that', 'with', 'from', 'they', 'have', 'been', 'were',
      'said', 'each', 'which', 'their', 'what', 'when', 'where',
      'would', 'there', 'could', 'should',
    ]);
    return stopWords.has(word);
  }

  /**
   * Calculate keyword overlap
   */
  private calculateKeywordOverlap(setA: Set<string>, setB: Set<string>): number {
    const intersection = new Set(Array.from(setA).filter(x => setB.has(x)));
    const union = new Set([...Array.from(setA), ...Array.from(setB)]);
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Extract key points for a topic
   */
  private extractKeyPointsForTopic(facts: Fact[], maxPoints: number): string[] {
    return facts
      .filter(f => f.type === 'statement' || f.type === 'statistic')
      .slice(0, maxPoints)
      .map(f => f.claim);
  }

  /**
   * Get relevant source IDs for a topic
   */
  private getRelevantSourceIds(facts: Fact[], sources: Source[]): string[] {
    const sourceIds = Array.from(new Set(facts.map(f => f.sourceId)));
    return sourceIds.filter(id => sources.some(s => s.id === id));
  }

  /**
   * Infer topic title from facts
   */
  private inferTopicTitle(facts: Fact[]): string {
    if (facts.length === 0) return 'Details';

    // Extract common terms
    const allWords = facts.flatMap(f => 
      f.claim.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    );
    
    const wordFreq = new Map<string, number>();
    for (const word of allWords) {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    }

    // Get most frequent significant word
    const sorted = Array.from(wordFreq.entries())
      .filter(([w]) => !this.isStopWord(w))
      .sort((a, b) => b[1] - a[1]);

    const topWord = sorted[0]?.[0];
    
    if (topWord) {
      return topWord.charAt(0).toUpperCase() + topWord.slice(1);
    }

    return 'Details';
  }

  /**
   * Generate title from query
   */
  private generateTitle(query: string): string {
    // Clean up and capitalize
    return query
      .replace(/\?$/, '')
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Group facts by type
   */
  private groupFactsByType(facts: Fact[]): Partial<Record<Fact['type'], Fact[]>> {
    const grouped: Partial<Record<Fact['type'], Fact[]>> = {};
    
    for (const fact of facts) {
      if (!grouped[fact.type]) {
        grouped[fact.type] = [];
      }
      grouped[fact.type]!.push(fact);
    }

    return grouped;
  }

  /**
   * Synthesize a sentence with citation
   */
  private synthesizeSentence(claim: string, citation: string): string {
    // Clean up the claim
    let sentence = claim.trim();
    
    // Ensure it ends with period
    if (!/[.!?]$/.test(sentence)) {
      sentence += '.';
    }

    return `${sentence} ${citation}`;
  }

  /**
   * Extract code from context
   */
  private extractCodeFromContext(context: string): string {
    // Try to extract code block
    const codeBlockMatch = context.match(/```[\w]*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // Return truncated context
    return context.substring(0, 500);
  }

  /**
   * Limit word count
   */
  private limitWordCount(text: string, maxWords: number): string {
    const words = text.split(/\s+/);
    if (words.length <= maxWords) return text;
    return words.slice(0, maxWords).join(' ') + '...';
  }

  /**
   * Check if two claims are similar
   */
  private isSimilarClaim(claimA: string, claimB: string): boolean {
    const wordsA = new Set(claimA.toLowerCase().split(/\s+/));
    const wordsB = new Set(claimB.toLowerCase().split(/\s+/));
    
    const intersection = new Set(Array.from(wordsA).filter(x => wordsB.has(x)));
    const union = new Set([...Array.from(wordsA), ...Array.from(wordsB)]);
    
    return union.size > 0 && intersection.size / union.size > 0.6;
  }

  /**
   * Apply depth-specific configuration
   */
  private applyDepthConfig(depth: SearchDepth): void {
    const depthConfig = DEPTH_CONFIG[depth];
    this.config = { ...this.config, ...depthConfig };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createSynthesisEngine(
  citationManager: CitationManager,
  confidenceScorer: ConfidenceScorer,
  config?: Partial<SynthesisConfig>
): SynthesisEngine {
  return new SynthesisEngine(citationManager, confidenceScorer, config);
}
