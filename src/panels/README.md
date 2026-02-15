# Kimi Chat Panel

Cursor-подобный Chat UI для VS Code extension.

## Структура

```
panels/
├── chatPanel.ts       # Основной класс ChatPanel
├── messageRenderer.ts # Рендеринг markdown и кода
└── index.ts           # Экспорты
```

## Использование

### Создание панели

```typescript
import { ChatPanel } from './panels';

// Создать или показать существующую панель
const panel = ChatPanel.createOrShow(
    context.extensionUri,
    (message) => {
        // Обработка отправки сообщения пользователем
        console.log('User message:', message);
    },
    (toolCallId, action) => {
        // Обработка действий с tool calls
        console.log('Tool action:', toolCallId, action);
    }
);
```

### Добавление сообщений

```typescript
// Добавить сообщение пользователя
panel.addMessage({
    id: 'msg-1',
    role: 'user',
    content: 'Привет, помоги мне с кодом',
    timestamp: Date.now()
});

// Добавить сообщение ассистента со статусом "thinking"
const assistantMsgId = 'msg-2';
panel.addMessage({
    id: assistantMsgId,
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    status: 'thinking'
});

// Обновить сообщение при получении ответа
panel.updateMessage(assistantMsgId, {
    content: 'Конечно! Вот пример кода:\n\n```typescript\nconst x = 1;\n```',
    status: 'complete'
});
```

### Tool Calls

```typescript
panel.addMessage({
    id: 'msg-3',
    role: 'assistant',
    content: 'Я использую инструмент для поиска файлов',
    timestamp: Date.now(),
    status: 'tool_executing',
    toolCalls: [{
        id: 'tool-1',
        name: 'search_files',
        arguments: { pattern: '*.ts', path: './src' },
        status: 'running'
    }]
});

// Обновить результат tool call
panel.updateMessage('msg-3', {
    toolCalls: [{
        id: 'tool-1',
        name: 'search_files',
        arguments: { pattern: '*.ts', path: './src' },
        result: ['src/index.ts', 'src/app.ts'],
        status: 'complete'
    }]
});
```

## Функции UI

### Для пользователя
- **Отправка сообщений**: Enter или кнопка Send
- **Многострочный ввод**: Shift+Enter для новой строки
- **Копирование кода**: Кнопка Copy в блоках кода
- **Вставка кода**: Кнопка Insert для вставки в активный редактор
- **Создание файла**: Кнопка New File для создания файла с кодом
- **Очистка чата**: Кнопка Clear в заголовке

### Для разработчика
- **Markdown рендеринг**: Поддержка всех стандартных элементов
- **Syntax highlighting**: highlight.js для 15+ языков
- **Tool calls**: Раскрывающиеся блоки для отображения вызовов инструментов
- **Status indicators**: Индикаторы thinking/tool_executing
- **Auto-scroll**: Автоматическая прокрутка к новым сообщениям

## Стили

Тёмная тема по умолчанию с переменными CSS:

```css
--bg-primary: #0d1117;      /* Основной фон */
--bg-secondary: #161b22;    /* Вторичный фон */
--accent-color: #58a6ff;    /* Акцентный цвет */
--user-bg: #1f6feb;         /* Фон сообщений пользователя */
--assistant-bg: #21262d;    /* Фон сообщений ассистента */
```

## API Webview

### Сообщения из Webview в Extension

```typescript
// Отправка сообщения
{ command: 'sendMessage', text: string }

// Копирование в буфер обмена
{ command: 'copyToClipboard', text: string }

// Вставка в курсор
{ command: 'insertAtCursor', text: string }

// Создание нового файла
{ command: 'createNewFile', text: string, language?: string }

// Действие с tool call
{ command: 'toolAction', toolCallId: string, action: string }

// Очистка чата
{ command: 'clearChat' }
```

### Сообщения из Extension в Webview

```typescript
// Добавить сообщение
{ command: 'addMessage', message: ChatMessage }

// Обновить сообщение
{ command: 'updateMessage', messageId: string, updates: Partial<ChatMessage> }

// Очистить все сообщения
{ command: 'clearMessages' }

// Установить статус
{ command: 'setStatus', status: string }
```

## Интерфейсы

```typescript
interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    status?: 'sending' | 'thinking' | 'tool_executing' | 'complete' | 'error';
    toolCalls?: ToolCall[];
}

interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
    result?: any;
    status: 'pending' | 'running' | 'complete' | 'error';
}
```
