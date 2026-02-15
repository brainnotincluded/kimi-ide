/**
 * Diff Merger for Parallel Multi-Strategy Editing
 * Handles combining changes from multiple strategies intelligently
 */

import {
  DiffChunk,
  EditingResult,
  MergeResult,
  MergeConflict,
  StrategyType,
} from './types';

/**
 * Calculate diff between original and modified content
 */
export function calculateDiff(
  original: string,
  modified: string,
  contextLines: number = 3
): DiffChunk[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  
  const chunks: DiffChunk[] = [];
  let i = 0;
  let j = 0;
  
  while (i < originalLines.length || j < modifiedLines.length) {
    // Skip matching lines
    while (
      i < originalLines.length &&
      j < modifiedLines.length &&
      originalLines[i] === modifiedLines[j]
    ) {
      i++;
      j++;
    }
    
    if (i >= originalLines.length && j >= modifiedLines.length) {
      break;
    }
    
    // Find the extent of changes
    const oldStart = i;
    const newStart = j;
    let removedLines: string[] = [];
    let addedLines: string[] = [];
    
    // Collect removed lines
    while (
      i < originalLines.length &&
      (j >= modifiedLines.length || originalLines[i] !== modifiedLines[j])
    ) {
      // Check if this line appears later in modified
      const futureIndex = modifiedLines.indexOf(originalLines[i], j);
      if (futureIndex !== -1 && futureIndex - j < 5) {
        // Small gap, likely just insertions
        break;
      }
      removedLines.push(originalLines[i]);
      i++;
    }
    
    // Collect added lines
    while (
      j < modifiedLines.length &&
      (i >= originalLines.length || originalLines[i] !== modifiedLines[j])
    ) {
      // Check if this line appears later in original
      const futureIndex = originalLines.indexOf(modifiedLines[j], i);
      if (futureIndex !== -1 && futureIndex - i < 5) {
        // Small gap, likely just removals
        break;
      }
      addedLines.push(modifiedLines[j]);
      j++;
    }
    
    if (removedLines.length > 0 || addedLines.length > 0) {
      chunks.push({
        type: removedLines.length > 0 && addedLines.length > 0 ? 'context' : 
              removedLines.length > 0 ? 'remove' : 'add',
        oldStart,
        oldLines: removedLines.length,
        newStart,
        newLines: addedLines.length,
        lines: [...removedLines.map(l => '-' + l), ...addedLines.map(l => '+' + l)],
      });
    }
  }
  
  return chunks;
}

/**
 * Check if two diff chunks overlap
 */
function chunksOverlap(chunk1: DiffChunk, chunk2: DiffChunk): boolean {
  const c1Start = chunk1.oldStart;
  const c1End = chunk1.oldStart + chunk1.oldLines;
  const c2Start = chunk2.oldStart;
  const c2End = chunk2.oldStart + chunk2.oldLines;
  
  return c1Start < c2End && c2Start < c1End;
}

/**
 * Check if two results can be merged (non-overlapping changes)
 */
export function canMergeResults(
  result1: EditingResult,
  result2: EditingResult
): boolean {
  // If either has no diff, they can merge
  if (result1.diff.length === 0 || result2.diff.length === 0) {
    return true;
  }
  
  // Check if any chunks overlap
  for (const chunk1 of result1.diff) {
    for (const chunk2 of result2.diff) {
      if (chunksOverlap(chunk1, chunk2)) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Find conflicts between multiple results
 */
function findConflicts(results: EditingResult[]): MergeConflict[] {
  const conflicts: MergeConflict[] = [];
  
  for (let i = 0; i < results.length; i++) {
    for (let j = i + 1; j < results.length; j++) {
      const r1 = results[i];
      const r2 = results[j];
      
      for (const chunk1 of r1.diff) {
        for (const chunk2 of r2.diff) {
          if (chunksOverlap(chunk1, chunk2)) {
            conflicts.push({
              strategy1: r1.strategy,
              strategy2: r2.strategy,
              lineStart: Math.min(chunk1.oldStart, chunk2.oldStart),
              lineEnd: Math.max(
                chunk1.oldStart + chunk1.oldLines,
                chunk2.oldStart + chunk2.oldLines
              ),
              content1: extractChunkContent(r1.content, chunk1),
              content2: extractChunkContent(r2.content, chunk2),
            });
          }
        }
      }
    }
  }
  
  return conflicts;
}

/**
 * Extract content for a specific chunk
 */
function extractChunkContent(content: string, chunk: DiffChunk): string {
  const lines = content.split('\n');
  return lines.slice(chunk.newStart, chunk.newStart + chunk.newLines).join('\n');
}

/**
 * Apply diff chunks to original content
 */
function applyChunks(
  original: string,
  chunks: DiffChunk[],
  contentMap: Map<number, string>
): string {
  const lines = original.split('\n');
  const result: string[] = [];
  let lastIndex = 0;
  
  // Sort chunks by position
  const sortedChunks = [...chunks].sort((a, b) => a.oldStart - b.oldStart);
  
  for (const chunk of sortedChunks) {
    // Add unchanged lines before this chunk
    result.push(...lines.slice(lastIndex, chunk.oldStart));
    
    // Get the replacement content
    const replacement = contentMap.get(chunk.oldStart);
    if (replacement !== undefined) {
      result.push(...replacement.split('\n'));
    } else {
      // Add new lines from the chunk
      for (const line of chunk.lines) {
        if (line.startsWith('+')) {
          result.push(line.substring(1));
        }
      }
    }
    
    lastIndex = chunk.oldStart + chunk.oldLines;
  }
  
  // Add remaining unchanged lines
  result.push(...lines.slice(lastIndex));
  
  return result.join('\n');
}

/**
 * Smart merge of multiple editing results
 * Attempts to combine non-conflicting changes from multiple strategies
 */
export function mergeResults(
  originalContent: string,
  results: EditingResult[],
  strategy: 'smart' | 'conservative' | 'aggressive' = 'smart'
): MergeResult {
  const startTime = Date.now();
  
  if (results.length === 0) {
    return {
      success: false,
      content: originalContent,
      mergedStrategies: [],
      conflicts: [],
      explanation: 'No results to merge',
    };
  }
  
  if (results.length === 1) {
    return {
      success: true,
      content: results[0].content,
      mergedStrategies: [results[0].strategy],
      conflicts: [],
      explanation: 'Single result, no merging needed',
    };
  }
  
  // Find all conflicts
  const conflicts = findConflicts(results);
  
  if (conflicts.length === 0) {
    // No conflicts - simple merge
    const merged = simpleMerge(originalContent, results);
    return {
      success: true,
      content: merged,
      mergedStrategies: results.map(r => r.strategy),
      conflicts: [],
      explanation: `Successfully merged ${results.length} strategies with no conflicts`,
    };
  }
  
  // Handle conflicts based on strategy
  return resolveConflicts(originalContent, results, conflicts, strategy);
}

/**
 * Simple merge for non-conflicting changes
 */
function simpleMerge(originalContent: string, results: EditingResult[]): string {
  // Collect all chunks with their new content
  const allChunks: Array<{ chunk: DiffChunk; content: string; priority: number }> = [];
  
  for (const result of results) {
    const priority = getStrategyPriority(result.strategy);
    for (const chunk of result.diff) {
      allChunks.push({
        chunk,
        content: extractChunkContent(result.content, chunk),
        priority,
      });
    }
  }
  
  // Sort by position
  allChunks.sort((a, b) => a.chunk.oldStart - b.chunk.oldStart);
  
  // Build content map
  const contentMap = new Map<number, string>();
  for (const { chunk, content } of allChunks) {
    contentMap.set(chunk.oldStart, content);
  }
  
  // Apply all changes
  return applyChunks(
    originalContent,
    allChunks.map(c => c.chunk),
    contentMap
  );
}

/**
 * Get priority for conflict resolution (lower = higher priority)
 */
function getStrategyPriority(strategy: StrategyType): number {
  const priorities: Record<StrategyType, number> = {
    'minimal-diff': 1,
    'conservative': 2,
    'test-first': 3,
    'balanced': 4,
    'aggressive': 5,
  };
  return priorities[strategy] || 4;
}

/**
 * Resolve conflicts using specified strategy
 */
function resolveConflicts(
  originalContent: string,
  results: EditingResult[],
  conflicts: MergeConflict[],
  strategy: 'smart' | 'conservative' | 'aggressive'
): MergeResult {
  // Group chunks by strategy
  const strategyChunks = new Map<StrategyType, DiffChunk[]>();
  for (const result of results) {
    strategyChunks.set(result.strategy, result.diff);
  }
  
  // Track which strategies' changes we can use
  const usableStrategies = new Set<StrategyType>();
  const resolvedConflicts: MergeConflict[] = [];
  
  switch (strategy) {
    case 'conservative':
      // Use only changes from the most conservative strategy without conflicts
      for (const result of results.sort(
        (a, b) => getStrategyPriority(a.strategy) - getStrategyPriority(b.strategy)
      )) {
        let hasConflict = false;
        for (const conflict of conflicts) {
          if (
            conflict.strategy1 === result.strategy ||
            conflict.strategy2 === result.strategy
          ) {
            hasConflict = true;
            break;
          }
        }
        if (!hasConflict) {
          usableStrategies.add(result.strategy);
          break; // Only use one strategy
        }
      }
      break;
      
    case 'aggressive':
      // Try to merge as much as possible, preferring higher priority strategies
      for (const result of results.sort(
        (a, b) => getStrategyPriority(a.strategy) - getStrategyPriority(b.strategy)
      )) {
        usableStrategies.add(result.strategy);
      }
      // Mark conflicts as resolved with higher priority strategy
      for (const conflict of conflicts) {
        const p1 = getStrategyPriority(conflict.strategy1);
        const p2 = getStrategyPriority(conflict.strategy2);
        resolvedConflicts.push({
          ...conflict,
          resolution: p1 <= p2 ? 'strategy1' : 'strategy2',
        });
      }
      break;
      
    case 'smart':
    default:
      // Smart merge: use non-conflicting parts, resolve conflicts intelligently
      for (const result of results) {
        let hasConflict = false;
        for (const conflict of conflicts) {
          if (
            conflict.strategy1 === result.strategy ||
            conflict.strategy2 === result.strategy
          ) {
            hasConflict = true;
            break;
          }
        }
        if (!hasConflict) {
          usableStrategies.add(result.strategy);
        }
      }
      
      // For conflicts, try to find partial merges
      for (const conflict of conflicts) {
        // Prefer the strategy with higher confidence
        const result1 = results.find(r => r.strategy === conflict.strategy1);
        const result2 = results.find(r => r.strategy === conflict.strategy2);
        
        if (result1 && result2) {
          const resolution: MergeConflict = {
            ...conflict,
            resolution:
              result1.confidence > result2.confidence + 0.2
                ? 'strategy1'
                : result2.confidence > result1.confidence + 0.2
                ? 'strategy2'
                : 'manual',
          };
          resolvedConflicts.push(resolution);
          
          if (resolution.resolution !== 'manual') {
            usableStrategies.add(
              resolution.resolution === 'strategy1'
                ? conflict.strategy1
                : conflict.strategy2
            );
          }
        }
      }
      break;
  }
  
  // Build final content from usable strategies
  const usableResults = results.filter(r => usableStrategies.has(r.strategy));
  
  if (usableResults.length === 0) {
    return {
      success: false,
      content: originalContent,
      mergedStrategies: [],
      conflicts: resolvedConflicts,
      explanation: 'Could not resolve conflicts automatically',
    };
  }
  
  // Apply changes from usable strategies
  let mergedContent = originalContent;
  for (const result of usableResults.sort(
    (a, b) => getStrategyPriority(a.strategy) - getStrategyPriority(b.strategy)
  )) {
    const contentMap = new Map<number, string>();
    for (const chunk of result.diff) {
      contentMap.set(chunk.oldStart, extractChunkContent(result.content, chunk));
    }
    mergedContent = applyChunks(mergedContent, result.diff, contentMap);
  }
  
  return {
    success: resolvedConflicts.every(c => c.resolution !== 'manual'),
    content: mergedContent,
    mergedStrategies: Array.from(usableStrategies),
    conflicts: resolvedConflicts,
    explanation: `Merged ${usableStrategies.size} strategies. ${
      resolvedConflicts.filter(c => c.resolution === 'manual').length
    } conflicts need manual resolution.`,
  };
}

/**
 * Check if a merge would be beneficial
 */
export function isMergeBeneficial(results: EditingResult[]): {
  beneficial: boolean;
  reason: string;
  estimatedImprovement: number;
} {
  if (results.length < 2) {
    return {
      beneficial: false,
      reason: 'Need at least 2 results to merge',
      estimatedImprovement: 0,
    };
  }
  
  // Check for non-overlapping improvements
  const strategiesWithImprovements = results.filter(
    r => r.metrics.linesAdded > 0 || r.metrics.linesRemoved > 0
  );
  
  if (strategiesWithImprovements.length < 2) {
    return {
      beneficial: false,
      reason: 'Not enough strategies made meaningful changes',
      estimatedImprovement: 0,
    };
  }
  
  // Check if strategies cover different aspects
  const hasBugFix = results.some(r =>
    r.explanation.toLowerCase().includes('fix') ||
    r.explanation.toLowerCase().includes('bug')
  );
  const hasRefactoring = results.some(r =>
    r.explanation.toLowerCase().includes('refactor') ||
    r.explanation.toLowerCase().includes('extract')
  );
  const hasOptimization = results.some(r =>
    r.explanation.toLowerCase().includes('optim') ||
    r.explanation.toLowerCase().includes('performance')
  );
  
  const diversity = [hasBugFix, hasRefactoring, hasOptimization].filter(Boolean).length;
  
  if (diversity >= 2) {
    return {
      beneficial: true,
      reason: `Strategies cover ${diversity} different aspects (bug fix, refactoring, optimization)`,
      estimatedImprovement: diversity * 15,
    };
  }
  
  // Check confidence spread
  const confidences = results.map(r => r.confidence);
  const maxConf = Math.max(...confidences);
  const minConf = Math.min(...confidences);
  
  if (maxConf - minConf < 0.3) {
    return {
      beneficial: true,
      reason: 'Similar confidence levels suggest complementary approaches',
      estimatedImprovement: 10,
    };
  }
  
  return {
    beneficial: false,
    reason: 'No clear benefit from merging these specific results',
    estimatedImprovement: 5,
  };
}

/**
 * Generate a merged explanation from multiple results
 */
export function generateMergedExplanation(results: EditingResult[]): string {
  const parts: string[] = [];
  
  parts.push(`Combined approach from ${results.length} strategies:\n`);
  
  for (const result of results) {
    const summary = result.explanation.split('\n')[0]; // First line only
    parts.push(`• **${result.strategy}**: ${summary}`);
  }
  
  // Add synthesis
  const totalAdded = results.reduce((sum, r) => sum + r.metrics.linesAdded, 0);
  const totalRemoved = results.reduce((sum, r) => sum + r.metrics.linesRemoved, 0);
  
  parts.push(
    `\n**Combined metrics**: +${totalAdded}/-${totalRemoved} lines across all strategies`
  );
  
  return parts.join('\n');
}
