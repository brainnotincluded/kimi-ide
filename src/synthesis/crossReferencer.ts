/**
 * Cross Referencer
 * 
 * Finds the same information across different sources,
 * checks consistency, finds contradictions, and determines consensus.
 */

import {
  Source,
  Fact,
  CrossReference,
  Contradiction,
  Consensus,
  StructuredClaim,
} from './types';
import * as crypto from 'crypto';

// ============================================================================
// Configuration
// ============================================================================

interface CrossReferencerConfig {
  similarityThreshold: number;
  contradictionThreshold: number;
  minSourcesForConsensus: number;
  consensusAgreementThreshold: number;
}

const DEFAULT_CONFIG: CrossReferencerConfig = {
  similarityThreshold: 0.75,
  contradictionThreshold: 0.6,
  minSourcesForConsensus: 3,
  consensusAgreementThreshold: 0.7,
};

// ============================================================================
// Cross Referencer Class
// ============================================================================

export class CrossReferencer {
  private config: CrossReferencerConfig;

  constructor(config: Partial<CrossReferencerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Cross-reference facts across sources
   */
  async crossReference(facts: Fact[], sources: Source[]): Promise<{
    crossReferences: CrossReference[];
    contradictions: Contradiction[];
    consensus: Consensus[];
  }> {
    // Group facts by similarity
    const factGroups = this.groupSimilarFacts(facts);

    // Analyze each group
    const crossReferences: CrossReference[] = [];
    const contradictions: Contradiction[] = [];
    const consensus: Consensus[] = [];

    for (const group of factGroups) {
      const analysis = this.analyzeFactGroup(group, sources);
      
      crossReferences.push(...analysis.crossReferences);
      contradictions.push(...analysis.contradictions);
      
      if (analysis.consensus) {
        consensus.push(analysis.consensus);
      }
    }

    return {
      crossReferences,
      contradictions,
      consensus,
    };
  }

  /**
   * Find contradictions between structured claims
   */
  async findContradictions(claims: StructuredClaim[]): Promise<Contradiction[]> {
    const contradictions: Contradiction[] = [];

    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        const claimA = claims[i];
        const claimB = claims[j];

        if (this.areContradictory(claimA, claimB)) {
          contradictions.push({
            id: this.generateId(),
            claimA: claimA.id,
            claimB: claimB.id,
            sourceA: claimA.sources[0],
            sourceB: claimB.sources[0],
            severity: this.calculateContradictionSeverity(claimA, claimB),
            detectedAt: new Date(),
          });
        }
      }
    }

    return contradictions;
  }

  /**
   * Determine consensus on a claim
   */
  async determineConsensus(
    claim: string,
    supportingFacts: Fact[],
    sources: Source[]
  ): Promise<Consensus | null> {
    const sourceIds = Array.from(new Set(supportingFacts.map(f => f.sourceId)));

    if (sourceIds.length < this.config.minSourcesForConsensus) {
      return null;
    }

    // Calculate agreement level
    const agreementLevel = this.calculateAgreementLevel(supportingFacts, sources);

    if (agreementLevel < this.config.consensusAgreementThreshold) {
      return null;
    }

    return {
      id: this.generateId(),
      claim,
      sourceIds,
      agreementLevel,
      supportingEvidence: supportingFacts.map(f => f.id),
    };
  }

  /**
   * Track information provenance
   */
  trackProvenance(fact: Fact, sources: Source[]): {
    originalSource: Source | null;
    propagation: Source[];
    citations: string[];
  } {
    const sourceMap = new Map(sources.map(s => [s.id, s]));
    const factSource = sourceMap.get(fact.sourceId);
    
    if (!factSource) {
      return { originalSource: null, propagation: [], citations: [] };
    }

    // Find earliest source mentioning similar information
    const similarFacts = this.findSimilarFacts(fact, sources);
    const sortedByDate = similarFacts
      .map(f => ({ fact: f, source: sourceMap.get(f.sourceId) }))
      .filter(item => item.source)
      .sort((a, b) => {
        const dateA = a.source!.publishDate || a.source!.fetchDate;
        const dateB = b.source!.publishDate || b.source!.fetchDate;
        return dateA.getTime() - dateB.getTime();
      });

    const originalSource = sortedByDate[0]?.source || factSource;
    const propagation = sortedByDate.map(item => item.source!);

    // Extract citations from content
    const citations = this.extractCitations(factSource.content);

    return {
      originalSource,
      propagation,
      citations,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Group similar facts together
   */
  private groupSimilarFacts(facts: Fact[]): Fact[][] {
    const groups: Fact[][] = [];
    const assigned = new Set<string>();

    for (const fact of facts) {
      if (assigned.has(fact.id)) continue;

      const group: Fact[] = [fact];
      assigned.add(fact.id);

      for (const other of facts) {
        if (assigned.has(other.id)) continue;
        
        if (this.factsSimilarity(fact, other) >= this.config.similarityThreshold) {
          group.push(other);
          assigned.add(other.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Analyze a group of similar facts
   */
  private analyzeFactGroup(
    group: Fact[],
    sources: Source[]
  ): {
    crossReferences: CrossReference[];
    contradictions: Contradiction[];
    consensus: Consensus | null;
  } {
    const sourceIds = Array.from(new Set(group.map(f => f.sourceId)));
    
    // Check for contradictions within the group
    const contradictions = this.findGroupContradictions(group);
    
    // Determine consistency
    let consistency: CrossReference['consistency'] = 'consistent';
    if (contradictions.length > 0) {
      consistency = contradictions.length > group.length / 2 ? 'contradictory' : 'partial';
    }

    // Create cross-reference
    const crossRef: CrossReference = {
      id: this.generateId(),
      claimId: group[0].id,
      sourceIds,
      consistency,
      confidence: this.calculateGroupConfidence(group, sources),
      notes: this.generateConsistencyNotes(group, contradictions),
    };

    // Determine consensus
    let consensus: Consensus | null = null;
    if (consistency !== 'contradictory' && sourceIds.length >= this.config.minSourcesForConsensus) {
      consensus = {
        id: this.generateId(),
        claim: group[0].claim,
        sourceIds,
        agreementLevel: 1 - (contradictions.length / group.length),
        supportingEvidence: group.map(f => f.id),
      };
    }

    return {
      crossReferences: [crossRef],
      contradictions,
      consensus,
    };
  }

  /**
   * Find contradictions within a fact group
   */
  private findGroupContradictions(group: Fact[]): Contradiction[] {
    const contradictions: Contradiction[] = [];

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const factA = group[i];
        const factB = group[j];

        if (this.areFactsContradictory(factA, factB)) {
          contradictions.push({
            id: this.generateId(),
            claimA: factA.id,
            claimB: factB.id,
            sourceA: factA.sourceId,
            sourceB: factB.sourceId,
            severity: this.assessContradictionSeverity(factA, factB),
            detectedAt: new Date(),
          });
        }
      }
    }

    return contradictions;
  }

  /**
   * Check if two facts are contradictory
   */
  private areFactsContradictory(factA: Fact, factB: Fact): boolean {
    // Same claim from different sources is not contradictory
    if (factA.claim === factB.claim) return false;

    // Check for negation
    const negationPatterns = [
      /\b(not|no|never|without|isn't|aren't|doesn't|don't|didn't)\b/gi,
      /\b(false|incorrect|wrong|untrue)\b/gi,
    ];

    const aHasNegation = negationPatterns.some(p => p.test(factA.claim));
    const bHasNegation = negationPatterns.some(p => p.test(factB.claim));

    // If one has negation and they share similar content
    if (aHasNegation !== bHasNegation) {
      const similarity = this.calculateTextSimilarity(
        factA.claim.replace(/\b(not|no|never)\b/gi, ''),
        factB.claim.replace(/\b(not|no|never)\b/gi, '')
      );
      
      if (similarity > 0.7) {
        return true;
      }
    }

    // Check for numerical contradictions
    const numsA = factA.metadata.numbers || [];
    const numsB = factB.metadata.numbers || [];
    
    if (numsA.length > 0 && numsB.length > 0) {
      // If claims have same subject but different numbers significantly
      const textSim = this.calculateTextSimilarity(
        factA.claim.replace(/\d+/g, ''),
        factB.claim.replace(/\d+/g, '')
      );
      
      if (textSim > 0.8) {
        // Check if numbers differ significantly
        for (const numA of numsA) {
          for (const numB of numsB) {
            const diff = Math.abs(numA - numB);
            const avg = (numA + numB) / 2;
            if (diff / avg > 0.2) { // 20% difference threshold
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if two structured claims are contradictory
   */
  private areContradictory(claimA: StructuredClaim, claimB: StructuredClaim): boolean {
    // Same subject, same predicate, different object
    if (claimA.subject === claimB.subject && claimA.predicate === claimB.predicate) {
      if (claimA.object !== claimB.object) {
        return true;
      }
    }

    // Check for negated predicates
    const negatedPredicates: Record<string, string> = {
      'is': 'is not',
      'has': 'does not have',
      'supports': 'does not support',
      'increases': 'decreases',
      'enables': 'disables',
    };

    const predA = claimA.predicate.toLowerCase();
    const predB = claimB.predicate.toLowerCase();

    if (claimA.subject === claimB.subject && claimA.object === claimB.object) {
      if (negatedPredicates[predA] === predB || negatedPredicates[predB] === predA) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate contradiction severity
   */
  private calculateContradictionSeverity(claimA: StructuredClaim, claimB: StructuredClaim): Contradiction['severity'] {
    const importanceIndicators = ['critical', 'essential', 'primary', 'major', 'significant'];
    
    const claimText = `${claimA.subject} ${claimA.predicate} ${claimA.object}`.toLowerCase();
    const importance = importanceIndicators.filter(ind => claimText.includes(ind)).length;

    if (importance >= 2) return 'major';
    if (importance >= 1) return 'moderate';
    return 'minor';
  }

  /**
   * Assess contradiction severity between facts
   */
  private assessContradictionSeverity(factA: Fact, factB: Fact): Contradiction['severity'] {
    // Check if contradiction involves core claims
    const coreIndicators = ['always', 'never', 'all', 'none', 'must', 'cannot'];
    const aCore = coreIndicators.some(i => factA.claim.toLowerCase().includes(i));
    const bCore = coreIndicators.some(i => factB.claim.toLowerCase().includes(i));

    if (aCore || bCore) return 'major';

    // Check if involves specific data
    if (factA.metadata.numbers?.length && factB.metadata.numbers?.length) {
      return 'moderate';
    }

    return 'minor';
  }

  /**
   * Calculate agreement level among facts
   */
  private calculateAgreementLevel(facts: Fact[], sources: Source[]): number {
    if (facts.length <= 1) return 1;

    let agreements = 0;
    let comparisons = 0;

    for (let i = 0; i < facts.length; i++) {
      for (let j = i + 1; j < facts.length; j++) {
        comparisons++;
        if (!this.areFactsContradictory(facts[i], facts[j])) {
          agreements++;
        }
      }
    }

    return comparisons > 0 ? agreements / comparisons : 1;
  }

  /**
   * Calculate confidence for a fact group
   */
  private calculateGroupConfidence(group: Fact[], sources: Source[]): number {
    const sourceMap = new Map(sources.map(s => [s.id, s]));
    
    let totalConfidence = 0;
    for (const fact of group) {
      const source = sourceMap.get(fact.sourceId);
      if (source) {
        totalConfidence += source.credibilityScore;
      }
    }

    // More sources = higher confidence, up to a point
    const sourceBonus = Math.min(0.2, (group.length - 1) * 0.05);

    return Math.min(1, (totalConfidence / group.length) + sourceBonus);
  }

  /**
   * Calculate similarity between two facts
   */
  private factsSimilarity(factA: Fact, factB: Fact): number {
    return this.calculateTextSimilarity(factA.claim, factB.claim);
  }

  /**
   * Calculate text similarity using cosine similarity of word vectors
   */
  private calculateTextSimilarity(textA: string, textB: string): number {
    const wordsA = this.tokenize(textA);
    const wordsB = this.tokenize(textB);

    const setA = new Set(wordsA);
    const setB = new Set(wordsB);

    const intersection = new Set(Array.from(setA).filter(x => setB.has(x)));
    const union = new Set([...Array.from(setA), ...Array.from(setB)]);

    return intersection.size / union.size;
  }

  /**
   * Tokenize text into words
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2);
  }

  /**
   * Find similar facts in sources
   */
  private findSimilarFacts(fact: Fact, sources: Source[]): Fact[] {
    // This would search through all sources for similar facts
    // Simplified implementation
    return [];
  }

  /**
   * Extract citations from content
   */
  private extractCitations(content: string): string[] {
    const citations: string[] = [];
    
    // Match various citation formats
    const patterns = [
      /\[\d+\]/g,                    // [1], [2]
      /\([^)]+\d{4}[^)]*\)/g,        // (Author, 2020)
      /\[\w+\s+et\s+al\.[^\]]*\]/g, // [Smith et al. 2020]
    ];

    for (const pattern of patterns) {
      const matches = content.match(pattern);
      if (matches) {
        citations.push(...matches);
      }
    }

    return Array.from(new Set(citations));
  }

  /**
   * Generate consistency notes
   */
  private generateConsistencyNotes(group: Fact[], contradictions: Contradiction[]): string {
    if (contradictions.length === 0) {
      return `Found ${group.length} consistent sources supporting this claim.`;
    }

    if (contradictions.length === group.length - 1) {
      return `Major disagreement: ${contradictions.length} contradictory sources found.`;
    }

    return `Partial consensus: ${group.length - contradictions.length} sources agree, ${contradictions.length} contradict.`;
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

export function createCrossReferencer(config?: Partial<CrossReferencerConfig>): CrossReferencer {
  return new CrossReferencer(config);
}
