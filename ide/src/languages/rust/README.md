# Rust Language Support for Traitor IDE

Complete Rust toolchain integration for the Traitor IDE, providing cargo operations, diagnostics, formatting, and code completions.

## Features

- **Rust Installation Detection**: Automatic detection of rustup, cargo, rustc, rustfmt, and rust-analyzer
- **Cargo Integration**: Full support for build, test, run, check, clippy, doc, clean, update commands
- **Diagnostics**: Real-time error and warning detection via cargo check and clippy
- **Code Formatting**: Integration with rustfmt for code formatting
- **Code Completions**: Basic completions via rust-analyzer LSP (fallback keywords/types/macros)
- **Cargo.toml Explorer**: Visual dependency management with search and details
- **Configuration**: Per-project settings for toolchain, target, features, and cargo args

## Project Structure

```
/Users/mac/kimi-vscode/ide/src/languages/rust/
├── index.ts              # Main exports
├── types.ts              # TypeScript type definitions
├── provider.ts           # RustLanguageProvider class
├── config.ts             # Configuration management
├── ipc.ts                # Main process IPC handlers
├── renderer-api.ts       # Renderer process API
├── components/
│   ├── RustStatusBar.tsx # Status bar with version/actions
│   ├── CargoPanel.tsx    # Cargo.toml explorer panel
│   └── index.ts          # Component exports
└── README.md             # This file
```

## API Reference

### RustLanguageProvider

Main class for Rust toolchain operations:

```typescript
import { RustLanguageProvider } from './languages/rust';

const provider = new RustLanguageProvider('/path/to/workspace');

// Check installation
const check = await provider.checkRustInstallation();

// Get toolchain info
const info = await provider.getToolchainInfo();

// Run cargo commands
const result = await provider.runCargo('build', { release: true });
const testResult = await provider.runCargo('test', { features: ['feature1'] });

// Get diagnostics
const diagnostics = await provider.getDiagnostics();
const clippyDiagnostics = await provider.getClippyDiagnostics();

// Format code
const formatted = await provider.formatCode('/path/to/file.rs');

// Get completions
const completions = await provider.getCompletions('/path/to/file.rs', 10, 5);
```

### IPC Handlers (Main Process)

```typescript
import { setupRustIPCHandlers } from './languages/rust/ipc';

// In main.ts
setupRustIPCHandlers();
```

Available IPC channels:
- `rust:checkInstallation` - Check Rust installation
- `rust:getToolchainInfo` - Get toolchain information
- `rust:runCargo` - Run cargo command
- `rust:check` - Run cargo check
- `rust:clippy` - Run clippy
- `rust:format` - Format file
- `rust:formatString` - Format code string
- `rust:getCompletions` - Get code completions
- `rust:getProjectInfo` - Get project information
- `rust:getDependencies` - Get dependencies list
- `rust:updateDependencies` - Update dependencies
- `rust:build` - Build project
- `rust:test` - Run tests
- `rust:run` - Run project
- `rust:clean` - Clean project
- `rust:doc` - Generate documentation
- `rust:getConfig` / `rust:updateConfig` - Configuration management

### Renderer API

```typescript
import { rust } from './languages/rust/renderer-api';

// Check installation
const check = await rust.checkRustInstallation();

// Build project
const result = await rust.build('/path/to/workspace', true); // release build

// Run tests
const testResult = await rust.test('/path/to/workspace');
```

### React Components

```tsx
import { RustStatusBar, CargoPanel } from './languages/rust/components';

// Status bar with version and quick actions
<RustStatusBar workspaceRoot="/path/to/workspace" />

// Cargo.toml explorer
<CargoPanel workspaceRoot="/path/to/workspace" />
```

## Configuration

Configuration is stored in `.traitor/traitor-rust.json`:

```json
{
  "toolchain": "stable",
  "target": "x86_64-unknown-linux-gnu",
  "features": ["feature1", "feature2"],
  "cargoArgs": ["--jobs", "4"],
  "rustfmtOnSave": true,
  "checkOnSave": true,
  "clippyOnSave": false
}
```

## Integration

### Main Process (main.ts)

```typescript
import { setupRustIPCHandlers } from './languages/rust/ipc';

// After app is ready
setupRustIPCHandlers();
```

### Renderer Process

Add to `ipc.ts` or create a new hook:

```typescript
import { rust } from './languages/rust/renderer-api';

// Expose to window
if (typeof window !== 'undefined') {
  (window as any).electron = {
    ...((window as any).electron || {}),
    rust,
  };
}
```

## Requirements

- Rust toolchain (rustup, cargo, rustc)
- rustfmt (for code formatting)
- rust-analyzer (optional, for advanced completions)

## License

MIT
