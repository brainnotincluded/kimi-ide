# Problems Panel for IDE Traitor

VS Code-like Problems Panel для отображения диагностик (ошибки, предупреждения, информация) в IDE.

## Структура

```
problems/
├── types.ts                 # Типы и интерфейсы
├── ProblemsManager.ts       # Центральный менеджер диагностик
├── ipc.ts                   # IPC handlers (main process)
├── renderer-ipc.ts          # IPC API (renderer process)
├── index.ts                 # Экспорты модуля
├── README.md                # Документация
├── hooks/
│   ├── useProblems.ts       # React hook для управления состоянием
│   └── index.ts
├── components/
│   ├── ProblemIcon.tsx      # Иконка severity
│   ├── ProblemItem.tsx      # Элемент проблемы
│   ├── ProblemsFilterBar.tsx # Панель фильтров
│   ├── ProblemsPanel.tsx    # Основная панель
│   ├── ProblemsStatusBar.tsx # Индикатор в статус-баре
│   └── index.ts
└── integrations/
    ├── python-provider.ts   # Python интеграция
    ├── typescript-provider.ts # TypeScript интеграция
    ├── rust-provider.ts     # Rust интеграция
    ├── go-provider.ts       # Go интеграция
    └── index.ts
```

## Использование

### Main Process

```typescript
import { setupProblemsIPCHandlers, ProblemsManager, registerAllLanguageProviders } from './problems';

// Создаём менеджер
const problemsManager = new ProblemsManager({
  workspaceRoot: '/path/to/project'
});

// Регистрируем IPC handlers
setupProblemsIPCHandlers(problemsManager);

// Регистрируем провайдеры языков
registerAllLanguageProviders(problemsManager, '/path/to/project');

// Публикуем диагностики из линтера
problemsManager.publishDiagnostics(
  '/path/to/file.ts',
  [
    {
      range: {
        start: { line: 10, character: 5 },
        end: { line: 10, character: 10 }
      },
      severity: DiagnosticSeverity.Error,
      message: 'Cannot find name "foo"',
      code: 'TS2304',
      source: 'typescript'
    }
  ],
  'typescript-language-server'
);
```

### Renderer Process

```typescript
import { ProblemsPanel, useProblems } from './problems';

// Использование компонента
function App() {
  return (
    <div>
      <ProblemsPanel height={200} />
    </div>
  );
}

// Использование хука
function CustomProblemsView() {
  const {
    problems,
    counts,
    filter,
    setFilter,
    openProblem,
    clearAll
  } = useProblems();

  return (
    <div>
      <span>Errors: {counts.errors}</span>
      <span>Warnings: {counts.warnings}</span>
      {/* ... */}
    </div>
  );
}
```

### Статус-бар

```typescript
import { ProblemsStatusBar } from './problems';

function StatusBar() {
  const { counts } = useProblems();
  
  return (
    <div className="status-bar">
      <ProblemsStatusBar 
        counts={counts} 
        onClick={() => toggleProblemsPanel()}
        isActive={problemsPanelVisible}
      />
    </div>
  );
}
```

## IPC Channels

### Main → Renderer

- `problems:onChanged` - Диагностики изменились
- `problems:onValidationStarted` - Валидация файла началась
- `problems:onValidationFinished` - Валидация файла завершена
- `problems:openFileInEditor` - Открыть файл в редакторе

### Renderer → Main

- `problems:getAll` - Получить все проблемы
- `problems:getForFile` - Получить проблемы файла
- `problems:clear` - Очистить все проблемы
- `problems:clearForFile` - Очистить проблемы файла
- `problems:openFile` - Открыть файл на позиции
- `problems:applyCodeAction` - Применить code action
- `problems:getCodeActions` - Получить code actions
- `problems:copyMessage` - Копировать сообщение
- `problems:getCounts` - Получить счётчики
- `problems:setFilter` - Установить фильтр
- `problems:getFilter` - Получить фильтр

## Функции

### Фильтрация

- ✅ Ошибки (Errors)
- ✅ Предупреждения (Warnings)
- ✅ Информация (Information)
- ✅ Подсказки (Hints)

### Группировка

- По файлу
- По severity
- По источнику (source)
- Без группировки

### Действия

- Переход к строке с ошибкой (click)
- Копирование сообщения
- Quick fix (если доступен)
- Expand/Collapse groups
- Clear all

### Интеграции

- Python (pylint, ruff, mypy, flake8)
- TypeScript (tsc, eslint)
- Rust (rustc, clippy)
- Go (go vet, go build)

## Типы

### DiagnosticSeverity

```typescript
enum DiagnosticSeverity {
  Error = 1,
  Warning = 2,
  Information = 3,
  Hint = 4
}
```

### ProblemItemData

```typescript
interface ProblemItemData {
  id: string;
  diagnostic: Diagnostic;
  file: string;
  relativeFile: string;
  line: number;
  column: number;
  source: string;
  code?: string | number;
  hasFix?: boolean;
  codeActions?: CodeAction[];
}
```

### ProblemsFilter

```typescript
interface ProblemsFilter {
  errors: boolean;
  warnings: boolean;
  information: boolean;
  hints: boolean;
  source?: string;
  searchText?: string;
}
```

## Лицензия

MIT
