# Улучшения Kimi VS Code Extension на основе инноваций Codebuff AI

## Обзор

Этот документ описывает конкретные улучшения для kimi-vscode, вдохновлённые архитектурой Codebuff AI. Каждое улучшение включает анализ того, что делает Codebuff особенным, и конкретную реализацию для Kimi.

---

## 1. Tree-based File Discovery (вместо grep)

### Что делает Codebuff:
- Парсит весь codebase → строит дерево
- Использует Grok 4.1 Fast для поиска релевантных файлов
- Gemini Flash для суммаризации файлов
- Main agent читает несколько файлов сраз

### Текущая реализация в Kimi:
Сейчас используется TF-IDF поиск в `codebaseIndexer.ts` - хорошая база, но можно значительно улучшить.

### Предлагаемые улучшения:

#### 1.1 Semantic File Discovery с LLM

```typescript
// src/agents/fileDiscoveryAgent.ts

interface FileDiscoveryResult {
    file: string;
    relevanceScore: number;
    relevanceReason: string;
    summary?: string;
}

interface CodebaseTree {
    root: TreeNode;
    modules: Map<string, ModuleNode>;
    dependencies: DependencyGraph;
}

interface TreeNode {
    path: string;
    type: 'file' | 'directory';
    children: Map<string, TreeNode>;
    metadata: NodeMetadata;
}

interface NodeMetadata {
    language: string;
    exports: string[];
    imports: string[];
    symbols: CodeSymbol[];
    summary?: string;
    lastAnalyzed: number;
}

export class FileDiscoveryAgent {
    private indexer: CodebaseIndexer;
    private kimiApi: KimiApi;
    private tree: CodebaseTree | null = null;
    private fileSummaries: Map<string, string> = new Map();

    constructor(indexer: CodebaseIndexer, kimiApi: KimiApi) {
        this.indexer = indexer;
        this.kimiApi = kimiApi;
    }

    /**
     * Основной метод поиска релевантных файлов
     * Использует многоуровневый подход как в Codebuff
     */
    async discoverFiles(query: string, options: DiscoveryOptions = {}): Promise<FileDiscoveryResult[]> {
        const { maxFiles = 10, useLLM = true } = options;

        // Уровень 1: Быстрый TF-IDF поиск (уже есть в indexer)
        const tfidfResults = this.indexer.search(query, maxFiles * 3);
        
        if (!useLLM || tfidfResults.length === 0) {
            return tfidfResults.map(r => ({
                file: r.relativePath,
                relevanceScore: r.similarity,
                relevanceReason: 'TF-IDF match',
            }));
        }

        // Уровень 2: LLM-based reranking (как Grok 4.1 Fast у Codebuff)
        const rerankedResults = await this.rerankWithLLM(query, tfidfResults, maxFiles);

        // Уровень 3: Суммаризация топ файлов (как Gemini Flash у Codebuff)
        await this.summarizeTopFiles(rerankedResults.slice(0, 5));

        return rerankedResults;
    }

    /**
     * LLM-based reranking файлов по релевантности запросу
     */
    private async rerankWithLLM(
        query: string, 
        candidates: SearchResult[], 
        topK: number
    ): Promise<FileDiscoveryResult[]> {
        // Строим компактное дерево файлов для LLM
        const fileTree = this.buildCompactTree(candidates.map(c => c.relativePath));
        
        const symbols = candidates.flatMap(c => 
            this.indexer.getFileContext(vscode.Uri.parse(c.uri))?.symbols || []
        );

        const prompt = `You are a code search expert. Given a user query and a list of candidate files, 
select the most relevant files and rank them by relevance.

User Query: "${query}"

Candidate Files:
${candidates.map((c, i) => `${i + 1}. ${c.relativePath} (${c.language})`).join('\n')}

File Tree Structure:
${fileTree}

Key Symbols Found:
${symbols.slice(0, 20).map(s => `- ${s.name} (${SymbolKind[s.kind]})`).join('\n')}

Respond in JSON format:
{
  "rankings": [
    {"index": 1, "score": 0.95, "reason": "Contains main implementation of X"},
    ...
  ]
}`;

        const response = await this.kimiApi.generateResponse(prompt, { temperature: 0.1 });
        
        try {
            const parsed = JSON.parse(response.content);
            return parsed.rankings
                .filter((r: any) => r.index > 0 && r.index <= candidates.length)
                .map((r: any) => ({
                    file: candidates[r.index - 1].relativePath,
                    relevanceScore: r.score,
                    relevanceReason: r.reason,
                }))
                .slice(0, topK);
        } catch {
            // Fallback к TF-IDF если LLM не смог распарсить
            return candidates.slice(0, topK).map(c => ({
                file: c.relativePath,
                relevanceScore: c.similarity,
                relevanceReason: 'TF-IDF fallback',
            }));
        }
    }

    /**
     * Суммаризация файлов для Main Agent (как Gemini Flash)
     */
    private async summarizeTopFiles(results: FileDiscoveryResult[]): Promise<void> {
        // Параллельная суммаризация
        const summarizationPromises = results.map(async result => {
            const uri = vscode.Uri.file(result.file);
            const context = this.indexer.getFileContext(uri);
            if (!context) return;

            // Пропускаем если уже есть свежая суммаризация
            if (this.fileSummaries.has(result.file)) return;

            const summary = await this.summarizeFile(context);
            this.fileSummaries.set(result.file, summary);
            result.summary = summary;
        });

        await Promise.all(summarizationPromises);
    }

    private async summarizeFile(context: FileContext): Promise<string> {
        const truncatedContent = context.content.slice(0, 3000);
        
        const prompt = `Summarize this code file in 2-3 sentences. Focus on:
1. What the file does (main purpose)
2. Key classes/functions exported
3. Dependencies and relationships

File: ${context.relativePath}

\`\`\`
${truncatedContent}
\`\`\`

Summary:`;

        const response = await this.kimiApi.generateResponse(prompt, { 
            temperature: 0.1,
            maxTokens: 200 
        });

        return response.content;
    }

    /**
     * Построение семантического дерева codebase
     */
    async buildCodebaseTree(): Promise<CodebaseTree> {
        const files = await this.getAllIndexedFiles();
        const root: TreeNode = {
            path: '',
            type: 'directory',
            children: new Map(),
            metadata: { language: '', exports: [], imports: [], symbols: [], lastAnalyzed: 0 },
        };

        for (const file of files) {
            this.insertIntoTree(root, file);
        }

        this.tree = {
            root,
            modules: this.extractModules(root),
            dependencies: this.buildDependencyGraph(files),
        };

        return this.tree;
    }

    private insertIntoTree(root: TreeNode, filePath: string): void {
        const parts = filePath.split('/');
        let current = root;

        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const isFile = i === parts.length - 1;

            if (!current.children.has(part)) {
                current.children.set(part, {
                    path: [...parts.slice(0, i), part].join('/'),
                    type: isFile ? 'file' : 'directory',
                    children: new Map(),
                    metadata: { language: '', exports: [], imports: [], symbols: [], lastAnalyzed: 0 },
                });
            }

            current = current.children.get(part)!;
        }
    }

    private buildCompactTree(files: string[]): string {
        const tree = this.buildFileTree(files);
        return this.renderCompactTree(tree);
    }

    private renderCompactTree(node: TreeNode, prefix = '', isLast = true): string {
        const lines: string[] = [];
        const connector = isLast ? '└── ' : '├── ';
        
        if (node.path) {
            lines.push(prefix + connector + path.basename(node.path));
        }

        const children = Array.from(node.children.values());
        const childPrefix = prefix + (isLast ? '    ' : '│   ');

        children.forEach((child, index) => {
            const isLastChild = index === children.length - 1;
            lines.push(this.renderCompactTree(child, childPrefix, isLastChild));
        });

        return lines.join('\n');
    }

    private extractModules(root: TreeNode): Map<string, ModuleNode> {
        // Извлечение модулей по директориям (src/modules/, packages/, etc.)
        const modules = new Map<string, ModuleNode>();
        
        for (const [name, child] of root.children) {
            if (child.type === 'directory') {
                modules.set(name, {
                    name,
                    path: child.path,
                    files: this.collectFiles(child),
                    exports: [], // Заполняется позже
                });
            }
        }

        return modules;
    }

    private collectFiles(node: TreeNode): string[] {
        const files: string[] = [];
        
        if (node.type === 'file') {
            files.push(node.path);
        } else {
            for (const child of node.children.values()) {
                files.push(...this.collectFiles(child));
            }
        }

        return files;
    }

    private buildDependencyGraph(files: string[]): DependencyGraph {
        const graph: DependencyGraph = { nodes: new Map(), edges: [] };

        for (const file of files) {
            const uri = vscode.Uri.file(file);
            const context = this.indexer.getFileContext(uri);
            if (!context) continue;

            graph.nodes.set(file, {
                path: file,
                imports: this.extractImports(context),
                exports: context.symbols.map(s => s.name),
            });
        }

        // Построение рёбер
        for (const [file, node] of graph.nodes) {
            for (const imp of node.imports) {
                const resolved = this.resolveImport(imp, file);
                if (resolved && graph.nodes.has(resolved)) {
                    graph.edges.push({ from: file, to: resolved, type: 'import' });
                }
            }
        }

        return graph;
    }

    private extractImports(context: FileContext): string[] {
        const content = context.content;
        const imports: string[] = [];

        // TypeScript/JavaScript imports
        const tsImportRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
        let match;
        while ((match = tsImportRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        return imports;
    }

    private resolveImport(importPath: string, fromFile: string): string | null {
        // Упрощённое разрешение импортов
        if (importPath.startsWith('.')) {
            const fromDir = path.dirname(fromFile);
            const resolved = path.resolve(fromDir, importPath);
            return resolved;
        }
        return null;
    }

    private async getAllIndexedFiles(): Promise<string[]> {
        const stats = this.indexer.getStats();
        // Получаем все файлы из индекса
        return []; // Реализация зависит от CodebaseIndexer API
    }
}

interface DiscoveryOptions {
    maxFiles?: number;
    useLLM?: boolean;
    includeSummaries?: boolean;
}

interface ModuleNode {
    name: string;
    path: string;
    files: string[];
    exports: string[];
}

interface DependencyGraph {
    nodes: Map<string, {
        path: string;
        imports: string[];
        exports: string[];
    }>;
    edges: Array<{
        from: string;
        to: string;
        type: 'import' | 'inheritance' | 'usage';
    }>;
}
```

#### 1.2 Интеграция с ContextResolver

```typescript
// src/context/contextResolver.ts - улучшения

export class ContextResolver {
    private fileDiscoveryAgent: FileDiscoveryAgent;

    constructor(
        indexer: CodebaseIndexer, 
        kimiApi: KimiApi,
        config?: Partial<ContextConfig>
    ) {
        this.indexer = indexer;
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.fileDiscoveryAgent = new FileDiscoveryAgent(indexer, kimiApi);
    }

    /**
     * Улучшенный поиск с LLM reranking
     */
    async searchRelevantFiles(query: string, limit: number = 10): Promise<SearchResult[]> {
        // Используем Tree-based discovery вместо простого TF-IDF
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
}
```

---

## 2. Parallel Multi-Strategy Editing

### Что делает Codebuff:
- Несколько editor агентов параллельно с разными стратегиями
- Reuse prompt cache
- Selector agent выбирает лучший результат

### Реализация для Kimi:

```typescript
// src/agents/parallelEditAgent.ts

interface EditStrategy {
    name: string;
    promptModifier: (basePrompt: string) => string;
    temperature: number;
    systemPrompt?: string;
}

interface EditAttempt {
    strategy: string;
    result: string;
    metadata: EditMetadata;
}

interface EditMetadata {
    tokensUsed: number;
    latency: number;
    syntaxValid: boolean;
    testResults?: TestResults;
}

interface SelectedEdit {
    edit: string;
    selectedStrategy: string;
    confidence: number;
    alternatives: string[];
}

export class ParallelEditAgent {
    private kimiApi: KimiApi;
    private strategies: EditStrategy[];
    private selectorAgent: SelectorAgent;

    constructor(kimiApi: KimiApi) {
        this.kimiApi = kimiApi;
        this.selectorAgent = new SelectorAgent(kimiApi);
        
        // Предопределённые стратегии редактирования
        this.strategies = [
            {
                name: 'conservative',
                promptModifier: (base) => `${base}\n\nStrategy: Make MINIMAL changes. Only fix what's necessary.`,
                temperature: 0.1,
                systemPrompt: 'You are a conservative code editor. Make only essential changes.',
            },
            {
                name: 'aggressive',
                promptModifier: (base) => `${base}\n\nStrategy: OPTIMIZE thoroughly. Improve performance and structure significantly.`,
                temperature: 0.3,
                systemPrompt: 'You are an aggressive optimizer. Make substantial improvements.',
            },
            {
                name: 'idiomatic',
                promptModifier: (base) => `${base}\n\nStrategy: Follow language BEST PRACTICES and idioms. Make code cleaner and more maintainable.`,
                temperature: 0.2,
                systemPrompt: 'You are an expert in idiomatic code. Focus on best practices and patterns.',
            },
            {
                name: 'defensive',
                promptModifier: (base) => `${base}\n\nStrategy: Add COMPREHENSIVE error handling and validation. Make code robust.`,
                temperature: 0.2,
                systemPrompt: 'You focus on code safety and error handling.',
            },
        ];
    }

    /**
     * Параллельное редактирование с несколькими стратегиями
     */
    async editWithStrategies(
        basePrompt: string,
        options: ParallelEditOptions = {}
    ): Promise<SelectedEdit> {
        const { 
            strategies = this.strategies,
            timeoutMs = 30000,
            useCache = true,
        } = options;

        // Создаём promise для каждой стратегии
        const attemptPromises = strategies.map(strategy => 
            this.executeStrategy(basePrompt, strategy, timeoutMs)
        );

        // Ждём все результаты (не отклоняемся при ошибках)
        const attempts = await Promise.allSettled(attemptPromises);

        // Собираем успешные результаты
        const successfulAttempts: EditAttempt[] = [];
        attempts.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value) {
                successfulAttempts.push({
                    strategy: strategies[index].name,
                    result: result.value.code,
                    metadata: result.value.metadata,
                });
            }
        });

        if (successfulAttempts.length === 0) {
            throw new Error('All edit strategies failed');
        }

        // Если только один результат - возвращаем его
        if (successfulAttempts.length === 1) {
            return {
                edit: successfulAttempts[0].result,
                selectedStrategy: successfulAttempts[0].strategy,
                confidence: 1.0,
                alternatives: [],
            };
        }

        // Selector agent выбирает лучший результат
        const selection = await this.selectorAgent.selectBestEdit(
            basePrompt,
            successfulAttempts
        );

        return {
            edit: selection.selectedEdit,
            selectedStrategy: selection.selectedStrategy,
            confidence: selection.confidence,
            alternatives: successfulAttempts
                .filter(a => a.strategy !== selection.selectedStrategy)
                .map(a => a.result),
        };
    }

    /**
     * Выполнение одной стратегии редактирования
     */
    private async executeStrategy(
        basePrompt: string,
        strategy: EditStrategy,
        timeoutMs: number
    ): Promise<{ code: string; metadata: EditMetadata } | null> {
        const startTime = Date.now();
        
        const modifiedPrompt = strategy.promptModifier(basePrompt);
        
        try {
            const response = await this.withTimeout(
                this.kimiApi.generateEdit(modifiedPrompt, {
                    temperature: strategy.temperature,
                }),
                timeoutMs
            );

            const latency = Date.now() - startTime;

            if (response.error) {
                return null;
            }

            // Базовая валидация синтаксиса
            const syntaxValid = this.validateSyntax(response.content);

            return {
                code: response.content,
                metadata: {
                    tokensUsed: response.usage?.totalTokens || 0,
                    latency,
                    syntaxValid,
                },
            };
        } catch (error) {
            console.error(`Strategy ${strategy.name} failed:`, error);
            return null;
        }
    }

    private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
        return Promise.race([
            promise,
            new Promise<T>((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), ms)
            ),
        ]);
    }

    private validateSyntax(code: string): boolean {
        // Базовая проверка: баланс скобок, кавычек
        const brackets = { '(': ')', '[': ']', '{': '}' };
        const stack: string[] = [];
        let inString: string | null = null;
        let escaped = false;

        for (const char of code) {
            if (escaped) {
                escaped = false;
                continue;
            }

            if (char === '\\') {
                escaped = true;
                continue;
            }

            if (inString) {
                if (char === inString) {
                    inString = null;
                }
                continue;
            }

            if (char === '"' || char === "'" || char === '`') {
                inString = char;
                continue;
            }

            if (brackets[char]) {
                stack.push(brackets[char]);
            } else if (Object.values(brackets).includes(char)) {
                if (stack.pop() !== char) {
                    return false;
                }
            }
        }

        return stack.length === 0 && inString === null;
    }
}

/**
 * Selector Agent - выбирает лучший результат редактирования
 */
class SelectorAgent {
    private kimiApi: KimiApi;

    constructor(kimiApi: KimiApi) {
        this.kimiApi = kimiApi;
    }

    async selectBestEdit(
        originalPrompt: string,
        attempts: EditAttempt[]
    ): Promise<{
        selectedEdit: string;
        selectedStrategy: string;
        confidence: number;
    }> {
        // Быстрый выбор если только 2 варианта
        if (attempts.length === 2) {
            return this.binarySelect(originalPrompt, attempts[0], attempts[1]);
        }

        // Множественный выбор для 3+ вариантов
        return this.multiSelect(originalPrompt, attempts);
    }

    private async binarySelect(
        prompt: string,
        a: EditAttempt,
        b: EditAttempt
    ): Promise<{ selectedEdit: string; selectedStrategy: string; confidence: number }> {
        const selectionPrompt = `You are an expert code reviewer. Compare two code edits and select the better one.

Original Request: "${prompt}"

Edit A (${a.strategy}):
\`\`\`
${a.result}
\`\`\`

Edit B (${b.strategy}):
\`\`\`
${b.result}
\`\`\`

Respond in JSON:
{
  "choice": "A" or "B",
  "confidence": 0.0 to 1.0,
  "reason": "brief explanation"
}`;

        const response = await this.kimiApi.generateResponse(selectionPrompt, {
            temperature: 0.1,
        });

        try {
            const parsed = JSON.parse(response.content);
            const selected = parsed.choice === 'A' ? a : b;
            return {
                selectedEdit: selected.result,
                selectedStrategy: selected.strategy,
                confidence: parsed.confidence || 0.5,
            };
        } catch {
            // Fallback: выбираем первый
            return {
                selectedEdit: a.result,
                selectedStrategy: a.strategy,
                confidence: 0.5,
            };
        }
    }

    private async multiSelect(
        prompt: string,
        attempts: EditAttempt[]
    ): Promise<{ selectedEdit: string; selectedStrategy: string; confidence: number }> {
        const options = attempts.map((a, i) => 
            `Option ${i + 1} (${a.strategy}):\n\`\`\`\n${a.result}\n\`\`\``
        ).join('\n\n');

        const selectionPrompt = `Rate these ${attempts.length} code edits from 1-10 and pick the best.

Request: "${prompt}"

${options}

Respond in JSON:
{
  "ratings": [8, 6, 9, ...],
  "winner": 1,
  "confidence": 0.9
}`;

        const response = await this.kimiApi.generateResponse(selectionPrompt, {
            temperature: 0.1,
        });

        try {
            const parsed = JSON.parse(response.content);
            const winnerIndex = (parsed.winner || 1) - 1;
            const winner = attempts[winnerIndex] || attempts[0];
            return {
                selectedEdit: winner.result,
                selectedStrategy: winner.strategy,
                confidence: parsed.confidence || 0.5,
            };
        } catch {
            return {
                selectedEdit: attempts[0].result,
                selectedStrategy: attempts[0].strategy,
                confidence: 0.5,
            };
        }
    }
}

interface ParallelEditOptions {
    strategies?: EditStrategy[];
    timeoutMs?: number;
    useCache?: boolean;
}
```

### Интеграция с InlineEditProvider:

```typescript
// src/providers/InlineEditProvider.ts - улучшения

export class InlineEditProvider implements vscode.Disposable {
    private parallelEditAgent: ParallelEditAgent;

    constructor(kimiApi: KimiApi, diffProvider: DiffProvider) {
        this.kimiApi = kimiApi;
        this.diffProvider = diffProvider;
        this.parallelEditAgent = new ParallelEditAgent(kimiApi);
    }

    private async processEditRequest(
        session: InlineEditSession, 
        instruction: string
    ): Promise<void> {
        const context = this.getSurroundingContext(session.editor, session.originalRange);
        const prompt = this.buildEditPrompt(
            session.originalText,
            instruction,
            context,
            session.editor.document.languageId
        );

        // Используем параллельное редактирование
        const result = await this.parallelEditAgent.editWithStrategies(prompt, {
            timeoutMs: 30000,
        });

        session.suggestedEdit = result.edit;
        session.alternatives = result.alternatives;

        // Показываем какой стратегия выбрана
        vscode.window.showInformationMessage(
            `Edit generated using "${result.selectedStrategy}" strategy (confidence: ${Math.round(result.confidence * 100)}%)`
        );

        await this.showInlinePreview(session, result.edit);
    }
}
```

---

## 3. Automatic Code Review

### Что делает Codebuff:
- Reviewer agent на каждый prompt
- Параллельно с typechecks/tests
- Ловит баги до показа результата

### Реализация:

```typescript
// src/agents/reviewAgent.ts

interface ReviewResult {
    approved: boolean;
    issues: CodeIssue[];
    suggestions: string[];
    confidence: number;
}

interface CodeIssue {
    severity: 'error' | 'warning' | 'info';
    message: string;
    line?: number;
    category: 'syntax' | 'logic' | 'security' | 'performance' | 'style';
}

interface ReviewContext {
    originalCode: string;
    editedCode: string;
    instruction: string;
    language: string;
    relatedFiles?: string[];
}

export class ReviewAgent {
    private kimiApi: KimiApi;
    private testRunner: TestRunner;
    private typeChecker: TypeChecker;

    constructor(kimiApi: KimiApi) {
        this.kimiApi = kimiApi;
        this.testRunner = new TestRunner();
        this.typeChecker = new TypeChecker();
    }

    /**
     * Полная проверка кода перед показом пользователю
     */
    async reviewEdit(context: ReviewContext): Promise<ReviewResult> {
        // Параллельные проверки
        const [llmReview, syntaxCheck, typeCheck] = await Promise.all([
            this.llmReview(context),
            this.checkSyntax(context),
            this.runTypeCheck(context),
        ]);

        // Агрегируем результаты
        const allIssues = [
            ...llmReview.issues,
            ...syntaxCheck.issues,
            ...typeCheck.issues,
        ];

        const errors = allIssues.filter(i => i.severity === 'error');
        const warnings = allIssues.filter(i => i.severity === 'warning');

        // Если есть критические ошибки - не одобряем
        const approved = errors.length === 0;

        return {
            approved,
            issues: allIssues,
            suggestions: llmReview.suggestions,
            confidence: this.calculateConfidence(llmReview, syntaxCheck, typeCheck),
        };
    }

    /**
     * LLM-based code review
     */
    private async llmReview(context: ReviewContext): Promise<ReviewResult> {
        const prompt = `Review this code edit. Identify issues, bugs, or improvements needed.

Original Request: "${context.instruction}"
Language: ${context.language}

Original Code:
\`\`\`${context.language}
${context.originalCode}
\`\`\`

Edited Code:
\`\`\`${context.language}
${context.editedCode}
\`\`\`

Check for:
1. Syntax errors
2. Logic bugs or edge cases
3. Security vulnerabilities (injection, unsafe eval, etc.)
4. Performance issues
5. Breaking changes
6. Missing error handling

Respond in JSON:
{
  "issues": [
    {"severity": "error|warning|info", "message": "...", "category": "syntax|logic|security|performance|style"}
  ],
  "suggestions": ["..."],
  "confidence": 0.0 to 1.0
}`;

        const response = await this.kimiApi.generateResponse(prompt, {
            temperature: 0.1,
        });

        try {
            const parsed = JSON.parse(response.content);
            return {
                approved: parsed.issues?.filter((i: any) => i.severity === 'error').length === 0,
                issues: parsed.issues || [],
                suggestions: parsed.suggestions || [],
                confidence: parsed.confidence || 0.5,
            };
        } catch {
            return {
                approved: true,
                issues: [],
                suggestions: [],
                confidence: 0.5,
            };
        }
    }

    /**
     * Проверка синтаксиса
     */
    private async checkSyntax(context: ReviewContext): Promise<ReviewResult> {
        const issues: CodeIssue[] = [];

        // Используем VS Code language features
        const document = await vscode.workspace.openTextDocument({
            content: context.editedCode,
            language: context.language,
        });

        // Запрашиваем diagnostics
        const diagnostics = await vscode.commands.executeCommand<vscode.Diagnostic[]>(
            'vscode.executeCodeActionProvider',
            document.uri,
            new vscode.Range(0, 0, document.lineCount, 0)
        );

        // Базовые проверки
        if (context.language === 'typescript' || context.language === 'javascript') {
            const bracketCheck = this.checkBrackets(context.editedCode);
            if (!bracketCheck.valid) {
                issues.push({
                    severity: 'error',
                    message: bracketCheck.message,
                    category: 'syntax',
                });
            }
        }

        return {
            approved: issues.filter(i => i.severity === 'error').length === 0,
            issues,
            suggestions: [],
            confidence: 1.0,
        };
    }

    private checkBrackets(code: string): { valid: boolean; message: string } {
        const pairs: Record<string, string> = { '(': ')', '[': ']', '{': '}' };
        const stack: string[] = [];
        
        for (const char of code) {
            if (pairs[char]) {
                stack.push(pairs[char]);
            } else if (Object.values(pairs).includes(char)) {
                if (stack.pop() !== char) {
                    return { valid: false, message: `Mismatched bracket: ${char}` };
                }
            }
        }

        if (stack.length > 0) {
            return { valid: false, message: `Unclosed bracket: ${stack[stack.length - 1]}` };
        }

        return { valid: true, message: '' };
    }

    /**
     * Type checking через VS Code
     */
    private async runTypeCheck(context: ReviewContext): Promise<ReviewResult> {
        // Для TypeScript/JavaScript используем встроенный type checker
        if (context.language === 'typescript' || context.language === 'javascript') {
            // Получаем diagnostics от TypeScript сервера
            // Это упрощённая реализация
        }

        return {
            approved: true,
            issues: [],
            suggestions: [],
            confidence: 1.0,
        };
    }

    private calculateConfidence(
        llm: ReviewResult,
        syntax: ReviewResult,
        type: ReviewResult
    ): number {
        // Взвешенная оценка уверенности
        return llm.confidence * 0.5 + syntax.confidence * 0.3 + type.confidence * 0.2;
    }
}

// Вспомогательные классы
class TestRunner {
    async runRelatedTests(filePath: string): Promise<{ passed: boolean; failures: string[] }> {
        // Интеграция с тестовым фреймворком проекта
        return { passed: true, failures: [] };
    }
}

class TypeChecker {
    async checkTypes(code: string, language: string): Promise<{ valid: boolean; errors: string[] }> {
        // Интеграция с TypeScript/Language Server
        return { valid: true, errors: [] };
    }
}
```

---

## 4. Invisible Context Management

### Что делает Codebuff:
- Smart compaction после idle
- Non-lossy summaries
- Immediate re-reading

### Реализация:

```typescript
// src/context/smartContextManager.ts

interface ContextState {
    messages: Message[];
    files: Map<string, FileVersion>;
    summary?: ConversationSummary;
    lastActivity: number;
    totalTokens: number;
}

interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    tokens: number;
    timestamp: number;
    filesReferenced: string[];
}

interface FileVersion {
    content: string;
    hash: string;
    version: number;
    summary?: string;
    isCompacted: boolean;
}

interface ConversationSummary {
    highLevel: string;
    keyDecisions: string[];
    openQuestions: string[];
    currentFocus: string;
}

export class SmartContextManager {
    private state: ContextState;
    private kimiApi: KimiApi;
    private config: ContextManagerConfig;
    private idleTimer?: NodeJS.Timeout;
    private readonly IDLE_TIMEOUT = 5 * 60 * 1000; // 5 минут

    constructor(kimiApi: KimiApi, config: Partial<ContextManagerConfig> = {}) {
        this.kimiApi = kimiApi;
        this.config = {
            maxTokens: 120000,
            compactionThreshold: 0.8, // Компактировать при 80% заполнении
            summaryInterval: 10, // Суммаризировать каждые N сообщений
            ...config,
        };
        
        this.state = {
            messages: [],
            files: new Map(),
            lastActivity: Date.now(),
            totalTokens: 0,
        };

        this.startIdleMonitor();
    }

    /**
     * Добавление сообщения с автоматической компактацией
     */
    async addMessage(message: Omit<Message, 'id' | 'tokens' | 'timestamp'>): Promise<void> {
        const tokens = this.estimateTokens(message.content);
        const newMessage: Message = {
            ...message,
            id: this.generateId(),
            tokens,
            timestamp: Date.now(),
            filesReferenced: this.extractFileReferences(message.content),
        };

        this.state.messages.push(newMessage);
        this.state.totalTokens += tokens;
        this.state.lastActivity = Date.now();

        // Проверяем необходимость компактации
        if (this.shouldCompact()) {
            await this.compactContext();
        }

        this.resetIdleTimer();
    }

    /**
     * Smart compaction - не теряем информацию
     */
    private async compactContext(): Promise<void> {
        console.log('[SmartContext] Starting compaction...');

        // Суммаризируем старые сообщения
        const messagesToSummarize = this.state.messages.slice(0, -5); // Оставляем последние 5
        
        if (messagesToSummarize.length > 0) {
            const summary = await this.summarizeMessages(messagesToSummarize);
            
            // Заменяем суммаризированные сообщения одним
            this.state.messages = [
                {
                    id: this.generateId(),
                    role: 'system',
                    content: `## Previous Conversation Summary\n\n${summary.highLevel}\n\nKey Decisions:\n${summary.keyDecisions.map(d => `- ${d}`).join('\n')}`,
                    tokens: this.estimateTokens(summary.highLevel),
                    timestamp: Date.now(),
                    filesReferenced: [],
                },
                ...this.state.messages.slice(-5),
            ];

            this.state.summary = summary;
        }

        // Компактируем файлы
        await this.compactFiles();

        // Пересчитываем токены
        this.recalculateTokens();

        console.log('[SmartContext] Compaction complete. New token count:', this.state.totalTokens);
    }

    /**
     * Суммаризация сообщений без потери важной информации
     */
    private async summarizeMessages(messages: Message[]): Promise<ConversationSummary> {
        const conversation = messages.map(m => 
            `${m.role.toUpperCase()}: ${m.content.slice(0, 500)}`
        ).join('\n\n');

        const prompt = `Summarize this conversation. Preserve important technical details, decisions, and context.

${conversation}

Provide a structured summary in JSON:
{
  "highLevel": "2-3 sentence overview",
  "keyDecisions": ["decision 1", "decision 2", ...],
  "openQuestions": ["question 1", ...],
  "currentFocus": "what we're working on now"
}`;

        const response = await this.kimiApi.generateResponse(prompt, {
            temperature: 0.2,
            maxTokens: 500,
        });

        try {
            return JSON.parse(response.content);
        } catch {
            return {
                highLevel: response.content.slice(0, 200),
                keyDecisions: [],
                openQuestions: [],
                currentFocus: '',
            };
        }
    }

    /**
     * Компактация файлов - замена на суммарии
     */
    private async compactFiles(): Promise<void> {
        for (const [path, fileVersion] of this.state.files) {
            if (fileVersion.isCompacted) continue;

            const content = fileVersion.content;
            const tokenCount = this.estimateTokens(content);

            // Если файл большой - создаём суммарию
            if (tokenCount > 1000) {
                const summary = await this.summarizeFile(content, path);
                
                this.state.files.set(path, {
                    ...fileVersion,
                    summary,
                    isCompacted: true,
                });
            }
        }
    }

    private async summarizeFile(content: string, path: string): Promise<string> {
        const prompt = `Summarize this file's key exports and important implementation details.
Keep enough detail for code editing tasks.

File: ${path}

${content.slice(0, 3000)}

Summary (focus on: main classes/functions, key logic, interfaces):`;

        const response = await this.kimiApi.generateResponse(prompt, {
            maxTokens: 300,
        });

        return response.content;
    }

    /**
     * Immediate re-reading - восстановление полного контекста
     */
    async expandCompactedFile(path: string): Promise<string> {
        const fileVersion = this.state.files.get(path);
        if (!fileVersion) return '';

        if (!fileVersion.isCompacted) {
            return fileVersion.content;
        }

        // Читаем актуальное содержимое
        const freshContent = await this.readFileFromDisk(path);
        
        // Обновляем кэш
        this.state.files.set(path, {
            content: freshContent,
            hash: this.hashContent(freshContent),
            version: fileVersion.version + 1,
            isCompacted: false,
        });

        return freshContent;
    }

    /**
     * Получение контекста для LLM с учётом компактации
     */
    getContextForPrompt(): { messages: Message[]; files: Map<string, string> } {
        const files = new Map<string, string>();

        for (const [path, version] of this.state.files) {
            if (version.isCompacted && version.summary) {
                files.set(path, `// SUMMARY of ${path}:\n${version.summary}\n// Use @file:${path} to load full content`);
            } else {
                files.set(path, version.content);
            }
        }

        return {
            messages: this.state.messages,
            files,
        };
    }

    private shouldCompact(): boolean {
        return this.state.totalTokens > this.config.maxTokens * this.config.compactionThreshold;
    }

    private startIdleMonitor(): void {
        this.resetIdleTimer();
    }

    private resetIdleTimer(): void {
        if (this.idleTimer) {
            clearTimeout(this.idleTimer);
        }

        this.idleTimer = setTimeout(() => {
            this.onIdle();
        }, this.IDLE_TIMEOUT);
    }

    private async onIdle(): Promise<void> {
        console.log('[SmartContext] Idle detected, performing maintenance...');
        
        // Можно сохранить состояние, обновить суммарии и т.д.
        if (this.state.messages.length > this.config.summaryInterval) {
            await this.compactContext();
        }
    }

    private recalculateTokens(): void {
        this.state.totalTokens = this.state.messages.reduce((sum, m) => sum + m.tokens, 0);
    }

    private estimateTokens(text: string): number {
        return Math.ceil(text.length / 3.5);
    }

    private extractFileReferences(content: string): string[] {
        const refs: string[] = [];
        const regex = /@(?:file|folder):(\S+)/g;
        let match;
        while ((match = regex.exec(content)) !== null) {
            refs.push(match[1]);
        }
        return refs;
    }

    private async readFileFromDisk(filePath: string): Promise<string> {
        const uri = vscode.Uri.file(filePath);
        const content = await vscode.workspace.fs.readFile(uri);
        return content.toString();
    }

    private hashContent(content: string): string {
        // Простой hash для примера
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(16);
    }

    private generateId(): string {
        return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    }
}

interface ContextManagerConfig {
    maxTokens: number;
    compactionThreshold: number;
    summaryInterval: number;
}
```

---

## 5. Новые Агенты

### 5.1 Testing Agent

```typescript
// src/agents/testingAgent.ts

interface TestGenerationRequest {
    code: string;
    language: string;
    filePath: string;
    testFramework?: string;
    coverage?: 'basic' | 'comprehensive' | 'edge-cases';
}

interface GeneratedTests {
    testCode: string;
    framework: string;
    testFilePath: string;
    estimatedCoverage: number;
    testCases: TestCase[];
}

interface TestCase {
    name: string;
    description: string;
    type: 'unit' | 'integration' | 'edge' | 'error';
}

export class TestingAgent {
    private kimiApi: KimiApi;

    constructor(kimiApi: KimiApi) {
        this.kimiApi = kimiApi;
    }

    async generateTests(request: TestGenerationRequest): Promise<GeneratedTests> {
        const framework = request.testFramework || this.detectTestFramework(request.filePath);
        
        const prompt = `Generate comprehensive unit tests for this code.

Language: ${request.language}
Framework: ${framework}
Coverage Level: ${request.coverage || 'comprehensive'}

Code to test:
\`\`\`${request.language}
${request.code}
\`\`\`

Requirements:
1. Test all public functions/methods
2. Include edge cases (null, empty, boundary values)
3. Include error cases
4. Use ${framework} best practices
5. Add descriptive test names

Output ONLY the test code, no explanations.`;

        const response = await this.kimiApi.generateResponse(prompt, {
            temperature: 0.3,
        });

        const testCases = this.parseTestCases(response.content, framework);

        return {
            testCode: response.content,
            framework,
            testFilePath: this.getTestFilePath(request.filePath, framework),
            estimatedCoverage: this.estimateCoverage(testCases),
            testCases,
        };
    }

    async runTests(testFilePath: string): Promise<TestRunResult> {
        // Интеграция с test runner
        return {
            passed: 0,
            failed: 0,
            skipped: 0,
            failures: [],
        };
    }

    private detectTestFramework(filePath: string): string {
        if (filePath.endsWith('.ts') || filePath.endsWith('.js')) {
            // Проверяем package.json
            return 'jest'; // default
        }
        if (filePath.endsWith('.py')) return 'pytest';
        if (filePath.endsWith('.go')) return 'testing';
        if (filePath.endsWith('.rs')) return 'cargo test';
        return 'unknown';
    }

    private getTestFilePath(sourcePath: string, framework: string): string {
        const ext = sourcePath.split('.').pop();
        const base = sourcePath.replace(`.${ext}`, '');
        
        if (framework === 'jest' || framework === 'mocha') {
            return `${base}.test.${ext}`;
        }
        if (framework === 'pytest') {
            return `test_${base.split('/').pop()}.py`;
        }
        return `${base}_test.${ext}`;
    }

    private parseTestCases(testCode: string, framework: string): TestCase[] {
        const cases: TestCase[] = [];
        
        if (framework === 'jest') {
            const regex = /it\(['"](.+?)['"]/g;
            let match;
            while ((match = regex.exec(testCode)) !== null) {
                cases.push({
                    name: match[1],
                    description: '',
                    type: 'unit',
                });
            }
        }
        
        return cases;
    }

    private estimateCoverage(testCases: TestCase[]): number {
        // Упрощённая оценка
        const baseCoverage = Math.min(testCases.length * 10, 80);
        const hasEdgeCases = testCases.some(t => t.type === 'edge');
        const hasErrorCases = testCases.some(t => t.type === 'error');
        
        return Math.min(baseCoverage + (hasEdgeCases ? 10 : 0) + (hasErrorCases ? 10 : 0), 100);
    }
}

interface TestRunResult {
    passed: number;
    failed: number;
    skipped: number;
    failures: Array<{ test: string; error: string }>;
}
```

### 5.2 Security Agent

```typescript
// src/agents/securityAgent.ts

interface SecurityScanResult {
    vulnerabilities: Vulnerability[];
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    recommendations: string[];
}

interface Vulnerability {
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: 'injection' | 'xss' | 'secrets' | 'dependencies' | 'crypto';
    message: string;
    line?: number;
    cwe?: string;
    remediation: string;
}

export class SecurityAgent {
    private kimiApi: KimiApi;
    private patterns: SecurityPattern[];

    constructor(kimiApi: KimiApi) {
        this.kimiApi = kimiApi;
        this.patterns = this.loadSecurityPatterns();
    }

    async scanCode(code: string, language: string): Promise<SecurityScanResult> {
        // Параллельно: pattern matching + LLM analysis
        const [patternResults, llmResults] = await Promise.all([
            this.patternBasedScan(code, language),
            this.llmSecurityScan(code, language),
        ]);

        const allVulnerabilities = [...patternResults, ...llmResults];

        return {
            vulnerabilities: allVulnerabilities,
            riskLevel: this.calculateRiskLevel(allVulnerabilities),
            recommendations: this.generateRecommendations(allVulnerabilities),
        };
    }

    private patternBasedScan(code: string, language: string): Vulnerability[] {
        const vulnerabilities: Vulnerability[] = [];
        
        for (const pattern of this.patterns) {
            if (pattern.languages && !pattern.languages.includes(language)) continue;
            
            const regex = new RegExp(pattern.regex, 'gi');
            let match;
            while ((match = regex.exec(code)) !== null) {
                vulnerabilities.push({
                    severity: pattern.severity,
                    category: pattern.category,
                    message: pattern.message,
                    line: this.getLineNumber(code, match.index),
                    cwe: pattern.cwe,
                    remediation: pattern.remediation,
                });
            }
        }

        return vulnerabilities;
    }

    private async llmSecurityScan(code: string, language: string): Promise<Vulnerability[]> {
        const prompt = `Analyze this code for security vulnerabilities.

Language: ${language}

\`\`\`${language}
${code}
\`\`\`

Check for:
1. SQL/NoSQL injection
2. Command injection
3. Path traversal
4. Insecure deserialization
5. Weak cryptography
6. Hardcoded secrets
7. XSS vulnerabilities
8. CSRF issues

Respond in JSON:
{
  "vulnerabilities": [
    {"severity": "high|medium|low", "category": "injection|xss|...", "message": "...", "remediation": "..."}
  ]
}`;

        const response = await this.kimiApi.generateResponse(prompt, { temperature: 0.1 });
        
        try {
            const parsed = JSON.parse(response.content);
            return parsed.vulnerabilities || [];
        } catch {
            return [];
        }
    }

    private loadSecurityPatterns(): SecurityPattern[] {
        return [
            {
                regex: 'eval\\s*\\(',
                languages: ['javascript', 'typescript'],
                severity: 'high',
                category: 'injection',
                message: 'Dangerous use of eval()',
                cwe: 'CWE-95',
                remediation: 'Avoid eval(). Use safer alternatives like JSON.parse() or Function constructor.',
            },
            {
                regex: 'innerHTML\\s*=',
                languages: ['javascript', 'typescript'],
                severity: 'medium',
                category: 'xss',
                message: 'Potential XSS via innerHTML',
                cwe: 'CWE-79',
                remediation: 'Use textContent instead, or sanitize HTML before insertion.',
            },
            {
                regex: '(password|secret|key|token)\\s*=\\s*["\'][^"\']+["\']',
                severity: 'high',
                category: 'secrets',
                message: 'Possible hardcoded secret',
                cwe: 'CWE-798',
                remediation: 'Use environment variables or secure secret management.',
            },
            {
                regex: 'SELECT.*\\+.*FROM',
                severity: 'critical',
                category: 'injection',
                message: 'Potential SQL injection',
                cwe: 'CWE-89',
                remediation: 'Use parameterized queries or ORM.',
            },
        ];
    }

    private calculateRiskLevel(vulnerabilities: Vulnerability[]): SecurityScanResult['riskLevel'] {
        if (vulnerabilities.some(v => v.severity === 'critical')) return 'critical';
        if (vulnerabilities.some(v => v.severity === 'high')) return 'high';
        if (vulnerabilities.some(v => v.severity === 'medium')) return 'medium';
        if (vulnerabilities.length > 0) return 'low';
        return 'low';
    }

    private generateRecommendations(vulnerabilities: Vulnerability[]): string[] {
        const categories = new Set(vulnerabilities.map(v => v.category));
        const recommendations: string[] = [];

        if (categories.has('secrets')) {
            recommendations.push('Move all secrets to environment variables or secret manager');
        }
        if (categories.has('injection')) {
            recommendations.push('Use parameterized queries and avoid string concatenation in SQL/commands');
        }
        if (categories.has('xss')) {
            recommendations.push('Implement Content Security Policy and sanitize user input');
        }

        return recommendations;
    }

    private getLineNumber(code: string, index: number): number {
        return code.slice(0, index).split('\n').length;
    }
}

interface SecurityPattern {
    regex: string;
    languages?: string[];
    severity: Vulnerability['severity'];
    category: Vulnerability['category'];
    message: string;
    cwe?: string;
    remediation: string;
}
```

### 5.3 Documentation Agent

```typescript
// src/agents/docsAgent.ts

interface DocsGenerationRequest {
    code: string;
    language: string;
    style: 'jsdoc' | 'docstring' | 'rustdoc' | 'rdoc';
    detail: 'brief' | 'standard' | 'comprehensive';
}

interface GeneratedDocs {
    documentedCode: string;
    summary: string;
    examples: string[];
}

export class DocumentationAgent {
    private kimiApi: KimiApi;

    constructor(kimiApi: KimiApi) {
        this.kimiApi = kimiApi;
    }

    async generateDocs(request: DocsGenerationRequest): Promise<GeneratedDocs> {
        const prompt = `Add ${request.style} documentation to this code.

Language: ${request.language}
Detail Level: ${request.detail}

Code:
\`\`\`${request.language}
${request.code}
\`\`\`

Requirements:
- Document all public APIs
- Include parameter types and descriptions
- Document return values
- Add usage examples
- Mention edge cases and exceptions

Output ONLY the documented code.`;

        const response = await this.kimiApi.generateResponse(prompt, {
            temperature: 0.2,
        });

        return {
            documentedCode: response.content,
            summary: this.extractSummary(response.content),
            examples: this.extractExamples(response.content),
        };
    }

    async generateReadme(projectPath: string): Promise<string> {
        // Анализируем структуру проекта и генерируем README
        const structure = await this.analyzeProjectStructure(projectPath);
        
        const prompt = `Generate a comprehensive README.md for this project.

Project Structure:
${structure}

Include:
1. Project title and description
2. Installation instructions
3. Usage examples
4. API documentation
5. Contributing guidelines
6. License

Format as proper Markdown.`;

        const response = await this.kimiApi.generateResponse(prompt);
        return response.content;
    }

    private async analyzeProjectStructure(projectPath: string): Promise<string> {
        // Сканируем ключевые файлы
        return '';
    }

    private extractSummary(documentedCode: string): string {
        // Извлекаем summary из JSDoc/docstring
        return '';
    }

    private extractExamples(documentedCode: string): string[] {
        // Извлекаем @example теги
        return [];
    }
}
```

---

## 6. Оптимизации для VS Code Extension (быстрее чем CLI)

### 6.1 WebWorker Pool для параллельных операций

```typescript
// src/utils/workerPool.ts

type WorkerTask<T, R> = {
    id: string;
    payload: T;
    resolve: (result: R) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
};

export class WorkerPool<T, R> {
    private workers: Worker[] = [];
    private queue: WorkerTask<T, R>[] = [];
    private activeTasks: Map<number, WorkerTask<T, R>> = new Map();
    private taskIdCounter = 0;

    constructor(
        private workerScript: string,
        private poolSize: number = navigator.hardwareConcurrency || 4
    ) {
        this.initializeWorkers();
    }

    private initializeWorkers(): void {
        for (let i = 0; i < this.poolSize; i++) {
            const worker = new Worker(this.workerScript);
            worker.onmessage = (e) => this.handleMessage(i, e.data);
            worker.onerror = (err) => this.handleError(i, err);
            this.workers.push(worker);
        }
    }

    async execute(payload: T, timeoutMs: number = 30000): Promise<R> {
        return new Promise((resolve, reject) => {
            const id = `task-${++this.taskIdCounter}`;
            const timeout = setTimeout(() => {
                reject(new Error(`Task ${id} timed out`));
            }, timeoutMs);

            const task: WorkerTask<T, R> = {
                id,
                payload,
                resolve,
                reject,
                timeout,
            };

            this.queue.push(task);
            this.processQueue();
        });
    }

    private processQueue(): void {
        for (let i = 0; i < this.workers.length; i++) {
            if (!this.activeTasks.has(i) && this.queue.length > 0) {
                const task = this.queue.shift()!;
                this.activeTasks.set(i, task);
                this.workers[i].postMessage({ id: task.id, payload: task.payload });
            }
        }
    }

    private handleMessage(workerId: number, result: R): void {
        const task = this.activeTasks.get(workerId);
        if (task) {
            clearTimeout(task.timeout);
            task.resolve(result);
            this.activeTasks.delete(workerId);
            this.processQueue();
        }
    }

    private handleError(workerId: number, error: ErrorEvent): void {
        const task = this.activeTasks.get(workerId);
        if (task) {
            clearTimeout(task.timeout);
            task.reject(new Error(error.message));
            this.activeTasks.delete(workerId);
            this.processQueue();
        }
    }

    terminate(): void {
        this.workers.forEach(w => w.terminate());
        this.workers = [];
        this.queue = [];
        this.activeTasks.clear();
    }
}
```

### 6.2 Request Batching для API calls

```typescript
// src/utils/requestBatcher.ts

interface BatchedRequest<T, R> {
    payload: T;
    resolve: (result: R) => void;
    reject: (error: Error) => void;
}

export class RequestBatcher<T, R> {
    private queue: BatchedRequest<T, R>[] = [];
    private timer?: NodeJS.Timeout;
    private readonly maxBatchSize: number;
    private readonly maxWaitMs: number;
    private readonly processor: (batch: T[]) => Promise<R[]>;

    constructor(
        processor: (batch: T[]) => Promise<R[]>,
        options: { maxBatchSize?: number; maxWaitMs?: number } = {}
    ) {
        this.processor = processor;
        this.maxBatchSize = options.maxBatchSize || 10;
        this.maxWaitMs = options.maxWaitMs || 50;
    }

    async request(payload: T): Promise<R> {
        return new Promise((resolve, reject) => {
            this.queue.push({ payload, resolve, reject });
            this.scheduleBatch();
        });
    }

    private scheduleBatch(): void {
        if (this.timer) return;

        if (this.queue.length >= this.maxBatchSize) {
            this.processBatch();
        } else {
            this.timer = setTimeout(() => this.processBatch(), this.maxWaitMs);
        }
    }

    private async processBatch(): Promise<void> {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = undefined;
        }

        const batch = this.queue.splice(0, this.maxBatchSize);
        if (batch.length === 0) return;

        try {
            const payloads = batch.map(b => b.payload);
            const results = await this.processor(payloads);

            batch.forEach((item, index) => {
                item.resolve(results[index]);
            });
        } catch (error) {
            batch.forEach(item => {
                item.reject(error instanceof Error ? error : new Error(String(error)));
            });
        }

        if (this.queue.length > 0) {
            this.scheduleBatch();
        }
    }
}
```

### 6.3 Predictive Prefetching

```typescript
// src/utils/prefetchManager.ts

export class PrefetchManager {
    private cache: Map<string, PrefetchedData> = new Map();
    private accessHistory: string[] = [];
    private readonly maxCacheSize = 50;

    constructor(private fetcher: (key: string) => Promise<any>) {}

    async get(key: string): Promise<any> {
        // Update access history
        this.accessHistory.push(key);
        if (this.accessHistory.length > 100) {
            this.accessHistory.shift();
        }

        // Check cache
        const cached = this.cache.get(key);
        if (cached && !this.isStale(cached)) {
            cached.lastAccessed = Date.now();
            return cached.data;
        }

        // Fetch and cache
        const data = await this.fetcher(key);
        this.cache.set(key, {
            data,
            fetchedAt: Date.now(),
            lastAccessed: Date.now(),
        });

        // Evict old entries if needed
        this.evictIfNeeded();

        // Predict and prefetch
        this.predictAndPrefetch(key);

        return data;
    }

    private predictAndPrefetch(currentKey: string): void {
        // Simple Markov chain prediction
        const predictions = this.predictNextFiles(currentKey);
        
        predictions.forEach(prediction => {
            if (!this.cache.has(prediction)) {
                // Prefetch in background
                this.fetcher(prediction).then(data => {
                    this.cache.set(prediction, {
                        data,
                        fetchedAt: Date.now(),
                        lastAccessed: 0, // Not accessed yet
                    });
                }).catch(() => {
                    // Ignore prefetch errors
                });
            }
        });
    }

    private predictNextFiles(currentFile: string): string[] {
        // Find files that were accessed after this file in history
        const predictions: Map<string, number> = new Map();
        
        for (let i = 0; i < this.accessHistory.length - 1; i++) {
            if (this.accessHistory[i] === currentFile) {
                const next = this.accessHistory[i + 1];
                predictions.set(next, (predictions.get(next) || 0) + 1);
            }
        }

        // Return top predictions
        return Array.from(predictions.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([file]) => file);
    }

    private isStale(cached: PrefetchedData): boolean {
        const staleTime = 5 * 60 * 1000; // 5 minutes
        return Date.now() - cached.fetchedAt > staleTime;
    }

    private evictIfNeeded(): void {
        if (this.cache.size <= this.maxCacheSize) return;

        // Evict least recently used
        const entries = Array.from(this.cache.entries());
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

        const toEvict = entries.slice(0, entries.length - this.maxCacheSize);
        toEvict.forEach(([key]) => this.cache.delete(key));
    }
}

interface PrefetchedData {
    data: any;
    fetchedAt: number;
    lastAccessed: number;
}
```

### 6.4 VS Code Native Optimizations

```typescript
// src/utils/vscodeOptimizations.ts

export class VSCodeOptimizer {
    /**
     * Использование VS Code Proposed API для быстрых inline edits
     */
    static async fastInlineEdit(
        editor: vscode.TextEditor,
        range: vscode.Range,
        newText: string
    ): Promise<boolean> {
        // Используем workspace edit для атомарных изменений
        const workspaceEdit = new vscode.WorkspaceEdit();
        workspaceEdit.replace(editor.document.uri, range, newText);
        
        // Применяем с оптимизациями
        const success = await vscode.workspace.applyEdit(workspaceEdit, {
            isRefactoring: false, // Не добавлять в undo stack как refactoring
        });

        if (success) {
            // Сохраняем документ без форматирования для скорости
            await editor.document.save();
        }

        return success;
    }

    /**
     * Lazy loading больших модулей
     */
    static async lazyLoad<T>(loader: () => Promise<T>): Promise<T> {
        // Используем dynamic import с prefetch
        const module = await loader();
        return module;
    }

    /**
     * Debounced diagnostics
     */
    static createDebouncedDiagnostics(
        provider: vscode.DiagnosticCollection,
        delay: number = 300
    ): (uri: vscode.Uri, diagnostics: vscode.Diagnostic[]) => void {
        let timeout: NodeJS.Timeout;
        let pendingUri: vscode.Uri | null = null;
        let pendingDiagnostics: vscode.Diagnostic[] = [];

        return (uri: vscode.Uri, diagnostics: vscode.Diagnostic[]) => {
            pendingUri = uri;
            pendingDiagnostics = diagnostics;

            clearTimeout(timeout);
            timeout = setTimeout(() => {
                if (pendingUri) {
                    provider.set(pendingUri, pendingDiagnostics);
                }
            }, delay);
        };
    }

    /**
     * Memory-efficient file streaming
     */
    static async* streamFileLines(uri: vscode.Uri, chunkSize: number = 100): AsyncGenerator<string[]> {
        const document = await vscode.workspace.openTextDocument(uri);
        const totalLines = document.lineCount;

        for (let i = 0; i < totalLines; i += chunkSize) {
            const chunk: string[] = [];
            for (let j = i; j < Math.min(i + chunkSize, totalLines); j++) {
                chunk.push(document.lineAt(j).text);
            }
            yield chunk;
        }
    }
}
```

---

## Сводка улучшений

| Компонент | Текущее состояние | Codebuff подход | Улучшение для Kimi |
|-----------|------------------|-----------------|-------------------|
| File Discovery | TF-IDF | Tree-based + LLM reranking | FileDiscoveryAgent с многоуровневым поиском |
| Editing | Single request | Parallel strategies | ParallelEditAgent с SelectorAgent |
| Review | Manual | Automatic on every prompt | ReviewAgent с LLM + syntax checks |
| Context | Static | Smart compaction | SmartContextManager с idle compaction |
| Architecture | Provider-based | Multi-agent | TestingAgent, SecurityAgent, DocsAgent |
| Performance | Basic | Optimized | WebWorker pool, Request batching, Prefetching |

## План внедрения

1. **Phase 1**: FileDiscoveryAgent + Tree-based search
2. **Phase 2**: ReviewAgent (легко интегрируется в существующий flow)
3. **Phase 3**: ParallelEditAgent (требует изменений в UI для выбора стратегий)
4. **Phase 4**: SmartContextManager (замена существующего context management)
5. **Phase 5**: Новые агенты (Testing, Security, Docs)
6. **Phase 6**: Performance optimizations
