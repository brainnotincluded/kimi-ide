# Git Integration for Traitor IDE

Comprehensive Git integration for Traitor IDE, similar to VS Code's Git features.

## Features

- **Git Operations**: status, stage, unstage, commit, push, pull, fetch
- **Branch Management**: list, checkout, create, delete, merge branches
- **History & Blame**: commit log, file blame annotations
- **Diff Viewing**: file diffs, inline decorations
- **UI Components**: Source Control panel, Status Bar, Inline decorations

## Installation

```bash
npm install simple-git
```

## Usage

### Main Process Setup

```typescript
import { setupGitIPCHandlers, cleanupGitProviders } from './git';

// In your main process initialization
setupGitIPCHandlers();

// Cleanup on app quit
app.on('before-quit', () => {
  cleanupGitProviders();
});
```

### Renderer Process API

```typescript
import { git } from './git';

// Initialize git for workspace
const result = await git.init('/path/to/workspace');
if (result.success) {
  console.log('Repository root:', result.data?.root);
}

// Get status
const statusResult = await git.getStatus('/path/to/workspace');
if (statusResult.success) {
  console.log('Current branch:', statusResult.data?.branch);
  console.log('Modified files:', statusResult.data?.modified);
  console.log('Staged files:', statusResult.data?.staged);
}

// Stage files
await git.stage('/path/to/workspace', ['file1.ts', 'file2.ts']);

// Commit
await git.commit('/path/to/workspace', 'My commit message');

// Push/Pull
await git.push('/path/to/workspace');
await git.pull('/path/to/workspace');

// Branch operations
const branches = await git.getBranches('/path/to/workspace');
await git.checkout('/path/to/workspace', 'feature-branch');
await git.createBranch('/path/to/workspace', 'new-branch', true);

// Get log
const log = await git.getLog('/path/to/workspace', 20);

// Get blame
const blame = await git.getBlame('/path/to/workspace', 'src/file.ts');

// Get diff
const diff = await git.getDiff('/path/to/workspace', 'src/file.ts');
```

### UI Components

#### Source Control Panel

```typescript
import { createSourceControlPanel } from './git/ui';

const container = document.getElementById('source-control-panel');

const panel = createSourceControlPanel(container, '/path/to/workspace', {
  onFileSelect: (file) => {
    // Open file in editor
    openFile(file.path);
  },
  onStage: (files) => {
    git.stage('/path/to/workspace', files);
  },
  onUnstage: (files) => {
    git.unstage('/path/to/workspace', files);
  },
  onCommit: (message) => {
    git.commit('/path/to/workspace', message);
    panel.updateState({ message: '', isCommitting: false });
  },
  onSync: () => {
    git.pull('/path/to/workspace').then(() => git.push('/path/to/workspace'));
  },
  onBranchChange: (branch) => {
    git.checkout('/path/to/workspace', branch);
  },
  onDiscard: (file) => {
    git.discard('/path/to/workspace', file);
  },
  onRefresh: async () => {
    const status = await git.getStatus('/path/to/workspace');
    if (status.success) {
      panel.updateStatus(status.data);
    }
  },
});

// Update panel when git status changes
const status = await git.getStatus('/path/to/workspace');
if (status.success) {
  panel.updateStatus(status.data);
}
```

#### Git Status Bar

```typescript
import { createGitStatusBar } from './git/ui';

const container = document.getElementById('status-bar-git');

const statusBar = createGitStatusBar(container, {
  onBranchClick: () => {
    // Show branch selector
  },
  onChangesClick: () => {
    // Focus source control panel
  },
  onSyncClick: () => {
    // Sync (pull + push)
  },
});

// Update from git status
const status = await git.getStatus('/path/to/workspace');
if (status.success) {
  statusBar.updateFromStatus(status.data);
}
```

#### Inline Decorations

```typescript
import { 
  createInlineDecorations, 
  createMonacoIntegration 
} from './git/ui';

// With Monaco Editor
const editor = monaco.editor.create(container, options);
const decorations = createInlineDecorations(
  createMonacoIntegration(editor),
  container
);

// Apply diff
const diff = await git.getDiff('/path/to/workspace', 'src/file.ts');
if (diff.success && diff.data) {
  for (const d of diff.data) {
    decorations.applyDiff(d);
  }
}

// Show blame
toggleBlameButton.addEventListener('click', async () => {
  if (decorations['isBlameVisible']) {
    decorations.hideBlame();
  } else {
    const blame = await git.getBlame('/path/to/workspace', 'src/file.ts');
    if (blame.success) {
      decorations.showBlame(blame.data);
    }
  }
});
```

## IPC Channels

All git operations are available via IPC:

| Channel | Params | Return |
|---------|--------|--------|
| `git:init` | `workspaceRoot: string` | `GitResult<RepositoryInfo>` |
| `git:initRepo` | `workspaceRoot: string` | `GitResult<void>` |
| `git:status` | `workspaceRoot: string` | `GitResult<GitStatus>` |
| `git:stage` | `workspaceRoot: string, files: string[]` | `GitResult<void>` |
| `git:unstage` | `workspaceRoot: string, files: string[]` | `GitResult<void>` |
| `git:commit` | `workspaceRoot: string, message: string, amend?: boolean` | `GitResult<string>` |
| `git:push` | `workspaceRoot: string, remote?: string, branch?: string, force?: boolean` | `GitResult<void>` |
| `git:pull` | `workspaceRoot: string, remote?: string, branch?: string, rebase?: boolean` | `GitResult<void>` |
| `git:fetch` | `workspaceRoot: string, remote?: string, prune?: boolean` | `GitResult<void>` |
| `git:getBranches` | `workspaceRoot: string` | `GitResult<GitBranch[]>` |
| `git:checkout` | `workspaceRoot: string, branch: string, create?: boolean` | `GitResult<void>` |
| `git:createBranch` | `workspaceRoot: string, branch: string, checkout?: boolean` | `GitResult<void>` |
| `git:deleteBranch` | `workspaceRoot: string, branch: string, force?: boolean` | `GitResult<void>` |
| `git:getLog` | `workspaceRoot: string, count?: number` | `GitResult<GitCommit[]>` |
| `git:getBlame` | `workspaceRoot: string, filePath: string` | `GitResult<GitBlame>` |
| `git:getDiff` | `workspaceRoot: string, filePath?: string, staged?: boolean` | `GitResult<GitDiff[]>` |
| `git:getDiffBetween` | `workspaceRoot: string, from: string, to: string` | `GitResult<GitDiff[]>` |
| `git:discard` | `workspaceRoot: string, filePath: string` | `GitResult<void>` |
| `git:discardAll` | `workspaceRoot: string` | `GitResult<void>` |
| `git:clean` | `workspaceRoot: string, force?: boolean` | `GitResult<void>` |
| `git:merge` | `workspaceRoot: string, branch: string, noFastForward?: boolean` | `GitResult<void>` |
| `git:getRemotes` | `workspaceRoot: string` | `GitRemote[]` |
| `git:addRemote` | `workspaceRoot: string, name: string, url: string` | `GitResult<void>` |
| `git:removeRemote` | `workspaceRoot: string, name: string` | `GitResult<void>` |
| `git:getCurrentBranch` | `workspaceRoot: string` | `string \| null` |
| `git:stash` | `workspaceRoot: string, message?: string` | `GitResult<void>` |
| `git:stashPop` | `workspaceRoot: string, index?: number` | `GitResult<void>` |
| `git:stashList` | `workspaceRoot: string` | `GitResult<Array<{index, message, hash}>>` |
| `git:clone` | `url: string, localPath: string, options?: {...}` | `GitResult<void>` |
| `git:updateConfig` | `workspaceRoot: string, config: Partial<GitConfiguration>` | `GitConfiguration` |
| `git:getConfig` | `workspaceRoot: string` | `GitConfiguration` |
| `git:isRepo` | `workspaceRoot: string` | `boolean` |

## Types

```typescript
import { 
  GitFile, 
  GitFileStatus, 
  GitStatus, 
  GitBranch, 
  GitCommit, 
  GitBlame, 
  GitBlameLine,
  GitDiff, 
  GitDiffHunk, 
  GitDiffLine,
  RepositoryInfo, 
  GitRemote, 
  GitResult,
  GitConfiguration,
  InlineDecoration,
  LineChangeType,
  SourceControlState,
} from './git';
```

## Configuration

```typescript
import { git, DEFAULT_GIT_CONFIG } from './git';

// Update config
await git.updateConfig('/path/to/workspace', {
  autoFetch: true,
  autoFetchInterval: 5, // minutes
  showInlineBlame: true,
  showInlineDiff: true,
  confirmSync: true,
  confirmCommit: false,
});

// Get current config
const config = await git.getConfig('/path/to/workspace');
```

## License

MIT
