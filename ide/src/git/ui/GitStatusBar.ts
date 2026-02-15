/**
 * Git Status Bar
 * Status bar component showing Git information (similar to VS Code)
 */

import { GitStatus, GitBranch, GitFileStatus } from '../types';

/** CSS styles for status bar */
const STYLES = `
  .git-statusbar {
    display: flex;
    align-items: center;
    height: 22px;
    font-size: 12px;
    color: var(--status-bar-foreground, #cccccc);
  }

  .git-statusbar-item {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 8px;
    height: 100%;
    cursor: pointer;
    user-select: none;
    transition: background-color 0.1s ease;
  }

  .git-statusbar-item:hover {
    background-color: var(--status-bar-item-hover-background, #4c4c4c);
  }

  .git-statusbar-item:active {
    background-color: var(--status-bar-item-active-background, #3c3c3c);
  }

  .git-statusbar-icon {
    font-size: 12px;
    opacity: 0.8;
  }

  .git-statusbar-text {
    white-space: nowrap;
  }

  .git-statusbar-branch {
    font-weight: 500;
  }

  .git-statusbar-changes {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .git-statusbar-change {
    display: flex;
    align-items: center;
    gap: 2px;
    font-size: 11px;
  }

  .git-statusbar-change.added { color: #73c991; }
  .git-statusbar-change.modified { color: #e2c08d; }
  .git-statusbar-change.deleted { color: #f48771; }
  .git-statusbar-change.untracked { color: #8c8c8c; }

  .git-statusbar-sync {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .git-statusbar-sync.ahead { color: #73c991; }
  .git-statusbar-sync.behind { color: #f48771; }
  .git-statusbar-sync.diverged { color: #e2c08d; }

  .git-statusbar-loading {
    width: 12px;
    height: 12px;
    border: 2px solid var(--status-bar-foreground, #cccccc);
    border-top-color: transparent;
    border-radius: 50%;
    animation: git-statusbar-spin 1s linear infinite;
  }

  @keyframes git-statusbar-spin {
    to { transform: rotate(360deg); }
  }

  .git-statusbar-tooltip {
    position: absolute;
    bottom: 26px;
    background: var(--tooltip-background, #252526);
    border: 1px solid var(--tooltip-border, #454545);
    border-radius: 4px;
    padding: 8px 12px;
    font-size: 12px;
    color: var(--tooltip-foreground, #cccccc);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    white-space: nowrap;
    z-index: 1000;
    pointer-events: none;
  }

  .git-statusbar-tooltip::after {
    content: '';
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    border-width: 6px 6px 0;
    border-style: solid;
    border-color: var(--tooltip-background, #252526) transparent transparent;
  }
`;

/** Status bar item types */
export type StatusBarItemType = 'branch' | 'changes' | 'sync' | 'loading';

/** Event callbacks */
export interface GitStatusBarCallbacks {
  onBranchClick?: () => void;
  onChangesClick?: () => void;
  onSyncClick?: () => void;
}

/**
 * Git Status Bar class
 */
export class GitStatusBar {
  private container: HTMLElement;
  private callbacks: GitStatusBarCallbacks;
  private branch: string = '';
  private changes: { added: number; modified: number; deleted: number; untracked: number } = {
    added: 0,
    modified: 0,
    deleted: 0,
    untracked: 0,
  };
  private ahead: number = 0;
  private behind: number = 0;
  private isLoading: boolean = false;
  private tooltip: HTMLElement | null = null;

  constructor(container: HTMLElement, callbacks: GitStatusBarCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;

    this.injectStyles();
    this.render();
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    if (!document.getElementById('git-statusbar-styles')) {
      const style = document.createElement('style');
      style.id = 'git-statusbar-styles';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }
  }

  /**
   * Update branch
   */
  updateBranch(branch: string): void {
    this.branch = branch;
    this.render();
  }

  /**
   * Update changes count
   */
  updateChanges(status: GitStatus): void {
    this.changes = {
      added: status.files.filter((f) => f.status === 'A' || (f.staged && !f.status)).length,
      modified: status.files.filter((f) => f.status === 'M').length,
      deleted: status.files.filter((f) => f.status === 'D').length,
      untracked: status.files.filter((f) => f.status === '??').length,
    };
    this.ahead = status.ahead;
    this.behind = status.behind;
    this.render();
  }

  /**
   * Set loading state
   */
  setLoading(loading: boolean): void {
    this.isLoading = loading;
    this.render();
  }

  /**
   * Update from GitStatus
   */
  updateFromStatus(status: GitStatus): void {
    this.branch = status.branch;
    this.updateChanges(status);
  }

  /**
   * Render the status bar
   */
  private render(): void {
    this.container.innerHTML = '';

    const statusBar = document.createElement('div');
    statusBar.className = 'git-statusbar';

    // Branch item
    const branchItem = this.createBranchItem();
    statusBar.appendChild(branchItem);

    // Changes item
    const totalChanges = this.changes.added + this.changes.modified + this.changes.deleted + this.changes.untracked;
    if (totalChanges > 0 || this.isLoading) {
      const changesItem = this.createChangesItem();
      statusBar.appendChild(changesItem);
    }

    // Sync item
    if (this.ahead > 0 || this.behind > 0) {
      const syncItem = this.createSyncItem();
      statusBar.appendChild(syncItem);
    }

    this.container.appendChild(statusBar);
  }

  /**
   * Create branch item
   */
  private createBranchItem(): HTMLElement {
    const item = document.createElement('div');
    item.className = 'git-statusbar-item';
    item.innerHTML = `
      <span class="git-statusbar-icon">🌿</span>
      <span class="git-statusbar-text git-statusbar-branch">${this.branch || 'main'}</span>
    `;
    item.addEventListener('click', () => this.callbacks.onBranchClick?.());
    this.setupTooltip(item, `Current branch: ${this.branch || 'main'}`);
    return item;
  }

  /**
   * Create changes item
   */
  private createChangesItem(): HTMLElement {
    const item = document.createElement('div');
    item.className = 'git-statusbar-item';

    if (this.isLoading) {
      item.innerHTML = `
        <span class="git-statusbar-loading"></span>
        <span class="git-statusbar-text">Syncing...</span>
      `;
    } else {
      const changes: string[] = [];
      if (this.changes.added > 0) changes.push(`+${this.changes.added}`);
      if (this.changes.modified > 0) changes.push(`~${this.changes.modified}`);
      if (this.changes.deleted > 0) changes.push(`-${this.changes.deleted}`);

      const total = this.changes.added + this.changes.modified + this.changes.deleted + this.changes.untracked;

      item.innerHTML = `
        <span class="git-statusbar-icon">📄</span>
        <span class="git-statusbar-text">${total}</span>
      `;

      if (changes.length > 0) {
        const changesEl = document.createElement('span');
        changesEl.className = 'git-statusbar-changes';
        changesEl.innerHTML = changes
          .map((c) => `<span class="git-statusbar-change">${c}</span>`)
          .join('');
        item.appendChild(changesEl);
      }
    }

    item.addEventListener('click', () => this.callbacks.onChangesClick?.());

    const tooltipText = this.isLoading
      ? 'Syncing changes...'
      : this.getChangesTooltip();
    this.setupTooltip(item, tooltipText);

    return item;
  }

  /**
   * Create sync item
   */
  private createSyncItem(): HTMLElement {
    const item = document.createElement('div');
    item.className = 'git-statusbar-item';

    let syncClass = '';
    let icon = '🔄';
    let text = '';

    if (this.ahead > 0 && this.behind > 0) {
      syncClass = 'diverged';
      icon = '⇅';
      text = `↓${this.behind} ↑${this.ahead}`;
    } else if (this.ahead > 0) {
      syncClass = 'ahead';
      icon = '↑';
      text = `${this.ahead} to push`;
    } else if (this.behind > 0) {
      syncClass = 'behind';
      icon = '↓';
      text = `${this.behind} to pull`;
    }

    item.classList.add(syncClass);
    item.innerHTML = `
      <span class="git-statusbar-icon">${icon}</span>
      <span class="git-statusbar-text">${text}</span>
    `;

    item.addEventListener('click', () => this.callbacks.onSyncClick?.());

    const tooltipText = this.getSyncTooltip();
    this.setupTooltip(item, tooltipText);

    return item;
  }

  /**
   * Get changes tooltip text
   */
  private getChangesTooltip(): string {
    const parts: string[] = [];
    if (this.changes.added > 0) parts.push(`${this.changes.added} added`);
    if (this.changes.modified > 0) parts.push(`${this.changes.modified} modified`);
    if (this.changes.deleted > 0) parts.push(`${this.changes.deleted} deleted`);
    if (this.changes.untracked > 0) parts.push(`${this.changes.untracked} untracked`);

    if (parts.length === 0) return 'No changes';
    return `Changes: ${parts.join(', ')}`;
  }

  /**
   * Get sync tooltip text
   */
  private getSyncTooltip(): string {
    if (this.ahead > 0 && this.behind > 0) {
      return `${this.behind} commits behind, ${this.ahead} commits ahead. Click to sync.`;
    } else if (this.ahead > 0) {
      return `${this.ahead} commits to push. Click to push.`;
    } else if (this.behind > 0) {
      return `${this.behind} commits to pull. Click to pull.`;
    }
    return 'Synchronized';
  }

  /**
   * Setup tooltip for element
   */
  private setupTooltip(element: HTMLElement, text: string): void {
    element.addEventListener('mouseenter', () => {
      this.showTooltip(element, text);
    });
    element.addEventListener('mouseleave', () => {
      this.hideTooltip();
    });
  }

  /**
   * Show tooltip
   */
  private showTooltip(anchor: HTMLElement, text: string): void {
    this.hideTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'git-statusbar-tooltip';
    tooltip.textContent = text;

    document.body.appendChild(tooltip);

    // Position tooltip
    const anchorRect = anchor.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    const left = anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2;
    const top = anchorRect.top - tooltipRect.height - 8;

    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;

    this.tooltip = tooltip;
  }

  /**
   * Hide tooltip
   */
  private hideTooltip(): void {
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }

  /**
   * Dispose the status bar
   */
  dispose(): void {
    this.hideTooltip();
    this.container.innerHTML = '';
  }
}

/**
 * Create and mount Git status bar
 */
export function createGitStatusBar(
  container: HTMLElement,
  callbacks?: GitStatusBarCallbacks
): GitStatusBar {
  return new GitStatusBar(container, callbacks);
}
