# Руководство по внедрению улучшений в kimi-vscode

## Быстрый старт

### 1. FileDiscoveryAgent (Priority: HIGH)

Создать файл: `src/agents/fileDiscoveryAgent.ts` (код из CODEBUFF_INSPIRED_IMPROVEMENTS.md)

Изменить `src/context/contextResolver.ts`:

```typescript
// Добавить импорт
import { FileDiscoveryAgent } from '../agents/fileDiscoveryAgent';

// В конструкторе:
constructor(indexer: CodebaseIndexer, kimiApi: KimiApi, config?: Partial<ContextConfig>) {
    this.indexer = indexer;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fileDiscoveryAgent = new FileDiscoveryAgent(indexer, kimiApi);
}

// Заменить метод searchRelevantFiles:
async searchRelevantFiles(query: string, limit: number = 10): Promise<SearchResult[]> {
    const discovered = await this.fileDiscoveryAgent.discoverFiles(query, {
        maxFiles: limit,
        useLLM: true,
        includeSummaries: true,
    });

    return discovered.map(d => ({
        uri: vscode.Uri.file(d.file).toString(),
        relativePath: d.file,
        similarity: d.relevanceScore,
        size: 0,
        language: '',
        summary: d.summary,
    }));
}
```

### 2. ReviewAgent (Priority: HIGH)

Создать файл: `src/agents/reviewAgent.ts`

Изменить `src/providers/InlineEditProvider.ts`:

```typescript
// Добавить импорт
import { ReviewAgent } from '../agents/reviewAgent';

// В конструкторе:
constructor(kimiApi: KimiApi, diffProvider: DiffProvider) {
    // ... existing code ...
    this.reviewAgent = new ReviewAgent(kimiApi);
}

// В processEditRequest, после получения результата:
private async processEditRequest(session: InlineEditSession, instruction: string): Promise<void> {
    // ... generate edit ...
    const response = await this.kimiApi.generateEdit(prompt, { ... });
    
    // Добавить review перед показом
    const review = await this.reviewAgent.reviewEdit({
        originalCode: session.originalText,
        editedCode: response.content,
        instruction,
        language: session.editor.document.languageId,
    });

    if (!review.approved) {
        // Показать предупреждение с issues
        const action = await vscode.window.showWarningMessage(
            `Potential issues found (${review.issues.length})`,
            'Show Details',
            'Continue Anyway',
            'Cancel'
        );
        
        if (action === 'Show Details') {
            // Показать детали проблем
            this.showReviewDetails(review);
            return;
        } else if (action === 'Cancel') {
            this.cleanupSession(session.id);
            return;
        }
    }

    session.suggestedEdit = response.content;
    await this.showInlinePreview(session, response.content);
}
```

### 3. ParallelEditAgent (Priority: MEDIUM)

Создать файл: `src/agents/parallelEditAgent.ts`

Добавить настройку в `package.json`:

```json
{
  "kimi.enableParallelEditing": {
    "type": "boolean",
    "default": true,
    "description": "Enable parallel multi-strategy editing"
  },
  "kimi.parallelEditTimeout": {
    "type": "number",
    "default": 30000,
    "description": "Timeout for parallel editing (ms)"
  }
}
```

Изменить `src/providers/InlineEditProvider.ts`:

```typescript
// Проверять настройку
const config = vscode.workspace.getConfiguration('kimi');
const enableParallel = config.get<boolean>('enableParallelEditing', true);

if (enableParallel) {
    const result = await this.parallelEditAgent.editWithStrategies(prompt, {
        timeoutMs: config.get<number>('parallelEditTimeout', 30000),
    });
    
    session.suggestedEdit = result.edit;
    
    // Показать информацию о выбранной стратегии
    if (result.confidence > 0.7) {
        vscode.window.showInformationMessage(
            `Generated using "${result.selectedStrategy}" strategy`
        );
    }
    
    // Показать альтернативы если уверенность низкая
    if (result.confidence < 0.6 && result.alternatives.length > 0) {
        const showAlternatives = await vscode.window.showInformationMessage(
            'Low confidence. View alternatives?',
            'Yes',
            'No'
        );
        if (showAlternatives === 'Yes') {
            this.showAlternatives(result);
        }
    }
} else {
    // Fallback к обычному редактированию
    const response = await this.kimiApi.generateEdit(prompt);
    session.suggestedEdit = response.content;
}
```

### 4. SmartContextManager (Priority: MEDIUM)

Создать файл: `src/context/smartContextManager.ts`

Изменить `src/panels/chatPanel.ts` (или где ведётся история чата):

```typescript
import { SmartContextManager } from '../context/smartContextManager';

export class ChatPanel {
    private contextManager: SmartContextManager;

    constructor(kimiApi: KimiApi) {
        this.contextManager = new SmartContextManager(kimiApi);
    }

    async handleUserMessage(message: string): Promise<void> {
        // Добавить сообщение пользователя
        await this.contextManager.addMessage({
            role: 'user',
            content: message,
        });

        // Получить контекст для LLM
        const context = this.contextManager.getContextForPrompt();
        
        // Использовать контекст при запросе к API
        const response = await this.kimiApi.generateResponseWithContext(
            message,
            context
        );

        // Добавить ответ ассистента
        await this.contextManager.addMessage({
            role: 'assistant',
            content: response.content,
        });
    }
}
```

### 5. Testing Agent (Priority: LOW)

Добавить команду в `package.json`:

```json
{
  "command": "kimi.generateTestsForFile",
  "title": "Generate Tests for File",
  "category": "Kimi",
  "icon": "$(beaker)"
}
```

Создать обработчик в `src/commands/testingCommands.ts`:

```typescript
import { TestingAgent } from '../agents/testingAgent';

export function registerTestingCommands(context: vscode.ExtensionContext, kimiApi: KimiApi) {
    const testingAgent = new TestingAgent(kimiApi);

    const generateTestsCmd = vscode.commands.registerCommand(
        'kimi.generateTestsForFile',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const document = editor.document;
            const tests = await testingAgent.generateTests({
                code: document.getText(),
                language: document.languageId,
                filePath: document.fileName,
                coverage: 'comprehensive',
            });

            // Создать файл с тестами
            const testUri = vscode.Uri.file(tests.testFilePath);
            await vscode.workspace.fs.writeFile(
                testUri,
                Buffer.from(tests.testCode)
            );

            await vscode.window.showTextDocument(testUri);
        }
    );

    context.subscriptions.push(generateTestsCmd);
}
```

### 6. Security Agent (Priority: MEDIUM)

Добавить в `src/providers/InlineEditProvider.ts`:

```typescript
import { SecurityAgent } from '../agents/securityAgent';

// В конструкторе:
this.securityAgent = new SecurityAgent(kimiApi);

// В processEditRequest:
const securityScan = await this.securityAgent.scanCode(
    response.content,
    session.editor.document.languageId
);

if (securityScan.riskLevel === 'critical' || securityScan.riskLevel === 'high') {
    const action = await vscode.window.showWarningMessage(
        `⚠️ Security issues detected: ${securityScan.vulnerabilities.length}`,
        'View Issues',
        'Cancel Edit'
    );
    
    if (action === 'View Issues') {
        this.showSecurityIssues(securityScan);
    }
    
    if (action === 'Cancel Edit') {
        this.cleanupSession(session.id);
        return;
    }
}
```

### 7. Performance Optimizations

Создать `src/utils/workerPool.ts` и использовать в `codebaseIndexer.ts`:

```typescript
import { WorkerPool } from '../utils/workerPool';

// Для параллельной индексации файлов
const indexingWorker = new WorkerPool<{ content: string }, DocumentVector>(
    './indexingWorker.js',
    4
);

// Вместо последовательной обработки:
const vectors = await Promise.all(
    files.map(f => indexingWorker.execute({ content: f.content }))
);
```

## Тестирование

### Unit тесты для агентов

Создать `src/test/agents/fileDiscoveryAgent.test.ts`:

```typescript
import * as assert from 'assert';
import { FileDiscoveryAgent } from '../../agents/fileDiscoveryAgent';
import { mockKimiApi, mockCodebaseIndexer } from '../mocks';

describe('FileDiscoveryAgent', () => {
    let agent: FileDiscoveryAgent;

    beforeEach(() => {
        agent = new FileDiscoveryAgent(mockCodebaseIndexer, mockKimiApi);
    });

    it('should discover relevant files', async () => {
        const results = await agent.discoverFiles('user authentication', {
            maxFiles: 5,
            useLLM: false,
        });

        assert.strictEqual(results.length, 5);
        assert(results[0].relevanceScore > 0);
    });
});
```

## Миграция существующего кода

### План постепенной миграции

1. **Week 1**: FileDiscoveryAgent + ReviewAgent (минимальные изменения)
2. **Week 2**: SmartContextManager (требует тестирования)
3. **Week 3**: ParallelEditAgent (требует UI изменений)
4. **Week 4**: TestingAgent, SecurityAgent, DocsAgent
5. **Week 5**: Performance optimizations

### Backwards Compatibility

Все изменения должны быть опциональными:

```typescript
// Проверяем настройки перед использованием новых фич
const useNewFeatures = config.get<boolean>('kimi.experimental.enableCodebuffFeatures', false);

if (useNewFeatures) {
    // Новый код
} else {
    // Старый код
}
```
