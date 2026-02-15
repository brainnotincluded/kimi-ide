# Go Language Support for Traitor IDE

Complete Go language support for the Traitor IDE, including language server integration (gopls), build tools, testing, linting, and formatting.

## Features

### Core Language Features
- **Go Version Detection**: Automatic detection of Go installation, GOROOT, and GOPATH
- **Go Modules**: Parse and manage `go.mod` files
- **Build & Test**: Run `go build`, `go test`, `go run` directly from IDE
- **Formatting**: Support for `gofmt`, `goimports`, and `gofumpt`
- **Linting**: Integration with `staticcheck`, `go vet`, and `golint`
- **Code Completion**: LSP-based completions via gopls

### UI Components
- **GoStatusBar**: Status bar with Go version, build/test/run buttons
- **GoModulesPanel**: Tree view of go.mod dependencies
- **GoSettingsPanel**: Configuration UI for all Go settings

### IPC Channels
- `go:checkInstallation` - Check Go installation status
- `go:runCommand` - Run arbitrary Go commands
- `go:build` - Build the project
- `go:test` - Run tests
- `go:format` - Format code
- `go:getDiagnostics` - Get lint/vet diagnostics
- `go:modTidy` - Run `go mod tidy`
- `go:getCompletions` - Get code completions
- `go:initializeGopls` - Initialize language server

## Configuration

### Settings

```typescript
interface GoConfiguration {
  goroot?: string;           // Path to Go SDK
  gopath?: string;           // GOPATH
  toolsManagement: 'auto' | 'manual';
  lintTool: 'staticcheck' | 'golint' | 'govet';
  formatTool: 'gofmt' | 'goimports' | 'gofumpt';
  buildFlags: string[];
  testFlags: string[];
  enableGopls: boolean;
  goplsPath?: string;
}
```

### Default Configuration

```typescript
{
  toolsManagement: 'auto',
  lintTool: 'staticcheck',
  formatTool: 'goimports',
  buildFlags: [],
  testFlags: ['-v'],
  enableGopls: true
}
```

## Usage

### Main Process Setup

```typescript
import { initGoIPCHandlers, disposeGoIPC } from './languages/go';

// When opening a folder/project:
initGoIPCHandlers('/path/to/project');

// On app exit:
disposeGoIPC();
```

### Renderer Process Usage

```typescript
import { go } from './languages/go';
import { GoStatusBar, GoModulesPanel } from './languages/go/components';

// Direct API usage
const result = await go.build();
const completions = await go.getCompletions('/path/file.go', 10, 5);

// React components
function App() {
  return (
    <>
      <GoStatusBar />
      <GoModulesPanel />
    </>
  );
}
```

### Using GoLanguageProvider Directly

```typescript
import { GoLanguageProvider } from './languages/go';

const provider = new GoLanguageProvider({
  lintTool: 'staticcheck',
  formatTool: 'goimports'
});

provider.setProjectRoot('/path/to/project');

// Check installation
const install = await provider.checkGoInstallation();
console.log(`Go ${install.version} at ${install.goroot}`);

// Get modules info
const mod = await provider.getModulesInfo();
console.log(`Module: ${mod?.module}`);

// Run commands
await provider.runGo('build', ['-o', 'bin/app']);
await provider.test();

// Format code
await provider.formatCode('/path/file.go');

// Get diagnostics
const diagnostics = await provider.getDiagnostics();

// Cleanup
provider.dispose();
```

## File Structure

```
src/languages/go/
├── index.ts                    # Main exports
├── types/                      # TypeScript definitions
│   └── index.ts
├── provider/                   # Core language provider
│   ├── index.ts
│   └── GoLanguageProvider.ts
├── components/                 # React UI components
│   ├── index.ts
│   ├── GoStatusBar.tsx
│   ├── GoModulesPanel.tsx
│   └── GoSettingsPanel.tsx
├── ipc.ts                      # Main process IPC handlers
├── renderer-ipc.ts             # Renderer IPC API
├── config.ts                   # Configuration defaults
└── README.md                   # This file
```

## Dependencies

### Required
- Go 1.18+ installed on system

### Optional Tools (auto-installed)
- `gopls` - Go language server
- `staticcheck` - Advanced linter
- `goimports` - Formatter with auto-imports
- `gofumpt` - Stricter formatter
- `dlv` - Debugger

## IPC API Reference

### Main → Renderer Events
- `installationChecked` - Go installation status updated
- `goplsReady` - Language server initialized
- `goplsDisconnected` - Language server disconnected
- `diagnostics` - New diagnostics available
- `commandOutput` - Command stdout/stderr
- `commandComplete` - Command finished
- `modTidyComplete` - go mod tidy finished

### Renderer → Main Invoke

#### go.checkInstallation()
Returns `GoInstallation` with version, GOROOT, GOPATH, and tool status.

#### go.getModulesInfo(modPath?)
Parses go.mod file and returns `GoModule` with dependencies.

#### go.runCommand(command, args?)
Runs a Go command like `go [command] [args]`.

#### go.build(filePath?, outputPath?)
Builds the project. Returns `GoBuildResult`.

#### go.test(pattern?, filePath?)
Runs tests. Returns `GoTestResult`.

#### go.format(filePath)
Formats a file using the configured format tool.

#### go.getDiagnostics(filePath?)
Returns array of `GoDiagnostic` from lint tools.

#### go.modTidy()
Runs `go mod tidy`. Returns `GoCommandResult`.

#### go.getCompletions(filePath, line, column)
Returns code completions from gopls.

#### go.installTools(tools)
Installs specified tools. Returns success/failure per tool.

#### go.updateConfig(config)
Updates Go configuration settings.

## License

MIT - Part of Traitor IDE
