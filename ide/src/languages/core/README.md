# Language Support System Core

Core framework for language support in IDE Traitor. Provides the foundation for implementing language providers with LSP (Language Server Protocol) support.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Language Support System                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  BaseLanguage   │  │   Language      │  │   Language      │  │
│  │   Provider      │  │    Registry     │  │    Client       │  │
│  │  (Abstract)     │  │   (Manager)     │  │   (LSP Client)  │  │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  │
│           │                    │                    │           │
│           └────────────────────┼────────────────────┘           │
│                                │                                │
│  ┌─────────────────┐  ┌───────▼────────┐  ┌─────────────────┐  │
│  │   Diagnostics   │  │ Configuration  │  │     Types       │  │
│  │    Manager      │  │    Manager     │  │   (Shared)      │  │
│  └─────────────────┘  └────────────────┘  └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Installation

```bash
npm install
npm run build
```

## Usage

### Creating a Language Provider

```typescript
import {
  BaseLanguageProvider,
  Position,
  Diagnostic,
  CompletionItem,
  Hover,
  Location
} from '@ide-traitor/languages-core';

class TypeScriptProvider extends BaseLanguageProvider {
  id = 'typescript';
  name = 'TypeScript';
  extensions = ['.ts', '.tsx', '.mts', '.cts'];

  async detect(projectPath: string): Promise<boolean> {
    // Check for tsconfig.json or .ts files
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const files = await fs.readdir(projectPath);
      return files.some(f => 
        f === 'tsconfig.json' || 
        f.endsWith('.ts') || 
        f.endsWith('.tsx')
      );
    } catch {
      return false;
    }
  }

  async activate(projectPath: string): Promise<void> {
    this.projectPath = projectPath;
    // Start language server, initialize tools, etc.
    this.setState(LanguageProviderState.Active);
  }

  async deactivate(): Promise<void> {
    // Cleanup resources
    this.setState(LanguageProviderState.Inactive);
  }

  async getDiagnostics(filePath: string): Promise<Diagnostic[]> {
    // Run linter/type checker
    return [];
  }

  async formatDocument(
    filePath: string,
    content: string,
    options: DocumentFormattingOptions
  ): Promise<string | null> {
    // Format code
    return content;
  }

  async provideCompletions(
    filePath: string,
    content: string,
    position: Position,
    context: CompletionContext
  ): Promise<CompletionItem[] | null> {
    // Provide autocomplete suggestions
    return [];
  }
}
```

### Using the Registry

```typescript
import { LanguageRegistry } from '@ide-traitor/languages-core';

const registry = new LanguageRegistry();

// Register a language provider
const disposable = registry.register(new TypeScriptProvider());

// Detect languages in a project
const languages = await registry.detectLanguages('/path/to/project');
console.log('Detected:', languages); // ['typescript']

// Auto-activate all detected languages
await registry.autoActivate('/path/to/project');

// Get provider for a specific file
const provider = registry.getProviderForFile('/path/to/file.ts');
if (provider) {
  const completions = await provider.provideCompletions(file, position, context);
}

// Unregister when done
disposable.dispose();
```

### Using the Language Client (LSP)

```typescript
import { LanguageClient, createClientCapabilities } from '@ide-traitor/languages-core';

const client = new LanguageClient({
  command: 'typescript-language-server',
  args: ['--stdio'],
  cwd: '/path/to/project'
});

// Connect and initialize
await client.connect('file:///path/to/project', createClientCapabilities());

// Send a request
const hover = await client.sendRequest('textDocument/hover', {
  textDocument: { uri: 'file:///path/to/file.ts' },
  position: { line: 10, character: 5 }
});

// Listen for diagnostics
client.onNotification('textDocument/publishDiagnostics', (params) => {
  console.log('Diagnostics:', params.diagnostics);
});

// Cleanup
await client.disconnect();
```

### Using the Diagnostics Manager

```typescript
import { DiagnosticsManager, createDiagnostic, DiagnosticSeverity } from '@ide-traitor/languages-core';

const diagnostics = new DiagnosticsManager({
  delay: 500,
  validateOnChange: true,
  validateOnSave: true
});

// Register a validator
diagnostics.registerValidator('typescript', async (uri, content, version) => {
  // Run type checking
  return [
    createDiagnostic(
      { start: { line: 5, character: 10 }, end: { line: 5, character: 15 } },
      'Type error: string is not assignable to number',
      DiagnosticSeverity.Error,
      { source: 'typescript', code: 'TS2345' }
    )
  ];
});

// Listen for changes
diagnostics.onDiagnosticsChanged(({ uri, diagnostics, source }) => {
  editor.setDiagnostics(uri, diagnostics);
});

// Trigger validation
diagnostics.onChange(fileUri, fileContent, fileVersion);

// Cleanup
diagnostics.dispose();
```

### Configuration Management

```typescript
import { LanguageConfigurationManager } from '@ide-traitor/languages-core';

const config = new LanguageConfigurationManager();

// Set configuration
config.set('languages.typescript.enabled', true);
config.set('languages.typescript.executable', 'typescript-language-server');
config.set('languages.typescript.args', ['--stdio']);

// Get language config
const tsConfig = config.getLanguageConfig('typescript');
// { enabled: true, executable: 'typescript-language-server', args: ['--stdio'] }

// Global settings
config.setGlobal('validationDelay', 300);
config.setGlobal('format.tabSize', 2);

// Listen for changes
config.onDidChange(({ key, value, previousValue }) => {
  console.log(`Config ${key} changed from ${previousValue} to ${value}`);
});
```

## Configuration Schema

```json
{
  "global": {
    "validationDelay": 500,
    "validateOnChange": true,
    "validateOnSave": true,
    "validateOnType": false,
    "format": {
      "tabSize": 4,
      "insertSpaces": true,
      "trimTrailingWhitespace": false,
      "insertFinalNewline": false,
      "trimFinalNewlines": false
    }
  },
  "languages": {
    "typescript": {
      "enabled": true,
      "executable": "typescript-language-server",
      "args": ["--stdio"]
    },
    "python": {
      "enabled": true,
      "executable": "pylsp"
    }
  }
}
```

## API Reference

### BaseLanguageProvider

Abstract class that all language providers must extend.

**Abstract Methods:**
- `detect(projectPath): Promise<boolean>` - Detect if language is present in project
- `activate(projectPath): Promise<void>` - Activate the provider
- `deactivate(): Promise<void>` - Deactivate the provider
- `getDiagnostics(filePath): Promise<Diagnostic[]>` - Get file diagnostics
- `formatDocument(filePath, content, options): Promise<string | null>` - Format document
- `provideCompletions(filePath, content, position, context): Promise<CompletionItem[] | null>` - Provide completions

**Optional Methods:**
- `provideHover(...)` - Hover information
- `provideDefinition(...)` - Go to definition
- `provideReferences(...)` - Find references
- `provideDocumentSymbols(...)` - Document outline
- `provideCodeActions(...)` - Quick fixes
- And more...

### LanguageRegistry

Manages all language providers.

**Methods:**
- `register(provider)` - Register a provider
- `unregister(id)` - Unregister a provider
- `getProvider(id)` - Get provider by ID
- `getProviderForFile(filePath)` - Get provider for file
- `detectLanguages(projectPath)` - Detect languages in project
- `autoActivate(projectPath)` - Activate all detected languages

### LanguageClient

LSP client for communicating with language servers.

**Methods:**
- `connect(rootUri, capabilities)` - Connect and initialize
- `disconnect()` - Disconnect from server
- `sendRequest(method, params)` - Send LSP request
- `sendNotification(method, params)` - Send LSP notification
- `onNotification(method, handler)` - Register notification handler

### DiagnosticsManager

Manages diagnostic reporting.

**Methods:**
- `registerValidator(languageId, validator)` - Register a validator
- `onChange(uri, content, version)` - Handle document change
- `onSave(uri, content, version)` - Handle document save
- `publishDiagnostics(uri, diagnostics, source)` - Publish diagnostics
- `getDiagnostics(uri)` - Get diagnostics for file

### LanguageConfigurationManager

Manages language configuration.

**Methods:**
- `get(key, defaultValue)` - Get config value
- `set(key, value)` - Set config value
- `getLanguageConfig(languageId)` - Get language config
- `setLanguageConfig(languageId, config)` - Set language config
- `isLanguageEnabled(languageId)` - Check if enabled

## License

MIT
