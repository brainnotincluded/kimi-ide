/**
 * Parallel Multi-Strategy Editing System for Kimi VS Code Extension
 * 
 * This module provides intelligent code editing by running multiple strategies
 * in parallel and selecting or merging the best results.
 * 
 * Inspired by Codebuff but integrated deeply with VS Code for superior UX.
 * 
 * @example
 * ```typescript
 * import { 
 *   ParallelEditor, 
 *   createParallelEditor,
 *   VSCodeIntegrationImpl 
 * } from './editing';
 * 
 * const vscodeIntegration = new VSCodeIntegrationImpl();
 * const editor = createParallelEditor(llmClient, vscodeIntegration);
 * 
 * const result = await editor.execute(context, "Fix the bug in this function");
 * ```
 */

// Import types for local usage
import type { StrategyType } from './types';

// Core types
export type {
  // Context and input
  EditingContext,
  Position,
  Range,
  ProjectContext,
  PromptCache,
  
  // Strategy definitions
  EditStrategy,
  StrategyType,
  StrategyConstraints,
  
  // Results
  EditingResult,
  DiffChunk,
  ResultMetrics,
  SelectionCriteria,
  RankedResult,
  ScoreBreakdown,
  
  // Merge
  MergeResult,
  MergeConflict,
  
  // Options and outputs
  ParallelEditOptions,
  ParallelEditResult,
} from './types';

// Strategy templates
export {
  // Individual strategies
  ConservativeStrategy,
  BalancedStrategy,
  AggressiveStrategy,
  TestFirstStrategy,
  MinimalDiffStrategy,
  
  // Strategy utilities
  getStrategy,
  getAllStrategies,
  getDefaultParallelStrategies,
  getStrategyForFileType,
  createCustomStrategy,
} from './strategyTemplates';

// Diff merger
export {
  // Core merge functions
  mergeResults,
  canMergeResults,
  isMergeBeneficial,
  generateMergedExplanation,
  calculateDiff,
} from './diffMerger';

// Result selector
export {
  // Selection functions
  selectBestResult,
  rankResults,
  shouldUseMergedResult,
  extractBestParts,
  getComparisonSummary,
  
  // Types
  EvaluatorConfig,
} from './resultSelector';

// Parallel editor engine
export {
  // Main class
  ParallelEditor,
  
  // Factory
  createParallelEditor,
  
  // Configuration
  ParallelEditorConfig,
  
  // Interfaces
  LLMClient,
  VSCodeIntegration,
} from './parallelEditor';

// VS Code integration
export {
  VSCodeIntegrationImpl,
  registerParallelEditorCommands,
  createDiffDecorations,
} from './vscodeIntegration';

/**
 * Version of the parallel editing system
 */
export const VERSION = '1.0.0';

/**
 * Default strategies for parallel execution
 */
export const DEFAULT_PARALLEL_STRATEGIES: StrategyType[] = [
  'conservative',
  'balanced',
  'aggressive',
];

/**
 * Strategy descriptions for UI
 */
export const STRATEGY_DESCRIPTIONS: Record<StrategyType, { 
  name: string; 
  description: string; 
  emoji: string;
  risk: 'low' | 'medium' | 'high';
}> = {
  'conservative': {
    name: 'Conservative',
    description: 'Minimal changes focusing only on the specific issue. Preserves existing code structure and minimizes risk.',
    emoji: '🛡️',
    risk: 'low',
  },
  'balanced': {
    name: 'Balanced',
    description: 'Optimal balance of improvement and safety. Makes sensible refactoring when beneficial.',
    emoji: '⚖️',
    risk: 'medium',
  },
  'aggressive': {
    name: 'Aggressive',
    description: 'Maximum code quality improvements through significant refactoring. Higher risk but potentially greater long-term benefits.',
    emoji: '🚀',
    risk: 'high',
  },
  'test-first': {
    name: 'Test-First',
    description: 'TDD approach ensuring testability. Generates tests first, then implements to pass.',
    emoji: '🧪',
    risk: 'low',
  },
  'minimal-diff': {
    name: 'Minimal Diff',
    description: 'Ultra-minimal changes optimized purely for smallest diff size. Hotfix mentality.',
    emoji: '🎯',
    risk: 'low',
  },
};

/**
 * Utility to get strategy info for display
 */
export function getStrategyInfo(type: StrategyType): typeof STRATEGY_DESCRIPTIONS[StrategyType] {
  return STRATEGY_DESCRIPTIONS[type];
}

/**
 * Utility to get all strategy options for UI
 */
export function getStrategyOptions(): Array<{ 
  type: StrategyType; 
  name: string; 
  description: string;
  emoji: string;
  risk: 'low' | 'medium' | 'high';
}> {
  return (Object.keys(STRATEGY_DESCRIPTIONS) as StrategyType[]).map(type => ({
    type,
    ...STRATEGY_DESCRIPTIONS[type],
  }));
}
