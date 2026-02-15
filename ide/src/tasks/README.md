# Task Runner System

Task Runner System для IDE Traitor, вдохновлённый VS Code tasks.json.

## Структура

```
tasks/
├── types/           # TypeScript типы и интерфейсы
│   └── index.ts     # TaskDefinition, TaskStatus, и т.д.
├── ui/              # React компоненты
│   ├── TasksPanel.tsx       # Панель списка задач
│   ├── TasksPanel.css       # Стили панели задач
│   ├── TaskStatusBar.tsx    # Статус-бар с быстрым доступом
│   ├── TaskStatusBar.css    # Стили статус-бара
│   ├── TaskOutputPanel.tsx  # Панель вывода задачи
│   ├── TaskOutputPanel.css  # Стили панели вывода
│   └── index.ts             # Экспорты UI компонентов
├── utils/           # Утилиты
│   ├── AutoDetectors.ts    # Авто-детект npm, cargo, и т.д.
│   ├── ProblemMatcher.ts   # Парсинг ошибок из вывода
│   └── index.ts            # Экспорты утилит
├── hooks/           # React hooks
│   ├── useTasks.ts         # Хук для работы с задачами
│   └── index.ts            # Экспорты хуков
├── ipc/             # IPC handlers
│   └── TaskIPC.ts          # IPC handlers для main/renderer
├── TaskProvider.ts  # Основной провайдер задач (main)
├── TaskTerminal.ts  # Терминал для вывода задач
└── index.ts         # Главный экспорт
```

## Конфигурация tasks.json

Создайте файл `.traitor/tasks.json` в корне проекта:

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "id": "build",
      "label": "Build Project",
      "type": "shell",
      "command": "npm",
      "args": ["run", "build"],
      "group": "build",
      "isDefault": true,
      "problemMatcher": ["$tsc"]
    },
    {
      "id": "test",
      "label": "Run Tests",
      "type": "shell",
      "command": "npm",
      "args": ["test"],
      "group": "test",
      "isDefault": true
    },
    {
      "id": "dev",
      "label": "Development Server",
      "type": "shell",
      "command": "npm",
      "args": ["run", "dev"],
      "group": "run",
      "isDefault": true
    },
    {
      "id": "lint",
      "label": "Lint Code",
      "type": "shell",
      "command": "npm",
      "args": ["run", "lint"],
      "group": "build",
      "problemMatcher": ["$eslint-stylish"]
    },
    {
      "id": "build-with-deps",
      "label": "Build with Dependencies",
      "type": "shell",
      "command": "npm",
      "args": ["run", "build"],
      "group": "build",
      "dependsOn": ["lint", "test"]
    }
  ]
}
```

## Использование

### В React компонентах:

```tsx
import { useTasks, TasksPanel, TaskStatusBar, TaskOutputPanel } from '../tasks';

function MyComponent() {
  const {
    tasks,
    detectedTasks,
    runningTasks,
    selectedTaskId,
    runTask,
    stopTask,
    selectTask,
    importDetectedTask,
    getTaskOutput,
  } = useTasks({ workspacePath: '/path/to/project' });

  const selectedOutput = selectedTaskId ? getTaskOutput(selectedTaskId) : [];

  return (
    <div>
      <TaskStatusBar
        tasks={tasks}
        runningTasks={runningTasks}
        onRunTask={runTask}
        onStopTask={stopTask}
        onOpenTasksPanel={() => {}}
      />

      <TasksPanel
        tasks={tasks}
        detectedTasks={detectedTasks}
        runningTasks={runningTasks}
        selectedTaskId={selectedTaskId || undefined}
        onRunTask={runTask}
        onStopTask={stopTask}
        onSelectTask={selectTask}
        onImportTask={importDetectedTask}
      />

      {selectedTaskId && (
        <TaskOutputPanel
          taskId={selectedTaskId}
          taskName={tasks.find(t => t.id === selectedTaskId)?.label || selectedTaskId}
          status={taskStatus.get(selectedTaskId) || 'idle'}
          lines={selectedOutput}
          onClear={() => clearOutput(selectedTaskId)}
          onStop={() => stopTask(selectedTaskId)}
          onRestart={() => runTask(selectedTaskId)}
          onProblemClick={(problem) => {
            // Navigate to file at problem location
            console.log('Navigate to:', problem.file, problem.line);
          }}
        />
      )}
    </div>
  );
}
```

### В Main Process:

```typescript
import { registerTaskIPCHandlers, cleanupTaskProviders } from './tasks';

// При старте приложения
registerTaskIPCHandlers();

// При закрытии приложения
app.on('before-quit', () => {
  cleanupTaskProviders();
});
```

## Авто-детект задач

Система автоматически определяет задачи из:

- **npm** - скрипты из package.json
- **cargo** - cargo build, test, run, и т.д.
- **make** - цели из Makefile
- **gradle** - gradle build, test, и т.д.
- **maven** - mvn compile, test, package
- **python** - pytest, tox, и т.д.
- **dotnet** - dotnet build, test, run
- **go** - go build, test, run

## Problem Matchers

Встроенные матчеры для распознавания ошибок:

- `$tsc` - TypeScript компилятор
- `$eslint-stylish` - ESLint (stylish format)
- `$eslint-compact` - ESLint (compact format)
- `$rustc` - Rust компилятор
- `$go` - Go компилятор
- `$gcc` - GCC/Clang
- `$mscompile` - Microsoft C++
- `$python` - Python traceback
- `$jshint` - JSHint
- `$mocha` - Mocha тесты
- `$jest` - Jest тесты
- `$gulp-tsc` - gulp-typescript

## TaskDefinition

```typescript
interface TaskDefinition {
  id: string;                    // Уникальный идентификатор
  label: string;                 // Отображаемое название
  type: 'shell' | 'process';     // Тип задачи
  command: string;               // Команда для выполнения
  args?: string[];               // Аргументы команды
  options?: {
    cwd?: string;               // Рабочая директория
    env?: Record<string, string>; // Переменные окружения
    shell?: { executable: string; args?: string[] };
  };
  group?: 'build' | 'test' | 'run' | 'none'; // Группа
  dependsOn?: string[] | { id: string; dependsOrder?: 'parallel' | 'sequence' }[];
  problemMatcher?: string | ProblemMatcher | (string | ProblemMatcher)[];
  presentation?: {
    reveal?: 'always' | 'silent' | 'never';
    focus?: boolean;
    panel?: 'shared' | 'dedicated' | 'new';
    clear?: boolean;
    close?: boolean;
  };
  hide?: boolean;                // Скрыть из UI
  isDefault?: boolean;           // Задача по умолчанию для группы
  windows?: Partial<TaskDefinition>; // Windows-специфичные настройки
  osx?: Partial<TaskDefinition>;     // macOS-специфичные настройки
  linux?: Partial<TaskDefinition>;   // Linux-специфичные настройки
}
```

## IPC Events

### Main → Renderer

- `tasks:output:${taskId}` - Вывод задачи
- `tasks:statusChange` - Изменение статуса
- `tasks:complete` - Задача завершена

### Renderer → Main

- `tasks:load` - Загрузить задачи
- `tasks:detect` - Авто-детект задач
- `tasks:run` - Запустить задачу
- `tasks:terminate` - Остановить задачу
- `tasks:getRunning` - Получить активные задачи
- `tasks:create` - Создать задачу
- `tasks:update` - Обновить задачу
- `tasks:delete` - Удалить задачу
- `tasks:import` - Импортировать детектированную задачу
- `tasks:importAll` - Импортировать все детектированные
- `tasks:getHistory` - Получить историю
- `tasks:clearHistory` - Очистить историю
- `tasks:dispose` - Освободить ресурсы
