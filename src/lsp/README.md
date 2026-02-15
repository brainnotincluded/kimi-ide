# Kimi LSP Integration

Language Server Protocol (LSP) integration for Kimi IDE VS Code extension.

## Architecture

```
┌─────────────────┐      LSP (JSON-RPC)      ┌─────────────────┐
│   VS Code       │  ←────────────────────→  │  Kimi Language  │
│   Extension     │      stdio/socket        │    Server       │
│   (Client)      │                         │   (Node.js)     │
└─────────────────┘                         └─────────────────┘
                                                        │
                                                        │ HTTP
                                                        ▼
                                              ┌─────────────────┐
                                              │   Kimi API      │
                                              │  (Moonshot AI)  │
                                              └─────────────────┘
```

## Files

### Server-side (runs in separate process)

- **`kimiLanguageServer.ts`** - Main LSP server implementation
  - Connection management
  - Protocol handlers (initialize, completion, hover, signature help)
  - Document synchronization
  - Diagnostics

- **`completionProvider.ts`** - AI-powered completion provider
  - Traditional completions (Ctrl+Space)
  - Inline completions (ghost text)
  - Debouncing and caching
  - Context extraction

- **`hoverProvider.ts`** - AI-powered hover information
  - Enhanced documentation
  - Type information with AI explanations
  - Code examples
  - Caching system

- **`signatureHelpProvider.ts`** - AI-powered signature help
  - Function signatures
  - Parameter descriptions
  - Active parameter highlighting
  - Usage examples

### Client-side (runs in extension host)

- **`kimiLanguageClient.ts`** - VS Code extension client
  - Server process management
  - Connection handling
  - Inline completion registration
  - Custom request/notification handling

- **`index.ts`** - Module exports

## Features

### 1. AI-Powered Completions

```typescript
// Trigger characters: . ( [ " ' / > : = ! ? @
// Plus space, newline, tab for AI suggestions

// Example: After typing "// AI: "
// AI will suggest code based on context
```

### 2. Smart Hover

Hover over any symbol to get:
- AI-generated documentation
- Type information
- Usage examples
- Links to related code

### 3. Signature Help

When typing function calls:
- Real-time parameter info
- AI-generated descriptions
- Active parameter highlighting
- Code examples

### 4. Inline Completions (Ghost Text)

Type `// AI: ` followed by a description to get:
- Context-aware code suggestions
- Automatic code generation
- Smart continuation

## Configuration

Add to your VS Code settings:

```json
{
  "kimi.enableLSP": true,
  "kimi.lsp.completionDebounceMs": 300,
  "kimi.lsp.maxCompletions": 5,
  "kimi.lsp.cacheTimeout": 300
}
```

## API Integration

The LSP server communicates with Kimi API (Moonshot AI):

- **Endpoint**: `https://api.moonshot.cn/v1/chat/completions`
- **Models**: moonshot-v1-8k, moonshot-v1-32k, moonshot-v1-128k
- **Temperature**: 0.2-0.3 (optimized for code)
- **Max Tokens**: 512 (completions), 2048 (other features)

## Protocol Extensions

### Custom Request: `textDocument/inlineCompletion`

Extended LSP method for inline completions:

```typescript
interface InlineCompletionParams {
  textDocument: { uri: string };
  position: Position;
  context?: {
    triggerKind: InlineCompletionTriggerKind;
    selectedCompletionInfo?: SelectedCompletionInfo;
  };
}

interface InlineCompletionItem {
  insertText: string;
  range?: Range;
  command?: Command;
}
```

## Development

### Building

```bash
npm run compile
```

### Testing

```bash
npm test
```

### Debug

1. Open VS Code
2. Run "Launch Extension" debug configuration
3. Check "Kimi LSP" output channel for logs

## Performance Considerations

1. **Debouncing**: All completion requests are debounced (default 300ms)
2. **Caching**: Hover and signature results cached for 5 minutes
3. **Context Window**: Limited to 1000 chars before/after cursor
4. **Concurrent Requests**: Limited to prevent API throttling

## Error Handling

- Graceful fallback when API is unavailable
- Local caching for offline scenarios
- Automatic retry with exponential backoff
- User-friendly error messages

## Security

- API key stored in VS Code secure storage
- No code sent to external servers without user action
- Optional opt-out for specific features
