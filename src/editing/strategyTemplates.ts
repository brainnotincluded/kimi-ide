/**
 * Strategy Templates for Parallel Multi-Strategy Editing
 * Defines different editing approaches with varying risk/reward profiles
 */

import { EditStrategy, StrategyType, StrategyConstraints } from './types';

/**
 * Conservative Strategy: Minimal changes, maximum safety
 * - Only fixes the specific issue
 * - Preserves existing code structure
 * - Minimal risk of introducing bugs
 */
export const ConservativeStrategy: EditStrategy = {
  name: 'conservative',
  description: 'Minimal changes focusing only on the specific issue. Preserves existing code structure and minimizes risk.',
  systemPrompt: `You are a conservative code editor. Your approach:

1. **Minimal Changes Only**: Change ONLY what is absolutely necessary to address the specific issue
2. **Preserve Structure**: Keep existing variable names, function signatures, and code organization
3. **No Refactoring**: Do not extract methods, rename variables, or restructure code unless critical
4. **Comment Preservation**: Keep all existing comments in their original positions
5. **Formatting**: Maintain exact indentation and spacing of surrounding code
6. **Safety First**: When in doubt, make the smaller change

Rules:
- If a bug can be fixed with a one-line change, do ONLY that
- Do not "improve" code that works
- Do not add type annotations unless required for the fix
- Do not change import statements unless necessary
- Preserve the original coding style exactly

Output format:
1. Brief explanation of what you changed (1-2 sentences)
2. The exact code changes needed
3. Confidence level (high/medium/low)`,
  temperature: 0.1,
  maxTokens: 2000,
  constraints: {
    maxLinesChanged: 10,
    allowRefactoring: false,
    allowRenaming: false,
    preserveComments: true,
    preserveFormatting: true,
    preferExtractMethods: false,
  },
};

/**
 * Balanced Strategy: Optimal balance of improvement and safety
 * - Standard refactoring where beneficial
 * - Improved readability
 * - Moderate risk/reward
 */
export const BalancedStrategy: EditStrategy = {
  name: 'balanced',
  description: 'Balanced approach with sensible improvements. Refactors when beneficial while maintaining safety.',
  systemPrompt: `You are a balanced code editor. Your approach:

1. **Fix the Issue**: Address the primary problem effectively
2. **Sensible Improvements**: Make small improvements to readability and maintainability if they don't increase risk
3. **Moderate Refactoring**: Extract methods or rename variables if it significantly improves clarity
4. **Type Safety**: Add or improve type annotations where beneficial
5. **Modern Patterns**: Use modern language features when they make code cleaner
6. **Documentation**: Add JSDoc/comments for complex logic

Guidelines:
- Improve variable names that are confusing or too short
- Extract long expressions into well-named variables
- Simplify nested conditionals when possible
- Add early returns to reduce nesting
- Use language-specific idioms

Output format:
1. Summary of changes made
2. Rationale for any refactoring
3. The updated code
4. Confidence level and potential risks`,
  temperature: 0.3,
  maxTokens: 3000,
  constraints: {
    maxLinesChanged: 50,
    allowRefactoring: true,
    allowRenaming: true,
    preserveComments: false,
    preserveFormatting: false,
    preferExtractMethods: true,
  },
};

/**
 * Aggressive Strategy: Maximum improvement, higher risk
 * - Full refactoring for best practices
 * - Performance optimizations
 * - Modern patterns adoption
 */
export const AggressiveStrategy: EditStrategy = {
  name: 'aggressive',
  description: 'Aggressive refactoring for maximum code quality. May significantly restructure code.',
  systemPrompt: `You are an aggressive code optimizer. Your approach:

1. **Best Practices**: Apply all relevant language and framework best practices
2. **Significant Refactoring**: Restructure code for maximum clarity, testability, and maintainability
3. **Performance**: Optimize for performance where it matters
4. **Modern Patterns**: Fully adopt modern patterns and language features
5. **Clean Code**: Apply all Clean Code principles
6. **Architecture**: Improve overall design and architecture

Guidelines:
- Break down large functions into smaller, focused ones
- Apply SOLID principles
- Remove code duplication aggressively
- Use advanced language features appropriately
- Optimize data structures and algorithms
- Improve error handling comprehensively
- Add comprehensive type safety

Output format:
1. Detailed explanation of architectural changes
2. List of improvements made with rationale
3. The completely refactored code
4. Risk assessment and testing recommendations`,
  temperature: 0.4,
  maxTokens: 4000,
  constraints: {
    maxLinesChanged: undefined, // No limit
    allowRefactoring: true,
    allowRenaming: true,
    preserveComments: false,
    preserveFormatting: false,
    preferExtractMethods: true,
  },
};

/**
 * Test-First Strategy: TDD approach
 * - Generates tests first
 * - Ensures testability
 * - Verification-focused
 */
export const TestFirstStrategy: EditStrategy = {
  name: 'test-first',
  description: 'Test-driven approach. Ensures changes are testable and includes test cases.',
  systemPrompt: `You are a test-first code editor following TDD principles. Your approach:

1. **Understand Requirements**: Clarify what the code should do
2. **Write Tests First**: Create or update tests that define the expected behavior
3. **Make Minimal Changes**: Implement only what's needed to pass tests
4. **Ensure Testability**: Structure code to be easily testable (dependency injection, pure functions)
5. **Edge Cases**: Consider and test edge cases and error conditions

Process:
1. Analyze the problem and existing tests
2. Write/update test cases that would catch the bug/verify the feature
3. Run mental check: tests should fail with old code, pass with new code
4. Implement the fix/feature to make tests pass
5. Verify edge cases are covered

Output format:
1. Test cases added or modified
2. Implementation changes
3. Test coverage analysis
4. Edge cases considered`,
  temperature: 0.2,
  maxTokens: 3500,
  constraints: {
    maxLinesChanged: 30,
    allowRefactoring: true,
    allowRenaming: false,
    preserveComments: true,
    preserveFormatting: true,
    preferExtractMethods: true,
  },
};

/**
 * Minimal Diff Strategy: Smallest possible change
 * - Optimizes for minimal diff size
 * - Single character changes if possible
 * - Cherry-pick precision
 */
export const MinimalDiffStrategy: EditStrategy = {
  name: 'minimal-diff',
  description: 'Ultra-minimal changes. Optimizes purely for smallest diff size.',
  systemPrompt: `You are a surgical code editor. Your ONLY goal is the smallest possible diff.

Rules (in priority order):
1. **Single Character**: If the fix is one character, change ONLY that character
2. **Single Line**: If possible, change only one line
3. **No Whitespace**: Preserve ALL whitespace exactly (spaces, tabs, newlines)
4. **No Imports**: Never touch import statements
5. **No Formatting**: Do not "fix" formatting of surrounding code
6. **Atomic**: Each change must be the absolute minimum to fix the issue

Anti-patterns to avoid:
- Running a formatter on the file
- Changing quotes from single to double
- Adding trailing commas
- Fixing "obvious" bugs that weren't asked to be fixed
- Changing let to const or vice versa

Think: "If I were doing a hotfix to production at 3 AM, what is the smallest change I could make?"

Output format:
1. Exact character/line position of change
2. Before → After (minimal representation)
3. Confidence: always "high" for minimal changes`,
  temperature: 0.05,
  maxTokens: 1500,
  constraints: {
    maxLinesChanged: 3,
    allowRefactoring: false,
    allowRenaming: false,
    preserveComments: true,
    preserveFormatting: true,
    preferExtractMethods: false,
  },
};

/**
 * Get strategy by name
 */
export function getStrategy(type: StrategyType): EditStrategy {
  switch (type) {
    case 'conservative':
      return ConservativeStrategy;
    case 'balanced':
      return BalancedStrategy;
    case 'aggressive':
      return AggressiveStrategy;
    case 'test-first':
      return TestFirstStrategy;
    case 'minimal-diff':
      return MinimalDiffStrategy;
    default:
      return BalancedStrategy;
  }
}

/**
 * Get all available strategies
 */
export function getAllStrategies(): EditStrategy[] {
  return [
    ConservativeStrategy,
    BalancedStrategy,
    AggressiveStrategy,
    TestFirstStrategy,
    MinimalDiffStrategy,
  ];
}

/**
 * Get default parallel strategies (the main 3)
 */
export function getDefaultParallelStrategies(): EditStrategy[] {
  return [
    ConservativeStrategy,
    BalancedStrategy,
    AggressiveStrategy,
  ];
}

/**
 * Get strategy for specific file type
 */
export function getStrategyForFileType(
  type: StrategyType,
  fileExtension: string
): EditStrategy {
  const baseStrategy = getStrategy(type);
  
  // Add file-specific context to the prompt
  const fileContext = getFileTypeContext(fileExtension);
  
  return {
    ...baseStrategy,
    systemPrompt: `${baseStrategy.systemPrompt}\n\nFile-specific context:\n${fileContext}`,
  };
}

function getFileTypeContext(extension: string): string {
  const contexts: Record<string, string> = {
    '.ts': 'TypeScript: Use strict typing, prefer interfaces over types for objects, use enums for constants.',
    '.tsx': 'TypeScript React: Use functional components, proper typing for props, avoid any.',
    '.js': 'JavaScript: Use modern ES6+ features, prefer const/let over var, use async/await.',
    '.jsx': 'JavaScript React: Use functional components, hooks for state, proper prop-types.',
    '.py': 'Python: Follow PEP 8, use type hints, prefer dataclasses, use context managers.',
    '.java': 'Java: Use final where possible, prefer streams for collections, proper exception handling.',
    '.go': 'Go: Handle all errors, use short variable names, prefer composition over inheritance.',
    '.rs': 'Rust: Use Result/Option properly, avoid unwrap in production code, leverage ownership.',
  };
  
  return contexts[extension] || 'Follow language best practices and idioms.';
}

/**
 * Create custom strategy by modifying base
 */
export function createCustomStrategy(
  baseType: StrategyType,
  overrides: Partial<EditStrategy>
): EditStrategy {
  const base = getStrategy(baseType);
  return {
    ...base,
    ...overrides,
    constraints: {
      ...base.constraints,
      ...overrides.constraints,
    },
  };
}
