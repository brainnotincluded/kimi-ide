/**
 * Result Selector for Parallel Multi-Strategy Editing
 * Evaluates and selects the best editing result from multiple strategies
 */

import {
  EditingResult,
  RankedResult,
  ScoreBreakdown,
  StrategyType,
  ResultMetrics,
} from './types';

/**
 * Configuration for result evaluation
 */
export interface EvaluatorConfig {
  weights: {
    codeQuality: number;
    diffEfficiency: number;
    styleCompliance: number;
    safety: number;
    confidence: number;
  };
  thresholds: {
    minConfidence: number;
    maxDiffRatio: number;
    maxComplexityIncrease: number;
  };
  preferences: {
    preferSmallerDiffs: boolean;
    preferHigherConfidence: boolean;
    balanceRefactoring: boolean;
  };
}

const DEFAULT_CONFIG: EvaluatorConfig = {
  weights: {
    codeQuality: 0.3,
    diffEfficiency: 0.2,
    styleCompliance: 0.2,
    safety: 0.2,
    confidence: 0.1,
  },
  thresholds: {
    minConfidence: 0.5,
    maxDiffRatio: 0.5,
    maxComplexityIncrease: 5,
  },
  preferences: {
    preferSmallerDiffs: false, // Smaller != always better
    preferHigherConfidence: true,
    balanceRefactoring: true,
  },
};

/**
 * Evaluate code quality heuristically
 */
function evaluateCodeQuality(result: EditingResult): number {
  const content = result.content;
  let score = 0.5; // Base score
  
  // Check for code smells (would be more sophisticated in real implementation)
  const smells: string[] = [];
  
  // Long lines
  const longLines = content.split('\n').filter(l => l.length > 120).length;
  if (longLines > 5) smells.push('long_lines');
  
  // Deep nesting (simplified check)
  const deepNesting = (content.match(/\n[ \t]{8,}/g) || []).length;
  if (deepNesting > 10) smells.push('deep_nesting');
  
  // Magic numbers
  const magicNumbers = (content.match(/[^"\w](\d{2,})[^"\w]/g) || []).length;
  if (magicNumbers > 5) smells.push('magic_numbers');
  
  // TODO/FIXME comments
  const todos = (content.match(/TODO|FIXME|XXX/gi) || []).length;
  if (todos > 3) smells.push('todos');
  
  // Comment ratio
  const lines = content.split('\n');
  const codeLines = lines.filter(l => l.trim() && !l.trim().startsWith('//')).length;
  const commentLines = lines.filter(l => l.trim().startsWith('//') || l.trim().startsWith('*')).length;
  const commentRatio = codeLines > 0 ? commentLines / codeLines : 0;
  
  if (commentRatio > 0.3) {
    score += 0.1; // Good commenting
  } else if (commentRatio < 0.05 && codeLines > 50) {
    score -= 0.1; // Needs more comments
  }
  
  // Function length (simplified)
  const longFunctions = (content.match(/\{[\s\S]{1000,}?\}/g) || []).length;
  if (longFunctions === 0) score += 0.15;
  
  // Deductions for smells
  score -= smells.length * 0.05;
  
  // Maintainability score from metrics
  if (result.metrics.maintainabilityScore !== undefined) {
    score += (result.metrics.maintainabilityScore - 0.5) * 0.2;
  }
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Evaluate diff efficiency
 * Smaller isn't always better - the right size for the change
 */
function evaluateDiffEfficiency(result: EditingResult): number {
  const { linesAdded, linesRemoved } = result.metrics;
  const totalChanged = linesAdded + linesRemoved;
  
  // Base score
  let score = 0.5;
  
  // Check if this is a minimal diff strategy
  if (result.strategy === 'minimal-diff' || result.strategy === 'conservative') {
    // For these strategies, smaller is expected and good
    if (totalChanged <= 3) {
      score += 0.4;
    } else if (totalChanged <= 10) {
      score += 0.2;
    }
  } else if (result.strategy === 'aggressive') {
    // For aggressive, larger changes are expected
    if (totalChanged > 20) {
      score += 0.2;
    }
  }
  
  // Penalize excessive changes for the strategy type
  const expectedMax = getExpectedMaxChanges(result.strategy);
  if (totalChanged > expectedMax * 2) {
    score -= 0.2;
  }
  
  // Bonus for good add/remove ratio (more refactoring = similar add/remove)
  const ratio = linesAdded / (linesRemoved + 1);
  if (ratio >= 0.8 && ratio <= 1.2) {
    score += 0.1; // Balanced refactoring
  }
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Get expected maximum changes for a strategy
 */
function getExpectedMaxChanges(strategy: StrategyType): number {
  const expectations: Record<StrategyType, number> = {
    'minimal-diff': 3,
    'conservative': 10,
    'test-first': 30,
    'balanced': 50,
    'aggressive': 100,
  };
  return expectations[strategy] || 50;
}

/**
 * Evaluate style guide compliance (heuristic)
 */
function evaluateStyleCompliance(result: EditingResult): number {
  const content = result.content;
  let score = 0.5;
  
  // Consistent indentation
  const tabs = (content.match(/\n\t/g) || []).length;
  const spaces = (content.match(/\n  /g) || []).length;
  if (tabs === 0 || spaces === 0) {
    score += 0.15; // Consistent
  } else {
    score -= 0.1; // Mixed
  }
  
  // Trailing whitespace
  const trailingWhitespace = (content.match(/[ \t]+\n/g) || []).length;
  if (trailingWhitespace === 0) {
    score += 0.1;
  } else {
    score -= Math.min(0.2, trailingWhitespace * 0.01);
  }
  
  // Newline at end of file
  if (content.endsWith('\n')) {
    score += 0.05;
  }
  
  // Consistent quote style (simplified)
  const singleQuotes = (content.match(/'/g) || []).length;
  const doubleQuotes = (content.match(/"/g) || []).length;
  if (singleQuotes > doubleQuotes * 2 || doubleQuotes > singleQuotes * 2) {
    score += 0.1; // Mostly consistent
  }
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Evaluate safety (bug risk)
 */
function evaluateSafety(result: EditingResult): number {
  let score = 0.7; // Base safety score
  
  // Higher confidence = safer
  score += (result.confidence - 0.5) * 0.2;
  
  // Strategy-based safety adjustment
  const safetyMultipliers: Record<StrategyType, number> = {
    'minimal-diff': 0.15,
    'conservative': 0.1,
    'test-first': 0.05,
    'balanced': 0,
    'aggressive': -0.1,
  };
  score += safetyMultipliers[result.strategy] || 0;
  
  // Check explanation for risk indicators
  const explanation = result.explanation.toLowerCase();
  const riskIndicators = [
    'breaking change',
    'may break',
    'potential issue',
    'careful',
    'risk',
    'unsafe',
  ];
  
  for (const indicator of riskIndicators) {
    if (explanation.includes(indicator)) {
      score -= 0.05;
    }
  }
  
  // Large changes are inherently riskier
  const totalLines = result.metrics.linesAdded + result.metrics.linesRemoved;
  if (totalLines > 100) {
    score -= 0.1;
  }
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Calculate comprehensive score for a result
 */
function calculateScore(
  result: EditingResult,
  config: EvaluatorConfig = DEFAULT_CONFIG
): ScoreBreakdown {
  const codeQuality = evaluateCodeQuality(result);
  const diffEfficiency = evaluateDiffEfficiency(result);
  const styleCompliance = evaluateStyleCompliance(result);
  const safety = evaluateSafety(result);
  const confidence = result.confidence;
  
  const overall =
    codeQuality * config.weights.codeQuality +
    diffEfficiency * config.weights.diffEfficiency +
    styleCompliance * config.weights.styleCompliance +
    safety * config.weights.safety +
    confidence * config.weights.confidence;
  
  return {
    codeQuality,
    diffEfficiency,
    styleCompliance,
    safety,
    overall,
  };
}

/**
 * Rank multiple editing results
 */
export function rankResults(
  results: EditingResult[],
  config: EvaluatorConfig = DEFAULT_CONFIG
): RankedResult[] {
  const ranked: RankedResult[] = results.map(result => {
    const breakdown = calculateScore(result, config);
    return {
      result,
      score: breakdown.overall,
      breakdown,
      ranking: 0, // Will be set after sorting
    };
  });
  
  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);
  
  // Assign rankings
  ranked.forEach((r, i) => {
    r.ranking = i + 1;
  });
  
  return ranked;
}

/**
 * Select the best result
 */
export function selectBestResult(
  results: EditingResult[],
  config: EvaluatorConfig = DEFAULT_CONFIG
): {
  best: EditingResult;
  ranked: RankedResult[];
  explanation: string;
} {
  const ranked = rankResults(results, config);
  const best = ranked[0].result;
  
  const explanation = generateSelectionExplanation(ranked[0], ranked.slice(1));
  
  return {
    best,
    ranked,
    explanation,
  };
}

/**
 * Generate explanation for why this result was selected
 */
function generateSelectionExplanation(
  winner: RankedResult,
  others: RankedResult[]
): string {
  const parts: string[] = [];
  
  parts.push(`Selected **${winner.result.strategy}** strategy with score ${(winner.score * 100).toFixed(1)}%\n`);
  
  // Breakdown
  parts.push('Score breakdown:');
  parts.push(`  • Code Quality: ${(winner.breakdown.codeQuality * 100).toFixed(0)}%`);
  parts.push(`  • Diff Efficiency: ${(winner.breakdown.diffEfficiency * 100).toFixed(0)}%`);
  parts.push(`  • Style Compliance: ${(winner.breakdown.styleCompliance * 100).toFixed(0)}%`);
  parts.push(`  • Safety: ${(winner.breakdown.safety * 100).toFixed(0)}%`);
  parts.push(`  • Confidence: ${(winner.result.confidence * 100).toFixed(0)}%\n`);
  
  // Comparison with others
  if (others.length > 0) {
    const runnerUp = others[0];
    const diff = winner.score - runnerUp.score;
    
    if (diff < 0.1) {
      parts.push(`Close competition with ${runnerUp.result.strategy} (${(runnerUp.score * 100).toFixed(1)}%). `);
      parts.push(`Winner chosen due to higher ${findWinningFactor(winner, runnerUp)}.`);
    } else {
      parts.push(`Clear winner over ${runnerUp.result.strategy} (${(runnerUp.score * 100).toFixed(1)}%).`);
    }
  }
  
  // Strategy-specific insights
  parts.push(`\n${getStrategyInsight(winner.result)}`);
  
  return parts.join('\n');
}

/**
 * Find which factor made the winner win
 */
function findWinningFactor(winner: RankedResult, runnerUp: RankedResult): string {
  const factors: Array<{ name: string; diff: number }> = [
    { name: 'code quality', diff: winner.breakdown.codeQuality - runnerUp.breakdown.codeQuality },
    { name: 'diff efficiency', diff: winner.breakdown.diffEfficiency - runnerUp.breakdown.diffEfficiency },
    { name: 'style compliance', diff: winner.breakdown.styleCompliance - runnerUp.breakdown.styleCompliance },
    { name: 'safety', diff: winner.breakdown.safety - runnerUp.breakdown.safety },
  ];
  
  factors.sort((a, b) => b.diff - a.diff);
  return factors[0].name;
}

/**
 * Get insight about why this strategy worked well
 */
function getStrategyInsight(result: EditingResult): string {
  const insights: Record<StrategyType, string> = {
    'minimal-diff': 'Minimal changes reduce risk of introducing bugs.',
    'conservative': 'Conservative approach maintains code stability.',
    'test-first': 'Test-first ensures reliability and testability.',
    'balanced': 'Balanced approach optimizes for maintainability.',
    'aggressive': 'Aggressive refactoring maximizes long-term code quality.',
  };
  
  return insights[result.strategy] || 'Strategy performed well for this change.';
}

/**
 * Check if we should use merged result instead of single best
 */
export function shouldUseMergedResult(
  ranked: RankedResult[],
  threshold: number = 0.15
): boolean {
  if (ranked.length < 2) return false;
  
  const best = ranked[0];
  const second = ranked[1];
  
  // If scores are very close, consider merging
  const scoreDiff = best.score - second.score;
  
  if (scoreDiff < threshold) {
    return true;
  }
  
  // If best has low confidence, consider alternatives
  if (best.result.confidence < 0.6 && second.result.confidence > 0.7) {
    return true;
  }
  
  return false;
}

/**
 * Extract best parts from multiple results
 */
export function extractBestParts(
  results: EditingResult[],
  ranked: RankedResult[]
): {
  canCombine: boolean;
  recommendation: string;
  parts: Array<{ strategy: StrategyType; lines: number[]; reason: string }>;
} {
  // Analyze which strategy is best for which parts
  const parts: Array<{ strategy: StrategyType; lines: number[]; reason: string }> = [];
  
  // Simple heuristic: if strategies changed different line ranges
  const strategyRanges = results.map(r => ({
    strategy: r.strategy,
    ranges: r.diff.map(d => ({ start: d.oldStart, end: d.oldStart + d.oldLines })),
  }));
  
  // Check for non-overlapping ranges
  for (let i = 0; i < strategyRanges.length; i++) {
    const sr = strategyRanges[i];
    let overlaps = false;
    
    for (let j = 0; j < strategyRanges.length; j++) {
      if (i === j) continue;
      
      for (const range1 of sr.ranges) {
        for (const range2 of strategyRanges[j].ranges) {
          if (range1.start < range2.end && range2.start < range1.end) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) break;
      }
      if (overlaps) break;
    }
    
    if (!overlaps) {
      const allLines = sr.ranges.flatMap(r => 
        Array.from({ length: r.end - r.start }, (_, i) => r.start + i)
      );
      parts.push({
        strategy: sr.strategy,
        lines: allLines,
        reason: 'Non-overlapping changes',
      });
    }
  }
  
  const canCombine = parts.length >= 2;
  
  return {
    canCombine,
    recommendation: canCombine
      ? `Can combine ${parts.length} strategies with non-overlapping changes`
      : 'Strategies have overlapping changes - manual review recommended',
    parts,
  };
}

/**
 * Get user-friendly description of result comparison
 */
export function getComparisonSummary(
  ranked: RankedResult[]
): string {
  const lines: string[] = [];
  
  lines.push('## Strategy Comparison\n');
  lines.push('| Strategy | Score | Confidence | Lines +/- | Safety |');
  lines.push('|----------|-------|------------|-----------|--------|');
  
  for (const r of ranked) {
    const emoji = r.ranking === 1 ? '🏆' : r.ranking === 2 ? '🥈' : r.ranking === 3 ? '🥉' : '•';
    const m = r.result.metrics;
    lines.push(
      `| ${emoji} ${r.result.strategy} | ${(r.score * 100).toFixed(0)}% | ` +
      `${(r.result.confidence * 100).toFixed(0)}% | +${m.linesAdded}/-${m.linesRemoved} | ` +
      `${(r.breakdown.safety * 100).toFixed(0)}% |`
    );
  }
  
  return lines.join('\n');
}
