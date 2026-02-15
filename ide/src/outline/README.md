# Outline View for IDE Traitor

Панель структуры/навигации по коду для IDE, аналогичная Outline в VS Code.

## Структура

```
outline/
├── types.ts              # Типы данных (Symbol, Range, etc.)
├── SymbolIcon.tsx        # Компонент иконок символов
├── Breadcrumbs.tsx       # Компонент "хлебных крошек"
├── SymbolTree.tsx        # Древовидное отображение символов
├── OutlinePanel.tsx      # Основная панель Outline
├── GoToSymbolPicker.tsx  # Быстрый выбор символа (Ctrl+Shift+O)
├── OutlineProvider.ts    # Провайдер символов
├── OutlineIPC.ts         # IPC хендлеры
├── useOutline.ts         # React hook
├── Outline.css           # Стили
├── index.ts              # Экспорты
├── parsers/
│   ├── BaseParser.ts     # Базовый класс парсера
│   ├── TypeScriptParser.ts
│   ├── PythonParser.ts
│   ├── GoParser.ts
│   ├── RustParser.ts
│   └── JavaParser.ts
└── README.md
```

## Использование

### Базовый пример

```typescript
import { OutlinePanel, OutlineProvider } from './outline';

const provider = new OutlineProvider();

// Получить символы документа
const symbols = await provider.getDocumentSymbols(fileUri, fileContent);

// Рендер панели
<OutlinePanel
  symbols={symbols}
  currentUri={fileUri}
  onNavigate={(target) => editor.goto(target)}
/>
```

### Использование с React Hook

```typescript
import { useOutline } from './outline';

function MyComponent() {
  const {
    symbols,
    breadcrumbs,
    isLoading,
    loadFile,
    setCursorPosition,
    navigateToSymbol,
  } = useOutline({
    onNavigate: (target) => editor.goto(target),
  });

  // Загрузить файл
  useEffect(() => {
    loadFile(fileUri, fileContent);
  }, [fileUri]);

  // Обновить позицию курсора
  const handleCursorMove = (pos) => {
    setCursorPosition(pos);
  };

  return (
    <OutlinePanel
      symbols={symbols}
      isLoading={isLoading}
      onNavigate={navigateToSymbol}
    />
  );
}
```

### Go to Symbol (Quick Picker)

```typescript
import { GoToSymbolPicker } from './outline';

<GoToSymbolPicker
  isOpen={isPickerOpen}
  documentSymbols={symbols}
  currentUri={fileUri}
  onSelect={(target) => editor.goto(target)}
  onClose={() => setPickerOpen(false)}
/>
```

### Breadcrumbs

```typescript
import { Breadcrumbs } from './outline';

<Breadcrumbs
  items={breadcrumbs}
  cursorPosition={currentPosition}
  onNavigate={(item) => editor.goto(item.range)}
/>
```

## Поддерживаемые языки

| Язык | Расширения | Парсер |
|------|-----------|--------|
| TypeScript | .ts, .tsx, .js, .jsx | typescript (AST) |
| Python | .py, .pyi | regex + jedi (опционально) |
| Go | .go | regex |
| Rust | .rs | regex |
| Java | .java | regex |

## IPC Channels

```typescript
// Main process
import { setupOutlineIPC } from './outline/OutlineIPC';

setupOutlineIPC(provider);

// Renderer
import { outlineAPI } from './outline/OutlineIPC';

const symbols = await outlineAPI.getDocumentSymbols(uri, content);
```

## Типы символов

- `file` - Файл
- `module` - Модуль
- `namespace` - Пространство имён
- `package` - Пакет
- `class` - Класс
- `method` - Метод
- `property` - Свойство
- `field` - Поле
- `constructor` - Конструктор
- `enum` - Перечисление
- `interface` - Интерфейс
- `function` - Функция
- `variable` - Переменная
- `constant` - Константа
- `struct` - Структура
- `typeParameter` - Параметр типа

## Функции

### Сортировка
- По позиции (по умолчанию)
- По имени
- По типу
- По доступности (public/protected/private)

### Фильтрация
- По типу символа (функции, классы, переменные)
- По имени (поиск)
- Скрывать deprecated
- Только публичные

### Навигация
- Клик для перехода
- Double-click для фокуса
- Follow cursor - авто-выбор текущего символа
- Breadcrumbs - показ пути к символу

### Горячие клавиши
- `Ctrl+Shift+O` / `Cmd+Shift+O` - Go to Symbol in File
- `Ctrl+T` / `Cmd+T` - Go to Symbol in Workspace
- `↑/↓` - Навигация по списку
- `Enter` - Перейти к символу
- `Esc` - Закрыть picker

## Расширение

### Добавление нового парсера

```typescript
import { BaseParser } from './outline/parsers/BaseParser';

class MyParser extends BaseParser {
  readonly languageId = 'mylang';
  readonly fileExtensions = ['my', 'mylang'];

  async parseDocument(uri: string, content: string): Promise<ParseResult> {
    const symbols: DocumentSymbol[] = [];
    
    // Ваш парсинг...
    
    return {
      symbols,
      duration: Date.now() - startTime,
    };
  }
}

// Регистрация
provider.registerParser(new MyParser());
```

## License

MIT
