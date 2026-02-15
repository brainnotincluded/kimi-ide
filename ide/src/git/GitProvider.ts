/**
 * GitProvider
 * Main service for Git operations using simple-git
 */

import * as path from 'path';
import * as fs from 'fs';
import { simpleGit, SimpleGit, StatusResult, DefaultLogFields, ListLogLine } from 'simple-git';
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
  DEFAULT_GIT_CONFIG,
} from './types';

export class GitProvider {
  private git: SimpleGit | null = null;
  private repoPath: string | null = null;
  private config: GitConfiguration = DEFAULT_GIT_CONFIG;
  private autoFetchInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize git provider with repository path
   */
  async init(repoPath: string): Promise<GitResult<RepositoryInfo>> {
    try {
      // Check if path exists
      if (!fs.existsSync(repoPath)) {
        return { success: false, error: `Path does not exist: ${repoPath}` };
      }

      // Check if it's a git repository
      const gitDir = path.join(repoPath, '.git');
      const isRepo = fs.existsSync(gitDir);

      this.git = simpleGit(repoPath);
      this.repoPath = repoPath;

      if (!isRepo) {
        // Check if inside a git repository
        try {
          const root = await this.git.revparse(['--show-toplevel']);
          this.repoPath = root.trim();
          this.git = simpleGit(this.repoPath);
        } catch {
          return {
            success: false,
            error: 'Not a git repository',
          };
        }
      }

      // Check if git is actually working
      await this.git.status();

      const remotes = await this.getRemotes();

      // Setup auto-fetch if enabled
      if (this.config.autoFetch) {
        this.setupAutoFetch();
      }

      return {
        success: true,
        data: {
          path: repoPath,
          root: this.repoPath,
          isRepo: true,
          remotes,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize git: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Initialize a new git repository
   */
  async initRepo(repoPath: string): Promise<GitResult<void>> {
    try {
      const git = simpleGit(repoPath);
      await git.init();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to init repository: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Check if provider is initialized
   */
  isInitialized(): boolean {
    return this.git !== null && this.repoPath !== null;
  }

  /**
   * Get current repository path
   */
  getRepoPath(): string | null {
    return this.repoPath;
  }

  /**
   * Get git status
   */
  async getStatus(): Promise<GitResult<GitStatus>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      const status: StatusResult = await this.git.status();

      const files: GitFile[] = [
        ...status.modified.map((f) => ({ path: f, status: 'M' as GitFileStatus, staged: false })),
        ...status.not_added.map((f) => ({ path: f, status: '??' as GitFileStatus, staged: false })),
        ...status.deleted.map((f) => ({ path: f, status: 'D' as GitFileStatus, staged: false })),
        ...status.renamed.map((f) => ({
          path: f.to,
          originalPath: f.from,
          status: 'R' as GitFileStatus,
          staged: false,
        })),
        ...status.conflicted.map((f) => ({ path: f, status: 'U' as GitFileStatus, staged: false })),
        ...status.staged.map((f) => {
          // Check the actual status in staged
          if (status.created.includes(f)) {
            return { path: f, status: 'A' as GitFileStatus, staged: true };
          } else if (status.deleted.includes(f)) {
            return { path: f, status: 'D' as GitFileStatus, staged: true };
          } else if (status.renamed.find((r) => r.to === f)) {
            const rename = status.renamed.find((r) => r.to === f)!;
            return { path: f, originalPath: rename.from, status: 'R' as GitFileStatus, staged: true };
          }
          return { path: f, status: 'M' as GitFileStatus, staged: true };
        }),
      ];

      // Remove duplicates (staged files might appear in other lists)
      const uniqueFiles = new Map<string, GitFile>();
      for (const file of files) {
        const key = `${file.path}:${file.staged}`;
        if (!uniqueFiles.has(key)) {
          uniqueFiles.set(key, file);
        }
      }

      const allFiles = Array.from(uniqueFiles.values());

      return {
        success: true,
        data: {
          branch: status.current || 'HEAD',
          ahead: status.ahead,
          behind: status.behind,
          files: allFiles,
          modified: allFiles.filter((f) => !f.staged && f.status === 'M'),
          staged: allFiles.filter((f) => f.staged),
          untracked: allFiles.filter((f) => f.status === '??'),
          conflicted: allFiles.filter((f) => f.status === 'U'),
          isClean: status.isClean(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get status: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Stage files
   */
  async stage(files: string[]): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      await this.git.add(files);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to stage files: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Unstage files
   */
  async unstage(files: string[]): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      await this.git.reset(['--', ...files]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to unstage files: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Commit with message
   */
  async commit(message: string, amend?: boolean): Promise<GitResult<string>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      const result = await this.git.commit(message, undefined, { '--amend': amend });
      return {
        success: true,
        data: result.commit,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to commit: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Push to remote
   */
  async push(remote?: string, branch?: string, force?: boolean): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      const pushOptions: string[] = [];
      if (force) {
        pushOptions.push('--force');
      }
      
      if (remote && branch) {
        await this.git.push(remote, branch, pushOptions);
      } else {
        await this.git.push(pushOptions);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to push: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Pull from remote
   */
  async pull(remote?: string, branch?: string, rebase?: boolean): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      const pullOptions: string[] = [];
      if (rebase) {
        pullOptions.push('--rebase');
      }

      if (remote && branch) {
        await this.git.pull(remote, branch, pullOptions);
      } else {
        await this.git.pull(pullOptions);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to pull: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Fetch from remote
   */
  async fetch(remote?: string, prune?: boolean): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      const fetchOptions: string[] = [];
      if (prune) {
        fetchOptions.push('--prune');
      }

      if (remote) {
        await this.git.fetch(remote, fetchOptions);
      } else {
        await this.git.fetch(fetchOptions);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to fetch: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get list of branches
   */
  async getBranches(): Promise<GitResult<GitBranch[]>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      const branchSummary = await this.git.branch(['-vv']);

      const branches: GitBranch[] = branchSummary.all.map((name) => {
        const branch = branchSummary.branches[name];
        return {
          name: branch.name,
          current: branch.current,
          remote: branch.label?.match(/\[([^\/]+)\//)?.[1],
          remoteTracking: branch.label?.match(/\[([^\]]+)\]/)?.[1],
          ahead: branch.label?.includes('ahead') 
            ? parseInt(branch.label.match(/ahead\s+(\d+)/)?.[1] || '0')
            : 0,
          behind: branch.label?.includes('behind')
            ? parseInt(branch.label.match(/behind\s+(\d+)/)?.[1] || '0')
            : 0,
        };
      });

      return {
        success: true,
        data: branches,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get branches: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Checkout branch
   */
  async checkout(branch: string, create?: boolean): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      if (create) {
        await this.git.checkout(['-b', branch]);
      } else {
        await this.git.checkout(branch);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to checkout: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Create branch
   */
  async createBranch(branch: string, checkout?: boolean): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      await this.git.checkoutBranch(branch, 'HEAD');
      if (!checkout) {
        await this.git.checkout('-');
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create branch: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Delete branch
   */
  async deleteBranch(branch: string, force?: boolean): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      if (force) {
        await this.git.deleteLocalBranch(branch, true);
      } else {
        await this.git.deleteLocalBranch(branch, false);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to delete branch: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get commit log
   */
  async getLog(count: number = 50): Promise<GitResult<GitCommit[]>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      const log = await this.git.log<DefaultLogFields & ListLogLine>({ maxCount: count });

      const commits: GitCommit[] = log.all.map((commit) => ({
        hash: commit.hash,
        shortHash: commit.hash.substring(0, 7),
        message: commit.message,
        author: commit.author_name,
        email: commit.author_email,
        date: new Date(commit.date),
        refs: commit.refs ? commit.refs.split(',').map((r) => r.trim()).filter(Boolean) : [],
      }));

      return {
        success: true,
        data: commits,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get log: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get blame for file
   */
  async getBlame(filePath: string): Promise<GitResult<GitBlame>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      const blame = await this.git.raw(['blame', '--porcelain', filePath]);
      const lines = blame.split('\n');

      const blameLines: GitBlameLine[] = [];
      let currentHash = '';
      let currentAuthor = '';
      let currentEmail = '';
      let currentDate = new Date();
      let contentIndex = 0;

      for (const line of lines) {
        if (line.startsWith('\t')) {
          // Content line
          blameLines.push({
            line: contentIndex + 1,
            hash: currentHash,
            author: currentAuthor,
            email: currentEmail,
            date: currentDate,
            content: line.substring(1),
          });
          contentIndex++;
        } else if (line.match(/^[0-9a-f]{40} /)) {
          // Header line with hash
          const parts = line.split(' ');
          currentHash = parts[0];
        } else if (line.startsWith('author ')) {
          currentAuthor = line.substring(7);
        } else if (line.startsWith('author-mail ')) {
          currentEmail = line.substring(12).replace(/[<>]/g, '');
        } else if (line.startsWith('author-time ')) {
          currentDate = new Date(parseInt(line.substring(12)) * 1000);
        }
      }

      return {
        success: true,
        data: {
          file: filePath,
          lines: blameLines,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get blame: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get diff for file or all changes
   */
  async getDiff(filePath?: string, staged?: boolean): Promise<GitResult<GitDiff[]>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      const args = ['diff', '--no-color'];
      if (staged) {
        args.push('--staged');
      }
      if (filePath) {
        args.push('--', filePath);
      }

      const diffOutput = await this.git.raw(args);
      const diffs = this.parseDiff(diffOutput);

      return {
        success: true,
        data: diffs,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get diff: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get diff between two commits/branches
   */
  async getDiffBetween(from: string, to: string): Promise<GitResult<GitDiff[]>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      const diffOutput = await this.git.diff([from, to]);
      const diffs = this.parseDiff(diffOutput);

      return {
        success: true,
        data: diffs,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get diff: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Discard changes in file
   */
  async discard(filePath: string): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      await this.git.checkout(['--', filePath]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to discard changes: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Discard all changes
   */
  async discardAll(): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      await this.git.reset(['--hard']);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to discard all changes: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Clean untracked files
   */
  async clean(force?: boolean): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      if (force) {
        await this.git.clean('f', ['-d']);
      } else {
        await this.git.clean('n', ['-d']);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to clean: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Merge branch
   */
  async merge(branch: string, noFastForward?: boolean): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      const mergeOptions: string[] = [];
      if (noFastForward) {
        mergeOptions.push('--no-ff');
      }

      await this.git.merge([branch, ...mergeOptions]);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to merge: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get remotes
   */
  async getRemotes(): Promise<GitRemote[]> {
    if (!this.git) {
      return [];
    }

    try {
      const remotes = await this.git.getRemotes(true);
      return remotes.map((r) => ({
        name: r.name,
        url: r.refs.fetch || r.refs.push || '',
        fetch: !!r.refs.fetch,
        push: !!r.refs.push,
      }));
    } catch {
      return [];
    }
  }

  /**
   * Add remote
   */
  async addRemote(name: string, url: string): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      await this.git.addRemote(name, url);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to add remote: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Remove remote
   */
  async removeRemote(name: string): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      await this.git.removeRemote(name);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to remove remote: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(): Promise<string | null> {
    if (!this.git) {
      return null;
    }

    try {
      const branch = await this.git.revparse(['--abbrev-ref', 'HEAD']);
      return branch.trim();
    } catch {
      return null;
    }
  }

  /**
   * Stash changes
   */
  async stash(message?: string): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      if (message) {
        await this.git.stash(['save', message]);
      } else {
        await this.git.stash();
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to stash: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Pop stash
   */
  async stashPop(index?: number): Promise<GitResult<void>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      if (index !== undefined) {
        await this.git.stash(['pop', `stash@{${index}}`]);
      } else {
        await this.git.stash(['pop']);
      }
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to pop stash: ${(error as Error).message}`,
      };
    }
  }

  /**
   * List stashes
   */
  async stashList(): Promise<GitResult<Array<{ index: number; message: string; hash: string }>>> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      const list = await this.git.stashList();
      const stashes = list.all.map((stash, index) => ({
        index,
        message: stash.message,
        hash: stash.hash,
      }));

      return {
        success: true,
        data: stashes,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to list stashes: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Clone repository
   */
  async clone(url: string, localPath: string, options?: { depth?: number; branch?: string }): Promise<GitResult<void>> {
    try {
      const git = simpleGit();
      const args: string[] = [];

      if (options?.depth) {
        args.push('--depth', options.depth.toString());
      }
      if (options?.branch) {
        args.push('--branch', options.branch);
      }

      await git.clone(url, localPath, args);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: `Failed to clone: ${(error as Error).message}`,
      };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<GitConfiguration>): void {
    this.config = { ...this.config, ...config };

    // Update auto-fetch
    if (this.config.autoFetch && !this.autoFetchInterval) {
      this.setupAutoFetch();
    } else if (!this.config.autoFetch && this.autoFetchInterval) {
      this.clearAutoFetch();
    }
  }

  /**
   * Get configuration
   */
  getConfig(): GitConfiguration {
    return { ...this.config };
  }

  /**
   * Setup auto-fetch interval
   */
  private setupAutoFetch(): void {
    this.clearAutoFetch();
    const intervalMs = this.config.autoFetchInterval * 60 * 1000;
    this.autoFetchInterval = setInterval(() => {
      this.fetch();
    }, intervalMs);
  }

  /**
   * Clear auto-fetch interval
   */
  private clearAutoFetch(): void {
    if (this.autoFetchInterval) {
      clearInterval(this.autoFetchInterval);
      this.autoFetchInterval = null;
    }
  }

  /**
   * Parse diff output
   */
  private parseDiff(diffOutput: string): GitDiff[] {
    const diffs: GitDiff[] = [];
    const lines = diffOutput.split('\n');

    let currentDiff: GitDiff | null = null;
    let currentHunk: GitDiffHunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        // Start of new diff
        if (currentDiff) {
          diffs.push(currentDiff);
        }
        
        const match = line.match(/diff --git a\/(.+) b\/(.+)/);
        currentDiff = {
          oldPath: match?.[1] || '',
          newPath: match?.[2] || '',
          hunks: [],
          isNew: false,
          isDeleted: false,
          isRename: false,
        };
        currentHunk = null;
      } else if (line.startsWith('new file mode')) {
        if (currentDiff) {
          currentDiff.isNew = true;
          currentDiff.oldPath = '/dev/null';
        }
      } else if (line.startsWith('deleted file mode')) {
        if (currentDiff) {
          currentDiff.isDeleted = true;
          currentDiff.newPath = '/dev/null';
        }
      } else if (line.startsWith('rename from')) {
        if (currentDiff) {
          currentDiff.isRename = true;
          currentDiff.oldPath = line.substring(12);
        }
      } else if (line.startsWith('rename to')) {
        if (currentDiff) {
          currentDiff.newPath = line.substring(10);
        }
      } else if (line.startsWith('similarity index')) {
        if (currentDiff) {
          currentDiff.similarity = parseInt(line.match(/(\d+)/)?.[1] || '0');
        }
      } else if (line.startsWith('@@')) {
        // Hunk header
        const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
        if (match && currentDiff) {
          oldLineNum = parseInt(match[1]);
          newLineNum = parseInt(match[3]);
          const oldLines = parseInt(match[2] || '1');
          const newLines = parseInt(match[4] || '1');

          currentHunk = {
            oldStart: oldLineNum,
            oldLines: oldLines,
            newStart: newLineNum,
            newLines: newLines,
            header: line,
            lines: [],
          };
          currentDiff.hunks.push(currentHunk);
        }
      } else if (currentHunk) {
        // Diff line
        const type = line.startsWith('+') ? 'added' : line.startsWith('-') ? 'deleted' : 'unchanged';
        const content = line.substring(1);

        const diffLine: GitDiffLine = {
          type,
          content,
        };

        if (type === 'deleted') {
          diffLine.oldLineNumber = oldLineNum++;
        } else if (type === 'added') {
          diffLine.newLineNumber = newLineNum++;
        } else {
          diffLine.oldLineNumber = oldLineNum++;
          diffLine.newLineNumber = newLineNum++;
        }

        currentHunk.lines.push(diffLine);
      }
    }

    if (currentDiff) {
      diffs.push(currentDiff);
    }

    return diffs;
  }

  /**
   * Dispose and cleanup
   */
  dispose(): void {
    this.clearAutoFetch();
    this.git = null;
    this.repoPath = null;
  }
}

// Singleton instance
let providerInstance: GitProvider | null = null;

export function getGitProvider(): GitProvider {
  if (!providerInstance) {
    providerInstance = new GitProvider();
  }
  return providerInstance;
}

export function resetGitProvider(): void {
  if (providerInstance) {
    providerInstance.dispose();
    providerInstance = null;
  }
}
