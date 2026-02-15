# Новая архитектура Kimi VS Code Extension

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VS Code Extension Host                               │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        Agent Orchestrator                            │   │
│  │                    (Coordinates multi-agent workflow)                │   │
│  └────────────┬────────────────────────────────────────────────────────┘   │
│               │                                                              │
│    ┌──────────┼──────────┬──────────┬──────────┬──────────┐                │
│    │          │          │          │          │          │                │
│    ▼          ▼          ▼          ▼          ▼          ▼                │
│ ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐              │
│ │ File │  │Edit  │  │Review│  │Test  │  │Security│ │Docs  │              │
│ │Picker│  │Agent │  │Agent │  │Agent │  │ Agent  │ │Agent │              │
│ │Agent │  │      │  │      │  │      │  │        │ │      │              │
│ └──┬───┘  └──┬───┘  └──┬───┘  └──┬───┘  └───┬────┘ └──┬───┘              │
│    │         │         │         │          │         │                   │
│    └─────────┴─────────┴─────────┴──────────┴─────────┘                   │
│                          │                                                  │
│                          ▼                                                  │
│            ┌─────────────────────────┐                                     │
│            │   SmartContextManager   │                                     │
│            │  (Invisible Context)    │                                     │
│            └───────────┬─────────────┘                                     │
│                        │                                                    │
│    ┌───────────────────┼───────────────────┐                              │
│    │                   │                   │                              │
│    ▼                   ▼                   ▼                              │
│ ┌──────┐          ┌──────┐          ┌──────────┐                         │
│ │Codebase│         │ Prompt │          │   Cache    │                         │
│ │Indexer │         │Builder │          │  Manager   │                         │
│ └──┬───┘          └──┬───┘          └─────┬────┘                         │
│    │                │                    │                                 │
│    └────────────────┼────────────────────┘                                 │
│                     │                                                      │
│                     ▼                                                      │
│           ┌───────────────────┐                                           │
│           │    Kimi API       │                                           │
│           │  (HTTP / Wire)    │                                           │
│           └─────────┬─────────┘                                           │
└─────────────────────┼───────────────────────────────────────────────────────┘
                      │
                      ▼
            ┌───────────────────┐
            │  Moonshot AI API  │
            └───────────────────┘
```

## Детальная схема агентов

### File Picker Agent

```
User Query → TF-IDF Search (fast)
                ↓
    Top N candidates → LLM Reranking (Grok-like)
                            ↓
                    Selected files → Gemini-like Summarization
                                          ↓
                                    File summaries → Main Agent
```

### Parallel Edit Agent

```
Edit Request → ┌─────────────────┐
               │ Strategy 1      │──┐
               │ (Conservative)  │  │
               └─────────────────┘  │
               ┌─────────────────┐  │
               │ Strategy 2      │──┼──→ Selector Agent → Best Edit
               │ (Aggressive)    │  │
               └─────────────────┘  │
               ┌─────────────────┐  │
               │ Strategy 3      │──┘
               │ (Idiomatic)     │
               └─────────────────┘
```

### Review Agent

```
Suggested Edit → ┌───────────────┐
                 │ LLM Review    │──┐
                 └───────────────┘  │
                 ┌───────────────┐  ├──→ Aggregated → Approved?
                 │ Syntax Check  │──┤      Issues
                 └───────────────┘  │
                 ┌───────────────┐  │
                 │ Type Check    │──┘
                 └───────────────┘
```

## Smart Context Manager Flow

```
Messages Flow:
══════════════

User Message → Add to Context ──→ Check Token Limit
                                      ↓
                    ┌─────────────────┴─────────────────┐
                    ↓                                   ↓
              Below Threshold                     Above Threshold
                    │                                   │
                    │                            Compact Context
                    │                                   │
                    │              ┌────────────────────┼────────────────────┐
                    │              ↓                    ↓                    ↓
                    │       Summarize Old         Compact Files      Update Summary
                    │       Messages              (keep hashes)      (non-lossy)
                    │              │                    │                    │
                    └──────────────┴────────────────────┴────────────────────┘
                                   │
                                   ↓
                        Continue with Optimized Context

Idle Detection:
═══════════════

No Activity 5min → Trigger Maintenance
                        ↓
              ┌─────────┴─────────┐
              ↓                   ↓
       Update Summaries    Save State
       (if needed)         to Disk
```

## Интеграция с VS Code API

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Actions                    Extension Response          │
│  ───────────                     ─────────────────           │
│                                                              │
│  Cmd+K (Inline Edit)    ─────→   ParallelEditAgent          │
│                                         ↓                    │
│                                   ReviewAgent (auto)         │
│                                         ↓                    │
│                                   Show Diff Preview          │
│                                                              │
│  @file:mention          ─────→   FileDiscoveryAgent         │
│                                         ↓                    │
│                                   Tree-based search          │
│                                         ↓                    │
│                                   Add to context             │
│                                                              │
│  Chat message           ─────→   SmartContextManager        │
│                                         ↓                    │
│                                   Check/compact context      │
│                                         ↓                    │
│                                   Kimi API request           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Performance Optimizations

```
Request Flow:
═════════════

User Request → Request Batcher (50ms window)
                     ↓
              ┌──────┴──────┐
              ↓             ↓
        Cached?       Batch Full?
              ↓             ↓
         Return      Process Batch
         Result      (parallel)
                            ↓
                     Response Cache
                            ↓
                     Return Results

File Access:
════════════

File Request → Prefetch Manager
                    ↓
            ┌───────┴───────┐
            ↓               ↓
       In Cache?      Predict & Prefetch
            ↓               ↓
       Return      Background Load
       Content     Similar Files
                        ↓
                   Next Request → Cache Hit!
```

## Сравнение со старой архитектурой

| Аспект | Старая архитектура | Новая архитектура |
|--------|-------------------|-------------------|
| File Discovery | TF-IDF only | Tree + LLM rerank + Summary |
| Editing | Single strategy | Parallel strategies + Selection |
| Review | Manual | Automatic on every edit |
| Context | Fixed window | Smart compaction |
| Agents | None | Specialized agents |
| Performance | Sequential | Parallel + Batched |

## Конфигурация

```jsonc
// settings.json
{
  "kimi.experimental.enableCodebuffFeatures": true,
  
  // File Discovery
  "kimi.fileDiscovery.useLLM": true,
  "kimi.fileDiscovery.maxCandidates": 20,
  
  // Parallel Editing
  "kimi.editing.enableParallel": true,
  "kimi.editing.strategies": ["conservative", "aggressive", "idiomatic"],
  "kimi.editing.timeout": 30000,
  
  // Review
  "kimi.review.autoReview": true,
  "kimi.review.blockOnErrors": false,
  
  // Context
  "kimi.context.maxTokens": 120000,
  "kimi.context.compactionThreshold": 0.8,
  
  // Performance
  "kimi.performance.enablePrefetch": true,
  "kimi.performance.workerPoolSize": 4
}
```
