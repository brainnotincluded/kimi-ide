/**
 * Example usage of Smart Context Management System
 * 
 * Примеры использования системы управления контекстом
 */

import * as vscode from 'vscode';
import {
    ContextManager,
    TokenBudget,
    RelevanceScorer,
    CompactionEngine,
    IncrementalLoader,
} from './index';

// =============================================================================
// Example 1: Basic Context Manager Setup
// =============================================================================

export function example1_basicSetup(extensionContext: vscode.ExtensionContext) {
    // Создаём менеджер с настройками по умолчанию
    const contextManager = new ContextManager(extensionContext, {
        enablePersistence: true,
        enableAutoCompaction: true,
        showUsageIndicator: true,
    });

    // Восстанавливаем предыдущую сессию при старте
    contextManager.restoreLastSession().then(restored => {
        if (restored) {
            console.log('Previous session restored');
        } else {
            // Создаём новую сессию
            contextManager.createSession('New Chat');
        }
    });

    return contextManager;
}

// =============================================================================
// Example 2: Adding Conversation Rounds
// =============================================================================

export function example2_addingRounds(contextManager: ContextManager) {
    // Добавляем раунд разговора
    contextManager.addRound(
        'How do I implement a custom React hook?',
        `You can create a custom React hook by defining a function that starts with 'use'. ` +
        `Here's an example:
        
\`\`\`typescript
function useLocalStorage<T>(key: string, initialValue: T) {
    const [value, setValue] = useState<T>(() => {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : initialValue;
    });
    
    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(value));
    }, [key, value]);
    
    return [value, setValue] as const;
}
\`\`\``,
        []
    );

    // Проверяем статистику
    const stats = contextManager.getStats();
    console.log(`Context usage: ${stats.usagePercentage}%`);
    console.log(`Rounds: ${stats.roundCount}`);
}

// =============================================================================
// Example 3: Loading Files with Different Priorities
// =============================================================================

export async function example3_loadingFiles(contextManager: ContextManager) {
    // Загружаем текущий файл с высоким приоритетом
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
        await contextManager.loadFile(activeEditor.document.uri, 'critical');
    }

    // Загружаем связанные файлы с нормальным приоритетом
    const relatedFiles = [
        vscode.Uri.file('/project/src/utils.ts'),
        vscode.Uri.file('/project/src/types.ts'),
    ];

    for (const file of relatedFiles) {
        await contextManager.loadFile(file, 'normal');
    }

    // Загружаем большой файл в фоне
    const largeFile = vscode.Uri.file('/project/src/large-dataset.json');
    await contextManager.loadFile(largeFile, 'background');
}

// =============================================================================
// Example 4: Manual Compaction Control
// =============================================================================

export async function example4_manualCompaction(contextManager: ContextManager) {
    // Проверяем статус перед важным запросом
    const stats = contextManager.getStats();
    
    if (stats.budgetStatus === 'warning') {
        // Показываем warning пользователю
        const action = await vscode.window.showWarningMessage(
            'Context usage is high. Consider compressing?',
            'Compress Now',
            'Continue Anyway'
        );

        if (action === 'Compress Now') {
            const result = await contextManager.triggerCompaction();
            if (result) {
                console.log(`Saved ${result.tokensSaved} tokens`);
                console.log('Compacted rounds:', result.compactedRounds);
            }
        }
    }

    // Critical: всегда доступна
    const criticalInfo = contextManager.getCriticalInfo();
    console.log('Requirements:', criticalInfo.requirements);
    console.log('Decisions:', criticalInfo.decisions);
}

// =============================================================================
// Example 5: Using Token Budget Directly
// =============================================================================

export function example5_tokenBudget() {
    const budget = new TokenBudget({
        maxContextTokens: 128000,
        warningThreshold: 0.75,
        criticalThreshold: 0.90,
        safetyMargin: 4000,
    });

    // Запрашиваем бюджет для разных компонентов
    const systemBudget = budget.requestBudget('system', 1000);
    const filesBudget = budget.requestBudget('mentionedFiles', 20000);
    const conversationBudget = budget.requestBudget('conversation', 50000);

    console.log(`Allocated: ${systemBudget} + ${filesBudget} + ${conversationBudget}`);

    // Обновляем фактическое использование
    const systemPrompt = 'You are a helpful assistant...';
    budget.updateUsage('system', budget.estimateTokens(systemPrompt));

    // Проверяем статус
    const snapshot = budget.getSnapshot();
    if (snapshot.warning) {
        console.warn(snapshot.warning.message);
    }
}

// =============================================================================
// Example 6: Relevance Scoring
// =============================================================================

export function example6_relevanceScoring() {
    const scorer = new RelevanceScorer({
        temporalWeight: 0.3,
        semanticWeight: 0.4,
        interactionWeight: 0.3,
        temporalHalfLife: 10 * 60 * 1000, // 10 minutes
    });

    // Трекаем файлы
    scorer.trackItem('/project/src/auth.ts', 'file', 
        'Authentication logic with JWT tokens...');
    scorer.trackItem('/project/src/utils.ts', 'file', 
        'Utility functions for formatting...');

    // Обновляем query context
    scorer.updateQueryContext('How to implement JWT authentication?');

    // Получаем наиболее релевантные файлы
    const mostRelevant = scorer.getMostRelevant(5);
    console.log('Most relevant files:');
    for (const item of mostRelevant) {
        console.log(`  ${item.id}: ${item.finalScore.toFixed(2)}`);
    }

    // Получаем наименее релевантные для удаления
    const leastRelevant = scorer.getLeastRelevant(3);
    console.log('Files to remove:', leastRelevant.map(i => i.id));
}

// =============================================================================
// Example 7: Session Management
// =============================================================================

export async function example7_sessionManagement(contextManager: ContextManager) {
    // Получаем список сохранённых сессий
    const sessions = contextManager.getSavedSessions();
    
    const items = sessions.map(s => ({
        label: s.title,
        description: new Date(s.updatedAt).toLocaleString(),
        id: s.id,
    }));

    // Показываем quick pick для выбора сессии
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a session to restore',
    });

    if (selected) {
        await contextManager.restoreSession(selected.id);
        vscode.window.showInformationMessage(`Restored session: ${selected.label}`);
    }
}

// =============================================================================
// Example 8: Using Incremental Loader Directly
// =============================================================================

export async function example8_incrementalLoader() {
    const loader = new IncrementalLoader({
        maxFullLoadSize: 1024 * 1024,      // 1MB
        maxLazyLoadSize: 10 * 1024 * 1024, // 10MB
        chunkSize: 64 * 1024,              // 64KB chunks
        maxCacheSize: 50 * 1024 * 1024,    // 50MB cache
    });

    // Загружаем файл с range
    const result = await loader.loadFile({
        uri: vscode.Uri.file('/project/src/large-file.ts'),
        priority: 'high',
        range: { start: 0, end: 50000 }, // First 50KB
        onProgress: (loaded, total) => {
            console.log(`Loaded: ${loaded}/${total}`);
        },
    });

    if (result.success) {
        console.log(`File loaded: ${result.file?.content.length} chars`);
        console.log(`Estimated tokens: ${result.file?.estimatedTokens}`);
    }

    // Догружаем оставшиеся чанки для большого файла
    await loader.loadMoreChunks(
        vscode.Uri.file('/project/src/large-file.ts'),
        [1, 2, 3] // chunk indices
    );

    // Проверяем статистику кэша
    const stats = loader.getCacheStats();
    console.log(`Cached files: ${stats.cachedFiles}`);
    console.log(`Cache size: ${(stats.cacheSize / 1024 / 1024).toFixed(2)} MB`);
}

// =============================================================================
// Example 9: Compaction Engine Direct Usage
// =============================================================================

export async function example9_compactionEngine() {
    const scorer = new RelevanceScorer();
    const engine = new CompactionEngine(scorer, {
        fullRoundsRetention: 15,
        maxRounds: 100,
        compactionThreshold: 80000,
    });

    // Добавляем много раундов
    for (let i = 0; i < 50; i++) {
        engine.addRound(
            `Question ${i}: How to do something?`,
            `Answer ${i}: You should use this approach...`,
            []
        );
    }

    // Получаем статистику
    const stats = engine.getStats();
    console.log(`Total rounds: ${stats.totalRounds}`);
    console.log(`Full rounds: ${stats.fullRounds}`);
    console.log(`Compacted: ${stats.compactedRounds}`);
    console.log(`Estimated tokens: ${stats.totalTokens}`);

    // Ручной запуск compaction
    const result = await engine.performCompaction();
    if (result) {
        console.log(`Compacted ${result.roundsCompacted} rounds`);
        console.log(`Saved ${result.tokensSaved} tokens`);
        
        // Critical info сохранена
        console.log('Requirements:', result.criticalInfo.requirements);
        console.log('Decisions:', result.criticalInfo.decisions);
    }
}

// =============================================================================
// Example 10: Integration with Chat Panel
// =============================================================================

export class ChatPanelIntegration {
    constructor(private contextManager: ContextManager) {}

    async onSendMessage(message: string): Promise<void> {
        // 1. Парсим упоминания файлов (@file:path)
        const mentions = this.parseFileMentions(message);
        
        // 2. Загружаем упомянутые файлы
        for (const mention of mentions) {
            await this.contextManager.loadFile(mention.uri, 'high');
        }

        // 3. Добавляем сообщение в контекст (временно, без ответа)
        // Note: в реальном коде это может работать иначе

        // 4. Получаем текущий контекст
        const rounds = this.contextManager.getRounds();
        const files = this.contextManager.getLoadedFiles();
        const criticalInfo = this.contextManager.getCriticalInfo();

        // 5. Проверяем бюджет перед отправкой
        const stats = this.contextManager.getStats();
        if (stats.budgetStatus === 'critical') {
            await this.contextManager.triggerCompaction();
        }

        // 6. Отправляем в API (здесь mock)
        console.log('Sending to API:', {
            messageCount: rounds.length,
            fileCount: files.length,
            totalTokens: stats.totalTokens,
        });

        // 7. Получаем ответ и добавляем полный раунд
        const assistantResponse = 'This is a mock response...';
        this.contextManager.addRound(message, assistantResponse, []);
    }

    private parseFileMentions(message: string): Array<{ uri: vscode.Uri; path: string }> {
        const mentions: Array<{ uri: vscode.Uri; path: string }> = [];
        const regex = /@file:([^\s]+)/g;
        let match;

        while ((match = regex.exec(message)) !== null) {
            const filePath = match[1];
            mentions.push({
                uri: vscode.Uri.file(filePath),
                path: filePath,
            });
        }

        return mentions;
    }
}
