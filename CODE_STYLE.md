# Code Style Guide

This document defines the coding standards for Traitor IDE. All contributions must follow these guidelines.

## Table of Contents

- [General Principles](#general-principles)
- [TypeScript Style Guide](#typescript-style-guide)
- [React Style Guide](#react-style-guide)
- [Electron Specifics](#electron-specifics)
- [File Organization](#file-organization)
- [Naming Conventions](#naming-conventions)
- [Formatting Rules](#formatting-rules)
- [Documentation Standards](#documentation-standards)

## General Principles

1. **Readability over cleverness**: Code is read more often than written
2. **Explicit over implicit**: Make types and intentions clear
3. **DRY (Don't Repeat Yourself)**: Extract reusable logic
4. **Single Responsibility**: Each function/component does one thing well
5. **Fail fast**: Validate inputs early and throw meaningful errors

## TypeScript Style Guide

### Strict Mode

Always enable strict mode in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true
  }
}
```

### Type Definitions

```typescript
// ✅ GOOD: Explicit, descriptive types
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

// ❌ BAD: Vague types, missing documentation
type Node = any;
interface File {
  name: string;
  // Missing other fields
}
```

### Functions

```typescript
// ✅ GOOD: Clear signature, JSDoc, early returns
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

// ❌ BAD: Implicit types, no validation
function readFile(path) {
  return fs.readFileSync(path);
}
```

### Interface vs Type

```typescript
// ✅ GOOD: Use interface for object shapes that may be extended
interface ComponentProps {
  id: string;
  children: React.ReactNode;
}

interface EditorProps extends ComponentProps {
  language: string;
  content: string;
}

// ✅ GOOD: Use type for unions, tuples, or mapped types
type Theme = 'light' | 'dark' | 'system';
type EventHandler<T> = (event: T) => void;
type FileMap = Record<string, FileNode>;
```

### Enums

```typescript
// ✅ GOOD: Use const enums or string literal unions
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

// ❌ BAD: Regular enums (adds runtime overhead)
enum Channel {
  FileRead,
  FileWrite
}
```

### Null Handling

```typescript
// ✅ GOOD: Use optional chaining and nullish coalescing
const fileName = file?.name ?? 'untitled';
const size = stats?.size ?? 0;

// ✅ GOOD: Type guards for null checks
function processNode(node: FileNode | null): void {
  if (!node) {
    return;
  }
  
  // TypeScript knows node is not null here
  console.log(node.name);
}

// ❌ BAD: Non-null assertions (except when absolutely necessary)
const name = node!.name; // Avoid this
```

## React Style Guide

### Component Structure

```typescript
// ✅ GOOD: Functional component with explicit props
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

```typescript
// ✅ GOOD: Hooks at top level, descriptive names
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

// ❌ BAD: Conditional hooks, vague names
function useData() {
  const [data, setData] = useState([]); // Vague
  
  if (condition) { // ❌ Hook rule violation!
    useEffect(() => {}, []);
  }
  
  return data;
}
```

### Event Handlers

```typescript
// ✅ GOOD: Memoized handlers, descriptive names
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

// ❌ BAD: Inline arrow functions (creates new function each render)
<button onClick={() => doSomething()}>Click</button>

// ✅ GOOD: Stable reference
<button onClick={handleClick}>Click</button>
```

### Conditional Rendering

```typescript
// ✅ GOOD: Early returns, clear conditions
function StatusMessage({ status, error }: StatusProps) {
  if (error) {
    return <ErrorMessage error={error} />;
  }
  
  if (status === 'loading') {
    return <LoadingSpinner />;
  }
  
  if (status === 'success') {
    return <SuccessMessage />;
  }
  
  return null;
}

// ✅ GOOD: Object map for multiple states
const StatusComponent = {
  loading: LoadingSpinner,
  success: SuccessMessage,
  error: ErrorMessage,
};

function Status({ status }: { status: keyof typeof StatusComponent }) {
  const Component = StatusComponent[status];
  return <Component />;
}
```

## Electron Specifics

### IPC Communication

```typescript
// ✅ GOOD: Typed IPC channels
// types/ipc.ts
export interface IPCChannels {
  'file:read': {
    request: { path: string; encoding?: BufferEncoding };
    response: string;
    error: FileSystemError;
  };
  'file:write': {
    request: { path: string; content: string };
    response: { success: boolean };
    error: FileSystemError;
  };
}

// main/ipc.ts
ipcMain.handle('file:read', async (event, { path, encoding }) => {
  try {
    const content = await fs.readFile(path, encoding);
    return content;
  } catch (error) {
    throw new FileSystemError(`Failed to read file: ${error.message}`);
  }
});

// renderer/fileService.ts
export async function readFile(path: string): Promise<string> {
  return ipcRenderer.invoke('file:read', { path });
}
```

### Security

```typescript
// ✅ GOOD: Validate all IPC inputs
ipcMain.handle('file:write', async (event, { path, content }) => {
  // Validate path is within workspace
  const resolvedPath = path.resolve(path);
  const workspaceRoot = getWorkspaceRoot();
  
  if (!resolvedPath.startsWith(workspaceRoot)) {
    throw new Error('Path outside workspace');
  }
  
  // Validate content type
  if (typeof content !== 'string') {
    throw new Error('Content must be a string');
  }
  
  await fs.writeFile(resolvedPath, content);
});

// ❌ BAD: Direct execution of user input
ipcMain.handle('run:command', (event, command) => {
  exec(command); // ❌ Security vulnerability!
});
```

### Memory Management

```typescript
// ✅ GOOD: Cleanup event listeners
useEffect(() => {
  const handler = (event: IpcRendererEvent, data: unknown) => {
    processData(data);
  };
  
  ipcRenderer.on('update', handler);
  
  return () => {
    ipcRenderer.off('update', handler);
  };
}, []);

// ✅ GOOD: Destroy browser windows properly
const window = new BrowserWindow({...});
window.on('closed', () => {
  // Cleanup
});
```

## File Organization

### Directory Structure

```
src/
├── main/                    # Electron main process
│   ├── main.ts             # Entry point
│   ├── ipc/                # IPC handlers
│   │   ├── fileHandlers.ts
│   │   └── windowHandlers.ts
│   └── utils/              # Main process utilities
│       └── fileUtils.ts
├── renderer/               # React renderer process
│   ├── components/         # React components
│   │   ├── common/        # Shared components
│   │   ├── editor/
│   │   ├── sidebar/
│   │   └── terminal/
│   ├── hooks/             # Custom React hooks
│   ├── services/          # API/IPC services
│   ├── utils/             # Utility functions
│   └── styles/            # Global styles
├── shared/                # Shared between main/renderer
│   ├── types/             # TypeScript types
│   └── constants.ts       # Shared constants
└── types/                 # Global type declarations
```

### File Naming

```typescript
// Components: PascalCase.tsx
// Sidebar.tsx, EditorPanel.tsx, TerminalView.tsx

// Hooks: camelCase starting with 'use'
// useFileSystem.ts, useTheme.ts, useDebounce.ts

// Utilities: camelCase
// fileUtils.ts, pathHelpers.ts, formatters.ts

// Constants: UPPER_SNAKE_CASE or camelCase
// constants.ts, ipcChannels.ts

// Styles: Same name as component
// Sidebar.tsx + Sidebar.css
```

## Naming Conventions

### Variables

```typescript
// ✅ GOOD: Descriptive, camelCase
const fileExplorerWidth = 260;
const isLoading = false;
const activeEditorId: string | null = null;
const MAX_RECENT_FILES = 10;

// ❌ BAD: Abbreviations, unclear names
const w = 260;
const loading = false;
const id = null;
const max = 10;
```

### Functions

```typescript
// ✅ GOOD: Verb + noun, clear intent
function getFileContent(path: string): Promise<string>
function handleFileSelect(path: string): void
function isValidFilePath(path: string): boolean
function formatFileSize(bytes: number): string

// ❌ BAD: Vague names
function getContent(p: string)
function process(x: string)
function check(s: string)
```

### Classes

```typescript
// ✅ GOOD: Nouns, PascalCase
class FileSystemManager {
  private workspaceRoot: string;
  
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }
  
  async readFile(path: string): Promise<string> {
    // Implementation
  }
}

// ❌ BAD: Verbs, unclear responsibility
class ProcessFile {
  // What does this do?
}
```

## Formatting Rules

### Indentation & Spacing

```typescript
// ✅ GOOD: 2 spaces, consistent spacing
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

// ❌ BAD: Inconsistent spacing
function process(arg1:string,arg2:number):Promise<string>{
  const result=arg1+String(arg2);
  return Promise.resolve(result);
}
```

### Quotes

```typescript
// ✅ GOOD: Single quotes for strings
const message = 'Hello, World!';
const template = `Value: ${value}`;

// ✅ GOOD: Double quotes for JSX attributes
<input type="text" placeholder="Enter name" />
```

### Semicolons

Always use semicolons:

```typescript
// ✅ GOOD
const x = 5;
const y = 10;

function foo(): void {
  return;
}

// ❌ BAD
const x = 5
const y = 10
```

### Trailing Commas

```typescript
// ✅ GOOD: Trailing commas in multi-line
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

// ❌ BAD: Missing trailing comma
const config = {
  port: 3000,
  host: 'localhost'
};
```

## Documentation Standards

### JSDoc Comments

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

## ESLint Configuration

```javascript
// .eslintrc.js
module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'error',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'react/prop-types': 'off',
    'react/react-in-jsx-scope': 'off',
  },
};
```

---

**Remember**: These guidelines exist to ensure consistency and quality. When in doubt, prioritize readability and maintainability.
