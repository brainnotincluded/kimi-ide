# Debugger Framework

Debugger интеграция для IDE Traitor на основе Debug Adapter Protocol (DAP).

## Архитектура

```
debugger/
├── types.ts              # DAP типы и базовые интерфейсы
├── DebugAdapterClient.ts # DAP клиент для общения с debug adapter
├── DebugConfiguration.ts # Конфигурация отладчика
├── DebugSession.ts       # Управление сессией отладки
├── SourceMapper.ts       # Маппинг исходного кода и breakpoints
├── DebugUI.ts            # UI компоненты (toolbar, panels)
├── DebuggerIPC.ts        # IPC обработчики для Electron
├── index.ts              # Экспорты
└── README.md             # Документация
```

## Компоненты

### 1. DebugAdapterClient

Клиент для общения с debug adapter через DAP:

```typescript
import { DebugAdapterClient } from './debugger';

const client = new DebugAdapterClient({
    connectionType: 'stdio',
    command: 'python',
    args: ['-m', 'debugpy.adapter'],
    cwd: '/path/to/project'
});

await client.connect();
```

### 2. DebugSession

Управление сессией отладки:

```typescript
import { DebugSession, DebugConfigurationFactory } from './debugger';

const config = DebugConfigurationFactory.createPython(
    'Python: Current File',
    '/path/to/main.py',
    { args: ['--debug'], cwd: '/project' }
);

const session = new DebugSession('session-1', config);

session.onStopped.on(({ body }) => {
    console.log('Stopped:', body.reason);
});

await session.start();
```

### 3. SourceMapper

Управление отображением кода:

```typescript
import { SourceMapper, LineHighlightType } from './debugger';

const mapper = new SourceMapper();

// Установить breakpoint
const bp = mapper.addBreakpoint('/path/to/file.py', 42, {
    condition: 'x > 10'
});

// Подсветить текущую строку
mapper.setCurrentLine({ path: '/path/to/file.py', line: 42 });

// Проверить тип подсветки
const highlight = mapper.getLineHighlightType('/path/to/file.py', 42);
// LineHighlightType.Current | LineHighlightType.Breakpoint | null
```

### 4. DebugUI

UI компоненты:

```typescript
import { 
    DebugToolbar, 
    VariablesPanel, 
    WatchPanel,
    CallStackPanel,
    BreakpointsPanel 
} from './debugger';

const toolbar = new DebugToolbar();
toolbar.attachToSession(session);

// Continue execution
await toolbar.continue();

const variables = new VariablesPanel();
variables.attachToSession(session);

// Get scopes
const scopes = variables.getScopes();
```

### 5. IPC

Коммуникация между main и renderer процессами:

**Main process:**
```typescript
import { DebuggerMainIPCHandler } from './debugger';

const handler = new DebuggerMainIPCHandler(configManager, sourceMapper);
```

**Renderer process:**
```typescript
import { DebuggerRendererIPC } from './debugger';

// Start debugging
await DebuggerRendererIPC.start({
    configurationName: 'Python: Current File'
});

// Set breakpoint
await DebuggerRendererIPC.setBreakpoint({
    path: '/path/to/file.py',
    line: 42
});

// Listen to events
DebuggerRendererIPC.onStopped((event) => {
    console.log('Stopped:', event);
});
```

## Поддерживаемые Debug Adapters

| Язык    | Adapter    | Команда                          |
|---------|------------|----------------------------------|
| Python  | debugpy    | `python -m debugpy.adapter`      |
| Node.js | node-debug2| `node-debug2 --stdio`            |
| C/C++   | cpptools   | `OpenDebugAD7 --interpreter=vscode` |
| Go      | delve      | `dlv dap`                        |
| Rust    | lldb       | `lldb --interpreter=vscode`      |

## DAP Events

- `stopped` - выполнение остановлено
- `continued` - выполнение продолжено
- `thread` - поток создан/завершён
- `breakpoint` - breakpoint изменён
- `output` - вывод от программы
- `terminated` - сессия завершена
- `exited` - процесс завершён

## Пример использования

```typescript
import {
    DebugConfigurationFactory,
    DebugSession,
    SourceMapper,
    DebugToolbar
} from './debugger';

async function main() {
    // 1. Создать конфигурацию
    const config = DebugConfigurationFactory.createNode(
        'Node: Current File',
        './server.js',
        { env: { NODE_ENV: 'development' } }
    );

    // 2. Создать сессию
    const session = new DebugSession('node-debug', config);

    // 3. Подписаться на события
    session.onStopped.on(async ({ body }) => {
        console.log(`Stopped: ${body.reason}`);
        
        // Получить стек вызовов
        const frames = await session.getStackTrace();
        console.log('Stack:', frames.map(f => f.name));
        
        // Получить переменные
        const scopes = await session.getScopes(frames[0].id);
        for (const scope of scopes) {
            const vars = await session.getVariables(scope.variablesReference);
            console.log(`Scope ${scope.name}:`, vars);
        }
    });

    // 4. Установить breakpoints
    await session.setBreakpoints('./server.js', [
        { line: 10 },
        { line: 25, condition: 'count > 5' }
    ]);

    // 5. Запустить отладку
    await session.start();

    // 6. Создать toolbar
    const toolbar = new DebugToolbar();
    toolbar.attachToSession(session);
}
```

## Лицензия

MIT
