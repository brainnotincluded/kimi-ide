/**
 * Parallel Multi-Strategy Editing Engine
 * Runs multiple editing strategies in parallel and coordinates results
 */

import { 
  EditingContext, 
  EditingResult, 
  ParallelEditOptions, 
  ParallelEditResult,
  EditStrategy,
  StrategyType,
  DiffChunk,
  ResultMetrics,
} from './types';
import { 
  getStrategy, 
  getDefaultParallelStrategies,
  getStrategyForFileType,
} from './strategyTemplates';
import { 
  selectBestResult, 
  rankResults, 
  shouldUseMergedResult,
  extractBestParts,
  EvaluatorConfig,
} from './resultSelector';
import { 
  mergeResults, 
  canMergeResults, 
  isMergeBeneficial,
  generateMergedExplanation,
  calculateDiff,
} from './diffMerger';

/**
 * LLM client interface (to be implemented with actual LLM provider)
 */
export interface LLMClient {
  generate(params: {
    systemPrompt: string;
    userPrompt: string;
    temperature: number;
    maxTokens: number;
    cacheKey?: string;
  }): Promise<{
    content: string;
    usage: { promptTokens: number; completionTokens: number };
  }>;
}

/**
 * VS Code integration interface
 */
export interface VSCodeIntegration {
  showDiffViewer(options: {
    original: string;
    modified: string;
    title: string;
    language: string;
  }): Promise<void>;
  
  showMultiDiffViewer(options: {
    original: string;
    variants: Array<{
      content: string;
      label: string;
      description: string;
    }>;
    title: string;
  }): Promise<number | 'merge' | 'cancel'>;
  
  applyEdit(content: string): Promise<boolean>;
  
  showProgress<T>(task: string, operation: () => Promise<T>): Promise<T>;
}

/**
 * Main Parallel Editor class
 */
export class ParallelEditor {
  private llmClient: LLMClient;
  private vscode: VSCodeIntegration;
  private config: ParallelEditorConfig;
  private promptCache: Map<string, string> = new Map();

  constructor(
    llmClient: LLMClient,
    vscode: VSCodeIntegration,
    config: Partial<ParallelEditorConfig> = {}
  ) {
    this.llmClient = llmClient;
    this.vscode = vscode;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute parallel editing with multiple strategies
   */
  async execute(
    context: EditingContext,
    userRequest: string,
    options: ParallelEditOptions = {}
  ): Promise<ParallelEditResult> {
    const startTime = Date.now();
    const opts = { ...this.config.defaultOptions, ...options };
    
    // Determine which strategies to run
    const strategies = opts.strategies 
      ? opts.strategies.map(s => getStrategy(s))
      : getDefaultParallelStrategies();
    
    // Prepare context with cache
    const contextWithCache = {
      ...context,
      promptCache: this.buildPromptCache(context),
    };
    
    // Run strategies in parallel
    const results = await this.vscode.showProgress(
      `Running ${strategies.length} editing strategies in parallel...`,
      () => this.runStrategiesParallel(strategies, contextWithCache, userRequest, opts.timeout)
    );
    
    // Filter out failed results
    const validResults = results.filter((r): r is EditingResult => r !== null);
    
    if (validResults.length === 0) {
      throw new Error('All editing strategies failed');
    }
    
    // Rank results
    const ranked = rankResults(validResults, this.config.evaluatorConfig);
    
    // Decide on merge vs best single
    let mergedResult;
    let bestResult = ranked[0].result;
    let finalExplanation = ranked[0].result.explanation;
    
    if (opts.enableMerging && validResults.length >= 2) {
      const mergeCheck = isMergeBeneficial(validResults);
      const shouldMerge = shouldUseMergedResult(ranked);
      
      if (mergeCheck.beneficial || shouldMerge) {
        mergedResult = mergeResults(
          context.originalContent,
          validResults,
          this.config.mergeStrategy
        );
        
        if (mergedResult.success && mergedResult.conflicts.length === 0) {
          // Create a synthetic result for the merged content
          bestResult = {
            strategy: 'balanced', // Composite
            content: mergedResult.content,
            diff: calculateDiff(context.originalContent, mergedResult.content),
            explanation: generateMergedExplanation(validResults),
            confidence: Math.min(...validResults.map(r => r.confidence)) * 0.9,
            metrics: this.calculateCombinedMetrics(validResults),
            timestamp: Date.now(),
            duration: Date.now() - startTime,
          };
          finalExplanation = `Merged result from ${mergedResult.mergedStrategies.length} strategies. ${mergedResult.explanation}`;
        }
      }
    }
    
    const duration = Date.now() - startTime;
    
    // Show results to user if enabled
    if (opts.enableUserSelection) {
      const userChoice = await this.showUserSelection(
        context,
        ranked,
        mergedResult
      );
      
      if (userChoice === 'cancel') {
        throw new Error('User cancelled editing');
      }
      
      if (userChoice === 'merge' && mergedResult?.success) {
        bestResult = {
          ...bestResult,
          content: mergedResult.content,
        };
      } else if (typeof userChoice === 'number') {
        bestResult = ranked[userChoice].result;
      }
    }
    
    return {
      results: validResults,
      rankedResults: ranked,
      bestResult,
      mergedResult,
      explanation: finalExplanation,
      duration,
    };
  }

  /**
   * Run multiple strategies in parallel
   */
  private async runStrategiesParallel(
    strategies: EditStrategy[],
    context: EditingContext,
    userRequest: string,
    timeout?: number
  ): Promise<(EditingResult | null)[]> {
    const timeoutMs = timeout || this.config.defaultTimeout;
    
    const promises = strategies.map(async (strategy) => {
      const startTime = Date.now();
      
      try {
        // Build prompt for this strategy
        const prompt = this.buildStrategyPrompt(strategy, context, userRequest);
        
        // Call LLM
        const response = await this.llmClient.generate({
          systemPrompt: strategy.systemPrompt,
          userPrompt: prompt,
          temperature: strategy.temperature,
          maxTokens: strategy.maxTokens,
          cacheKey: context.promptCache?.systemPrompt,
        });
        
        // Parse result
        const result = this.parseLLMResponse(
          response.content,
          strategy,
          context,
          Date.now() - startTime
        );
        
        return result;
      } catch (error) {
        console.error(`Strategy ${strategy.name} failed:`, error);
        return null;
      }
    });
    
    // Add timeout to each promise
    const timeoutPromises = promises.map(p => 
      Promise.race([
        p,
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeoutMs)
        ).catch(() => null)
      ])
    );
    
    return Promise.all(timeoutPromises);
  }

  /**
   * Build prompt cache for reuse across strategies
   */
  private buildPromptCache(context: EditingContext): { systemPrompt: string; contextPrompt: string } {
    const cacheKey = `${context.filePath}:${context.originalContent.length}`;
    
    if (this.promptCache.has(cacheKey)) {
      return {
        systemPrompt: this.promptCache.get(cacheKey)!,
        contextPrompt: this.buildContextPrompt(context),
      };
    }
    
    const systemPrompt = this.buildSystemPrompt(context);
    this.promptCache.set(cacheKey, systemPrompt);
    
    return {
      systemPrompt,
      contextPrompt: this.buildContextPrompt(context),
    };
  }

  /**
   * Build base system prompt
   */
  private buildSystemPrompt(context: EditingContext): string {
    return `You are an expert code editor working on a ${context.language} file.
File: ${context.filePath}

Context:
${context.projectContext ? JSON.stringify(context.projectContext, null, 2) : 'No additional context'}

Your task is to edit the provided code according to the user's request.
Provide your response in this format:

EXPLANATION: Brief explanation of changes
CONFIDENCE: High/Medium/Low
METRICS: Added:X, Removed:Y, Complexity:Z
CODE:
[Your code here]`;
  }

  /**
   * Build context-specific prompt
   */
  private buildContextPrompt(context: EditingContext): string {
    const parts: string[] = [];
    
    parts.push(`File: ${context.filePath}`);
    parts.push(`Language: ${context.language}`);
    
    if (context.selection) {
      parts.push(`Selection: lines ${context.selection.start.line}-${context.selection.end.line}`);
    }
    
    if (context.cursorPosition) {
      parts.push(`Cursor: line ${context.cursorPosition.line}`);
    }
    
    parts.push('\n--- Original Code ---\n');
    parts.push(context.originalContent);
    
    return parts.join('\n');
  }

  /**
   * Build strategy-specific prompt
   */
  private buildStrategyPrompt(
    strategy: EditStrategy,
    context: EditingContext,
    userRequest: string
  ): string {
    const parts: string[] = [];
    
    parts.push(`Strategy: ${strategy.name}`);
    parts.push(`Description: ${strategy.description}\n`);
    parts.push(`User Request: ${userRequest}\n`);
    parts.push(context.promptCache?.contextPrompt || this.buildContextPrompt(context));
    
    // Add constraints
    parts.push('\n--- Constraints ---');
    if (strategy.constraints.maxLinesChanged) {
      parts.push(`Max lines to change: ${strategy.constraints.maxLinesChanged}`);
    }
    if (!strategy.constraints.allowRefactoring) {
      parts.push('No refactoring allowed');
    }
    if (strategy.constraints.preserveComments) {
      parts.push('Preserve all existing comments');
    }
    
    return parts.join('\n');
  }

  /**
   * Parse LLM response into structured result
   */
  private parseLLMResponse(
    content: string,
    strategy: EditStrategy,
    context: EditingContext,
    duration: number
  ): EditingResult {
    // Extract explanation
    const explanationMatch = content.match(/EXPLANATION:\s*(.+?)(?=\n(?:CONFIDENCE|METRICS|CODE):|$)/is);
    const explanation = explanationMatch?.[1]?.trim() || 'No explanation provided';
    
    // Extract confidence
    const confidenceMatch = content.match(/CONFIDENCE:\s*(High|Medium|Low)/i);
    const confidence = this.parseConfidence(confidenceMatch?.[1] || 'Medium');
    
    // Extract metrics
    const metricsMatch = content.match(/METRICS:\s*Added:(\d+),\s*Removed:(\d+)(?:,\s*Complexity:(\d+))?/i);
    const metrics: ResultMetrics = {
      linesAdded: parseInt(metricsMatch?.[1] || '0', 10),
      linesRemoved: parseInt(metricsMatch?.[2] || '0', 10),
      charactersChanged: 0,
      complexityScore: metricsMatch?.[3] ? parseInt(metricsMatch[3], 10) / 10 : undefined,
    };
    
    // Extract code
    const codeMatch = content.match(/CODE:\s*\n?([\s\S]+)$/);
    const code = codeMatch?.[1]?.trim() || content; // Fallback to full content
    
    // Calculate actual diff
    const diff = calculateDiff(context.originalContent, code);
    
    // Calculate actual metrics from diff
    metrics.linesAdded = diff.filter(d => d.type === 'add' || d.lines.some(l => l.startsWith('+'))).length;
    metrics.linesRemoved = diff.filter(d => d.type === 'remove' || d.lines.some(l => l.startsWith('-'))).length;
    metrics.charactersChanged = Math.abs(code.length - context.originalContent.length);
    
    return {
      strategy: strategy.name,
      content: code,
      diff,
      explanation,
      confidence,
      metrics,
      timestamp: Date.now(),
      duration,
    };
  }

  /**
   * Parse confidence string to number
   */
  private parseConfidence(confidence: string): number {
    const map: Record<string, number> = {
      high: 0.9,
      medium: 0.6,
      low: 0.3,
    };
    return map[confidence.toLowerCase()] || 0.6;
  }

  /**
   * Calculate combined metrics for merged result
   */
  private calculateCombinedMetrics(results: EditingResult[]): ResultMetrics {
    const combined: ResultMetrics = {
      linesAdded: 0,
      linesRemoved: 0,
      charactersChanged: 0,
    };
    
    for (const r of results) {
      combined.linesAdded += r.metrics.linesAdded;
      combined.linesRemoved += r.metrics.linesRemoved;
      combined.charactersChanged += r.metrics.charactersChanged;
    }
    
    // Average the scores
    const complexityScores = results
      .map(r => r.metrics.complexityScore)
      .filter((s): s is number => s !== undefined);
    if (complexityScores.length > 0) {
      combined.complexityScore = complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length;
    }
    
    return combined;
  }

  /**
   * Show selection UI to user
   */
  private async showUserSelection(
    context: EditingContext,
    ranked: Awaited<ReturnType<typeof rankResults>>,
    mergedResult?: Awaited<ReturnType<typeof mergeResults>>
  ): Promise<number | 'merge' | 'cancel'> {
    const variants = ranked.map((r, i) => ({
      content: r.result.content,
      label: `${i + 1}. ${r.result.strategy}`,
      description: `Score: ${(r.score * 100).toFixed(0)}%, Confidence: ${(r.result.confidence * 100).toFixed(0)}%`,
    }));
    
    if (mergedResult?.success) {
      variants.push({
        content: mergedResult.content,
        label: 'Merge',
        description: `Combined from ${mergedResult.mergedStrategies.length} strategies`,
      });
    }
    
    const choice = await this.vscode.showMultiDiffViewer({
      original: context.originalContent,
      variants,
      title: `Select Best Edit - ${context.filePath}`,
    });
    
    return choice;
  }

  /**
   * Quick edit with best strategy only
   */
  async quickEdit(
    context: EditingContext,
    userRequest: string
  ): Promise<EditingResult> {
    const result = await this.execute(context, userRequest, {
      strategies: ['balanced'],
      enableUserSelection: false,
      enableMerging: false,
    });
    
    return result.bestResult;
  }

  /**
   * Smart edit with automatic strategy selection
   */
  async smartEdit(
    context: EditingContext,
    userRequest: string
  ): Promise<ParallelEditResult> {
    // Analyze request to determine best strategies
    const strategies = this.selectStrategiesForRequest(userRequest);
    
    return this.execute(context, userRequest, {
      strategies,
      enableMerging: true,
      enableUserSelection: strategies.length > 1,
    });
  }

  /**
   * Select appropriate strategies based on request
   */
  private selectStrategiesForRequest(request: string): StrategyType[] {
    const lower = request.toLowerCase();
    
    // Bug fix -> conservative + minimal-diff
    if (lower.includes('fix') || lower.includes('bug') || lower.includes('error')) {
      return ['minimal-diff', 'conservative', 'test-first'];
    }
    
    // Refactor -> balanced + aggressive
    if (lower.includes('refactor') || lower.includes('clean') || lower.includes('improve')) {
      return ['balanced', 'aggressive', 'conservative'];
    }
    
    // Feature -> test-first + balanced
    if (lower.includes('add') || lower.includes('feature') || lower.includes('implement')) {
      return ['test-first', 'balanced', 'aggressive'];
    }
    
    // Optimization -> aggressive + balanced
    if (lower.includes('optim') || lower.includes('performance') || lower.includes('slow')) {
      return ['aggressive', 'balanced', 'conservative'];
    }
    
    // Default
    return ['conservative', 'balanced', 'aggressive'];
  }

  /**
   * Clear prompt cache
   */
  clearCache(): void {
    this.promptCache.clear();
  }
}

/**
 * Configuration for ParallelEditor
 */
export interface ParallelEditorConfig {
  defaultTimeout: number;
  defaultOptions: ParallelEditOptions;
  evaluatorConfig: EvaluatorConfig;
  mergeStrategy: 'smart' | 'conservative' | 'aggressive';
  maxConcurrentStrategies: number;
  enableMetrics: boolean;
}

const DEFAULT_CONFIG: ParallelEditorConfig = {
  defaultTimeout: 30000,
  defaultOptions: {
    strategies: ['conservative', 'balanced', 'aggressive'],
    timeout: 30000,
    enableMerging: true,
    enableUserSelection: true,
    autoApplyThreshold: 0.85,
    preserveCache: true,
  },
  evaluatorConfig: {
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
      preferSmallerDiffs: false,
      preferHigherConfidence: true,
      balanceRefactoring: true,
    },
  },
  mergeStrategy: 'smart',
  maxConcurrentStrategies: 5,
  enableMetrics: true,
};

/**
 * Factory function to create ParallelEditor
 */
export function createParallelEditor(
  llmClient: LLMClient,
  vscode: VSCodeIntegration,
  config?: Partial<ParallelEditorConfig>
): ParallelEditor {
  return new ParallelEditor(llmClient, vscode, config);
}
