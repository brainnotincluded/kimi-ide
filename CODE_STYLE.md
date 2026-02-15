# Code Style Guide

This document defines the coding standards for Kimi IDE. All contributions must follow these guidelines.

---

## Table of Contents

- [General Principles](#general-principles)
- [TypeScript Style Guide](#typescript-style-guide)
- [React Style Guide](#react-style-guide)
- [VS Code Extension Guidelines](#vs-code-extension-guidelines)
- [File Organization](#file-organization)
- [Naming Conventions](#naming-conventions)
- [Formatting Rules](#formatting-rules)
- [Documentation Standards](#documentation-standards)
- [ESLint Configuration](#eslint-configuration)

---

## General Principles

1. **Readability over cleverness** - Code is read more often than written
2. **Explicit over implicit** - Make types and intentions clear
3. **DRY (Don't Repeat Yourself)** - Extract reusable logic
4. **Single Responsibility** - Each function/component does one thing well
5. **Fail fast** - Validate inputs early and throw meaningful errors

---

## TypeScript Style Guide

### Strict Mode

Always enable strict mode in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### Type Definitions

✅ **Good:**
```typescript
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size: number;
  lastModified: Date;
  children?: FileNode[];
}

type FileOperation = 'read' | 'write' | 'delete' | 'rename';

interface FileSystemError extends Error {
  code: string;
  path: string;
}
```

❌ **Bad:**
```typescript
type Node = any;
interface File {
  name: string;
  // Missing other fields
}
```

### Functions

✅ **Good:**
```typescript
/**
 * Reads file content from the filesystem
 * @param filePath - Absolute path to the file
 * @param encoding - File encoding (default: 'utf-8')
 * @returns File content as string
 * @throws {FileSystemError} When file doesn't exist or can't be read
 */
async function readFileContent(
  filePath: string, 
  encoding: BufferEncoding = 'utf-8'
): Promise<string> {
  if (!filePath) {
    throw new Error('filePath is required');
  }
  
  if (!path.isAbsolute(filePath)) {
    throw new Error('filePath must be absolute');
  }
  
  return fs.promises.readFile(filePath, encoding);
}
```

❌ **Bad:**
```typescript
function readFile(path) {
  return fs.readFileSync(path);
}
```

### Interface vs Type

✅ **Good:**
```typescript
// Use interface for object shapes that may be extended
interface ComponentProps {
  id: string;
  children: React.ReactNode;
}

interface EditorProps extends ComponentProps {
  language: string;
  content: string;
}

// Use type for unions, tuples, or mapped types
type Theme = 'light' | 'dark' | 'system';
type EventHandler<T> = (event: T) => void;
type FileMap = Record<string, FileNode>;
```

### Enums

✅ **Good:**
```typescript
// Use const enums or string literal unions
const enum IPCChannel {
  FILE_READ = 'file:read',
  FILE_WRITE = 'file:write',
  DIALOG_OPEN = 'dialog:open'
}

// Alternative: String literal union (preferred for flexibility)
type IPCChannel = 
  | 'file:read' 
  | 'file:write' 
  | 'dialog:open';
```

❌ **Bad:**
```typescript
// Regular enums add runtime overhead
enum Channel {
  FileRead,
  FileWrite
}
```

### Null Handling

✅ **Good:**
```typescript
// Use optional chaining and nullish coalescing
const fileName = file?.name ?? 'untitled';
const size = stats?.size ?? 0;

// Type guards for null checks
function processNode(node: FileNode | null): void {
  if (!node) {
    return;
  }
  
  // TypeScript knows node is not null here
  console.log(node.name);
}
```

❌ **Bad:**
```typescript
// Non-null assertions (avoid when possible)
const name = node!.name;
```

---

## React Style Guide

### Component Structure

✅ **Good:**
```typescript
import React, { useCallback, useMemo, useState } from 'react';

interface SidebarProps {
  workspace: string | null;
  onFileSelect: (path: string) => void;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  workspace, 
  onFileSelect,
  className 
}) => {
  const [activeFile, setActiveFile] = useState<string | null>(null);
  
  const handleFileClick = useCallback((path: string) => {
    setActiveFile(path);
    onFileSelect(path);
  }, [onFileSelect]);
  
  const fileCount = useMemo(() => {
    return workspace ? getFileCount(workspace) : 0;
  }, [workspace]);
  
  if (!workspace) {
    return <EmptyState />;
  }
  
  return (
    <div className={className}>
      <FileTree 
        workspace={workspace}
        activeFile={activeFile}
        onFileClick={handleFileClick}
      />
      <Footer count={fileCount} />
    </div>
  );
};
```

### Hooks Rules

✅ **Good:**
```typescript
function useFileSystem(workspace: string | null) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!workspace) {
      setFiles([]);
      return;
    }
    
    setIsLoading(true);
    loadFiles(workspace)
      .then(setFiles)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, [workspace]);
  
  return { files, isLoading, error };
}
```

❌ **Bad:**
```typescript
function useData() {
  const [data, setData] = useState([]); // Vague type
  
  if (condition) { // ❌ Hook rule violation!
    useEffect(() => {}, []);
  }
  
  return data;
}
```

### Event Handlers

✅ **Good:**
```typescript
const Editor: React.FC<EditorProps> = ({ onChange, onSave }) => {
  const handleContentChange = useCallback((value: string) => {
    onChange(value);
  }, [onChange]);
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.metaKey && event.key === 's') {
      event.preventDefault();
      onSave();
    }
  }, [onSave]);
  
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  return <MonacoEditor onChange={handleContentChange} />;
};

// ✅ Stable reference
<button onClick={handleClick}>Click</button>
```

❌ **Bad:**
```typescript
// ❌ Inline functions create new function each render
<button onClick={() => doSomething()}>Click</button>
```

---

## VS Code Extension Guidelines

### Command Registration

✅ **Good:**
```typescript
export function activate(context: vscode.ExtensionContext) {
  // Register command with proper error handling
  const disposable = vscode.commands.registerCommand(
    'kimi.inlineEdit',
    async () => {
      try {
        await inlineEditService.open();
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to open inline edit: ${error.message}`
        );
        logger.error('Inline edit failed', error);
      }
    }
  );
  
  context.subscriptions.push(disposable);
}
```

### WebView Usage

✅ **Good:**
```typescript
const panel = vscode.window.createWebviewPanel(
  'kimiChat',
  'Kimi Chat',
  vscode.ViewColumn.Beside,
  {
    enableScripts: true,
    retainContextWhenHidden: true,
    localResourceRoots: [
      vscode.Uri.joinPath(context.extensionUri, 'media')
    ]
  }
);
```

### Configuration

✅ **Good:**
```typescript
// Get configuration with defaults
const config = vscode.workspace.getConfiguration('kimi');
const apiKey = config.get<string>('apiKey', '');
const maxTokens = config.get<number>('context.maxTokens', 8000);

// Listen for changes
vscode.workspace.onDidChangeConfiguration(e => {
  if (e.affectsConfiguration('kimi')) {
    // Reload config
    reloadConfiguration();
  }
});
```

---

## File Organization

### Directory Structure

```
src/
├── agents/                    # Multi-Agent System
│   ├── __tests__/            # Unit tests
│   ├── orchestrator.ts
│   └── ...
├── discovery/                 # Tree-based Discovery
├── editing/                   # Parallel Editing
├── review/                    # Auto Code Review
├── context/                   # Smart Context
├── kimi/                      # Wire Protocol
├── panels/                    # UI Panels
├── providers/                 # VS Code Providers
├── commands/                  # Command handlers
├── utils/                     # Utilities
├── types/                     # Global types
└── extension.ts               # Entry point
```

### File Naming

| Category | Convention | Example |
|----------|-----------|---------|
| Components | PascalCase.tsx | `Sidebar.tsx` |
| Hooks | camelCase with `use` | `useFileSystem.ts` |
| Utilities | camelCase | `fileUtils.ts` |
| Constants | camelCase or UPPER_SNAKE | `constants.ts` |
| Types | PascalCase | `types.ts` |
| Tests | `*.test.ts` | `orchestrator.test.ts` |

---

## Naming Conventions

### Variables

✅ **Good:**
```typescript
const fileExplorerWidth = 260;
const isLoading = false;
const activeEditorId: string | null = null;
const MAX_RECENT_FILES = 10;
```

❌ **Bad:**
```typescript
const w = 260;           // Too short
const loading = false;   // Not descriptive
const id = null;         // Missing type
const max = 10;          // Ambiguous
```

### Functions

✅ **Good:**
```typescript
function getFileContent(path: string): Promise<string>
function handleFileSelect(path: string): void
function isValidFilePath(path: string): boolean
function formatFileSize(bytes: number): string
```

❌ **Bad:**
```typescript
function getContent(p: string)  // Vague name, short param
function process(x: string)     // Non-descriptive
function check(s: string)       // Unclear purpose
```

### Classes

✅ **Good:**
```typescript
class FileSystemManager {
  private workspaceRoot: string;
  
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }
  
  async readFile(path: string): Promise<string> {
    // Implementation
  }
}
```

❌ **Bad:**
```typescript
// Unclear responsibility
class ProcessFile {
  // What does this do?
}
```

---

## Formatting Rules

### Indentation & Spacing

✅ **Good:**
```typescript
interface Example {
  name: string;
  value: number;
}

function process(
  arg1: string,
  arg2: number
): Promise<string> {
  const result = arg1 + String(arg2);
  return Promise.resolve(result);
}
```

❌ **Bad:**
```typescript
function process(arg1:string,arg2:number):Promise<string>{
  const result=arg1+String(arg2);
  return Promise.resolve(result);
}
```

### Quotes

✅ **Good:**
```typescript
// Single quotes for strings
const message = 'Hello, World!';
const template = `Value: ${value}`;

// Double quotes for JSX attributes
<input type="text" placeholder="Enter name" />
```

### Semicolons

Always use semicolons:

✅ **Good:**
```typescript
const x = 5;
const y = 10;

function foo(): void {
  return;
}
```

❌ **Bad:**
```typescript
const x = 5
const y = 10
```

### Trailing Commas

✅ **Good:**
```typescript
const config = {
  port: 3000,
  host: 'localhost',
  ssl: true,
};

const items = [
  'one',
  'two',
  'three',
];
```

❌ **Bad:**
```typescript
const config = {
  port: 3000,
  host: 'localhost'  // Missing trailing comma
};
```

---

## Documentation Standards

### JSDoc Comments

✅ **Good:**
```typescript
/**
 * Represents a file in the workspace
 */
interface FileNode {
  /** Unique identifier for the file */
  id: string;
  
  /** File name including extension */
  name: string;
  
  /** Absolute path to the file */
  path: string;
  
  /** File size in bytes */
  size: number;
}

/**
 * Reads a file from the filesystem
 * 
 * @param filePath - Absolute path to the file
 * @param options - Reading options
 * @returns Promise resolving to file content
 * @throws {FileSystemError} When file cannot be read
 * 
 * @example
 * ```typescript
 * const content = await readFile('/project/src/index.ts');
 * console.log(content);
 * ```
 */
async function readFile(
  filePath: string,
  options?: ReadOptions
): Promise<string> {
  // Implementation
}
```

### README Documentation

Each module should have a README explaining:
- Purpose of the module
- Key exports
- Usage examples
- Dependencies

---

## ESLint Configuration

```javascript
// .eslintrc.json
{
  "parser": "@typescript-eslint/parser",
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended"
  ],
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error",
    "react/prop-types": "off",
    "react/react-in-jsx-scope": "off",
    "no-console": ["warn", { "allow": ["error", "warn"] }]
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### Running Linting

```bash
# Check code
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Format with Prettier
npm run format
```

---

**Remember**: These guidelines exist to ensure consistency and quality. When in doubt, prioritize readability and maintainability.
