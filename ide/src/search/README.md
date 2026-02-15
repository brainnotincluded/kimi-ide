# Search Module for Traitor IDE

VS Code-like project-wide search functionality for the Traitor IDE.

## Features

- 🔍 **Fast Search**: Uses ripgrep (rg) when available, falls back to Node.js streams
- 🔄 **Non-blocking**: Worker threads for UI responsiveness
- ⚡ **Debounced**: 300ms debounce on search input
- 📝 **Replace**: Replace single or all matches
- 🎨 **React UI**: Complete set of React components
- 🔌 **Electron IPC**: Ready-to-use IPC handlers for main/renderer processes

## Quick Start

### Main Process Setup

```typescript
import { SearchManager, setupSearchIPC } from './search';

// Create search manager
const searchManager = new SearchManager('/path/to/project');

// Setup IPC handlers
setupSearchIPC(searchManager);
```

### Renderer Process Usage

```typescript
import { getSearchClient } from './search';

const client = getSearchClient();

// Search
await client.query('function', { include: ['*.ts'] });

// Listen to results
client.onResult((result) => {
  console.log('Found in:', result.file);
  console.log('Matches:', result.matches);
});

// Replace
await client.replace('method', false);
```

### React Components

```tsx
import { SearchContainer } from './search';

function SearchSidebar() {
  const [results, setResults] = useState([]);
  
  return (
    <SearchContainer
      results={results}
      query={query}
      options={options}
      isSearching={isSearching}
      onSearch={handleSearch}
      onResultClick={(file, match) => openFile(file, match.line)}
    />
  );
}
```

## Architecture

```
search/
├── types.ts           # TypeScript interfaces
├── SearchProvider.ts  # Core search (ripgrep + Node.js fallback)
├── SearchWorker.ts    # Worker thread wrapper
├── SearchManager.ts   # High-level manager with debounce
├── ipc.ts            # Electron IPC integration
├── utils.ts          # Helper functions
├── components/       # React UI components
│   ├── SearchPanel.tsx
│   ├── ReplaceBox.tsx
│   ├── SearchResultsList.tsx
│   └── SearchContainer.tsx
└── index.ts          # Public API exports
```

## SearchOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| query | string | required | Search query (supports regex) |
| include | string[] | undefined | Glob patterns to include |
| exclude | string[] | undefined | Glob patterns to exclude |
| caseSensitive | boolean | false | Case-sensitive search |
| wholeWord | boolean | false | Match whole words only |
| regex | boolean | false | Use regex for query |
| maxResults | number | 10000 | Maximum results to return |
| maxFileSize | number | 16MB | Skip files larger than this |

## Default Exclude Patterns

- `**/node_modules/**`
- `**/.git/**`
- `**/dist/**`, `**/build/**`
- `**/.next/**`, `**/out/**`
- `**/*.min.js`, `**/*.min.css`
- Lock files (`package-lock.json`, etc.)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Shift+F | Focus search input |
| Enter | Search |
| Escape | Cancel search / Clear results |
| Alt+C | Toggle case sensitive |
| Alt+W | Toggle whole word |
| Alt+R | Toggle regex |
| Ctrl+Enter | Replace All |

## Performance

- **ripgrep**: ~100MB/s search speed (when available)
- **Node.js**: ~10MB/s search speed (fallback)
- **Worker threads**: Non-blocking UI during search
- **Debounce**: 300ms delay on input

## Requirements

- Node.js 14+
- TypeScript 4.5+
- React 17+ (for UI components)
- Electron 13+ (for IPC)
- ripgrep (optional, for faster search)

## Installation

```bash
# Install ripgrep (optional but recommended)
# macOS
brew install ripgrep

# Ubuntu/Debian
apt-get install ripgrep

# Windows
choco install ripgrep
```

## License

MIT
