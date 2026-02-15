# Java Language Support for Traitor IDE

Полноценная поддержка Java для IDE Traitor с интеграцией Maven, Gradle и Eclipse JDT Language Server.

## Возможности

### 🚀 Основные функции
- Автоматическое обнаружение JDK (JAVA_HOME)
- Поддержка Maven и Gradle проектов
- Интеграция с Eclipse JDT Language Server
- Подсветка синтаксиса и диагностика
- Автодополнение кода
- Форматирование кода (google-java-format)
- Поддержка Checkstyle и SpotBugs

### 📊 UI Компоненты
- **JavaStatusBar** - отображение версии JDK, статуса сборки
- **MavenPanel** - дерево lifecycle goals и плагинов
- **GradlePanel** - дерево tasks

## Структура проекта

```
java/
├── index.ts                    # Основные экспорты
├── README.md                   # Документация
├── JavaLanguageProvider.ts     # Основной провайдер Java
├── JavaConfig.ts               # Конфигурация и схема
├── ui/
│   ├── JavaStatusBar.ts        # Статус-бар
│   ├── MavenPanel.ts           # Панель Maven
│   └── GradlePanel.ts          # Панель Gradle
└── ipc/
    └── JavaIPCHandler.ts       # IPC обработчики
```

## Использование

### Базовая инициализация

```typescript
import { JavaLanguageProvider, JavaStatusBar, MavenPanel, GradlePanel, JavaIPCHandler } from './languages/java';

// Создание провайдера
const javaProvider = new JavaLanguageProvider(workspaceRoot);
await javaProvider.initialize();

// Создание UI компонентов
const statusBar = new JavaStatusBar(javaProvider);
const mavenPanel = new MavenPanel(javaProvider);
const gradlePanel = new GradlePanel(javaProvider);

// IPC Handler
const ipcHandler = new JavaIPCHandler(javaProvider, statusBar, mavenPanel, gradlePanel);
ipcHandler.initializeEventForwarding();
```

### IPC Команды

#### JDK
- `java:detectJDK` - обнаружение JDK
- `java:getJDKInfo` - получение информации о JDK
- `java:selectJDK` - выбор JDK

#### Maven
- `java:runMaven <goal>` - запуск Maven goal
- `java:getMavenGoals` - получение списка lifecycle goals
- `java:showMavenPanel` - показать панель Maven

#### Gradle
- `java:runGradle <task>` - запуск Gradle task
- `java:getGradleTasks` - получение списка tasks
- `java:showGradlePanel` - показать панель Gradle

#### Workspace
- `java:refreshWorkspace` - обновление workspace
- `java:getBuildSystem` - получение информации о build system

#### Code
- `java:formatCode <filePath>` - форматирование кода
- `java:getDiagnostics <filePath>` - получение диагностики
- `java:getCompletions <filePath> <position>` - автодополнение

## Конфигурация

### settings.json

```json
{
  "java.home": "/path/to/jdk",
  "java.jdtls.home": "/path/to/jdtls",
  "java.jdtls.enabled": true,
  
  "java.import.maven.enabled": true,
  "java.import.gradle.enabled": true,
  
  "java.configuration.updateBuildConfiguration": "automatic",
  "java.autobuild.enabled": true,
  
  "java.format.enabled": true,
  "java.format.style": "google",
  "java.format.google-java-format.jar": "/path/to/google-java-format.jar",
  
  "java.checkstyle.enabled": false,
  "java.checkstyle.jar": "/path/to/checkstyle.jar",
  
  "java.spotbugs.enabled": false
}
```

### Переменные окружения

```bash
export JAVA_HOME=/path/to/jdk
export PATH=$JAVA_HOME/bin:$PATH
```

## Maven Lifecycle

| Phase | Описание |
|-------|----------|
| clean | Удаление артефактов предыдущей сборки |
| validate | Валидация проекта |
| compile | Компиляция исходного кода |
| test | Запуск unit-тестов |
| package | Создание пакета (JAR/WAR) |
| verify | Проверка пакета |
| install | Установка в локальный репозиторий |
| deploy | Публикация в удаленный репозиторий |
| site | Генерация документации |

## Gradle Tasks

| Task | Описание |
|------|----------|
| build | Сборка и тестирование |
| clean | Удаление build директории |
| assemble | Сборка артефактов |
| check | Запуск всех проверок |
| test | Запуск unit-тестов |
| jar | Создание JAR файла |
| javadoc | Генерация Javadoc |

## Требования

### Обязательные
- JDK 8 или выше
- Maven 3.6+ (для Maven проектов)
- Gradle 6+ (для Gradle проектов)

### Опциональные
- Eclipse JDT Language Server для полной поддержки LSP
- google-java-format для форматирования
- Checkstyle для статического анализа
- SpotBugs для поиска багов

## Установка зависимостей

### Eclipse JDT Language Server

```bash
# macOS/Linux
cd /opt
wget https://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz
tar -xzf jdt-language-server-latest.tar.gz
```

### google-java-format

```bash
wget https://github.com/google/google-java-format/releases/download/v1.18.1/google-java-format-1.18.1-all-deps.jar
```

### Checkstyle

```bash
wget https://github.com/checkstyle/checkstyle/releases/download/checkstyle-10.12.4/checkstyle-10.12.4-all.jar
```

## События

### JavaLanguageProvider
- `jdkDetected` - JDK обнаружен
- `jdkNotFound` - JDK не найден
- `buildSystemDetected` - Build system обнаружен
- `mavenStart` / `mavenComplete` - Maven события
- `gradleStart` / `gradleComplete` - Gradle события
- `jdtlsStarted` / `jdtlsStopped` - JDTLS события

### JavaStatusBar
- `updated` - обновление всех элементов
- `itemUpdated` - обновление элемента
- `showJDKSelector` - запрос выбора JDK

### MavenPanel / GradlePanel
- `refresh` - обновление дерева
- `goalStart` / `goalComplete` - Maven goal события
- `taskStart` / `taskComplete` - Gradle task события

## Лицензия

MIT
