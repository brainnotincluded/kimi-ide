# Web Language Support for IDE Traitor

Comprehensive TypeScript, JavaScript, JSON, YAML, and TOML support for IDE Traitor.

## Features

### TypeScript/JavaScript

- **Diagnostics**: ESLint and TypeScript compiler diagnostics
- **Formatting**: Prettier integration
- **Completions**: Full IntelliSense via typescript-language-server
- **Import Organization**: Auto-sort and organize imports
- **Refactoring**: Rename symbol, extract function, and more

### Configuration Files

- **JSON**: Schema validation, completions, formatting
- **YAML**: Schema validation, completions, formatting
- **TOML**: Parsing, formatting

### Package Management

- **NPM Scripts Panel**: View and run scripts from package.json
- **Dependencies Panel**: Manage npm/yarn/pnpm dependencies
- **Package Installation**: Install/uninstall packages

### UI Components

- **WebStatusBar**: Shows TS version, ESLint status, Prettier status
- **NPMScriptsPanel**: Interactive npm scripts tree
- **DependenciesPanel**: Dependency management with outdated check

## Configuration

Configuration is stored in `.traitor/web-config.json`:

```json
{
  "typescript": {
    "tsdk": "./node_modules/typescript/lib",
    "enableTSDiagnostics": true
  },
  "prettier": {
    "configPath": ".prettierrc.json",
    "useTabs": false,
    "tabWidth": 2,
    "singleQuote": true,
    "semi": true,
    "trailingComma": "es5"
  },
  "eslint": {
    "enabled": true,
    "autoFix": true
  },
  "editor": {
    "formatOnSave": true,
    "organizeImportsOnSave": true,
    "defaultFormatter": "prettier"
  }
}
```

## Usage

### Basic Setup

```typescript
import { WebLanguageSupport } from './languages/web';

const webSupport = new WebLanguageSupport('/path/to/workspace');
await webSupport.initialize();
```

### Get Diagnostics

```typescript
const diagnostics = await webSupport.getDiagnostics('/path/to/file.ts', fileContent);
```

### Format Code

```typescript
const result = await webSupport.formatCode('/path/to/file.ts', fileContent);
// result.formatted contains formatted code
// result.edits contains text edits
```

### Get Completions

```typescript
const completions = await webSupport.getCompletions('/path/to/file.ts', {
  line: 10,
  character: 15,
}, fileContent);
```

### Organize Imports

```typescript
const edits = await webSupport.getTSProvider().organizeImports(
  '/path/to/file.ts',
  fileContent,
  { sortImports: true, removeUnused: true }
);
```

### Run NPM Script

```typescript
const result = await webSupport.runScript('build', ['--watch']);
// result.stdout, result.stderr, result.exitCode
```

### Install Packages

```typescript
const result = await webSupport.installPackages(['lodash', 'react'], false);
// or dev dependencies:
// await webSupport.installPackages(['@types/node'], true);
```

## React Hooks

```typescript
import {
  useWebLanguageStatus,
  useDiagnostics,
  useFormatting,
  useNPMScripts,
  useDependencies,
} from './languages/web/hooks';

// Status bar
function StatusBar() {
  const { status, loading } = useWebLanguageStatus();
  return (
    <div>
      <span>TS: {status?.typescript.version}</span>
      <span>ESLint: {status?.eslint.enabled ? 'On' : 'Off'}</span>
    </div>
  );
}

// Diagnostics panel
function DiagnosticsPanel({ filePath, content }) {
  const { diagnostics, check } = useDiagnostics(filePath, content);
  return (
    <ul>
      {diagnostics.map(d => (
        <li key={d.code}>{d.message}</li>
      ))}
    </ul>
  );
}

// NPM Scripts
function ScriptsPanel() {
  const { scripts, runScript, runningScripts } = useNPMScripts();
  return (
    <ul>
      {scripts.map(script => (
        <li key={script.name}>
          {script.name}
          <button 
            onClick={() => runScript(script.name)}
            disabled={runningScripts.has(script.name)}
          >
            Run
          </button>
        </li>
      ))}
    </ul>
  );
}

// Dependencies
function DependenciesPanel() {
  const { dependencies, install, uninstall, checkOutdated } = useDependencies();
  return (
    <ul>
      {dependencies.map(dep => (
        <li key={dep.name}>
          {dep.name}@{dep.version}
          {dep.outdated && <span> (outdated: {dep.latestVersion})</span>}
        </li>
      ))}
    </ul>
  );
}
```

## IPC Channels

### Main to Renderer

| Channel | Description |
|---------|-------------|
| `web:scriptStarted` | Script execution started |
| `web:scriptFinished` | Script execution finished |
| `web:scriptOutput` | Script output (stdout/stderr) |
| `web:installing` | Package installation started |
| `web:installed` | Package installation finished |
| `web:checkingOutdated` | Outdated check started |
| `web:checkedOutdated` | Outdated check finished |

### Renderer to Main

| Channel | Parameters | Returns |
|---------|------------|---------|
| `web:initialize` | - | `{ success: boolean }` |
| `web:getDiagnostics` | `filePath, content?` | `Diagnostic[]` |
| `web:format` | `FormatRequest` | `FormatResult` |
| `web:lint` | `LintRequest` | `LintResult` |
| `web:getCompletions` | `filePath, position, content?` | `CompletionItem[]` |
| `web:organizeImports` | `filePath, content, options?` | `TextEdit[]` |
| `web:renameSymbol` | `RenameParams` | `WorkspaceEdit \| null` |
| `web:extractFunction` | `ExtractFunctionParams` | `WorkspaceEdit \| null` |
| `web:installPackages` | `InstallPackagesRequest` | `InstallPackagesResult` |
| `web:runScript` | `RunScriptRequest` | `RunScriptResult` |
| `web:getScripts` | - | `ScriptTreeItem[]` |
| `web:getDependencies` | - | `DependencyTreeItem[]` |
| `web:checkOutdated` | - | `void` |
| `web:getStatus` | - | `WebLanguageStatus` |

## Architecture

```
languages/web/
├── types/              # TypeScript type definitions
├── config/             # Configuration management
│   └── web-config.ts
├── providers/          # Language providers
│   ├── typescript-provider.ts  # TS/JS support
│   └── config-provider.ts      # JSON/YAML/TOML
├── ui/                 # UI components
│   ├── web-status-bar.ts
│   ├── npm-scripts-panel.ts
│   └── dependencies-panel.ts
├── ipc/                # IPC handlers
│   └── web-ipc.ts
├── hooks/              # React hooks
│   └── useWebLanguage.ts
└── index.ts            # Main entry
```

## Requirements

- Node.js 16+
- TypeScript (bundled or in node_modules)
- ESLint (optional, for linting)
- Prettier (optional, for formatting)
- `yaml` package (optional, for YAML support)
- `@iarna/toml` package (optional, for TOML support)

## License

MIT
