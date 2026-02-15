/**
 * Search Module Usage Examples
 * 
 * This file demonstrates how to use the search module in various scenarios.
 */

// ============================================================================
// Example 1: Basic Search (Main Process)
// ============================================================================

import { SearchManager } from './SearchManager';
import { getSearchClient } from './ipc';

async function basicSearchExample() {
  const projectRoot = '/path/to/your/project';
  const searchManager = new SearchManager(projectRoot);

  // Listen for results
  searchManager.on('result', (result) => {
    console.log(`Found ${result.matchCount} matches in ${result.file}`);
  });

  searchManager.on('progress', (progress) => {
    console.log(`Searched ${progress.filesSearched} files...`);
  });

  // Perform search
  const stats = await searchManager.searchImmediate('function', {
    include: ['*.ts', '*.tsx'],
    exclude: ['node_modules/**', '*.test.ts'],
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });

  console.log(`Search completed in ${stats.duration}ms`);
  console.log(`Found ${stats.totalMatches} matches in ${stats.filesWithMatches} files`);

  // Replace all matches
  const replaceResult = await searchManager.replace('method', false);
  console.log(`Replaced ${replaceResult.replacedMatches} matches in ${replaceResult.replacedFiles} files`);

  // Cleanup
  searchManager.dispose();
}

// ============================================================================
// Example 2: Debounced Search (UI Integration)
// ============================================================================

function debouncedSearchExample() {
  const projectRoot = '/path/to/your/project';
  const searchManager = new SearchManager(projectRoot, {
    delay: 300,        // 300ms debounce
    minQueryLength: 2, // Minimum 2 characters
  });

  // This will be debounced (300ms delay)
  searchManager.search('func');
  searchManager.search('funct');
  searchManager.search('function'); // Only this one executes

  // This executes immediately
  searchManager.searchImmediate('function');
}

// ============================================================================
// Example 3: Worker Thread Search (Non-blocking)
// ============================================================================

import { SearchWorker } from './SearchWorker';

async function workerSearchExample() {
  const projectRoot = '/path/to/your/project';
  const worker = new SearchWorker(projectRoot);

  // Search runs in worker thread - UI stays responsive
  const stats = await worker.search({
    query: 'TODO',
    include: ['*.ts'],
  }, (event) => {
    // Receive events from worker
    if (event.type === 'result') {
      console.log('Match found:', event.data);
    }
  });

  // Terminate worker when done
  await worker.terminate();
}

// ============================================================================
// Example 4: Electron IPC (Renderer Process)
// ============================================================================

async function rendererIPCExample() {
  const client = getSearchClient();

  // Setup event listeners
  const unsubscribeResult = client.onResult((result) => {
    console.log('New result:', result);
  });

  const unsubscribeComplete = client.onComplete((stats) => {
    console.log('Search complete:', stats);
  });

  // Perform search
  await client.query('console.log', {
    include: ['*.js', '*.ts'],
    exclude: ['node_modules/**'],
  });

  // Replace
  await client.replace('console.debug', false);

  // Cleanup
  unsubscribeResult();
  unsubscribeComplete();
  disposeSearchClient();
}

// ============================================================================
// Example 5: React Component Usage
// ============================================================================

/*
import React, { useState, useEffect } from 'react';
import { SearchContainer, SearchResult } from './search';
import { getSearchClient } from './search';

function SearchSidebar() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [options, setOptions] = useState({
    caseSensitive: false,
    wholeWord: false,
    regex: false,
  });

  useEffect(() => {
    const client = getSearchClient();
    
    const unsubscribe = client.onStateChange((state) => {
      setResults(state.results);
      setIsSearching(state.isSearching);
      setQuery(state.query);
    });

    return () => {
      unsubscribe();
      disposeSearchClient();
    };
  }, []);

  const handleSearch = async (newQuery: string, newOptions?: Partial<SearchOptions>) => {
    const client = getSearchClient();
    await client.query(newQuery, newOptions);
  };

  const handleResultClick = (file: string, match: SearchMatch) => {
    // Open file in editor at match position
    openFile(file, match.line, match.column);
  };

  return (
    <SearchContainer
      results={results}
      query={query}
      options={options}
      isSearching={isSearching}
      onSearch={handleSearch}
      onCancel={() => getSearchClient().cancel()}
      onClear={() => getSearchClient().clear()}
      onReplace={(replacement, preserveCase) => 
        getSearchClient().replace(replacement, preserveCase)
      }
      onResultClick={handleResultClick}
      onOptionsChange={setOptions}
    />
  );
}
*/

// ============================================================================
// Example 6: Advanced Search with Regex
// ============================================================================

async function regexSearchExample() {
  const searchManager = new SearchManager('/path/to/project');

  // Find all function declarations
  const stats = await searchManager.searchImmediate(
    'function\\s+\\w+\\s*\\(',
    {
      regex: true,
      include: ['*.ts', '*.tsx', '*.js', '*.jsx'],
    }
  );

  // Find TODO comments
  const todoStats = await searchManager.searchImmediate(
    'TODO|FIXME|XXX|HACK',
    {
      regex: true,
      caseSensitive: false,
    }
  );

  // Find console methods
  const consoleStats = await searchManager.searchImmediate(
    'console\\.(log|warn|error|info)',
    {
      regex: true,
    }
  );

  searchManager.dispose();
}

// ============================================================================
// Example 7: File-specific Search
// ============================================================================

import { SearchProvider } from './SearchProvider';

async function fileSearchExample() {
  const provider = new SearchProvider('/path/to/project');

  // Search in specific file
  const matches = await provider.searchInFile(
    '/path/to/project/src/index.ts',
    'import',
    { caseSensitive: false }
  );

  console.log(`Found ${matches.length} imports in index.ts`);
  matches.forEach(match => {
    console.log(`  Line ${match.line}: ${match.preview.before}${match.preview.match}${match.preview.after}`);
  });

  provider.dispose();
}

// ============================================================================
// Example 8: Main Process Setup (Electron)
// ============================================================================

/*
// main.ts - Main process
import { app, BrowserWindow } from 'electron';
import { SearchManager, setupSearchIPC } from './search';

let searchManager: SearchManager;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // Initialize search
  const projectRoot = '/path/to/project';
  searchManager = new SearchManager(projectRoot);
  
  // Setup IPC handlers
  setupSearchIPC(searchManager);

  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('before-quit', () => {
  searchManager?.dispose();
});
*/

// ============================================================================
// Run examples
// ============================================================================

if (require.main === module) {
  console.log('Search Module Examples');
  console.log('======================\n');
  console.log('This file contains usage examples. Import the functions you need in your code.');
  console.log('\nAvailable examples:');
  console.log('  - basicSearchExample()');
  console.log('  - debouncedSearchExample()');
  console.log('  - workerSearchExample()');
  console.log('  - rendererIPCExample()');
  console.log('  - regexSearchExample()');
  console.log('  - fileSearchExample()');
}

export {
  basicSearchExample,
  debouncedSearchExample,
  workerSearchExample,
  rendererIPCExample,
  regexSearchExample,
  fileSearchExample,
};
