# Contributing to Kimi IDE

Thank you for your interest in contributing to Kimi IDE! This document provides guidelines for contributing to the project.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Style](#coding-style)
- [Building the Project](#building-the-project)
- [Running Tests](#running-tests)
- [Making Changes](#making-changes)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Release Process](#release-process)

## Development Setup

### Prerequisites

- **VS Code** 1.86.0 or higher
- **Node.js** 18.x or higher
- **npm** 9.x or higher
- **Git**
- **Make** (optional, for Makefile commands)

### Initial Setup

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/kimi-vscode.git
cd kimi-vscode

# 3. Install dependencies
npm install

# 4. Compile TypeScript
npm run compile

# 5. Open in VS Code
code .
```

### Verify Setup

```bash
# Check TypeScript compilation
npm run type-check

# Run linting
npm run lint

# Run tests
npm test
```

## Project Structure

```
kimi-vscode/
├── src/
│   ├── commands/          # VS Code commands
│   ├── context/           # Context management
│   ├── kimi/              # API and Wire Protocol
│   ├── lsp/               # Language Server Protocol
│   ├── panels/            # WebView panels
│   ├── providers/         # VS Code providers
│   ├── terminal/          # Terminal integration
│   ├── test/              # Test files
│   ├── types/             # Type definitions
│   ├── utils/             # Utility functions
│   ├── config.ts          # Configuration
│   ├── extension.ts       # Entry point
│   └── statusBar.ts       # Status bar
├── docs/                  # Documentation
├── resources/             # Icons and assets
├── scripts/               # Build scripts
├── package.json           # Extension manifest
├── tsconfig.json          # TypeScript config
└── Makefile               # Build automation
```

## Coding Style

We use ESLint with TypeScript-specific rules. Configuration is in `.eslintrc.json`.

### TypeScript Guidelines

#### General

- Use **TypeScript strict mode**
- Prefer `interface` over `type` for object shapes
- Use explicit return types for public functions
- Avoid `any` - use `unknown` with type guards

```typescript
// ✅ Good
interface Config {
    apiKey: string;
    model: string;
}

function getConfig(): Config {
    return { apiKey: '', model: '' };
}

// ❌ Bad
function getConfig(): any {
    return {};
}
```

#### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Classes | PascalCase | `KimiApi`, `WireClient` |
| Interfaces | PascalCase | `KimiConfig`, `WireMessage` |
| Functions | camelCase | `getConfig()`, `sendMessage()` |
| Variables | camelCase | `apiKey`, `isConnected` |
| Constants | UPPER_SNAKE_CASE | `DEFAULT_TIMEOUT`, `CONFIG_SECTION` |
| Enums | PascalCase | `WireEventType`, `StepType` |
| Private members | _camelCase (prefix with _) | `_requestId`, `_process` |

#### Code Organization

```typescript
// 1. Imports
import * as vscode from 'vscode';
import { EventEmitter } from 'events';

// 2. Constants
const DEFAULT_TIMEOUT = 30000;

// 3. Types/Interfaces
interface Options {
    timeout: number;
}

// 4. Class Definition
export class MyClass {
    // 5. Private fields
    private _timeout: number;
    
    // 6. Constructor
    constructor(options: Options) {
        this._timeout = options.timeout;
    }
    
    // 7. Public methods
    public async doSomething(): Promise<void> {
        // Implementation
    }
    
    // 8. Private methods
    private _helper(): void {
        // Implementation
    }
}
```

#### Error Handling

```typescript
// ✅ Good - Specific error handling
try {
    const result = await api.call();
    return result;
} catch (error) {
    if (error instanceof NetworkError) {
        showError('Network connection failed', error);
        return null;
    }
    throw error; // Re-throw unexpected errors
}

// ✅ Good - With type guards
function handleError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    return 'Unknown error';
}
```

#### Async/Await

```typescript
// ✅ Good
async function fetchData(): Promise<Data> {
    const response = await api.get('/data');
    return response.json();
}

// ❌ Bad - Mixed async styles
function fetchData(): Promise<Data> {
    return api.get('/data').then(r => r.json());
}
```

### Formatting

We don't enforce a specific formatter, but recommend:

- 4 spaces indentation
- 120 character line limit
- Semicolons required
- Single quotes for strings

```bash
# Optional: Format with Prettier
npx prettier --write "src/**/*.ts"
```

## Building the Project

### Development Build

```bash
# Watch mode - auto-recompile on changes
npm run watch

# Or using Make
make dev
```

### Production Build

```bash
# Full production build
npm run build

# Or using Make
make build
```

### Cleaning Build Artifacts

```bash
# Remove build artifacts
make clean

# Deep clean (includes node_modules)
make clean-all
```

### Running the Extension

```bash
# Method 1: Press F5 in VS Code
# Opens Extension Development Host

# Method 2: Command line
make test-extension

# Method 3: Manual
code --extensionDevelopmentPath=$(pwd)
```

## Running Tests

### Test Structure

```
src/test/
├── mocks/
│   └── vscode.ts          # VS Code API mocks
├── suite/
│   ├── extension.test.ts  # Extension tests
│   ├── kimi/
│   │   └── wire.test.ts   # Wire Protocol tests
│   ├── context/           # Context tests
│   └── utils/             # Utility tests
└── runTest.ts             # Test runner
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests with compilation
make test

# Run tests in CI mode (headless on Linux)
make test-ci

# Run specific test file
npm test -- --grep "WireClient"
```

### Writing Tests

```typescript
import * as assert from 'assert';
import { WireClient } from '../../kimi/wire';

suite('WireClient', () => {
    let client: WireClient;

    setup(() => {
        client = new WireClient({ cliPath: '/path/to/cli' });
    });

    teardown(async () => {
        await client.disconnect();
    });

    test('should connect to cli', async () => {
        await client.connect();
        assert.strictEqual(client.getStatus(), true);
    });

    test('should handle disconnection', async () => {
        await client.connect();
        await client.disconnect();
        assert.strictEqual(client.getStatus(), false);
    });
});
```

### Test Guidelines

1. **Use descriptive test names**: `should handle connection timeout`
2. **Group related tests** in suites
3. **Clean up** in `teardown()`
4. **Mock external dependencies** (VS Code API, network)
5. **Test edge cases** (empty input, errors, timeouts)

## Making Changes

### Branch Naming

```
feature/description     # New features
bugfix/description      # Bug fixes
docs/description        # Documentation updates
refactor/description    # Code refactoring
test/description        # Test additions
chore/description       # Maintenance tasks
```

### Commit Messages

Follow conventional commits:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting)
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Build/config changes

Examples:
```
feat(inline-edit): add support for multi-line selections

fix(wire-protocol): handle reconnection after cli crash

docs(api): add wire protocol examples
```

### Before Committing

```bash
# 1. Run linter
npm run lint

# 2. Run type checker
npm run type-check

# 3. Run tests
npm test

# 4. Build to verify
npm run build
```

Or use Make:
```bash
make ci
```

## Submitting a Pull Request

### PR Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Commit messages follow conventions
- [ ] PR description explains changes

### PR Process

1. **Create a branch**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes**
   - Write code
   - Add tests
   - Update docs

3. **Commit changes**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

4. **Push to your fork**
   ```bash
   git push origin feature/my-feature
   ```

5. **Create Pull Request**
   - Go to GitHub
   - Click "New Pull Request"
   - Fill in the template
   - Link related issues

### PR Review Process

1. Automated checks must pass (CI)
2. Maintainer review
3. Address feedback
4. Approval and merge

## Release Process

### Version Bumping

```bash
# Patch version (0.0.x)
make bump-patch

# Minor version (0.x.0)
make bump-minor

# Major version (x.0.0)
make bump-major
```

### Creating a Release

```bash
# 1. Update CHANGELOG.md
# 2. Create package
make package

# 3. Create GitHub release with .vsix attached
# 4. Publish to marketplace (maintainers only)
make publish
```

## Debugging

### Extension Development

1. Open project in VS Code
2. Set breakpoints in source
3. Press `F5` to launch Extension Host
4. Trigger functionality
5. Debug in main VS Code window

### Enable Debug Logging

```json
// settings.json
{
  "kimi.debug": true
}
```

View logs: Output panel → "Kimi IDE"

### Common Issues

**Issue**: Extension not loading
```bash
# Check VS Code version
code --version  # Must be 1.86.0+

# Check compilation
npm run compile

# Clear extension cache
rm -rf ~/.vscode/extensions/kimi-ide*
```

**Issue**: Tests failing
```bash
# Rebuild test environment
npm run compile

# Check for missing mocks
```

**Issue**: Lint errors
```bash
# Auto-fix some issues
npm run lint -- --fix
```

## Getting Help

- Check [FAQ](./FAQ.md)
- Open an issue on GitHub
- Join our Discord community
- Read [API Documentation](./API.md)

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Respect maintainers' decisions

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
