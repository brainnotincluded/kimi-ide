# Search Module - Trench Project

Интеграция с бесплатными поисковыми API для проекта Trench.

## 📋 Описание

Этот модуль предоставляет унифицированный доступ к множеству бесплатных поисковых источников:

- **GitHub Search** - репозитории, код, issues, pull requests
- **arXiv Search** - научные статьи и публикации
- **Web Search** - DuckDuckGo, Bing, Google, SearXNG
- **Community Search** - Hacker News, Reddit, Stack Exchange

## 🚀 Быстрый старт

### Базовый поиск

```typescript
import { searchAggregator } from './search';

// Простой поиск по всем источникам
const results = await searchAggregator.quickSearch('machine learning', 10);

// Умный поиск (авто-определение типа запроса)
const result = await searchAggregator.smartSearch('rust async patterns', 20);
console.log(result.results);
console.log(result.sourcesUsed);
console.log(result.deduplicationStats);
```

### Поиск кода

```typescript
// Поиск кода на GitHub
const codeResults = await searchAggregator.searchCode('quick sort', 'rust', 10);

// Использование GitHub провайдера напрямую
import { githubSearch } from './search';

// С авторизацией (5000 запросов/час вместо 60)
githubSearch.setToken('your-github-token');

// Поиск репозиториев
const repos = await githubSearch.searchRepositories('neural network', {
    language: 'python',
    stars: '>100',
    sort: 'stars'
});

// Поиск кода
const code = await githubSearch.searchCode('function test', {
    language: 'typescript',
    filename: '*.test.ts'
});

// Извлечение паттернов из репозитория
const patterns = await githubSearch.extractPatterns('facebook', 'react', 'typescript');
```

### Поиск научных статей

```typescript
// Поиск на arXiv
const papers = await searchAggregator.searchAcademic('transformer architecture', 10);

// Использование arXiv провайдера напрямую
import { arxivSearch } from './search';

// Поиск по категориям
const aiPapers = await arxivSearch.searchByCategory('cs.AI', { maxResults: 20 });

// Недавние публикации
const recent = await arxivSearch.getRecentPapers('cs.LG', 10);

// Получение PDF URL
const paper = await arxivSearch.searchById('2301.00001');
const pdfUrl = arxivSearch.getPdfUrl('2301.00001');
```

### Веб-поиск

```typescript
// Веб-поиск с fallback между источниками
const webResults = await searchAggregator.searchWeb('best practices docker', 10);

// Настройка провайдеров
import { webSearch } from './search';

// Bing API (1000 запросов/месяц бесплатно)
webSearch.configureBing({
    apiKey: 'your-bing-api-key'
});

// Google Custom Search (100 запросов/день бесплатно)
webSearch.configureGoogle({
    apiKey: 'your-google-api-key',
    cx: 'your-search-engine-id'
});

// SearXNG (self-hosted)
webSearch.configureSearxng({
    baseUrl: 'http://localhost:8080'
});

// Поиск со всеми доступными провайдерами
const allResults = await webSearch.searchAll('query', { maxResults: 20 });
```

### Поиск по сообществам

```typescript
// Поиск по сообществам
const communityResults = await searchAggregator.searchCommunity('kubernetes best practices', 15);

// Использование отдельных провайдеров
import { hackerNewsSearch, redditSearch, stackExchangeSearch } from './search';

// Hacker News
const hnResults = await hackerNewsSearch.search('startup funding', { timeRange: 'month' });
const topStories = await hackerNewsSearch.getTopStories(30);
const comments = await hackerNewsSearch.searchComments('ai ethics', '123456');

// Reddit
const redditResults = await redditSearch.search('web3 development', { timeRange: 'week' });
const subredditPosts = await redditSearch.getSubredditPosts('programming', 'hot', 25);

// Stack Exchange / Stack Overflow
const seResults = await stackExchangeSearch.search('async await javascript', {
    sortBy: 'score'
});
const tagged = await stackExchangeSearch.searchByTag('stackoverflow', ['javascript', 'async-await']);
```

## 🔧 Конфигурация

### Проверка доступности источников

```typescript
// Статус всех источников
const status = await searchAggregator.getSourcesStatus();
for (const s of status) {
    console.log(`${s.source}: ${s.available ? '✓' : '✗'} (${s.rateLimit.remainingRequests} remaining)`);
}

// Только доступные источники
const available = await searchAggregator.getAvailableSources();
```

### Настройка весов источников

```typescript
searchAggregator.setSourceWeights({
    [SearchSource.GITHUB]: 1.2,      // Увеличить приоритет GitHub
    [SearchSource.ARXIV]: 1.0,       // Стандартный приоритет
    [SearchSource.REDDIT]: 0.8,      // Уменьшить приоритет Reddit
});
```

## 📊 Rate Limits (Бесплатные лимиты)

| Источник | Лимит | Требует ключ |
|----------|-------|--------------|
| GitHub (anon) | 60 req/hour | Нет |
| GitHub (auth) | 5000 req/hour | Да |
| arXiv | ~1200 req/hour | Нет |
| DuckDuckGo | ~100 req/hour | Нет |
| Bing API | 1000 req/month | Да |
| Google CSE | 100 req/day | Да |
| SearXNG | Зависит от инстанса | Нет |
| Hacker News | 36000 req/hour | Нет |
| Reddit | 600 req/hour | Нет |
| Stack Exchange | 300 req/hour | Нет |
| Stack Exchange (key) | 10000 req/day | Да |

## 🏗️ Архитектура

```
s/
├── types.ts              # Общие типы и интерфейсы
├── index.ts              # Экспорты модуля
├── githubSearch.ts       # GitHub Search API
├── arxivSearch.ts        # arXiv Search API
├── webSearch.ts          # Web Search (DuckDuckGo, Bing, Google, SearXNG)
├── communitySearch.ts    # Community Search (HN, Reddit, StackExchange)
└── searchAggregator.ts   # Главный агрегатор
```

## 📝 Примеры использования

### Поиск репозиториев с фильтрами

```typescript
const results = await githubSearch.search('machine learning', {
    type: 'repositories',
    language: 'python',
    stars: '>1000',
    created: '>2023-01-01',
    sort: 'stars',
    order: 'desc',
    maxResults: 10
});
```

### Поиск issues с решениями

```typescript
const issues = await githubSearch.searchIssues('memory leak', {
    language: 'rust',
    sortBy: 'date'
});

// Отфильтровать issues с комментариями
const withSolutions = issues.filter(i => i.metadata.commentCount > 5);
```

### Поиск по научным статьям с фильтрами

```typescript
const papers = await arxivSearch.search('transformer', {
    searchField: 'title',
    categories: ['cs.CL', 'cs.LG'],
    sortBy: 'submittedDate',
    sortOrder: 'descending',
    startDate: new Date('2024-01-01'),
    maxResults: 20
});
```

### Сравнение результатов из разных источников

```typescript
const result = await searchAggregator.search('docker best practices', {
    sources: [
        SearchSource.GITHUB,
        SearchSource.STACKEXCHANGE,
        SearchSource.HACKERNEWS
    ],
    maxResults: 30,
    deduplicate: true
});

// Группировка по источникам
const bySource = result.results.reduce((acc, r) => {
    acc[r.source] = (acc[r.source] || []).concat(r);
    return acc;
}, {} as Record<string, SearchResult[]>);
```

## 🔒 Безопасность

- API ключи хранятся в конфигурации VS Code
- Никакие данные не отправляются на сторонние сервера, кроме запросов к API
- Для GitHub code search требуется авторизация

## 🐛 Отладка

```typescript
import { logger } from '../utils/logger';

// Включить debug logging
logger.setLogLevel(LogLevel.DEBUG);

// Посмотреть failed sources
const result = await searchAggregator.search('query');
console.log('Failed:', result.failedSources);
```

## 📚 Дополнительные ресурсы

- [GitHub Search API Docs](https://docs.github.com/en/rest/search)
- [arXiv API Docs](https://arxiv.org/help/api)
- [Bing Search API](https://www.microsoft.com/en-us/bing/apis/bing-web-search-api)
- [Google Custom Search](https://developers.google.com/custom-search)
- [SearXNG](https://github.com/searxng/searxng)
- [HN Algolia API](https://hn.algolia.com/api)
- [Stack Exchange API](https://api.stackexchange.com/docs)
