/**
 * Confidence Scorer
 * 
 * Evaluates confidence in claims based on:
 * - Number of corroborating sources
 * - Source credibility
 * - Information freshness
 * - Presence of contradictions
 * - Consensus level
 */

import {
  Source,
  Fact,
  ConfidenceScore,
  ConfidenceFactors,
  Contradiction,
  Consensus,
  StructuredClaim,
  AnySource,
} from './types';

// ============================================================================
// Configuration
// ============================================================================

interface ConfidenceScorerConfig {
  minSourcesForHighConfidence: number;
  freshnessDecayDays: number;
  contradictionPenalty: number;
  consensusBonus: number;
  credibilityWeight: number;
  diversityWeight: number;
}

const DEFAULT_CONFIG: ConfidenceScorerConfig = {
  minSourcesForHighConfidence: 5,
  freshnessDecayDays: 365,
  contradictionPenalty: 0.2,
  consensusBonus: 0.15,
  credibilityWeight: 0.35,
  diversityWeight: 0.2,
};

// ============================================================================
// Confidence Scorer Class
// ============================================================================

export class ConfidenceScorer {
  private config: ConfidenceScorerConfig;

  constructor(config: Partial<ConfidenceScorerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate confidence score for a fact
   */
  calculateFactConfidence(
    fact: Fact,
    sources: Source[],
    contradictions: Contradiction[],
    consensus: Consensus | null
  ): ConfidenceScore {
    const source = sources.find(s => s.id === fact.sourceId);
    const corroboratingSources = this.findCorroboratingSources(fact, sources);

    const factors: ConfidenceFactors = {
      sourceCount: this.scoreSourceCount([fact.sourceId, ...corroboratingSources]),
      sourceCredibility: this.scoreSourceCredibility([source, ...corroboratingSources.map(id => sources.find(s => s.id === id))].filter(Boolean) as Source[]),
      sourceDiversity: this.scoreSourceDiversity([fact.sourceId, ...corroboratingSources], sources),
      informationFreshness: this.scoreFreshness([source, ...corroboratingSources.map(id => sources.find(s => s.id === id))].filter(Boolean) as Source[]),
      contradictionPenalty: this.scoreContradictionPenalty(fact, contradictions),
      consensusBonus: this.scoreConsensusBonus(consensus),
    };

    const breakdown = {
      sourceReliability: factors.sourceCredibility,
      corroboration: (factors.sourceCount + factors.sourceDiversity) / 2,
      recency: factors.informationFreshness,
      consistency: 1 - factors.contradictionPenalty + factors.consensusBonus,
    };

    const overall = this.calculateOverallScore(factors, breakdown);

    return {
      overall,
      factors,
      breakdown,
      explanation: this.generateExplanation(factors, overall),
    };
  }

  /**
   * Calculate confidence for a structured claim
   */
  calculateClaimConfidence(
    claim: StructuredClaim,
    sources: Source[],
    contradictions: Contradiction[],
    allClaims: StructuredClaim[]
  ): ConfidenceScore {
    const claimSources = sources.filter(s => claim.sources.includes(s.id));
    const supportingClaims = allClaims.filter(c => 
      c.supports.includes(claim.id) && c.id !== claim.id
    );

    const factors: ConfidenceFactors = {
      sourceCount: this.scoreSourceCount(claim.sources),
      sourceCredibility: this.scoreSourceCredibility(claimSources),
      sourceDiversity: this.scoreSourceDiversity(claim.sources, sources),
      informationFreshness: this.scoreFreshness(claimSources),
      contradictionPenalty: claim.contradictions.length * this.config.contradictionPenalty,
      consensusBonus: supportingClaims.length * 0.05,
    };

    const breakdown = {
      sourceReliability: factors.sourceCredibility,
      corroboration: (factors.sourceCount + factors.sourceDiversity) / 2,
      recency: factors.informationFreshness,
      consistency: 1 - factors.contradictionPenalty + factors.consensusBonus,
    };

    const overall = this.calculateOverallScore(factors, breakdown);

    return {
      overall,
      factors,
      breakdown,
      explanation: this.generateExplanation(factors, overall),
    };
  }

  /**
   * Calculate confidence for a synthesized answer
   */
  calculateSynthesisConfidence(
    usedSources: Source[],
    facts: Fact[],
    contradictions: Contradiction[],
    consensus: Consensus[]
  ): ConfidenceScore {
    const factors: ConfidenceFactors = {
      sourceCount: this.scoreSourceCount(usedSources.map(s => s.id)),
      sourceCredibility: this.scoreSourceCredibility(usedSources),
      sourceDiversity: this.scoreSourceDiversity(usedSources.map(s => s.id), usedSources),
      informationFreshness: this.scoreFreshness(usedSources),
      contradictionPenalty: Math.min(0.5, contradictions.length * this.config.contradictionPenalty),
      consensusBonus: Math.min(0.3, consensus.length * this.config.consensusBonus),
    };

    const breakdown = {
      sourceReliability: factors.sourceCredibility,
      corroboration: (factors.sourceCount + factors.sourceDiversity) / 2,
      recency: factors.informationFreshness,
      consistency: 1 - factors.contradictionPenalty + factors.consensusBonus,
    };

    const overall = this.calculateOverallScore(factors, breakdown);

    return {
      overall,
      factors,
      breakdown,
      explanation: this.generateSynthesisExplanation(factors, overall, usedSources.length),
    };
  }

  /**
   * Score based on number of sources
   */
  private scoreSourceCount(sourceIds: string[]): number {
    const count = sourceIds.length;
    
    if (count >= this.config.minSourcesForHighConfidence) return 1;
    if (count >= 3) return 0.8;
    if (count === 2) return 0.6;
    if (count === 1) return 0.4;
    return 0;
  }

  /**
   * Score based on source credibility
   */
  private scoreSourceCredibility(sources: Source[]): number {
    if (sources.length === 0) return 0;

    const totalCredibility = sources.reduce((sum, s) => sum + (s?.credibilityScore || 0.5), 0);
    const average = totalCredibility / sources.length;

    // Bonus for having multiple high-credibility sources
    const highCredibilityCount = sources.filter(s => (s?.credibilityScore || 0) >= 0.8).length;
    const highCredibilityBonus = Math.min(0.2, highCredibilityCount * 0.05);

    return Math.min(1, average + highCredibilityBonus);
  }

  /**
   * Score based on source diversity
   */
  private scoreSourceDiversity(sourceIds: string[], sources: Source[]): number {
    const sourceTypes = new Set<string>();
    const domains = new Set<string>();
    
    for (const sourceId of sourceIds) {
      const source = sources.find(s => s.id === sourceId);
      if (source) {
        sourceTypes.add(source.sourceType);
        if (source.domain) {
          domains.add(source.domain);
        }
      }
    }

    // Score based on type diversity
    const typeScore = Math.min(1, sourceTypes.size * 0.25);
    
    // Score based on domain diversity
    const domainScore = Math.min(1, domains.size * 0.15);

    return (typeScore + domainScore) / 2;
  }

  /**
   * Score based on information freshness
   */
  private scoreFreshness(sources: Source[]): number {
    if (sources.length === 0) return 0.5;

    const now = Date.now();
    const decayMs = this.config.freshnessDecayDays * 24 * 60 * 60 * 1000;

    let totalScore = 0;
    let validSources = 0;

    for (const source of sources) {
      const date = source.publishDate || source.fetchDate;
      if (date) {
        const age = now - date.getTime();
        const score = Math.max(0, 1 - age / decayMs);
        totalScore += score;
        validSources++;
      }
    }

    return validSources > 0 ? totalScore / validSources : 0.5;
  }

  /**
   * Score penalty for contradictions
   */
  private scoreContradictionPenalty(fact: Fact, contradictions: Contradiction[]): number {
    const relevantContradictions = contradictions.filter(c => 
      c.claimA === fact.id || c.claimB === fact.id
    );

    const severityPenalty = relevantContradictions.reduce((sum, c) => {
      switch (c.severity) {
        case 'major': return sum + this.config.contradictionPenalty;
        case 'moderate': return sum + this.config.contradictionPenalty * 0.6;
        case 'minor': return sum + this.config.contradictionPenalty * 0.3;
        default: return sum;
      }
    }, 0);

    return Math.min(0.5, severityPenalty);
  }

  /**
   * Score bonus for consensus
   */
  private scoreConsensusBonus(consensus: Consensus | null): number {
    if (!consensus) return 0;
    return Math.min(this.config.consensusBonus, consensus.agreementLevel * this.config.consensusBonus);
  }

  /**
   * Calculate overall confidence score
   */
  private calculateOverallScore(
    factors: ConfidenceFactors,
    breakdown: ConfidenceScore['breakdown']
  ): number {
    // Weighted combination
    const weights = {
      sourceReliability: this.config.credibilityWeight,
      corroboration: 0.3,
      recency: 0.15,
      consistency: 0.2,
    };

    let score = 0;
    score += breakdown.sourceReliability * weights.sourceReliability;
    score += breakdown.corroboration * weights.corroboration;
    score += breakdown.recency * weights.recency;
    score += breakdown.consistency * weights.consistency;

    // Apply diversity bonus
    score += factors.sourceDiversity * this.config.diversityWeight;

    return Math.min(1, Math.max(0, score));
  }

  /**
   * Find corroborating sources for a fact
   */
  private findCorroboratingSources(fact: Fact, sources: Source[]): string[] {
    // In practice, this would use semantic similarity
    // For now, return sources with similar content
    const corroborating: string[] = [];
    const source = sources.find(s => s.id === fact.sourceId);
    
    if (!source) return corroborating;

    for (const otherSource of sources) {
      if (otherSource.id === fact.sourceId) continue;
      
      // Simple text overlap check
      if (this.contentSimilarity(source.content, otherSource.content) > 0.5) {
        corroborating.push(otherSource.id);
      }
    }

    return corroborating;
  }

  /**
   * Calculate content similarity
   */
  private contentSimilarity(contentA: string, contentB: string): number {
    const wordsA = new Set(this.tokenize(contentA));
    const wordsB = new Set(this.tokenize(contentB));

    const intersection = new Set(Array.from(wordsA).filter(x => wordsB.has(x)));
    const union = new Set([...Array.from(wordsA), ...Array.from(wordsB)]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Tokenize text
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);
  }

  /**
   * Generate explanation for confidence score
   */
  private generateExplanation(factors: ConfidenceFactors, overall: number): string {
    const parts: string[] = [];

    if (overall >= 0.8) {
      parts.push('High confidence');
    } else if (overall >= 0.6) {
      parts.push('Moderate confidence');
    } else if (overall >= 0.4) {
      parts.push('Low confidence');
    } else {
      parts.push('Very low confidence');
    }

    if (factors.sourceCount >= 0.8) {
      parts.push('well-supported by multiple sources');
    } else if (factors.sourceCount >= 0.5) {
      parts.push('supported by limited sources');
    } else {
      parts.push('based on few sources');
    }

    if (factors.sourceCredibility >= 0.8) {
      parts.push('from highly credible sources');
    }

    if (factors.contradictionPenalty > 0.1) {
      parts.push('with some contradictory evidence');
    }

    if (factors.consensusBonus > 0) {
      parts.push('showing consensus');
    }

    return parts.join(', ') + '.';
  }

  /**
   * Generate explanation for synthesis confidence
   */
  private generateSynthesisExplanation(
    factors: ConfidenceFactors,
    overall: number,
    sourceCount: number
  ): string {
    const parts: string[] = [];

    if (overall >= 0.8) {
      parts.push('This synthesis has high confidence');
    } else if (overall >= 0.6) {
      parts.push('This synthesis has moderate confidence');
    } else {
      parts.push('This synthesis has lower confidence');
    }

    parts.push(`based on ${sourceCount} source${sourceCount !== 1 ? 's' : ''}`);

    if (factors.sourceDiversity >= 0.6) {
      parts.push('from diverse perspectives');
    }

    if (factors.informationFreshness >= 0.8) {
      parts.push('with recent information');
    }

    if (factors.contradictionPenalty > 0.1) {
      parts.push(`(note: ${Math.round(factors.contradictionPenalty * 100)}% confidence reduction due to contradictions)`);
    }

    return parts.join(' ') + '.';
  }

  /**
   * Get confidence level label
   */
  getConfidenceLabel(score: number): string {
    if (score >= 0.9) return 'Very High';
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Moderate';
    if (score >= 0.4) return 'Low';
    if (score >= 0.2) return 'Very Low';
    return 'Unreliable';
  }

  /**
   * Get confidence emoji indicator
   */
  getConfidenceIndicator(score: number): string {
    if (score >= 0.8) return '✓';
    if (score >= 0.6) return '~';
    return '⚠';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createConfidenceScorer(config?: Partial<ConfidenceScorerConfig>): ConfidenceScorer {
  return new ConfidenceScorer(config);
}
