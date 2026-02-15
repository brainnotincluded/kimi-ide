/**
 * Core types for Parallel Multi-Strategy Editing system
 */

export interface EditingContext {
  filePath: string;
  originalContent: string;
  language: string;
  cursorPosition?: Position;
  selection?: Range;
  projectContext?: ProjectContext;
  promptCache?: PromptCache;
}

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface ProjectContext {
  styleGuide?: string;
  dependencies?: string[];
  relatedFiles?: string[];
  imports?: string[];
  existingPatterns?: string;
}

export interface PromptCache {
  systemPrompt: string;
  contextPrompt: string;
  examplesPrompt?: string;
}

export interface EditStrategy {
  name: StrategyType;
  description: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  constraints: StrategyConstraints;
}

export type StrategyType = 
  | 'conservative' 
  | 'balanced' 
  | 'aggressive' 
  | 'test-first' 
  | 'minimal-diff';

export interface StrategyConstraints {
  maxLinesChanged?: number;
  allowRefactoring?: boolean;
  allowRenaming?: boolean;
  preserveComments?: boolean;
  preserveFormatting?: boolean;
  preferExtractMethods?: boolean;
}

export interface EditingResult {
  strategy: StrategyType;
  content: string;
  diff: DiffChunk[];
  explanation: string;
  confidence: number;
  metrics: ResultMetrics;
  timestamp: number;
  duration: number;
}

export interface DiffChunk {
  type: 'add' | 'remove' | 'context';
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

export interface ResultMetrics {
  linesAdded: number;
  linesRemoved: number;
  charactersChanged: number;
  complexityScore?: number;
  testCoverage?: number;
  maintainabilityScore?: number;
}

export interface SelectionCriteria {
  codeQuality: number;
  diffSize: number;
  styleGuideMatch: number;
  bugRisk: number;
  readability: number;
  performance: number;
}

export interface RankedResult {
  result: EditingResult;
  score: number;
  breakdown: ScoreBreakdown;
  ranking: number;
}

export interface ScoreBreakdown {
  codeQuality: number;
  diffEfficiency: number;
  styleCompliance: number;
  safety: number;
  overall: number;
}

export interface MergeResult {
  success: boolean;
  content: string;
  mergedStrategies: StrategyType[];
  conflicts: MergeConflict[];
  explanation: string;
}

export interface MergeConflict {
  strategy1: StrategyType;
  strategy2: StrategyType;
  lineStart: number;
  lineEnd: number;
  content1: string;
  content2: string;
  resolution?: 'strategy1' | 'strategy2' | 'combined' | 'manual';
}

export interface ParallelEditOptions {
  strategies?: StrategyType[];
  timeout?: number;
  enableMerging?: boolean;
  enableUserSelection?: boolean;
  autoApplyThreshold?: number;
  preserveCache?: boolean;
}

export interface ParallelEditResult {
  results: EditingResult[];
  rankedResults: RankedResult[];
  bestResult: EditingResult;
  mergedResult?: MergeResult;
  explanation: string;
  duration: number;
}

export interface UserSelectionOptions {
  showInlineDiff: boolean;
  showSideBySide: boolean;
  allowPartialAccept: boolean;
  showMetrics: boolean;
  showExplanations: boolean;
}
