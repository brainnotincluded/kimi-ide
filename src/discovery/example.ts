/**
 * Example usage of Tree-based File Discovery System
 */

import {
  DiscoveryService,
  createDiscoveryService,
  CodeTreeBuilder,
  TreeSearch,
  SmartFilePicker,
  CodeSummarizer
} from './index';

// ==================== Example 1: Basic Usage ====================

async function basicExample() {
  // Create and initialize service
  const discovery = await createDiscoveryService({
    treeBuilder: {
      includePatterns: ['**/*.{ts,tsx}'],
      excludePatterns: ['**/node_modules/**', '**/*.test.ts'],
      cacheDir: '.kimi/cache'
    }
  });

  // Search for symbols
  console.log('=== Symbol Search ===');
  const results = discovery.search('User', 10);
  for (const result of results) {
    console.log(`${result.symbol.kind}: ${result.symbol.name} (${result.matchType}, score: ${result.score.toFixed(2)})`);
  }

  // Dispose when done
  discovery.dispose();
}

// ==================== Example 2: Smart File Picker ====================

async function filePickerExample() {
  const discovery = await createDiscoveryService();

  // Pick files for a task
  console.log('=== Smart File Picker ===');
  const files = await discovery.pickFiles({
    query: 'add email verification to user registration',
    maxFiles: 8,
    useAI: true,
    currentFile: '/project/src/auth/controller.ts'
  });

  for (const file of files) {
    console.log(`${file.filePath}`);
    console.log(`  Score: ${file.relevanceScore.toFixed(2)} (${file.confidence})`);
    console.log(`  Why: ${file.justification}`);
    console.log(`  Symbols: ${file.matchedSymbols.join(', ')}`);
    console.log();
  }

  discovery.dispose();
}

// ==================== Example 3: Dependency Analysis ====================

async function dependencyExample() {
  const discovery = await createDiscoveryService();

  console.log('=== Dependency Analysis ===');
  
  const filePath = '/project/src/services/UserService.ts';
  
  // Get dependencies
  const deps = discovery.getDependencies(filePath);
  console.log(`Dependencies of ${filePath}:`);
  deps.forEach(d => console.log(`  → ${d}`));

  // Get dependents
  const dependents = discovery.getDependents(filePath);
  console.log(`\nFiles depending on ${filePath}:`);
  dependents.forEach(d => console.log(`  ← ${d}`));

  discovery.dispose();
}

// ==================== Example 4: Code Summaries ====================

async function summaryExample() {
  const discovery = await createDiscoveryService({
    summarizer: {
      useAI: false, // Use AST-based summaries (faster)
      generateOnInit: true
    }
  });

  console.log('=== File Summary ===');
  const summary = await discovery.getSummary('/project/src/utils/validator.ts');
  
  if (summary) {
    console.log(`Overview: ${summary.overview}`);
    console.log(`Purpose: ${summary.purpose}`);
    console.log(`\nKey Functions:`);
    summary.keyFunctions.forEach(fn => {
      console.log(`  • ${fn.signature} - ${fn.description}`);
    });
    console.log(`\nComplexity:`, summary.complexity);
  }

  discovery.dispose();
}

// ==================== Example 5: Advanced Search ====================

async function advancedSearchExample() {
  const discovery = await createDiscoveryService();
  const tree = discovery.getTree();
  const search = new TreeSearch(tree as any);

  console.log('=== Advanced Search ===');

  // Search by type
  const typeResults = search.searchByType('Promise<User>', 10);
  console.log('Functions returning Promise<User>:');
  typeResults.forEach(r => console.log(`  • ${r.symbol.name}`));

  // Find related symbols
  const related = search.findRelated('UserService#login@45:10', 2);
  console.log('\nRelated symbols:');
  related.forEach((score, id) => {
    const symbol = tree.symbols.get(id);
    if (symbol) {
      console.log(`  • ${symbol.name} (score: ${score.toFixed(2)})`);
    }
  });

  // Search in specific file
  const fileResults = search.searchInFile('/project/src/auth.ts', 'token');
  console.log('\nToken-related symbols in auth.ts:');
  fileResults.forEach(r => console.log(`  • ${r.symbol.name}`));

  discovery.dispose();
}

// ==================== Example 6: Event Handling ====================

async function eventHandlingExample() {
  const discovery = new DiscoveryService();

  // Listen to events
  discovery.on('ready', (status) => {
    console.log('Discovery ready:', status);
  });

  discovery.on('build-started', () => {
    console.log('Building code tree...');
  });

  discovery.on('build-completed' as string, ((data: { duration: number }) => {
    console.log(`Build completed in ${data.duration}ms`);
  }) as any);

  discovery.on('update-completed' as string, ((data: { updatedFiles: number }) => {
    console.log(`Incremental update: ${data.updatedFiles} files`);
  }) as any);

  discovery.on('summary-generated' as string, ((data: { filePath: string }) => {
    console.log(`Summary generated for ${data.filePath}`);
  }) as any);

  await discovery.initialize();

  // ... use discovery ...

  discovery.dispose();
}

// ==================== Example 7: Low-level API ====================

async function lowLevelExample() {
  // Use individual components directly
  
  const builder = new CodeTreeBuilder({
    cacheDir: '.kimi/cache',
    includePatterns: ['**/*.ts'],
    excludePatterns: ['**/node_modules/**']
  });

  await builder.initialize();
  const tree = builder.getTree();

  // Direct tree manipulation
  console.log('Files in tree:', tree.files.size);
  console.log('Symbols in tree:', tree.symbols.size);

  // Access specific file
  const fileNode = builder.getFile('/project/src/index.ts');
  if (fileNode) {
    console.log('Imports:', fileNode.imports.map(i => i.source));
    console.log('Exports:', fileNode.exports.map(e => e.name));
  }

  // Search
  const search = new TreeSearch(tree as any);
  const completions = search.getCompletions('getUser', 10);
  console.log('Completions:', completions.map(c => c.symbol.name));

  // File picker without AI
  const picker = new SmartFilePicker(tree as any);
  const quickPicks = picker.quickPick('authentication', 5);
  console.log('Quick picks:', quickPicks.map(p => p.filePath));

  builder.dispose();
}

// ==================== Run Examples ====================

// Uncomment to run:
// basicExample();
// filePickerExample();
// dependencyExample();
// summaryExample();
// advancedSearchExample();
// eventHandlingExample();
// lowLevelExample();

export {
  basicExample,
  filePickerExample,
  dependencyExample,
  summaryExample,
  advancedSearchExample,
  eventHandlingExample,
  lowLevelExample
};
