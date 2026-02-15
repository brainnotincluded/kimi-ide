/**
 * Git IPC Handlers
 * Main process IPC handlers for Git integration
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { GitProvider, getGitProvider, resetGitProvider } from './GitProvider';
import { GitConfiguration } from './types';

// Active providers per workspace
const providers = new Map<string, GitProvider>();

/**
 * Get or create provider for workspace
 */
function getProvider(workspaceRoot: string): GitProvider {
  if (!providers.has(workspaceRoot)) {
    providers.set(workspaceRoot, new GitProvider());
  }
  return providers.get(workspaceRoot)!;
}

/**
 * Setup all IPC handlers for Git integration
 */
export function setupGitIPCHandlers(): void {
  // Initialize git provider
  ipcMain.handle(
    'git:init',
    async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.init(workspaceRoot);
    }
  );

  // Initialize new repository
  ipcMain.handle(
    'git:initRepo',
    async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.initRepo(workspaceRoot);
    }
  );

  // Get git status
  ipcMain.handle(
    'git:status',
    async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.getStatus();
    }
  );

  // Stage files
  ipcMain.handle(
    'git:stage',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, files: string[]) => {
      const provider = getProvider(workspaceRoot);
      return await provider.stage(files);
    }
  );

  // Unstage files
  ipcMain.handle(
    'git:unstage',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, files: string[]) => {
      const provider = getProvider(workspaceRoot);
      return await provider.unstage(files);
    }
  );

  // Commit
  ipcMain.handle(
    'git:commit',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, message: string, amend?: boolean) => {
      const provider = getProvider(workspaceRoot);
      return await provider.commit(message, amend);
    }
  );

  // Push
  ipcMain.handle(
    'git:push',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, remote?: string, branch?: string, force?: boolean) => {
      const provider = getProvider(workspaceRoot);
      return await provider.push(remote, branch, force);
    }
  );

  // Pull
  ipcMain.handle(
    'git:pull',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, remote?: string, branch?: string, rebase?: boolean) => {
      const provider = getProvider(workspaceRoot);
      return await provider.pull(remote, branch, rebase);
    }
  );

  // Fetch
  ipcMain.handle(
    'git:fetch',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, remote?: string, prune?: boolean) => {
      const provider = getProvider(workspaceRoot);
      return await provider.fetch(remote, prune);
    }
  );

  // Get branches
  ipcMain.handle(
    'git:getBranches',
    async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.getBranches();
    }
  );

  // Checkout branch
  ipcMain.handle(
    'git:checkout',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, branch: string, create?: boolean) => {
      const provider = getProvider(workspaceRoot);
      return await provider.checkout(branch, create);
    }
  );

  // Create branch
  ipcMain.handle(
    'git:createBranch',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, branch: string, checkout?: boolean) => {
      const provider = getProvider(workspaceRoot);
      return await provider.createBranch(branch, checkout);
    }
  );

  // Delete branch
  ipcMain.handle(
    'git:deleteBranch',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, branch: string, force?: boolean) => {
      const provider = getProvider(workspaceRoot);
      return await provider.deleteBranch(branch, force);
    }
  );

  // Get commit log
  ipcMain.handle(
    'git:getLog',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, count?: number) => {
      const provider = getProvider(workspaceRoot);
      return await provider.getLog(count);
    }
  );

  // Get blame
  ipcMain.handle(
    'git:getBlame',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, filePath: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.getBlame(filePath);
    }
  );

  // Get diff
  ipcMain.handle(
    'git:getDiff',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, filePath?: string, staged?: boolean) => {
      const provider = getProvider(workspaceRoot);
      return await provider.getDiff(filePath, staged);
    }
  );

  // Get diff between commits
  ipcMain.handle(
    'git:getDiffBetween',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, from: string, to: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.getDiffBetween(from, to);
    }
  );

  // Discard changes
  ipcMain.handle(
    'git:discard',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, filePath: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.discard(filePath);
    }
  );

  // Discard all changes
  ipcMain.handle(
    'git:discardAll',
    async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.discardAll();
    }
  );

  // Clean untracked files
  ipcMain.handle(
    'git:clean',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, force?: boolean) => {
      const provider = getProvider(workspaceRoot);
      return await provider.clean(force);
    }
  );

  // Merge branch
  ipcMain.handle(
    'git:merge',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, branch: string, noFastForward?: boolean) => {
      const provider = getProvider(workspaceRoot);
      return await provider.merge(branch, noFastForward);
    }
  );

  // Get remotes
  ipcMain.handle(
    'git:getRemotes',
    async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.getRemotes();
    }
  );

  // Add remote
  ipcMain.handle(
    'git:addRemote',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, name: string, url: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.addRemote(name, url);
    }
  );

  // Remove remote
  ipcMain.handle(
    'git:removeRemote',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, name: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.removeRemote(name);
    }
  );

  // Get current branch
  ipcMain.handle(
    'git:getCurrentBranch',
    async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.getCurrentBranch();
    }
  );

  // Stash changes
  ipcMain.handle(
    'git:stash',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, message?: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.stash(message);
    }
  );

  // Pop stash
  ipcMain.handle(
    'git:stashPop',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, index?: number) => {
      const provider = getProvider(workspaceRoot);
      return await provider.stashPop(index);
    }
  );

  // List stashes
  ipcMain.handle(
    'git:stashList',
    async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
      const provider = getProvider(workspaceRoot);
      return await provider.stashList();
    }
  );

  // Clone repository
  ipcMain.handle(
    'git:clone',
    async (_: IpcMainInvokeEvent, url: string, localPath: string, options?: { depth?: number; branch?: string }) => {
      return await getGitProvider().clone(url, localPath, options);
    }
  );

  // Update configuration
  ipcMain.handle(
    'git:updateConfig',
    async (_: IpcMainInvokeEvent, workspaceRoot: string, config: Partial<GitConfiguration>) => {
      const provider = getProvider(workspaceRoot);
      provider.updateConfig(config);
      return provider.getConfig();
    }
  );

  // Get configuration
  ipcMain.handle(
    'git:getConfig',
    async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
      const provider = getProvider(workspaceRoot);
      return provider.getConfig();
    }
  );

  // Check if repository
  ipcMain.handle(
    'git:isRepo',
    async (_: IpcMainInvokeEvent, workspaceRoot: string) => {
      const provider = getProvider(workspaceRoot);
      return provider.isInitialized();
    }
  );
}

/**
 * Cleanup all Git providers
 */
export function cleanupGitProviders(): void {
  providers.forEach((provider) => provider.dispose());
  providers.clear();
  resetGitProvider();
}
