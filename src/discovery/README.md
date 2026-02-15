# Tree-based File Discovery System

Интеллектуальная система обнаружения и поиска файлов для Kimi VS Code Extension.

## Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                    Discovery Service                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐ │
│  │ Code Tree   │  │ Tree Search │  │ Smart File  │  │ Code   │ │
│  │ Builder     │  │             │  │ Picker      │  │ Summarizer│
│  │             │  │             │  │             │  │        │ │
│  │ • AST parse │  │ • Fuzzy     │  │ • AI-powered│  │ • AST  │ │
│  │ • Symbols   │  │   matching  │  │   ranking   │  │   based │ │
│  │ • Imports/  │  │ • Semantic  │  │ • Context   │  │ • AI   │ │
│  │   Exports   │  │   search    │  │   aware     │  │   enhance│ │
│  │ • Dependency│  │ • Relevance │  │ • Intent    │  │ • Cache │ │
│  │   graph     │  │   scoring   │  │   analysis  │  │        │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────┘ │
│           │              │                │              │      │
│           └──────────────┴────────────────┴──────────────┘      │
│                              │                                   │
│                    ┌─────────┴─────────┐                         │
│                    │   Cache Layer     │                         │
│                    │   (Disk + Memory) │                         │
│                    └───────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
```

## Преимущества над grep-подходом (Codebuff, etc.)

| Фича | Grep-подход | Tree-based подход |
|------|-------------|-------------------|
| **Скорость поиска** | O(n) по всем файлам | O(1) к AST, O(log n) поиск |
| **Понимание структуры** | Текстовые совпадения | Полная AST информация |
| **Семантический поиск** | ❌ | ✅ Типы, наследование |
| **Зависимости** | Нет анализа | Полный dependency graph |
| **Инкрементальность** | Полный re-scan | Точечные обновления |
| **AI context** | Сырые файлы | Структурированные summaries |

## Быстрый старт

```typescript
import { DiscoveryService, createDiscoveryService } from './discovery';

// Создать и инициализировать сервис
const discovery = await createDiscoveryService({
  treeBuilder: {
    includePatterns: ['**/*.{ts,tsx}'],
    excludePatterns: ['**/node_modules/**', '**/*.test.ts']
  },
  summarizer: {
    useAI: true,
    modelClient: kimiModelClient
  }
});

// Поиск символов
const results = discovery.search('UserController', 20);

// Умный выбор файлов
const files = await discovery.pickFiles({
  query: 'add authentication to user login',
  maxFiles: 10,
  useAI: true,
  currentFile: vscode.window.activeTextEditor?.document.uri.fsPath
});

// Получить summary файла
const summary = await discovery.getSummary('./src/auth/service.ts');
```

## API Reference

### CodeTreeBuilder

Построение дерева codebase через TypeScript Compiler API.

```typescript
const builder = new CodeTreeBuilder({
  cacheDir: '.kimi/cache',
  includePatterns: ['**/*.{ts,tsx}'],
  excludePatterns: ['**/node_modules/**'],
  maxFileSize: 1024 * 1024, // 1MB
  enableJsDoc: true
});

await builder.initialize();

const tree = builder.getTree();
const deps = builder.getDependencies('./src/index.ts');
```

### TreeSearch

Быстрый поиск с fuzzy matching и семантическим анализом.

```typescript
const search = new TreeSearch(tree);

// Fuzzy search
const results = search.search({
  query: 'usrCtrl',
  kinds: ['class', 'function'],
  maxResults: 20
});

// Find usages
const usages = search.findUsages('symbol-id');

// Related symbols
const related = search.findRelated('symbol-id', 2);
```

### SmartFilePicker

AI-powered выбор релевантных файлов.

```typescript
const picker = new SmartFilePicker(tree, modelClient);

// Pick with AI analysis
const picks = await picker.pickFiles({
  query: 'implement rate limiting',
  maxFiles: 10,
  useAI: true
});

// Result:
// {
//   filePath: '/src/middleware/rateLimiter.ts',
//   relevanceScore: 0.92,
//   justification: 'contains RateLimiter class; exports configureRateLimit',
//   matchedSymbols: ['RateLimiter', 'configureRateLimit'],
//   confidence: 'high'
// }
```

### CodeSummarizer

Генерация summary для файлов.

```typescript
const summarizer = new CodeSummarizer(tree, {
  useAI: true,
  modelClient
});

const summary = await summarizer.getSummary('./src/service.ts');
// {
//   overview: 'Service layer for user management',
//   purpose: 'Handles business logic for user operations',
//   keyFunctions: [...],
//   keyClasses: [...],
//   complexity: { cyclomatic: 12, cognitive: 18 }
// }
```

## Инкрементальные обновления

```
File Changed
     │
     ▼
FileSystemWatcher
     │
     ▼
Pending Updates Queue (debounced 500ms)
     │
     ▼
TypeScript Program Update
     │
     ▼
Incremental AST Parse
     │
     ▼
Update Symbol Table
     │
     ▼
Rebuild Dependency Graph
     │
     ▼
Update Search Index
     │
     ▼
Persist to Cache
```

## Кеширование

```typescript
// Cache structure
.kimi/cache/
├── code-tree-cache.json      # AST tree + symbols
└── summaries/
    └── summaries-cache.json   # File summaries

// Cache invalidation
- File modification time change
- Manual invalidateCache() call
- Config change
```

## Performance

| Операция | Время (1000 файлов) |
|----------|---------------------|
| Full build | ~2-3s |
| Incremental update | ~50-100ms |
| Symbol search | ~1-5ms |
| File pick (heuristic) | ~10-50ms |
| File pick (AI) | ~200-500ms |

## Интеграция с VS Code

```typescript
export function activate(context: vscode.ExtensionContext) {
  const discovery = new DiscoveryService({
    modelClient: createKimiModelClient()
  });
  
  context.subscriptions.push({
    dispose: () => discovery.dispose()
  });

  // Update context on editor change
  vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
      discovery.updateContext({
        currentFile: editor.document.uri.fsPath,
        cursorPosition: {
          file: editor.document.uri.fsPath,
          line: editor.selection.active.line,
          column: editor.selection.active.character
        }
      });
    }
  });
}
```

## License

MIT
