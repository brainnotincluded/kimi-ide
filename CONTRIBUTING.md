# Contributing to Traitor IDE

Thank you for your interest in contributing to Traitor IDE! This document provides guidelines and standards for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Pull Request Process](#pull-request-process)
- [Code Review Process](#code-review-process)
- [Testing Requirements](#testing-requirements)

## Code of Conduct

This project and everyone participating in it is governed by our commitment to:

- **Be respectful**: Treat everyone with respect. Healthy debate is encouraged, but harassment is not tolerated.
- **Be constructive**: Provide constructive feedback and be open to receiving it.
- **Be collaborative**: Work together towards the best possible solutions.
- **Be professional**: Maintain professionalism in all interactions.

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 9+ or yarn 1.22+
- Git
- TypeScript knowledge
- React and Electron experience

### Setup

```bash
# Fork and clone the repository
git clone https://github.com/your-username/kimi-vscode.git
cd kimi-vscode

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm start
```

## Development Workflow

### Branch Naming Convention

Format: `<type>/<short-description>`

Types:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions/changes
- `chore/` - Maintenance tasks

Examples:
```
feature/add-syntax-highlighting
fix/memory-leak-terminal
docs/update-api-reference
```

### Before You Start

1. **Check existing issues**: Look for existing issues or create one to discuss your changes
2. **Claim the issue**: Comment on the issue to let others know you're working on it
3. **Keep scope focused**: One PR should address one concern

## Coding Standards

We follow strict coding standards to maintain code quality and consistency.

### TypeScript Standards

```typescript
// ✅ GOOD: Explicit types, clear interfaces
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

function processFile(node: FileNode): string {
  return node.path;
}

// ❌ BAD: Implicit types, no interfaces
function processFile(node) {
  return node.path;
}
```

### React Component Standards

```typescript
// ✅ GOOD: Functional components with explicit props
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

// ❌ BAD: No type safety, class components
class Editor extends React.Component {
  render() {
    return <div>{this.props.content}</div>;
  }
}
```

### File Organization

```
src/
├── common/          # Shared utilities and types
├── main/           # Electron main process
│   ├── main.ts
│   └── ipc/
├── renderer/       # React renderer process
│   ├── components/
│   ├── hooks/
│   ├── utils/
│   └── styles/
├── shared/         # Shared between main and renderer
└── types/          # Global type definitions
```

### Naming Conventions

- **Files**: PascalCase for components (`Sidebar.tsx`), camelCase for utilities (`fileUtils.ts`)
- **Components**: PascalCase (`Sidebar`, `EditorPanel`)
- **Hooks**: camelCase starting with `use` (`useFileSystem`, `useTheme`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_FILE_SIZE`, `DEFAULT_THEME`)
- **Interfaces**: PascalCase with descriptive names (`FileSystemOptions`)
- **Types**: PascalCase, use `Type` suffix for disambiguation (`EditorType`)

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

### Examples

```
feat(editor): add syntax highlighting for Python

fix(terminal): resolve memory leak in PTY process

refactor(sidebar): extract file explorer logic into custom hook

docs(api): update IPC communication documentation

test(utils): add unit tests for file path utilities
```

### Rules

1. Use imperative mood ("add" not "added" or "adds")
2. Don't capitalize the first letter
3. No period at the end
4. Keep the first line under 72 characters
5. Reference issues and PRs in the footer

## Pull Request Process

### Before Submitting

1. **Run tests**: Ensure all tests pass
   ```bash
   npm test
   ```

2. **Check types**: Verify TypeScript compilation
   ```bash
   npx tsc --noEmit
   ```

3. **Lint your code**: Follow ESLint rules
   ```bash
   npm run lint
   ```

4. **Update documentation**: If your change affects user-facing features

### PR Template

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or feature works
- [ ] New and existing unit tests pass locally

## Related Issues
Fixes #123
```

### PR Size Guidelines

- **Small**: < 100 lines (ideal)
- **Medium**: 100-400 lines (acceptable)
- **Large**: 400+ lines (requires special justification)

Keep PRs small and focused. Large PRs are harder to review and more likely to introduce bugs.

## Code Review Process

### For Authors

1. **Respond to feedback**: Address all comments within 48 hours
2. **Be open**: Don't take criticism personally
3. **Explain decisions**: If you disagree, explain your reasoning
4. **Keep it updated**: Rebase if the target branch changes significantly

### For Reviewers

1. **Be constructive**: Focus on the code, not the person
2. **Explain why**: Provide reasoning for your suggestions
3. **Distinguish required vs. optional**: Use `nit:` prefix for minor suggestions
4. **Respond timely**: Aim to review within 24-48 hours
5. **Approve when ready**: Don't hold PRs hostage for minor issues

### Review Checklist

- [ ] Code follows style guidelines
- [ ] No obvious bugs or edge cases missed
- [ ] Appropriate error handling
- [ ] Performance considerations addressed
- [ ] Security implications considered
- [ ] Tests included for new functionality
- [ ] Documentation updated if needed

## Testing Requirements

### Unit Tests

```typescript
// ✅ GOOD: Test behavior, not implementation
describe('FileExplorer', () => {
  it('should display files in alphabetical order', () => {
    const files = [{ name: 'z.ts' }, { name: 'a.ts' }];
    const result = sortFiles(files);
    expect(result[0].name).toBe('a.ts');
  });
});
```

### Integration Tests

Test IPC communication between main and renderer processes:

```typescript
describe('File Operations IPC', () => {
  it('should read file content via IPC', async () => {
    const content = await ipcRenderer.invoke('file:read', '/test.ts');
    expect(content).toBeDefined();
  });
});
```

### E2E Tests

Use Playwright for end-to-end testing:

```typescript
test('user can open a file', async ({ page }) => {
  await page.click('[data-testid="file-explorer"]');
  await page.click('text=example.ts');
  await expect(page.locator('.editor')).toContainText('example content');
});
```

## Performance Guidelines

- **Lazy load**: Use dynamic imports for heavy components
- **Memoize**: Use `useMemo` and `useCallback` appropriately
- **Avoid unnecessary re-renders**: Use `React.memo` for pure components
- **Monitor bundle size**: Keep the renderer bundle under 5MB

## Security Guidelines

- Never execute user input directly
- Validate all IPC messages
- Use context isolation in production
- Sanitize file paths before operations
- Never store secrets in the renderer process

## Questions?

- Join our Discord: [link]
- Check the [documentation](./docs/)
- Open a [discussion](https://github.com/your-username/kimi-vscode/discussions)

---

Thank you for contributing to Traitor IDE! 🚀
