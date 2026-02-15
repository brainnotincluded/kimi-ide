# C/C++ Language Support for Traitor IDE

Комплексная поддержка языка C/C++ для IDE Traitor с интеграцией CMake, clangd и отладчиков.

## Структура модуля

```
languages/cpp/
├── CppLanguageProvider.ts    # Основной провайдер языка
├── CppStatusBar.ts           # Статус-бар с информацией о компиляторе
├── CmakePanel.ts             # Панель CMake с targets
├── CppIpcHandler.ts          # IPC обработчики
├── extension.ts              # Точка входа расширения
├── index.ts                  # Экспорты модуля
├── package.json              # Конфигурация расширения VS Code
├── language-configuration.json # Конфигурация языка
└── tsconfig.json             # Конфигурация TypeScript
```

## Основные возможности

### 1. CppLanguageProvider

```typescript
class CppLanguageProvider {
    // Обнаружение компиляторов
    async detectCompilers(): Promise<CompilerInfo[]>
    
    // Работа с CMake
    async getCMakeInfo(): Promise<CMakeInfo | null>
    async configureCMake(): Promise<boolean>
    async runCMake(target?: string): Promise<boolean>
    
    // Диагностика кода
    async getDiagnostics(filePath?: string): Promise<CppDiagnostic[]>
    
    // Форматирование
    async formatCode(document: TextDocument, range?: Range): Promise<TextEdit[]>
    
    // Автодополнение
    async getCompletions(document: TextDocument, position: Position): Promise<CompletionItem[]>
    
    // Отладка
    async debugConfiguration(targetName?: string): Promise<DebugConfiguration | null>
}
```

### 2. Конфигурация (package.json)

```json
{
    "cpp.compiler": "gcc" | "clang" | "cl",
    "cpp.standard": "c++11" | "c++14" | "c++17" | "c++20" | "c++23",
    "cpp.includePaths": ["/usr/local/include"],
    "cpp.defines": {"DEBUG": "1"},
    "cpp.buildDirectory": "build",
    "cpp.debugger": "gdb" | "lldb",
    "cpp.clangdPath": "clangd",
    "cpp.clangFormatStyle": "file",
    "cpp.clangTidyChecks": "cppcoreguidelines-*,...",
    "cpp.parallelJobs": 0
}
```

### 3. UI Компоненты

#### CppStatusBar
- Отображает текущий компилятор и стандарт C++
- Кнопка build
- Меню быстрых действий по клику

#### CMakePanel
- Список CMake targets
- Дерево исходных файлов
- Кнопки: Configure, Build, Clean

### 4. IPC Команды

| Команда | Описание |
|---------|----------|
| `cpp:detectCompilers` | Обнаружить компиляторы |
| `cpp:configureCMake` | Конфигурировать CMake |
| `cpp:build` | Собрать проект/target |
| `cpp:buildAll` | Собрать все targets |
| `cpp:clean` | Очистить build директорию |
| `cpp:run` | Запустить исполняемый файл |
| `cpp:debug` | Запустить отладчик |
| `cpp:getDiagnostics` | Получить диагностику |
| `cpp:format` | Форматировать код |
| `cpp:getCMakeInfo` | Получить информацию о CMake |
| `cpp:setCompiler` | Установить компилятор |
| `cpp:getCompletions` | Получить автодополнения |

### 5. Горячие клавиши

| Клавиша | Действие |
|---------|----------|
| `Ctrl+Shift+B` | Быстрая сборка |
| `Ctrl+Shift+R` | Быстрый запуск |
| `Alt+O` | Переключение header/source |

## Интеграция с инструментами

### Компиляторы
- **GCC** - GNU Compiler Collection
- **Clang** - LLVM-based compiler
- **MSVC** - Microsoft Visual C++ (cl.exe)

### Сборка
- **CMake** - Кроссплатформенная система сборки
- **Ninja/Unix Makefiles** - Генераторы CMake

### Линтеры и анализаторы
- **clang-tidy** - Линтер с проверками на C++ best practices
- **cppcheck** - Статический анализатор кода

### Форматирование
- **clang-format** - Форматирование кода

### LSP
- **clangd** - Language Server Protocol для C++

### Отладчики
- **GDB** - GNU Debugger
- **LLDB** - LLVM Debugger

## Использование

### Активация расширения

```typescript
import { activate, CppLanguageProvider } from './languages/cpp';

// В главном extension.ts
export function activate(context: vscode.ExtensionContext) {
    await activateCpp(context);
}
```

### Доступ к провайдеру

```typescript
import { cppProvider } from './languages/cpp/extension';

// Использование API
const compilers = await cppProvider.detectCompilers();
await cppProvider.runCMake('mytarget');
```

### Создание задач сборки

```json
// tasks.json
{
    "version": "2.0.0",
    "tasks": [
        {
            "type": "cpp",
            "task": "build",
            "group": "build"
        }
    ]
}
```

## Требования

- Node.js 16+
- TypeScript 4.9+
- VS Code API 1.74+
- Установленные компиляторы (gcc/clang/cl)
- CMake 3.10+
- clangd (для LSP)
- clang-format (для форматирования)
- clang-tidy (для диагностики)
- cppcheck (для статического анализа)
- GDB или LLDB (для отладки)
