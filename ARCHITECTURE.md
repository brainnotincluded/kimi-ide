# Traitor IDE Architecture

This document describes the high-level architecture, design decisions, and technical implementation details of Traitor IDE.

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Main Process](#main-process)
- [Renderer Process](#renderer-process)
- [Communication Layer](#communication-layer)
- [Data Flow](#data-flow)
- [Security Model](#security-model)
- [Extension Points](#extension-points)
- [Performance Considerations](#performance-considerations)

## Overview

Traitor IDE is a desktop code editor built on Electron, combining the power of native desktop applications with the flexibility of web technologies. The architecture follows the standard Electron multi-process model.

### Key Technologies

- **Electron**: Cross-platform desktop app framework
- **React**: UI component library
- **TypeScript**: Type-safe JavaScript
- **Monaco Editor**: Code editor (VS Code's editor component)
- **node-pty**: Pseudo-terminal for integrated terminal
- **Webpack**: Module bundling and build tooling

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron App                            │
│                                                              │
│  ┌─────────────────┐         ┌──────────────────────────┐  │
│  │   Main Process  │         │    Renderer Process      │  │
│  │   (Node.js)     │◄───────►│    (Chromium)            │  │
│  │                 │   IPC   │                          │  │
│  │  - File I/O     │         │  - React UI              │  │
│  │  - Terminal     │         │  - Monaco Editor         │  │
│  │  - IPC handlers │         │  - State Management      │  │
│  │  - Window mgmt  │         │  - User Interactions     │  │
│  └─────────────────┘         └──────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Process Model

Electron operates with two types of processes:

1. **Main Process**: Single instance, controls application lifecycle, native APIs
2. **Renderer Process**: One per BrowserWindow, renders UI using Chromium

## Main Process

### Responsibilities

- Application lifecycle management
- Native OS integration (dialogs, menus, notifications)
- File system operations
- Process management (terminal)
- IPC communication handlers

### Module Structure

```
src/main/
├── main.ts              # Entry point, window creation
├── ipc/                 # IPC handlers
│   ├── fileHandlers.ts  # File operations
│   ├── dialogHandlers.ts # Native dialogs
│   └── windowHandlers.ts # Window management
├── terminal/            # Terminal management
│   └── TerminalManager.ts
├── services/            # Business logic
│   └── FileService.ts
└── utils/               # Utilities
    └── pathUtils.ts
```

### Key Components

#### Main Window (`main.ts`)

```typescript
class MainWindow {
  private window: BrowserWindow;
  
  constructor() {
    this.window = new BrowserWindow({
      width: 1400,
      height: 900,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      }
    });
    
    this.setupIPC();
    this.setupTerminal();
  }
  
  private setupIPC(): void {
    // Register IPC handlers
    ipcMain.handle('file:read', this.handleFileRead);
    ipcMain.handle('file:write', this.handleFileWrite);
  }
}
```

#### Terminal Manager

Manages pseudo-terminal instances using node-pty:

```typescript
class TerminalManager {
  private terminals = new Map<string, IPty>();
  
  create(id: string, shell: string, cwd: string): IPty {
    const pty = spawn(shell, [], { cwd });
    this.terminals.set(id, pty);
    
    pty.onData((data) => {
      this.notifyRenderer(id, data);
    });
    
    return pty;
  }
  
  write(id: string, data: string): void {
    this.terminals.get(id)?.write(data);
  }
  
  kill(id: string): void {
    this.terminals.get(id)?.kill();
    this.terminals.delete(id);
  }
}
```

## Renderer Process

### Responsibilities

- UI rendering with React
- User interaction handling
- Editor state management
- Terminal UI rendering
- IPC communication with main process

### Module Structure

```
src/renderer/
├── index.tsx           # Entry point
├── App.tsx             # Root component
├── components/         # React components
│   ├── common/        # Shared components
│   ├── editor/        # Editor-related
│   ├── sidebar/       # Sidebar panels
│   └── terminal/      # Terminal component
├── hooks/             # Custom React hooks
├── services/          # Business logic
├── utils/             # Utilities
└── styles/            # Global styles
```

### Component Architecture

We follow a hierarchical component structure:

```
App
├── Titlebar
├── MainContainer
│   ├── Sidebar
│   │   ├── FileExplorer
│   │   └── SearchPanel
│   ├── EditorArea
│   │   └── EditorPanel
│   │       ├── TabBar
│   │       └── MonacoEditor
│   └── BottomPanel
│       ├── Terminal
│       ├── Problems
│       └── Output
└── StatusBar
```

### State Management

Local component state with React hooks:

```typescript
// Component-level state
const [editorTabs, setEditorTabs] = useState<EditorTab[]>([]);
const [activeTab, setActiveTab] = useState<string | null>(null);
const [workspace, setWorkspace] = useState<string | null>(null);

// Complex state: Custom hook
function useFileSystem(workspace: string | null) {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  useEffect(() => {
    if (!workspace) return;
    
    loadFiles(workspace).then(setFiles);
  }, [workspace]);
  
  return { files, isLoading };
}
```

## Communication Layer

### IPC (Inter-Process Communication)

All communication between main and renderer uses Electron's IPC mechanism.

#### Channel Naming Convention

```
<domain>:<action>

Examples:
- file:read
- file:write
- file:delete
- dialog:openFolder
- window:minimize
```

#### Type-Safe IPC

```typescript
// shared/types/ipc.ts
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

// Main process
ipcMain.handle('file:read', async (_, { path }) => {
  return fs.readFile(path, 'utf-8');
});

// Renderer process
const content = await ipcRenderer.invoke('file:read', { path });
```

### Event Flow

```
User Action
    │
    ▼
┌──────────────┐
│   React UI   │
└──────────────┘
    │
    ▼
┌──────────────┐
│  IPC Invoke  │
└──────────────┘
    │
    ▼
┌──────────────┐
│ Main Process │
│   Handler    │
└──────────────┘
    │
    ▼
┌──────────────┐
│   OS/File    │
│   System     │
└──────────────┘
    │
    ▼
Response (async)
    │
    ▼
Update UI State
```

## Data Flow

### File Operations Flow

```typescript
// 1. User selects file in sidebar
const handleFileSelect = async (path: string) => {
  // 2. Invoke IPC to read file
  const content = await window.api.readFile(path);
  
  // 3. Create new tab
  const tab: EditorTab = {
    id: generateId(),
    filePath: path,
    content,
    isDirty: false
  };
  
  // 4. Update state
  setTabs(prev => [...prev, tab]);
  setActiveTab(tab.id);
};

// 5. User edits content
const handleContentChange = (tabId: string, newContent: string) => {
  setTabs(prev => prev.map(tab => 
    tab.id === tabId 
      ? { ...tab, content: newContent, isDirty: true }
      : tab
  ));
};

// 6. User saves file
const handleSave = async (tabId: string) => {
  const tab = tabs.find(t => t.id === tabId);
  if (!tab) return;
  
  await window.api.writeFile(tab.filePath, tab.content);
  
  setTabs(prev => prev.map(t => 
    t.id === tabId ? { ...t, isDirty: false } : t
  ));
};
```

### State Management Pattern

We use a unidirectional data flow:

```
┌─────────────┐
│   State     │
│  (useState) │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Render    │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Event     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Update    │
│   State     │
└─────────────┘
```

## Security Model

### Threat Model

1. **Arbitrary Code Execution**: Prevent execution of untrusted code
2. **Path Traversal**: Validate all file paths
3. **IPC Injection**: Validate all IPC messages
4. **Prototype Pollution**: Use strict TypeScript checks

### Security Measures

#### Path Validation

```typescript
function validatePath(inputPath: string, workspaceRoot: string): string {
  const resolvedPath = path.resolve(inputPath);
  const resolvedRoot = path.resolve(workspaceRoot);
  
  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new SecurityError('Path outside workspace');
  }
  
  return resolvedPath;
}
```

#### IPC Input Validation

```typescript
import { z } from 'zod';

const ReadFileSchema = z.object({
  path: z.string().min(1),
  encoding: z.enum(['utf-8', 'ascii', 'base64']).optional()
});

ipcMain.handle('file:read', async (_, data) => {
  const { path, encoding } = ReadFileSchema.parse(data);
  // Now safe to use
  return fs.readFile(path, encoding);
});
```

#### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  connect-src 'self';
">
```

## Extension Points

### Plugin Architecture (Planned)

```typescript
interface Plugin {
  id: string;
  name: string;
  version: string;
  activate(context: PluginContext): void;
  deactivate(): void;
}

interface PluginContext {
  registerCommand(command: string, handler: Function): void;
  registerFileProvider(provider: FileProvider): void;
  subscribeToEvent(event: string, handler: Function): void;
}
```

### Language Server Protocol (LSP)

Integration with LSP for language support:

```typescript
interface LanguageServer {
  initialize(workspacePath: string): Promise<void>;
  provideCompletions(file: string, position: Position): Promise<Completion[]>;
  provideDiagnostics(file: string): Promise<Diagnostic[]>;
}
```

## Performance Considerations

### Bundle Optimization

- **Code Splitting**: Lazy load heavy components
- **Tree Shaking**: Remove unused code
- **Asset Optimization**: Compress images and fonts

```typescript
// Lazy load Monaco Editor
const MonacoEditor = lazy(() => import('./MonacoEditor'));

// Lazy load terminal
const TerminalPanel = lazy(() => import('./TerminalPanel'));
```

### Memory Management

- Dispose of Monaco editor instances
- Clean up IPC event listeners
- Limit number of open tabs
- Implement LRU cache for file contents

```typescript
useEffect(() => {
  const disposable = monaco.editor.createModel(content, language);
  
  return () => {
    disposable.dispose();
  };
}, [content, language]);
```

### Rendering Optimization

- Use `React.memo` for pure components
- Virtualize long lists (file explorer)
- Debounce expensive operations (search)
- Throttle UI updates (terminal output)

```typescript
// Memoized component
export const FileItem = memo<FileItemProps>(({ file, onClick }) => {
  return <div onClick={onClick}>{file.name}</div>;
});

// Debounced search
const debouncedSearch = useMemo(
  () => debounce((query: string) => performSearch(query), 300),
  []
);
```

## Error Handling

### Error Boundaries

```typescript
class EditorErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  
  componentDidCatch(error: Error, info: ErrorInfo) {
    logError(error, info);
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
```

### IPC Error Handling

```typescript
ipcMain.handle('file:read', async (_, { path }) => {
  try {
    return await fs.readFile(path, 'utf-8');
  } catch (error) {
    throw new IPCError('FILE_READ_ERROR', error.message, { path });
  }
});

// Renderer error handling
try {
  const content = await window.api.readFile(path);
} catch (error) {
  if (error.code === 'FILE_READ_ERROR') {
    showNotification('Failed to read file');
  }
}
```

## Testing Strategy

### Unit Tests

Test individual functions and components:

```typescript
describe('FileExplorer', () => {
  it('should sort files alphabetically', () => {
    const files = [{ name: 'z.ts' }, { name: 'a.ts' }];
    const sorted = sortFiles(files);
    expect(sorted[0].name).toBe('a.ts');
  });
});
```

### Integration Tests

Test IPC communication:

```typescript
describe('File IPC', () => {
  it('should read file through IPC', async () => {
    const content = await ipcRenderer.invoke('file:read', { 
      path: testFile 
    });
    expect(content).toBe('test content');
  });
});
```

### E2E Tests

Use Playwright for full application testing:

```typescript
test('open and edit file', async ({ page }) => {
  await page.click('[data-testid="file-explorer"]');
  await page.click('text=example.ts');
  await page.fill('.monaco-editor', 'new content');
  await page.keyboard.press('Meta+S');
  
  const content = await fs.readFile(testFile, 'utf-8');
  expect(content).toBe('new content');
});
```

## Build System

### Webpack Configuration

```javascript
// webpack.config.js
module.exports = {
  target: 'electron-renderer',
  entry: './src/renderer/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'renderer.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  plugins: [
    new MonacoWebpackPlugin()
  ]
};
```

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  }
}
```

## Deployment

### Electron Builder

```json
{
  "build": {
    "appId": "com.traitor.ide",
    "productName": "Traitor IDE",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "node_modules/**/*"
    ],
    "mac": {
      "target": "dmg"
    },
    "win": {
      "target": "nsis"
    },
    "linux": {
      "target": "AppImage"
    }
  }
}
```

---

For questions or suggestions about the architecture, please open an issue or discussion.
