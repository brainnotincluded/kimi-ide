# Research Synthesis Engine

Комплексная система для агрегации информации из множества источников, перекрёстной проверки фактов, обнаружения противоречий и генерации структурированных ответов с цитированием.

## Возможности

- **Source Aggregation** - сбор результатов из web, GitHub, arXiv, community sources
- **Cross-Referencing** - перекрёстная проверка информации между источниками
- **Fact Extraction** - извлечение структурированных фактов из текста
- **Contradiction Detection** - обнаружение противоречий между источниками
- **Confidence Scoring** - оценка надёжности каждого факта
- **Citation Management** - форматирование цитат в стиле Perplexity ([1], [2])
- **Query Planning** - разбиение сложных вопросов на под-запросы

## Быстрый старт

```typescript
import { synthesize, synthesizeQuick, synthesizeComprehensive } from './synthesis';

// Простой синтез
const result = await synthesize({
  query: "How does Vercel Edge Caching work?",
  sources: ['web', 'github', 'documentation'],
  depth: 'comprehensive'
});

console.log(result.markdown);
// Возвращает markdown с цитатами, confidence scores, key takeaways
```

## API

### Основная функция: `synthesize()`

```typescript
interface SynthesizeInput {
  query: string;           // Вопрос для исследования
  sources: SourceType[];   // Источники: 'web' | 'github' | 'arxiv' | 'community' | 'archive' | 'documentation'
  depth?: SearchDepth;     // 'quick' | 'standard' | 'comprehensive'
  maxResults?: number;     // Максимум результатов
}

interface SynthesizeOutput {
  markdown: string;        // Готовый markdown с цитатами
  result: SynthesisResult; // Структурированный результат
  sources: AnySource[];    // Использованные источники
  facts: Fact[];           // Извлечённые факты
  contradictions: Contradiction[]; // Обнаруженные противоречия
  consensus: Consensus[];  // Достигнутый консенсус
  confidence: number;      // Общий confidence score (0-1)
}
```

### Упрощённые функции

```typescript
// Быстрый синтез (web + documentation, depth: quick)
const answer = await synthesizeQuick("What is React?");

// Комплексный синтез (все источники, depth: comprehensive)
const result = await synthesizeComprehensive("Latest advances in LLMs");
```

### Продвинутое использование

```typescript
import { ResearchSynthesisEngine } from './synthesis';

const engine = new ResearchSynthesisEngine({
  citationStyle: 'numbered',
  includeConfidenceScores: true,
  includeContradictions: true,
});

// Пошаговый процесс
const plan = await engine.plan("How does React Server Components work?", 'comprehensive');
const aggregated = await engine.aggregate(searchResults);
const facts = await engine.extractFacts(aggregated.sources);
const { contradictions, consensus } = await engine.crossReference(facts, aggregated.sources);
const confidence = engine.calculateConfidence(aggregated.sources, facts, contradictions, consensus);
const result = await engine.synthesize(query, aggregated.sources, facts, contradictions, consensus, 'comprehensive');
const markdown = engine.renderMarkdown(result);
```

## Архитектура

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   QueryPlanner  │────▶│  SourceAggregator │────▶│  FactExtractor  │
│  (планирование) │     │  (агрегация)      │     │  (извлечение)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                           │
                                                           ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  CitationManager│◀────│  SynthesisEngine  │◀────│ CrossReferencer │
│   (цитирование) │     │    (синтез)       │     │ (перекрёстная   │
└─────────────────┘     └──────────────────┘     │   проверка)     │
                                                  └─────────────────┘
                                                           │
                                                           ▼
                                                  ┌─────────────────┐
                                                  │ ConfidenceScorer│
                                                  │  (оценка        │
                                                  │   уверенности)  │
                                                  └─────────────────┘
```

## Компоненты

### SourceAggregator

Агрегирует результаты из множества источников:
- Нормализация форматов
- Дедупликация по URL/content hash
- Оценка credibility источников

```typescript
import { createSourceAggregator } from './synthesis';

const aggregator = createSourceAggregator({
  maxSourcesPerType: 20,
  minCredibilityScore: 0.3,
});

const aggregated = await aggregator.aggregate(searchResults);
```

### CrossReferencer

Перекрёстная проверка информации:
- Находит одинаковую информацию в разных источниках
- Проверяет consistency
- Находит contradictions
- Определяет consensus

```typescript
import { createCrossReferencer } from './synthesis';

const referencer = createCrossReferencer();
const { crossReferences, contradictions, consensus } = await referencer.crossReference(facts, sources);
```

### FactExtractor

Извлечение фактов из текста:
- Statements и claims
- Числа и статистика
- Даты
- Имена и сущности
- Code examples
- Цитаты
- Методологии (для научных статей)

```typescript
import { createFactExtractor } from './synthesis';

const extractor = createFactExtractor({
  maxFactsPerSource: 50,
  extractCode: true,
  extractQuotes: true,
});

const facts = await extractor.extractFromSource(source);
```

### ConfidenceScorer

Оценка уверенности:
- Количество подтверждающих источников
- Credibility источников
- Diversity источников
- Свежесть информации
- Штраф за противоречия
- Бонус за консенсус

```typescript
import { createConfidenceScorer } from './synthesis';

const scorer = createConfidenceScorer();
const confidence = scorer.calculateFactConfidence(fact, sources, contradictions, consensus);
// confidence.overall: 0-1
// confidence.explanation: "High confidence, well-supported by multiple sources..."
```

### SynthesisEngine

Движок синтеза:
- Структурирует информацию по темам
- Генерирует outline ответа
- Выбирает best sources для каждого point
- Генерирует markdown ответ

```typescript
import { createSynthesisEngine, createCitationManager, createConfidenceScorer } from './synthesis';

const engine = createSynthesisEngine(
  createCitationManager(),
  createConfidenceScorer()
);

const result = await engine.synthesize(query, sources, facts, contradictions, consensus, 'comprehensive');
const markdown = engine.renderMarkdown(result);
```

### CitationManager

Управление цитированием:
- Форматирование в стиле Perplexity ([1], [2])
- Создание bibliography
- Archival links (Wayback Machine)

```typescript
import { createCitationManager } from './synthesis';

const manager = createCitationManager({
  style: 'numbered',
  includeArchiveLinks: true,
  archiveProvider: 'wayback',
});

const citation = manager.formatCitation(source); // "[1]"
const bibliography = manager.buildBibliography(sources);
```

### QueryPlanner

Планирование запросов:
- Разбиение сложных вопросов на sub-queries
- Определение нужных источников
- Планирование parallel search

```typescript
import { createQueryPlanner } from './synthesis';

const planner = createQueryPlanner();
const plan = await planner.planQuery("React vs Vue performance", 'comprehensive');
// plan.subQueries: ["What is React?", "What is Vue?", "Compare React and Vue performance"]
// plan.requiredSources: ['web', 'github', 'documentation']
```

## Примеры вывода

### Markdown Output

```markdown
# How Does Vercel Edge Caching Work

> ✓ **Confidence:** High (87%)

## Key Takeaways

- Vercel Edge Caching uses a global CDN with 100+ locations
- Cache hits are served from the edge in <50ms
- Cache miss ratio typically below 5% for static content

## Overview

Vercel Edge Caching is a content delivery network (CDN) feature that caches static assets and pages at edge locations worldwide [1]. When a user requests content, it's served from the nearest edge location, reducing latency significantly [2].

## Architecture

The edge caching architecture consists of three layers [3]:
- **Browser Cache**: Client-side caching with configurable headers
- **Edge Cache**: Distributed across 100+ global locations
- **Origin Shield**: Protects origin servers from thundering herds

## Configuration

Developers can configure caching through the `vercel.json` file [4]:

```json
{
  "routes": [{
    "src": "/(.*)",
    "headers": {
      "Cache-Control": "s-maxage=3600"
    }
  }]
}
```

## ⚠️ Contradictions & Disagreements

Some sources present conflicting information:
- **MINOR**: Default cache TTL varies between documentation versions

## Further Reading

1. [Vercel Edge Network Documentation](https://vercel.com/docs/edge-network) [Web]
2. [Edge Caching Best Practices](https://vercel.com/docs/concepts/edge-network/caching) [Documentation]
3. [Vercel vs Traditional CDN](https://example.com/comparison) [Web]

## References

[1] Vercel Edge Network Documentation — https://vercel.com/docs/edge-network
[2] Edge Caching Best Practices — https://vercel.com/docs/concepts/edge-network/caching
[3] Building with Vercel Edge — https://github.com/vercel/examples

---
*Generated: 2/11/2026, 10:30:00 AM*
*Sources: 8 | Facts: 24*
```

## Конфигурация

```typescript
interface SynthesizeConfig {
  // Функции поиска для каждого типа источников
  searchWeb?: (query: string) => Promise<SearchResult>;
  searchGitHub?: (query: string) => Promise<SearchResult>;
  searchArXiv?: (query: string) => Promise<SearchResult>;
  searchCommunity?: (query: string) => Promise<SearchResult>;
  
  // Функция для получения контента по URL
  fetchContent?: (url: string) => Promise<string>;
  
  // Настройки вывода
  defaultDepth?: SearchDepth;
  maxResults?: number;
  includeContradictions?: boolean;
  includeConfidenceScores?: boolean;
  includeArchivedLinks?: boolean;
  citationStyle?: 'numbered' | 'inline' | 'footnote';
}
```

## Типы источников

| Тип | Описание | Credibility |
|-----|----------|-------------|
| `web` | Общий веб-поиск | 0.5-0.9 (зависит от домена) |
| `github` | Репозитории и код | 0.7-0.9 (зависит от stars) |
| `arxiv` | Научные статьи | 0.9-0.95 |
| `community` | HN, Reddit, StackOverflow | 0.5-0.85 |
| `archive` | Архивные версии | 0.6-0.8 |
| `documentation` | Официальная документация | 0.9-0.95 |

## Уровни глубины поиска

| Уровень | Описание | Источники | Время |
|---------|----------|-----------|-------|
| `quick` | Быстрый ответ | 2-3 источника | ~5s |
| `standard` | Стандартный поиск | 3-5 источников | ~15s |
| `comprehensive` | Комплексное исследование | 5-8 источников | ~30s |

## Лицензия

MIT
