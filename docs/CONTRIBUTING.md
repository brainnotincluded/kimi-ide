# Contributing to Kimi IDE

Thank you for your interest in contributing to Kimi IDE! This document provides comprehensive guidelines and standards for contributing to the project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Review Process](#code-review-process)
- [Release Process](#release-process)
- [Getting Help](#getting-help)

---

## Code of Conduct

This project and everyone participating in it is governed by our commitment to:

- **Be respectful**: Treat everyone with respect. Healthy debate is encouraged, but harassment is not tolerated.
- **Be constructive**: Provide constructive feedback and be open to receiving it.
- **Be collaborative**: Work together towards the best possible solutions.
- **Be professional**: Maintain professionalism in all interactions.

---

## Getting Started

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| VS Code | 1.86.0+ | Development environment |
| Node.js | 18.x+ | Runtime |
| npm | 9.x+ | Package manager |
| Git | 2.x+ | Version control |

### Recommended Tools

- **VS Code Extensions**:
  - ESLint
  - Prettier
  - TypeScript Hero
  - GitLens
  - Jest Runner

### Quick Setup

```bash
# 1. Fork the repository on GitHub
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/kimi-ide.git
cd kimi-ide

# 3. Install dependencies
npm install

# 4. Build the project
npm run compile

# 5. Run in development mode
npm run watch
# Then press F5 in VS Code to open Extension Development Host
```

---

## Development Environment

### VS Code Configuration

Create `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "./node_modules/typescript/lib",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "eslint.workingDirectories": ["."]
}
```

### Launch Configuration

The project includes `.vscode/launch.json` for debugging:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Run Extension",
      "type": "extensionHost",
      "request": "launch",
      "runtimeExecutable": "${execPath}",
      "args": ["--extensionDevelopmentPath=${workspaceFolder}"],
      "outFiles": ["${workspaceFolder}/out/**/*.js"],
      "preLaunchTask": "npm: watch"
    }
  ]
}
```

### Environment Variables

Create `.env` file for local development:

```bash
# Optional: for testing with real API
KIMI_API_KEY=your-test-key-here
KIMI_DEBUG=true
```

---

## Development Workflow

### Branch Naming Convention

Format: `<type>/<short-description>`

| Type | Purpose | Example |
|------|---------|---------|
| `feature/` | New features | `feature/add-voice-commands` |
| `fix/` | Bug fixes | `fix/memory-leak-terminal` |
| `docs/` | Documentation | `docs/update-api-reference` |
| `refactor/` | Code refactoring | `refactor/simplify-context` |
| `test/` | Test additions | `test/add-e2e-tests` |
| `chore/` | Maintenance | `chore/update-dependencies` |
| `perf/` | Performance | `perf/optimize-file-discovery` |

### Before You Start

1. **Check existing issues**: Look for existing issues or create one
2. **Claim the issue**: Comment to let others know you're working on it
3. **Keep scope focused**: One PR should address one concern

### Development Cycle

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Create    │────▶│    Write     │────▶│    Test      │
│    Branch    │     │     Code     │     │   Locally    │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
┌──────────────┐     ┌──────────────┐     ┌──────┴───────┐
│    Merge     │◀────│     PR       │◀────│     Push     │
│    to Main   │     │   Reviewed   │     │    Branch    │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## Coding Standards

We follow strict coding standards to maintain code quality and consistency.

### TypeScript Standards

✅ **Good Example:**
```typescript
// Explicit types, clear interfaces
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

function processFile(node: FileNode): string {
  if (node.type === 'directory') {
    return `Directory: ${node.name}`;
  }
  return node.path;
}
```

❌ **Bad Example:**
```typescript
// Implicit types, no interfaces
function processFile(node) {
  return node.path;
}
```

### React Component Standards

✅ **Good Example:**
```typescript
interface EditorProps {
  filePath: string;
  content: string;
  onChange: (content: string) => void;
  readonly?: boolean;
}

export const Editor: React.FC<EditorProps> = ({ 
  filePath, 
  content, 
  onChange,
  readonly = false 
}) => {
  const handleChange = useCallback((value: string) => {
    onChange(value);
  }, [onChange]);

  return (
    <div className="editor">
      <MonacoEditor 
        value={content}
        onChange={handleChange}
        readonly={readonly}
      />
    </div>
  );
};
```

### VS Code Extension Standards

```typescript
// Register commands properly
export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand(
    'kimi.inlineEdit',
    async () => {
      try {
        await inlineEditService.open();
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to open inline edit: ${error.message}`
        );
      }
    }
  );
  
  context.subscriptions.push(disposable);
}
```

### File Organization

```
src/
├── agents/              # Multi-Agent System
│   ├── __tests__/       # Unit tests
│   └── *.ts             # Agent implementations
├── discovery/           # Tree-based Discovery
├── editing/             # Parallel Editing
├── review/              # Auto Code Review
├── context/             # Smart Context
├── kimi/                # Wire Protocol
├── panels/              # UI Panels
├── providers/           # VS Code Providers
├── commands/            # Command handlers
├── utils/               # Utilities
└── extension.ts         # Entry point
```

### Naming Conventions

| Category | Convention | Example |
|----------|-----------|---------|
| Files | PascalCase for components | `Sidebar.tsx` |
| Files | camelCase for utilities | `fileUtils.ts` |
| Components | PascalCase | `Sidebar`, `EditorPanel` |
| Hooks | camelCase with `use` | `useFileSystem` |
| Constants | UPPER_SNAKE_CASE | `MAX_FILE_SIZE` |
| Interfaces | PascalCase | `FileSystemOptions` |
| Enums | PascalCase | `AgentType` |

---

## Testing Guidelines

### Test Structure

```
src/
├── agents/
│   ├── orchestrator.ts
│   └── __tests__/
│       ├── orchestrator.test.ts
│       └── fixtures/
│           └── sample-tasks.ts
```

### Unit Tests

✅ **Good Example:**
```typescript
describe('FileDiscoveryAgent', () => {
  describe('discoverFiles', () => {
    it('should return files matching query', async () => {
      const agent = new FileDiscoveryAgent();
      const files = await agent.discoverFiles('auth', mockContext);
      
      expect(files).toHaveLength(2);
      expect(files[0].name).toBe('auth.ts');
    });
    
    it('should return empty array when no matches', async () => {
      const agent = new FileDiscoveryAgent();
      const files = await agent.discoverFiles('xyz123', mockContext);
      
      expect(files).toHaveLength(0);
    });
  });
});
```

### Integration Tests

```typescript
describe('Wire Protocol', () => {
  it('should send message and receive response', async () => {
    const client = new WireClient({ cliPath: '/test/cli' });
    await client.connect();
    
    const response = await client.sendMessage('Hello', mockContext);
    
    expect(response).toBeDefined();
    expect(response.content).toContain('Hello');
  });
});
```

### Test Coverage

Minimum coverage requirements:

| Category | Minimum |
|----------|---------|
| Statements | 80% |
| Branches | 75% |
| Functions | 80% |
| Lines | 80% |

Run coverage report:
```bash
npm test -- --coverage
```

---

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(agents): add voice interface` |
| `fix` | Bug fix | `fix(discovery): handle circular deps` |
| `docs` | Documentation | `docs(api): update endpoints` |
| `style` | Code style | `style: fix indentation` |
| `refactor` | Refactoring | `refactor(context): simplify manager` |
| `perf` | Performance | `perf(search): optimize indexing` |
| `test` | Tests | `test(agents): add unit tests` |
| `chore` | Maintenance | `chore(deps): update typescript` |

### Scopes

Common scopes:
- `agents` - Multi-Agent System
- `discovery` - Tree-based Discovery
- `editing` - Parallel Editing
- `review` - Auto Code Review
- `context` - Smart Context
- `ui` - User Interface
- `api` - API/Wire Protocol
- `lsp` - Language Server Protocol

### Examples

```
feat(agents): add orchestrator workflow validation

Add validation to ensure all required agents are registered
before executing a workflow. This prevents runtime errors.

Closes #123
```

```
fix(discovery): resolve memory leak in AST cache

The AST cache was not properly clearing old entries,
leading to unbounded memory growth in large projects.

Fixes #456
```

### Rules

1. Use imperative mood ("add" not "added")
2. Don't capitalize the first letter
3. No period at the end
4. Keep first line under 72 characters
5. Reference issues in footer

---

## Pull Request Process

### Before Submitting

```bash
# 1. Run tests
npm test

# 2. Check types
npx tsc --noEmit

# 3. Lint
npm run lint

# 4. Format
npm run format
```

### PR Description Template

```markdown
## Summary
Brief description of changes

## Changes
- Specific change 1
- Specific change 2

## Type
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Refactoring
- [ ] Documentation

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Tested manually
- [ ] E2E tests (if applicable)

## Screenshots
<!-- For UI changes -->

## Related Issues
Fixes #123
Relates to #456

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Changes are documented
- [ ] Tests pass locally
- [ ] No breaking changes (or documented)
```

### PR Size Guidelines

| Size | Lines | Action |
|------|-------|--------|
| Small | < 100 | Ideal, easy to review |
| Medium | 100-400 | Acceptable |
| Large | 400+ | Requires special justification |

Keep PRs small and focused. Large PRs are harder to review and more likely to introduce bugs.

---

## Code Review Process

See [CODE_REVIEW_GUIDELINES.md](../CODE_REVIEW_GUIDELINES.md) for detailed review process.

### Quick Reference

**For Authors:**
- Respond to feedback within 24-48 hours
- Address all blocking comments
- Explain decisions when needed
- Keep PR up to date with main

**For Reviewers:**
- Review within 24-48 hours
- Use comment prefixes (`blocking:`, `suggestion:`, `nit:`)
- Be constructive and specific
- Approve when ready

---

## Release Process

### Version Numbers

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR** - Breaking changes
- **MINOR** - New features (backward compatible)
- **PATCH** - Bug fixes

### Release Checklist

- [ ] Update CHANGELOG.md
- [ ] Update version in package.json
- [ ] Run full test suite
- [ ] Create git tag
- [ ] Build and package extension
- [ ] Create GitHub release
- [ ] Publish to VS Code Marketplace

---

## Getting Help

### Resources

- **Documentation**: [docs/](./)
- **FAQ**: [FAQ.md](./FAQ.md)
- **API Reference**: [API.md](./API.md)
- **Architecture**: [ARCHITECTURE.md](./ARCHITECTURE.md)

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: Questions and general discussion
- **Discord**: Real-time chat (link TBD)

### Asking Questions

When asking for help:

1. **Search first** - Check existing issues and docs
2. **Be specific** - Provide context and details
3. **Include code** - Share relevant code snippets
4. **Show errors** - Include error messages and stack traces

Good question example:
```
I'm trying to add a new agent to the system.

I've created the file at `src/agents/myAgent.ts`:

[code snippet]

But when I try to register it, I get this error:

[error message]

I've checked the existing agents and my code looks similar.
What am I missing?
```

---

## Recognition

Contributors will be:

- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Added to the contributors graph

Thank you for contributing to Kimi IDE! 🚀
