# Refactoring Quick Reference

## Import Mappings

### Main Process

| Old Import | New Import |
|------------|------------|
| `import './main'` | `import './main/index'` |
| IPC handlers from `main.ts` | `import { registerIPCHandlers } from './main/ipc'` |
| Window functions | `import { createWindow, sendToRenderer } from './main/window'` |
| Menu functions | `import { createMenu } from './main/menu'` |

### Renderer Components

| Old Import | New Import |
|------------|------------|
| `import { StatusBar } from './components/StatusBar'` | `import { StatusBar } from './components/layout'` |
| `import { Sidebar } from './components/Sidebar'` | `import { Sidebar, ActivityBar } from './components/layout'` |
| `import { FileExplorer } from './components/FileExplorer'` | `import { FileExplorer } from './components/explorer'` |
| `import { TitleBar } from './components/TitleBar'` | `import { TitleBar } from './components/layout'` |

### UI Primitives

```typescript
// Import all UI primitives
import { Button, Icon, Panel, Tabs } from './components/ui';

// Or individually
import { Button } from './components/ui/Button';
```

### Hooks

```typescript
// Import all hooks
import { useWorkspace, useResizer, useEditor } from './hooks';

// Or individually
import { useWorkspace } from './hooks/useWorkspace';
```

### Shared Types

```typescript
// All shared types
import type { 
  FileNode, 
  EditorTab, 
  Problem, 
  GitInfo,
  BottomTab,
  SidebarView 
} from '../shared/types';
```

### Shared Constants

```typescript
import { 
  LAYOUT,           // Layout dimensions
  EDITOR,           // Editor defaults
  LANGUAGE_MAP,     // File ext -> language
  FILE_TYPE_NAMES,  // Human readable names
  IPC_CHANNELS,     // All IPC channels
  EXCLUDED_DIRS     // File explorer exclusions
} from '../shared/constants';

// Usage
const minWidth = LAYOUT.SIDEBAR.MIN_WIDTH;
const channel = IPC_CHANNELS.WORKSPACE.READ_FILE;
```

### Shared Utilities

```typescript
import {
  getFileExtension,
  getFileName,
  getDirectory,
  detectLanguage,
  getFileTypeName,
  formatCursorPosition,
  isExcludedPath,
  debounce,
  throttle,
  formatBytes,
  generateId,
  deepClone,
  deepMerge
} from '../shared/utils';

// Usage
const ext = getFileExtension('/path/to/file.ts');  // 'ts'
const lang = detectLanguage('/path/to/file.ts');   // 'typescript'
```

## New Component APIs

### Button

```tsx
import { Button } from './components/ui';

// Variants: 'primary' | 'secondary' | 'ghost' | 'icon'
// Sizes: 'sm' | 'md' | 'lg'

<Button variant="primary" size="md" onClick={handleClick}>
  Click Me
</Button>
```

### Icon

```tsx
import { Icon } from './components/ui';

// Built-in icons: folder, file, search, git, debug, extensions, etc.
<Icon name="folder" size={16} />
```

### Panel

```tsx
import { Panel } from './components/ui';

<Panel title="Explorer" headerActions={<button>X</button>}>
  Content here
</Panel>
```

### StatusBar (Refactored)

```tsx
import { StatusBar } from './components/layout';

<StatusBar
  activeFile="/path/to/file.ts"
  fileType="TypeScript"
  cursorPosition={{ line: 10, column: 5 }}
  gitInfo={{ branch: 'main', changes: 3 }}
  aiConnected={true}
  problemsCount={{ errors: 0, warnings: 2, infos: 0 }}
  isDebugging={false}
/>
```

### FileExplorer (Refactored)

```tsx
import { FileExplorer } from './components/explorer';

<FileExplorer
  workspace="/path/to/workspace"
  onFileSelect={(path) => console.log(path)}
  activeFile="/path/to/active.ts"
/>
```

## New Hooks

### useWorkspace

```tsx
import { useWorkspace } from './hooks';

function MyComponent() {
  const { workspace, isLoading, error, openFolder, setWorkspace } = useWorkspace();
  
  return (
    <div>
      {workspace || 'No folder open'}
      <button onClick={openFolder}>Open Folder</button>
    </div>
  );
}
```

### useResizer

```tsx
import { useResizer } from './hooks';

function MyComponent() {
  const { size, isResizing, startResize } = useResizer({
    direction: 'vertical',  // or 'horizontal'
    min: 180,
    max: 400,
    default: 260,
  });
  
  return (
    <div style={{ width: size }}>
      <div onMouseDown={startResize} className="resizer" />
    </div>
  );
}
```

## File Structure Changes

```
Before:                          After:
main/                            main/
  main.ts (514 lines)      →       index.ts (entry)
                                   window.ts (window mgmt)
                                   menu.ts (menu)
                                   ipc/index.ts (IPC handlers)
                                   services/index.ts (services)
                                   utils/index.ts (utilities)

renderer/components/             renderer/components/
  StatusBar.tsx (307)      →       layout/StatusBar/
                                     index.tsx (main)
                                     GitStatus.tsx
                                     CursorPosition.tsx
                                     AIStatus.tsx
                                     ProblemsIndicator.tsx
                                     DebugIndicator.tsx
  
  FileExplorer.tsx (245)   →       explorer/
                                     FileExplorer.tsx
                                     FileTree.tsx
                                     FileNode.tsx
                                     FileIcons.tsx
  
  (no UI primitives)       →       ui/
                                     Button.tsx
                                     Icon.tsx
                                     Panel.tsx
                                     Tabs.tsx
  
  (no shared)              →       panels/
                                     WelcomePanel.tsx
                                     ...more to come

(no shared)                →     shared/
                                   types/index.ts
                                   constants/index.ts
                                   utils/index.ts
```

## Migration Checklist

When updating existing code:

- [ ] Replace inline types with imports from `shared/types`
- [ ] Replace magic numbers with constants from `shared/constants`
- [ ] Replace duplicated utility functions with imports from `shared/utils`
- [ ] Update component imports to use barrel exports
- [ ] Consider using new UI primitives for consistency
- [ ] Use new hooks for workspace and resizing logic
- [ ] Test that imports still work correctly

## Barrel Export Pattern

All new modules follow the barrel export pattern:

```typescript
// In components/ui/index.ts
export { Button } from './Button';
export { Icon } from './Icon';
export { Panel } from './Panel';
export { Tabs, TabItem } from './Tabs';

// Consumer imports
import { Button, Icon, Panel, Tabs } from './components/ui';
```

This provides:
- Clean import paths
- Clear public API
- Easier refactoring
- Better tree-shaking
