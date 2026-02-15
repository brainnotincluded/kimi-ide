# Multi-Agent System для Kimi VS Code Extension

Превосходит Codebuff через интеграцию с VS Code API, Wire Protocol и параллельное выполнение.

## Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestrator Agent                        │
│  - Получает задачу от пользователя                          │
│  - Принимает решение о создании агентов                     │
│  - Координирует workflow (sequential/parallel/DAG)          │
└───────────────────────┬─────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   File       │ │   Planner    │ │   Editor     │
│  Discovery   │ │    Agent     │ │    Agent     │
└──────────────┘ └──────────────┘ └──────────────┘
        │               │               │
        └───────────────┼───────────────┘
                        ▼
            ┌───────────────────┐
            │  Reviewer Agent   │
            │  Testing Agent    │
            └───────────────────┘
```

## Агенты

### 1. Orchestrator Agent (`orchestrator.ts`)
- **Роль**: Центральный координатор
- **Функции**:
  - Принимает решение о создании агентов (makeSpawnDecision)
  - Управляет workflow (sequential/parallel/DAG)
  - Собирает результаты от всех агентов
  - Обрабатывает ошибки и retry

### 2. File Discovery Agent (`fileDiscoveryAgent.ts`)
- **Модель**: `kimi-k2.5-lite` (быстрая)
- **Функции**:
  - Строит дерево файлов codebase
  - Находит релевантные файлы за 1-2 вызова вместо множества grep
  - Возвращает ranked list с relevance scores
  - Интегрируется с VS Code workspace.fs для быстрого доступа

### 3. Planner Agent (`plannerAgent.ts`)
- **Функции**:
  - Создаёт план изменений (PlannedChange[])
  - Определяет зависимости между изменениями (ChangeDependency[])
  - Оценивает риски (RiskAssessment[])
  - Строит Execution Graph для параллельного выполнения

### 4. Editor Agent (`editorAgent.ts`)
- **Стратегии** (выполняются параллельно):
  1. **AST Transform**: TypeScript Compiler API для точных изменений
  2. **Text Replace**: Паттерн-based замена текста
  3. **Semantic Patch**: Семантическое понимание изменений
- **Функции**:
  - Параллельное выполнение всех стратегий
  - Выбор лучшей стратегии по score
  - Возврат unified diff

### 5. Reviewer Agent (`reviewerAgent.ts`)
- **Проверки** (выполняются параллельно):
  1. **TypeCheck**: TypeScript компиляция
  2. **Lint**: ESLint проверка
  3. **Tests**: Запуск связанных тестов
  4. **Security**: Heuristic security checks
  5. **Semantic Review**: AI review
- **Функции**:
  - Создаёт VS Code diagnostics
  - Предлагает fixes
  - Вычисляет quality metrics

### 6. Testing Agent (`testingAgent.ts`)
- **Функции**:
  - Генерирует тесты для изменений
  - Запускает тесты (Jest, Vitest, pytest)
  - Проверяет coverage
  - Поддерживает unit/integration/e2e тесты

## Wire Protocol

Связь между агентами через типизированные сообщения:

```typescript
interface AgentMessage<T> {
    id: string;
    type: 'task.assign' | 'task.complete' | 'status.update' | ...;
    from: string;
    to: string;
    timestamp: number;
    payload: T;
    correlationId?: string;
}
```

### Event Flow
1. Orchestrator отправляет `task.assign`
2. Агент выполняет задачу
3. Агент отправляет `task.complete` или `error.report`
4. Orchestrator обновляет workflow state

## Преимущества над Codebuff

### 1. VS Code API Integration
- **AST Access**: TypeScript Compiler API для точных изменений
- **workspace.fs**: Быстрый доступ к файлам
- **Language Services**: Символы, диагностики, Go to Definition
- **UI Integration**: Diagnostics в Problems panel, decorations

### 2. Производительность
- **1-2 вызова модели** для File Discovery вместо множества grep
- **Параллельные стратегии** редактирования (3 одновременно)
- **Параллельные проверки** (typecheck + lint + test + security)
- **DAG execution** для независимых задач

### 3. Качество кода
- **Type-safe**: TypeScript для всех агентов
- **Error handling**: Graceful degradation
- **Rollback strategies**: Для каждого изменения
- **Risk assessment**: Перед выполнением

## Использование

```typescript
import { createMultiAgentSystem } from './agents';

// Создание системы
const mas = createMultiAgentSystem({
    workspace: vscode.workspace,
    window: vscode.window,
    commands: vscode.commands,
    languages: vscode.languages,
});

await mas.initialize();

// Получение orchestrator и выполнение задачи
const orchestrator = mas.getOrchestrator();
const result = await orchestrator.processRequest({
    id: 'task-1',
    description: 'Refactor user authentication',
    context: {
        currentFile: '/path/to/file.ts',
    },
});

// Очистка
await mas.dispose();
```

## Структура файлов

```
src/agents/
├── types.ts              # Типы для всех агентов
├── baseAgent.ts          # Базовый класс и AgentRegistry
├── orchestrator.ts       # Orchestrator Agent
├── fileDiscoveryAgent.ts # File Discovery Agent
├── plannerAgent.ts       # Planner Agent
├── editorAgent.ts        # Editor Agent (3 стратегии)
├── reviewerAgent.ts      # Reviewer Agent (параллельные проверки)
├── testingAgent.ts       # Testing Agent
└── index.ts              # Экспорты и MultiAgentSystem
```

## Добавление нового агента

1. Создать файл `newAgent.ts`
2. Расширить `BaseAgent`
3. Реализовать абстрактные методы:
   - `onInitialize()`
   - `onExecute<TInput, TOutput>()`
   - `onMessage()`
   - `onCancel()`
   - `onDispose()`
4. Добавить в `orchestrator.ts` spawnAgent()
5. Экспортировать в `index.ts`

## Конфигурация

```typescript
interface MultiAgentSystemConfig {
    vscode: {
        workspace: typeof vscode.workspace;
        window: typeof vscode.window;
        commands: typeof vscode.commands;
        languages: typeof vscode.languages;
    };
    maxConcurrentAgents?: number;  // default: 5
    defaultTimeoutMs?: number;     // default: 60000
}
```

## Лицензия

MIT
