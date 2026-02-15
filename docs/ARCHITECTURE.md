# Kimi IDE Architecture

This document describes the high-level architecture, design decisions, and technical implementation details of Kimi IDE.

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Multi-Agent System](#multi-agent-system)
- [Tree-based Discovery](#tree-based-discovery)
- [Parallel Editing](#parallel-editing)
- [Automatic Code Review](#automatic-code-review)
- [Smart Context Management](#smart-context-management)
- [Wire Protocol](#wire-protocol)
- [Security Model](#security-model)
- [Performance Considerations](#performance-considerations)

---

## Overview

Kimi IDE is a VS Code extension that brings AI-powered coding capabilities through a Multi-Agent System. It combines the VS Code Extension API with advanced AI features.

### Key Technologies

| Category | Technology |
|----------|-----------|
| **Framework** | VS Code Extension API |
| **Language** | TypeScript 5.x |
| **UI** | VS Code WebView API |
| **Editor** | Monaco Editor (via VS Code) |
| **AI Backend** | Moonshot AI API |
| **Protocol** | JSON-RPC 2.0 over stdio |
| **Testing** | Jest |
| **Build** | Webpack 5 |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VS Code                                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Kimi IDE Extension                     │   │
│  │                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │   │
│  │  │   Extension  │  │  WireClient  │  │  VS Code API │   │   │
│  │  │    Host      │──│  (JSON-RPC)  │──│  Integration │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘   │   │
│  │         │                   │                  │         │   │
│  │  ┌──────┴──────┐   ┌────────┴────────┐   ┌────┴────┐   │   │
│  │  │   Agents    │   │  kimi-code-cli  │   │   UI    │   │   │
│  │  │   System    │   │   (optional)    │   │ Panels  │   │   │
│  │  └─────────────┘   └─────────────────┘   └─────────┘   │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Moonshot AI API                            │
│                    (api.moonshot.cn)                            │
└─────────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/
├── agents/                    # Multi-Agent System
│   ├── orchestrator.ts       # Central coordinator
│   ├── fileDiscoveryAgent.ts # AST-based file search
│   ├── plannerAgent.ts       # Change planning
│   ├── editorAgent.ts        # Code editing
│   ├── reviewerAgent.ts      # Code review
│   └── testingAgent.ts       # Test generation
│
├── discovery/                 # Tree-based Discovery
│   ├── codeTreeBuilder.ts    # AST tree construction
│   ├── treeSearch.ts         # Tree search algorithms
│   ├── smartFilePicker.ts    # AI-powered file selection
│   └── codeSummarizer.ts     # Code summarization
│
├── editing/                   # Parallel Editing
│   ├── parallelEditor.ts     # Parallel execution
│   ├── strategyTemplates.ts  # Editing strategies
│   ├── resultSelector.ts     # Result selection
│   └── diffMerger.ts         # Diff merging
│
├── review/                    # Auto Code Review
│   ├── reviewEngine.ts       # Review orchestration
│   ├── reviewReporter.ts     # VS Code diagnostics
│   └── reviewers/            # Specialized reviewers
│       ├── semanticReviewer.ts
│       ├── styleReviewer.ts
│       ├── securityReviewer.ts
│       ├── performanceReviewer.ts
│       └── testReviewer.ts
│
├── context/                   # Smart Context Management
│   ├── contextManager.ts     # Context lifecycle
│   ├── compactionEngine.ts   # Token optimization
│   ├── tokenBudget.ts        # Budget management
│   ├── relevanceScorer.ts    # Relevance scoring
│   └── incrementalLoader.ts  # Incremental loading
│
├── kimi/                      # Wire Protocol
│   ├── wireClient.ts         # JSON-RPC client
│   ├── wireTypes.ts          # Type definitions
│   └── apiAdapter.ts         # API abstraction
│
├── panels/                    # UI Panels
│   ├── chatPanel.ts          # Chat WebView
│   └── chatProvider.ts       # Chat logic
│
├── providers/                 # VS Code Providers
│   ├── inlineEditProvider.ts # Inline editing
│   ├── completionProvider.ts # Completions
│   └── codeActionProvider.ts # Code actions
│
├── terminal/                  # Terminal Integration
│   └── terminalManager.ts    # Terminal management
│
├── lsp/                       # Language Server Protocol
│   └── completionProvider.ts # LSP completions
│
├── commands/                  # VS Code Commands
│   └── index.ts              # Command registration
│
├── utils/                     # Utilities
│   ├── logger.ts             # Logging
│   └── errors.ts             # Error handling
│
└── extension.ts               # Extension entry point
```

---

## Multi-Agent System

The Multi-Agent System is the core intelligence layer of Kimi IDE.

### Agent Architecture

```
┌─────────────────────────────────────────┐
│           Orchestrator Agent            │
│         (Central Coordinator)           │
└─────────────────┬───────────────────────┘
                  │
    ┌─────────────┼─────────────┬──────────────┐
    ▼             ▼             ▼              ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  File  │  │  Planner │  │  Editor  │  │ Reviewer │
│Discover│  │   Agent  │  │  Agent   │  │  Agent   │
└────┬───┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │           │             │             │
     └───────────┴─────────────┴─────────────┘
                  │
                  ▼
          ┌──────────────┐
          │ Testing Agent │
          │ (Verification)│
          └──────────────┘
```

### Agent Responsibilities

#### Orchestrator Agent

```typescript
interface OrchestratorAgent {
  // Coordinates workflow execution
  executeWorkflow(task: Task): Promise<WorkflowResult>;
  
  // Decides which agents to invoke
  decideStrategy(context: Context): Strategy;
  
  // Manages agent lifecycle
  dispatchAgent(agentType: AgentType, input: unknown): Promise<unknown>;
}
```

#### File Discovery Agent

Uses AST analysis instead of simple grep:

```typescript
interface FileDiscoveryAgent {
  // Find relevant files using AST
  discoverFiles(query: string, context: Context): Promise<File[]>;
  
  // Build dependency graph
  buildDependencyGraph(files: File[]): DependencyGraph;
  
  // Rank files by relevance
  rankFiles(files: File[], query: string): RankedFile[];
}
```

#### Planner Agent

Creates execution plans with dependency graphs:

```typescript
interface PlannerAgent {
  // Create execution plan
  createPlan(task: Task, context: Context): ExecutionPlan;
  
  // Analyze dependencies
  analyzeDependencies(changes: Change[]): DependencyGraph;
  
  // Order operations
  topologicalSort(dependencies: DependencyGraph): OrderedSteps;
}
```

#### Editor Agent

Generates code edits using multiple strategies:

```typescript
interface EditorAgent {
  // Generate edits
  generateEdits(task: Task, context: Context): Edit[];
  
  // Apply edits
  applyEdits(edits: Edit[]): Promise<void>;
  
  // Validate edits
  validateEdits(edits: Edit[]): ValidationResult;
}
```

#### Reviewer Agent

Performs automatic code review:

```typescript
interface ReviewerAgent {
  // Run all reviewers
  review(code: Code): ReviewResult;
  
  // Check for issues
  checkSemantics(code: Code): SemanticIssue[];
  checkStyle(code: Code): StyleIssue[];
  checkSecurity(code: Code): SecurityIssue[];
  checkPerformance(code: Code): PerformanceIssue[];
}
```

---

## Tree-based Discovery

Tree-based File Discovery uses AST analysis for intelligent code search.

### How It Works

```typescript
// 1. Parse source files into AST
const sourceFile = ts.createSourceFile(
  filePath,
  fileContent,
  ts.ScriptTarget.Latest,
  true
);

// 2. Extract symbols and dependencies
const symbols = extractSymbols(sourceFile);
const dependencies = extractDependencies(sourceFile);

// 3. Build code tree
const codeTree = buildCodeTree(symbols, dependencies);

// 4. Search using semantic understanding
const results = searchCodeTree(codeTree, query);
```

### Code Tree Structure

```typescript
interface CodeTree {
  root: TreeNode;
  symbols: Map<string, Symbol>;
  dependencies: DependencyGraph;
}

interface TreeNode {
  type: 'file' | 'class' | 'function' | 'variable' | 'import';
  name: string;
  location: Location;
  children: TreeNode[];
  dependencies: string[];
}
```

### Advantages Over Grep

| Aspect | Grep | AST-based |
|--------|------|-----------|
| Speed | Fast | 2-3x faster with indexing |
| Accuracy | Text matching | Semantic understanding |
| Context | None | Symbol hierarchy |
| Dependencies | Manual tracing | Automatic extraction |
| Refactoring | Risky | Safe with symbol analysis |

---

## Parallel Editing

Parallel Multi-Strategy Editing runs multiple editing strategies simultaneously.

### Strategy Types

```typescript
type EditStrategy = 
  | 'conservative'   // Minimal, safe changes
  | 'balanced'       // Best practices approach
  | 'aggressive'     // Full optimization
  | 'test-first'     // TDD approach
  | 'minimal-diff';  // Smallest changes
```

### Execution Flow

```
User Request
    │
    ▼
┌─────────────────┐
│ Create 5 Tasks  │
│ (one per        │
│  strategy)      │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│     Parallel Execution       │
│  ┌─────┐ ┌─────┐ ┌─────┐   │
│  │Cons │ │Bal  │ │Agg  │   │
│  │erv  │ │anced│ │ress │   │
│  └──┬──┘ └──┬──┘ └──┬──┘   │
│     │       │       │       │
│     └───────┼───────┘       │
│             ▼                │
│     ┌──────────────┐        │
│     │ Result Merge │        │
│     └──────────────┘        │
└─────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ Quality Score   │
│ & Selection     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Present to User │
│ (VS Code diff)  │
└─────────────────┘
```

### Result Selection

```typescript
interface ResultSelector {
  // Score each result
  scoreResult(result: EditResult): Score;
  
  // Consider multiple factors
  factors: {
    syntaxValidity: number;
    semanticCorrectness: number;
    styleConsistency: number;
    testPassing: number;
    userPreference: number;
  };
  
  // Select best or merge
  select(results: EditResult[]): EditResult | MergedResult;
}
```

---

## Automatic Code Review

The automatic code review system catches issues before showing results to the user.

### Review Pipeline

```
Generated Code
      │
      ▼
┌─────────────────┐
│ Syntax Check    │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│         Parallel Reviewers              │
│  ┌────────┐ ┌────────┐ ┌────────┐      │
│  │Semantic│ │ Style  │ │Security│      │
│  │ Review │ │ Review │ │ Review │      │
│  └───┬────┘ └───┬────┘ └───┬────┘      │
│      └──────────┼──────────┘            │
│                 ▼                        │
│         ┌────────────┐                  │
│         │Performance │                  │
│         │  Review    │                  │
│         └────────────┘                  │
└─────────────────────────────────────────┘
                  │
                  ▼
          ┌───────────────┐
          │ VS Code       │
          │ Diagnostics   │
          └───────────────┘
                  │
                  ▼
          ┌───────────────┐
          │  Auto-Fix     │
          │  (if enabled) │
          └───────────────┘
```

### Reviewer Types

#### Semantic Reviewer

Checks for logic errors and edge cases:

```typescript
interface SemanticReviewer {
  checkNullHandling(code: Code): Issue[];
  checkEdgeCases(code: Code): Issue[];
  checkTypeConsistency(code: Code): Issue[];
  checkLogicErrors(code: Code): Issue[];
}
```

#### Style Reviewer

Ensures consistency with project conventions:

```typescript
interface StyleReviewer {
  checkNamingConventions(code: Code): Issue[];
  checkFormatting(code: Code): Issue[];
  checkDocumentation(code: Code): Issue[];
  checkBestPractices(code: Code): Issue[];
}
```

#### Security Reviewer

Detects common vulnerabilities:

```typescript
interface SecurityReviewer {
  checkInjectionRisks(code: Code): Issue[];
  checkPathTraversal(code: Code): Issue[];
  checkHardcodedSecrets(code: Code): Issue[];
  checkUnsafeEval(code: Code): Issue[];
}
```

#### Performance Reviewer

Identifies performance issues:

```typescript
interface PerformanceReviewer {
  checkNPlusOne(code: Code): Issue[];
  checkMemoryLeaks(code: Code): Issue[];
  checkUnnecessaryRenders(code: Code): Issue[];
  checkAlgorithmComplexity(code: Code): Issue[];
}
```

#### Test Reviewer

Analyzes test coverage:

```typescript
interface TestReviewer {
  checkTestCoverage(code: Code): Issue[];
  checkEdgeCaseCoverage(code: Code): Issue[];
  checkTestQuality(code: Code): Issue[];
}
```

---

## Smart Context Management

Smart Context Management intelligently selects the most relevant code context.

### Context Sources

```typescript
interface ContextSources {
  currentFile: File;           // Currently active file
  selectedText: string;        // User selection
  openFiles: File[];           // All open files
  recentFiles: File[];         // Recently accessed
  importedFiles: File[];       // Files imported by current
  relatedSymbols: Symbol[];    // Symbols related to selection
}
```

### Relevance Scoring

```typescript
interface RelevanceScorer {
  // Score each context item
  score(item: ContextItem): number;
  
  // Factors considered
  factors: {
    recency: number;        // How recently accessed
    proximity: number;      // Distance in file tree
    semantic: number;       // Semantic relationship
    interaction: number;    // User interaction frequency
  };
}
```

### Token Budget Management

```typescript
interface TokenBudget {
  total: number;              // Total available tokens
  used: number;               // Currently used
  reserved: number;           // Reserved for response
  
  // Allocate tokens by priority
  allocate(priority: Priority): number;
  
  // Compact lower-priority context
  compact(): void;
}
```

### Context Compaction

When approaching token limits:

1. **Summarize** - Replace full content with summaries
2. **Evict** - Remove least relevant items
3. **Condense** - Compress code while preserving structure

---

## Wire Protocol

The Wire Protocol is a JSON-RPC 2.0 protocol over stdio for communication with kimi-code-cli.

### Protocol Structure

```typescript
interface WireMessage<T = unknown> {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: T;
  result?: T;
  error?: WireError;
}

interface WireError {
  code: number;
  message: string;
  data?: unknown;
}
```

### Client → Server Methods

| Method | Description |
|--------|-------------|
| `sendMessage` | Send user message with context |
| `interruptTurn` | Interrupt current turn |
| `submitApproval` | Submit approval response |
| `ping` | Health check |

### Server → Client Events

| Event | Description |
|-------|-------------|
| `TurnBegin` | New conversation turn started |
| `TurnEnd` | Turn completed |
| `StepBegin` | Step within turn started |
| `StepEnd` | Step completed |
| `ContentPart` | Streaming content chunk |
| `ToolCall` | Tool execution request |
| `ToolResult` | Tool execution result |
| `ApprovalRequest` | User approval needed |
| `StatusUpdate` | Connection status update |
| `Error` | Error notification |

See [API.md](./API.md) for complete protocol documentation.

---

## Security Model

### Threat Model

1. **Arbitrary Code Execution** - Prevent execution of untrusted code
2. **Path Traversal** - Validate all file paths
3. **IPC Injection** - Validate all messages
4. **API Key Exposure** - Secure storage of credentials

### Security Measures

#### Path Validation

```typescript
function validatePath(inputPath: string, workspaceRoot: string): string {
  const resolvedPath = path.resolve(inputPath);
  const resolvedRoot = path.resolve(workspaceRoot);
  
  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new SecurityError('Path outside workspace');
  }
  
  return resolvedPath;
}
```

#### Input Validation

```typescript
import { z } from 'zod';

const ReadFileSchema = z.object({
  path: z.string().min(1),
  encoding: z.enum(['utf-8', 'ascii', 'base64']).optional()
});

// Validate before processing
const validated = ReadFileSchema.parse(data);
```

#### API Key Security

- Keys stored in VS Code's secure storage
- Never logged or exposed
- Validated on startup
- Can use environment variables

---

## Performance Considerations

### Optimization Strategies

#### Lazy Loading

```typescript
// Lazy load heavy components
const MonacoEditor = lazy(() => import('./MonacoEditor'));

// Lazy load agent modules
const loadAgent = (type: AgentType) => 
  import(`./agents/${type}Agent`);
```

#### Caching

```typescript
interface Cache {
  // Multi-level cache
  memory: Map<string, CacheEntry>;
  disk: DiskCache;
  
  // Cache strategies
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, ttl: number): void;
  invalidate(pattern: string): void;
}
```

#### Worker Pool

```typescript
// Use worker threads for CPU-intensive tasks
const workerPool = new WorkerPool({
  minWorkers: 2,
  maxWorkers: 8,
  idleTimeoutMs: 30000
});

// Offload AST parsing
const result = await workerPool.execute('parseAST', code);
```

### Memory Management

- Dispose of editor instances properly
- Clean up event listeners
- Limit context size
- Use WeakMap for caches

### Bundle Optimization

- Code splitting by feature
- Tree shaking
- Dynamic imports
- Asset compression

---

## Error Handling

### Error Types

```typescript
class KimiIDEError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
  }
}

class ValidationError extends KimiIDEError {}
class SecurityError extends KimiIDEError {}
class NetworkError extends KimiIDEError {}
class AIError extends KimiIDEError {}
```

### Error Recovery

```typescript
// Retry with exponential backoff
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(Math.pow(2, i) * 1000);
    }
  }
  throw new Error('Max retries exceeded');
}
```

---

For questions about the architecture, please open an issue or discussion.
