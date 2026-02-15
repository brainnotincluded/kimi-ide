# Kimi IDE Test Suite

Test suite for VS Code extension Kimi IDE using @vscode/test-electron and mocha.

## Structure

```
src/test/
├── runTest.ts              # Entry point for running tests
├── suite/
│   ├── index.ts            # Test runner configuration
│   ├── extension.test.ts   # Extension activation tests
│   ├── context/
│   │   ├── indexer.test.ts       # CodebaseIndexer tests
│   │   ├── contextResolver.test.ts  # Context resolution tests
│   │   └── promptBuilder.test.ts    # Prompt building tests
│   ├── kimi/
│   │   └── wire.test.ts          # Wire Protocol tests
│   └── utils/
│       └── fileUtils.test.ts     # File utility tests
└── mocks/
    └── vscode.ts           # VS Code API mocks
```

## Running Tests

```bash
# Run all tests
npm test

# Compile tests
npm run compile

# Run with VS Code
npm run pretest && npm test
```

## Test Categories

### Wire Protocol Tests (`kimi/wire.test.ts`)
- Message envelope serialization/deserialization
- JSON-RPC 2.0 compliance
- Event parsing (TurnBegin, TurnEnd, ContentPart, etc.)
- Tool events and approval requests
- Status updates

### Codebase Indexer Tests (`context/indexer.test.ts`)
- TF-IDF vectorization
- Symbol extraction for different languages (TS, JS, Python, Go, Rust, etc.)
- Language detection from file extensions
- Search functionality
- Cosine similarity calculations
- File context retrieval

### Context Resolver Tests (`context/contextResolver.test.ts`)
- Mention parsing (@file, @folder, @symbol)
- Fuzzy matching for file/symbol search
- Auto-context generation
- Token estimation
- Mention completions

### Prompt Builder Tests (`context/promptBuilder.test.ts`)
- System prompt generation
- File context formatting
- Token budget planning
- Conversation history handling
- Content truncation
- Line number addition

### File Utils Tests (`utils/fileUtils.test.ts`)
- Encoding detection (UTF-8, UTF-16 LE/BE, with/without BOM)
- Binary/text file detection
- Gitignore pattern matching
- File extension and language ID detection
- File size formatting

### Extension Tests (`extension.test.ts`)
- Extension context initialization
- Command registration
- Window and workspace operations
- Configuration handling

## Mocks

The `mocks/vscode.ts` file provides comprehensive mocks for VS Code APIs:

- **Uri**: File URI handling with path operations
- **Position/Range/Selection**: Editor position types
- **MockTextDocument/MockTextEditor**: Document and editor simulation
- **MockExtensionContext**: Extension lifecycle context
- **MockFileSystem**: In-memory file system for tests
- **MockWorkspace**: Workspace operations
- **MockWindow**: Window and UI operations
- **MockCommands**: Command registration and execution
- **MockConfiguration**: Settings management

## Writing New Tests

1. Create a new `.test.ts` file in the appropriate directory
2. Import from `mocha` and `assert`
3. Use mocks from `../mocks/vscode`
4. Follow the naming convention: `describe('Component', () => { it('should...') })`

Example:

```typescript
import * as assert from 'assert';
import { describe, it } from 'mocha';
import { MockExtensionContext } from '../mocks/vscode';

describe('MyFeature', () => {
    it('should work correctly', () => {
        const context = new MockExtensionContext();
        assert.ok(context);
    });
});
```

## Dependencies

- `@vscode/test-electron`: VS Code test runner
- `mocha`: Test framework
- `@types/mocha`: TypeScript types
- `glob`: File pattern matching
