/**
 * Git Renderer API
 * API for renderer process to communicate with Git integration
 */

import { ipcRenderer } from 'electron';
import {
  GitStatus,
  GitBranch,
  GitCommit,
  GitBlame,
  GitDiff,
  RepositoryInfo,
  GitRemote,
  GitResult,
  GitConfiguration,
} from './types';

/**
 * Initialize git provider
 */
export async function init(workspaceRoot: string): Promise<GitResult<RepositoryInfo>> {
  return ipcRenderer.invoke('git:init', workspaceRoot);
}

/**
 * Initialize new git repository
 */
export async function initRepo(workspaceRoot: string): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:initRepo', workspaceRoot);
}

/**
 * Get git status
 */
export async function getStatus(workspaceRoot: string): Promise<GitResult<GitStatus>> {
  return ipcRenderer.invoke('git:status', workspaceRoot);
}

/**
 * Stage files
 */
export async function stage(workspaceRoot: string, files: string[]): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:stage', workspaceRoot, files);
}

/**
 * Unstage files
 */
export async function unstage(workspaceRoot: string, files: string[]): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:unstage', workspaceRoot, files);
}

/**
 * Commit changes
 */
export async function commit(
  workspaceRoot: string,
  message: string,
  amend?: boolean
): Promise<GitResult<string>> {
  return ipcRenderer.invoke('git:commit', workspaceRoot, message, amend);
}

/**
 * Push to remote
 */
export async function push(
  workspaceRoot: string,
  remote?: string,
  branch?: string,
  force?: boolean
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:push', workspaceRoot, remote, branch, force);
}

/**
 * Pull from remote
 */
export async function pull(
  workspaceRoot: string,
  remote?: string,
  branch?: string,
  rebase?: boolean
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:pull', workspaceRoot, remote, branch, rebase);
}

/**
 * Fetch from remote
 */
export async function fetch(
  workspaceRoot: string,
  remote?: string,
  prune?: boolean
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:fetch', workspaceRoot, remote, prune);
}

/**
 * Get list of branches
 */
export async function getBranches(workspaceRoot: string): Promise<GitResult<GitBranch[]>> {
  return ipcRenderer.invoke('git:getBranches', workspaceRoot);
}

/**
 * Checkout branch
 */
export async function checkout(
  workspaceRoot: string,
  branch: string,
  create?: boolean
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:checkout', workspaceRoot, branch, create);
}

/**
 * Create branch
 */
export async function createBranch(
  workspaceRoot: string,
  branch: string,
  checkout?: boolean
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:createBranch', workspaceRoot, branch, checkout);
}

/**
 * Delete branch
 */
export async function deleteBranch(
  workspaceRoot: string,
  branch: string,
  force?: boolean
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:deleteBranch', workspaceRoot, branch, force);
}

/**
 * Get commit log
 */
export async function getLog(
  workspaceRoot: string,
  count?: number
): Promise<GitResult<GitCommit[]>> {
  return ipcRenderer.invoke('git:getLog', workspaceRoot, count);
}

/**
 * Get blame for file
 */
export async function getBlame(
  workspaceRoot: string,
  filePath: string
): Promise<GitResult<GitBlame>> {
  return ipcRenderer.invoke('git:getBlame', workspaceRoot, filePath);
}

/**
 * Get diff for file or all changes
 */
export async function getDiff(
  workspaceRoot: string,
  filePath?: string,
  staged?: boolean
): Promise<GitResult<GitDiff[]>> {
  return ipcRenderer.invoke('git:getDiff', workspaceRoot, filePath, staged);
}

/**
 * Get diff between two commits
 */
export async function getDiffBetween(
  workspaceRoot: string,
  from: string,
  to: string
): Promise<GitResult<GitDiff[]>> {
  return ipcRenderer.invoke('git:getDiffBetween', workspaceRoot, from, to);
}

/**
 * Discard changes in file
 */
export async function discard(
  workspaceRoot: string,
  filePath: string
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:discard', workspaceRoot, filePath);
}

/**
 * Discard all changes
 */
export async function discardAll(workspaceRoot: string): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:discardAll', workspaceRoot);
}

/**
 * Clean untracked files
 */
export async function clean(
  workspaceRoot: string,
  force?: boolean
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:clean', workspaceRoot, force);
}

/**
 * Merge branch
 */
export async function merge(
  workspaceRoot: string,
  branch: string,
  noFastForward?: boolean
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:merge', workspaceRoot, branch, noFastForward);
}

/**
 * Get remotes
 */
export async function getRemotes(workspaceRoot: string): Promise<GitRemote[]> {
  return ipcRenderer.invoke('git:getRemotes', workspaceRoot);
}

/**
 * Add remote
 */
export async function addRemote(
  workspaceRoot: string,
  name: string,
  url: string
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:addRemote', workspaceRoot, name, url);
}

/**
 * Remove remote
 */
export async function removeRemote(
  workspaceRoot: string,
  name: string
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:removeRemote', workspaceRoot, name);
}

/**
 * Get current branch
 */
export async function getCurrentBranch(workspaceRoot: string): Promise<string | null> {
  return ipcRenderer.invoke('git:getCurrentBranch', workspaceRoot);
}

/**
 * Stash changes
 */
export async function stash(
  workspaceRoot: string,
  message?: string
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:stash', workspaceRoot, message);
}

/**
 * Pop stash
 */
export async function stashPop(
  workspaceRoot: string,
  index?: number
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:stashPop', workspaceRoot, index);
}

/**
 * List stashes
 */
export async function stashList(
  workspaceRoot: string
): Promise<GitResult<Array<{ index: number; message: string; hash: string }>>> {
  return ipcRenderer.invoke('git:stashList', workspaceRoot);
}

/**
 * Clone repository
 */
export async function clone(
  url: string,
  localPath: string,
  options?: { depth?: number; branch?: string }
): Promise<GitResult<void>> {
  return ipcRenderer.invoke('git:clone', url, localPath, options);
}

/**
 * Update configuration
 */
export async function updateConfig(
  workspaceRoot: string,
  config: Partial<GitConfiguration>
): Promise<GitConfiguration> {
  return ipcRenderer.invoke('git:updateConfig', workspaceRoot, config);
}

/**
 * Get configuration
 */
export async function getConfig(workspaceRoot: string): Promise<GitConfiguration> {
  return ipcRenderer.invoke('git:getConfig', workspaceRoot);
}

/**
 * Check if repository
 */
export async function isRepo(workspaceRoot: string): Promise<boolean> {
  return ipcRenderer.invoke('git:isRepo', workspaceRoot);
}

// Re-export types
export * from './types';
