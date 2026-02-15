/**
 * Example usage of Research Synthesis Engine
 * 
 * This file demonstrates how to use the synthesis engine with
 * mock search functions for testing and development.
 */

import {
  synthesize,
  synthesizeQuick,
  synthesizeComprehensive,
  ResearchSynthesisEngine,
  createSourceAggregator,
  createCrossReferencer,
  createFactExtractor,
  createConfidenceScorer,
  createSynthesisEngine,
  createCitationManager,
  createQueryPlanner,
  SearchResult,
  AnySource,
  SourceType,
} from './index';

// ============================================================================
// Mock Search Functions (for demonstration)
// ============================================================================

const mockWebResults: AnySource[] = [
  {
    id: 'web-1',
    url: 'https://vercel.com/docs/concepts/edge-network/caching',
    title: 'Vercel Edge Network Caching',
    content: `Vercel's Edge Network caches your content at the edge to serve data from the 
    closest location to your users. Edge caching is enabled by default for all deployments.
    Cache hits are served in under 50ms globally. The cache supports stale-while-revalidate 
    pattern for dynamic content. In 2024, Vercel expanded to 100+ edge locations worldwide.`,
    snippet: 'Edge caching is enabled by default for all deployments.',
    sourceType: 'web',
    domain: 'vercel.com',
    fetchDate: new Date(),
    credibilityScore: 0.95,
    metadata: {},
  },
  {
    id: 'web-2',
    url: 'https://nextjs.org/docs/app/building-your-application/caching',
    title: 'Next.js Caching Guide',
    content: `Next.js 14 introduces an evolved caching model. The Data Cache persists results 
    from fetch requests across requests and deployments. The Full Route Cache automatically 
    renders and caches routes at build time. Vercel Edge Config provides low-latency access 
    to feature flags and configuration. The Router Cache maintains client-side navigation state.`,
    snippet: 'Next.js caching model explained with Data Cache and Full Route Cache.',
    sourceType: 'web',
    domain: 'nextjs.org',
    author: 'Vercel Team',
    fetchDate: new Date(),
    credibilityScore: 0.95,
    metadata: {},
  },
];

const mockGitHubResults: AnySource[] = [
  {
    id: 'github-1',
    url: 'https://github.com/vercel/examples/blob/main/solutions/edge-functions/readme.md',
    title: 'Vercel Edge Functions Examples',
    content: `Edge Functions run at the edge, close to your users. They can modify requests 
    and responses, making them ideal for authentication, geolocation, and personalization.
    Edge Functions have a 50ms execution limit on the Hobby plan and 5s on Pro. 
    Cold starts are typically under 1ms.`,
    repo: 'vercel/examples',
    stars: 3500,
    forks: 850,
    language: 'TypeScript',
    lastUpdated: new Date('2024-01-15'),
    sourceType: 'github',
    domain: 'github.com',
    fetchDate: new Date(),
    credibilityScore: 0.88,
    metadata: {},
  },
];

const mockArXivResults: AnySource[] = [
  {
    id: 'arxiv-1',
    url: 'https://arxiv.org/abs/2401.12345',
    title: 'Edge Computing Performance Analysis: A Comparative Study',
    content: `This paper analyzes edge computing performance across major providers. 
    Vercel Edge Functions demonstrate sub-50ms latency across 95% of global locations.
    The study found edge caching reduces origin load by 85% on average. 
    Key metrics include: cache hit ratio 94.5%, p50 latency 23ms, p99 latency 89ms.
    The research methodology involved 1 million requests across 30 days.`,
    paperId: '2401.12345',
    authors: ['John Smith', 'Jane Doe', 'Bob Johnson'],
    abstract: 'Comparative analysis of edge computing platforms including Vercel, Cloudflare, and AWS.',
    categories: ['cs.DC', 'cs.NI'],
    sourceType: 'arxiv',
    domain: 'arxiv.org',
    fetchDate: new Date(),
    credibilityScore: 0.92,
    metadata: {},
  },
];

// Mock search implementations
async function mockSearchWeb(query: string): Promise<SearchResult> {
  console.log(`[Mock] Searching web for: ${query}`);
  return {
    sourceType: 'web',
    query,
    results: mockWebResults.filter(r => 
      r.content.toLowerCase().includes(query.toLowerCase())
    ),
  };
}

async function mockSearchGitHub(query: string): Promise<SearchResult> {
  console.log(`[Mock] Searching GitHub for: ${query}`);
  return {
    sourceType: 'github',
    query,
    results: mockGitHubResults,
  };
}

async function mockSearchArXiv(query: string): Promise<SearchResult> {
  console.log(`[Mock] Searching arXiv for: ${query}`);
  return {
    sourceType: 'arxiv',
    query,
    results: mockArXivResults,
  };
}

// ============================================================================
// Example 1: Simple Synthesis
// ============================================================================

async function example1_SimpleSynthesis() {
  console.log('\n=== Example 1: Simple Synthesis ===\n');

  const result = await synthesize(
    {
      query: "How does Vercel Edge Caching work?",
      sources: ['web', 'github'],
      depth: 'standard',
    },
    {
      searchWeb: mockSearchWeb,
      searchGitHub: mockSearchGitHub,
    }
  );

  console.log('Confidence:', result.confidence);
  console.log('Sources used:', result.sources.length);
  console.log('Facts extracted:', result.facts.length);
  console.log('Contradictions:', result.contradictions.length);
  console.log('\n--- Markdown Output (truncated) ---\n');
  console.log(result.markdown.substring(0, 1500) + '...');
}

// ============================================================================
// Example 2: Quick Synthesis
// ============================================================================

async function example2_QuickSynthesis() {
  console.log('\n=== Example 2: Quick Synthesis ===\n');

  const markdown = await synthesizeQuick("What is Next.js caching?", {
    searchWeb: mockSearchWeb,
  });

  console.log(markdown.substring(0, 1000) + '...');
}

// ============================================================================
// Example 3: Comprehensive Synthesis
// ============================================================================

async function example3_ComprehensiveSynthesis() {
  console.log('\n=== Example 3: Comprehensive Synthesis ===\n');

  const result = await synthesizeComprehensive("Edge computing performance comparison", {
    searchWeb: mockSearchWeb,
    searchGitHub: mockSearchGitHub,
    searchArXiv: mockSearchArXiv,
  });

  console.log('Confidence:', result.confidence);
  console.log('Consensus points:', result.consensus.length);
  console.log('Key Takeaways:');
  result.result.keyTakeaways.forEach((takeaway, i) => {
    console.log(`  ${i + 1}. ${takeaway}`);
  });
}

// ============================================================================
// Example 4: Advanced Usage with Full Control
// ============================================================================

async function example4_AdvancedUsage() {
  console.log('\n=== Example 4: Advanced Usage ===\n');

  // Create individual components
  const planner = createQueryPlanner();
  const aggregator = createSourceAggregator();
  const extractor = createFactExtractor({
    maxFactsPerSource: 30,
    extractCode: true,
  });
  const crossReferencer = createCrossReferencer();
  const confidenceScorer = createConfidenceScorer();
  const citationManager = createCitationManager({
    style: 'numbered',
    includeArchiveLinks: true,
  });
  const synthesisEngine = createSynthesisEngine(
    citationManager,
    confidenceScorer,
    {
      maxSections: 5,
      includeConfidenceScores: true,
    }
  );

  // Step 1: Plan the query
  const plan = await planner.planQuery("Vercel Edge vs Cloudflare Workers", 'comprehensive');
  console.log('Query Plan:');
  console.log('  Sub-queries:', plan.subQueries.length);
  plan.subQueries.forEach((sq, i) => {
    console.log(`    ${i + 1}. ${sq.query} (${sq.intent})`);
  });

  // Step 2: Aggregate sources
  const searchResults = await Promise.all([
    mockSearchWeb('Vercel Edge vs Cloudflare Workers'),
    mockSearchGitHub('edge functions comparison'),
    mockSearchArXiv('edge computing performance'),
  ]);
  
  const aggregated = await aggregator.aggregate(searchResults);
  console.log('\nAggregated Sources:', aggregated.sources.length);
  console.log('  By type:', aggregated.sourceStats.byType);

  // Step 3: Extract facts
  const allFacts = [];
  for (const source of aggregated.sources) {
    const facts = await extractor.extractFromSource(source);
    allFacts.push(...facts);
  }
  console.log('\nExtracted Facts:', allFacts.length);
  
  // Group facts by type
  const factsByType = allFacts.reduce((acc, fact) => {
    acc[fact.type] = (acc[fact.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log('  By type:', factsByType);

  // Step 4: Cross-reference
  const { crossReferences, contradictions, consensus } = await crossReferencer.crossReference(
    allFacts,
    aggregated.sources
  );
  console.log('\nCross-references:', crossReferences.length);
  console.log('Contradictions:', contradictions.length);
  console.log('Consensus:', consensus.length);

  // Step 5: Calculate confidence
  const confidence = confidenceScorer.calculateSynthesisConfidence(
    aggregated.sources,
    allFacts,
    contradictions,
    consensus
  );
  console.log('\nConfidence Score:', confidence.overall);
  console.log('  Explanation:', confidence.explanation);

  // Step 6: Synthesize
  const result = await synthesisEngine.synthesize(
    "Vercel Edge vs Cloudflare Workers",
    aggregated.sources,
    allFacts,
    contradictions,
    consensus,
    'comprehensive'
  );

  // Step 7: Render
  const markdown = synthesisEngine.renderMarkdown(result);
  console.log('\n--- Generated Markdown (first 2000 chars) ---\n');
  console.log(markdown.substring(0, 2000));
}

// ============================================================================
// Example 5: Using ResearchSynthesisEngine Class
// ============================================================================

async function example5_EngineClass() {
  console.log('\n=== Example 5: Using ResearchSynthesisEngine Class ===\n');

  const engine = new ResearchSynthesisEngine({
    citationStyle: 'numbered',
    includeConfidenceScores: true,
    includeContradictions: true,
  });

  // Create search results
  const searchResults = [
    await mockSearchWeb('Next.js 14 caching'),
    await mockSearchGitHub('next.js cache examples'),
  ];

  // Run full pipeline
  const aggregated = await engine.aggregate(searchResults);
  const facts = await engine.extractFacts(aggregated.sources);
  const { contradictions, consensus } = await engine.crossReference(facts, aggregated.sources);
  
  const result = await engine.synthesize(
    "Next.js 14 caching explained",
    aggregated.sources,
    facts,
    contradictions,
    consensus,
    'standard'
  );

  const markdown = engine.renderMarkdown(result);
  
  console.log('Synthesis complete!');
  console.log('Sections:', result.sections.length);
  console.log('Key Takeaways:', result.keyTakeaways.length);
  console.log('\n--- Output Preview ---\n');
  console.log(markdown.substring(0, 1500));
}

// ============================================================================
// Example 6: Custom Domain Credibility
// ============================================================================

async function example6_CustomCredibility() {
  console.log('\n=== Example 6: Custom Domain Credibility ===\n');

  const aggregator = createSourceAggregator({
    domainCredibility: new Map([
      ['vercel.com', 0.98],
      ['nextjs.org', 0.98],
      ['github.com', 0.85],
      ['stackoverflow.com', 0.80],
      ['medium.com', 0.50],
    ]),
  });

  // Add custom domain
  aggregator.addDomainCredibility('my-trusted-site.com', 0.95);

  const searchResults = [await mockSearchWeb('Next.js caching')];
  const aggregated = await aggregator.aggregate(searchResults);

  console.log('Sources with credibility scores:');
  aggregated.sources.forEach(source => {
    console.log(`  ${source.domain}: ${source.credibilityScore.toFixed(2)}`);
  });
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('Research Synthesis Engine - Examples\n');
  console.log('=' .repeat(50));

  try {
    await example1_SimpleSynthesis();
    await example2_QuickSynthesis();
    await example3_ComprehensiveSynthesis();
    await example4_AdvancedUsage();
    await example5_EngineClass();
    await example6_CustomCredibility();

    console.log('\n' + '='.repeat(50));
    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export {
  mockWebResults,
  mockGitHubResults,
  mockArXivResults,
  mockSearchWeb,
  mockSearchGitHub,
  mockSearchArXiv,
  example1_SimpleSynthesis,
  example2_QuickSynthesis,
  example3_ComprehensiveSynthesis,
  example4_AdvancedUsage,
  example5_EngineClass,
  example6_CustomCredibility,
};
