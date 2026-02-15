/**
 * Source Control Panel
 * Left panel UI component for Git source control (similar to VS Code)
 */

import { ipcRenderer } from 'electron';
import {
  GitFile,
  GitFileStatus,
  GitStatus,
  GitBranch,
  SourceControlState,
} from '../types';

/** CSS styles for the panel */
const STYLES = `
  .git-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--panel-background, #1e1e1e);
    color: var(--panel-foreground, #cccccc);
    font-family: var(--font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
    font-size: 13px;
  }

  .git-panel-header {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid var(--panel-border, #3c3c3c);
    background: var(--panel-header-background, #252526);
  }

  .git-panel-title {
    flex: 1;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .git-branch-selector {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--dropdown-background, #3c3c3c);
    border: 1px solid var(--dropdown-border, #3c3c3c);
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    max-width: 180px;
  }

  .git-branch-selector:hover {
    background: var(--dropdown-hover-background, #4c4c4c);
  }

  .git-branch-icon {
    font-size: 12px;
  }

  .git-branch-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .git-sync-indicator {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    color: var(--foreground-muted, #858585);
    font-size: 11px;
  }

  .git-sync-indicator.ahead-behind {
    color: var(--foreground, #cccccc);
  }

  .git-section {
    border-bottom: 1px solid var(--panel-border, #3c3c3c);
  }

  .git-section-header {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    background: var(--section-header-background, #252526);
    cursor: pointer;
    user-select: none;
  }

  .git-section-header:hover {
    background: var(--section-header-hover-background, #2c2c2c);
  }

  .git-section-title {
    flex: 1;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .git-section-count {
    background: var(--badge-background, #3c3c3c);
    color: var(--badge-foreground, #cccccc);
    padding: 2px 6px;
    border-radius: 10px;
    font-size: 10px;
    font-weight: 600;
    min-width: 18px;
    text-align: center;
  }

  .git-section-actions {
    display: flex;
    gap: 4px;
    margin-left: 8px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .git-section-header:hover .git-section-actions {
    opacity: 1;
  }

  .git-action-btn {
    background: none;
    border: none;
    color: var(--foreground, #cccccc);
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 3px;
    font-size: 12px;
  }

  .git-action-btn:hover {
    background: var(--toolbar-hover-background, #4c4c4c);
  }

  .git-file-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .git-file-item {
    display: flex;
    align-items: center;
    padding: 4px 12px 4px 24px;
    cursor: pointer;
    user-select: none;
  }

  .git-file-item:hover {
    background: var(--list-hover-background, #2a2d2e);
  }

  .git-file-item.selected {
    background: var(--list-active-selection-background, #094771);
  }

  .git-file-checkbox {
    margin-right: 8px;
    cursor: pointer;
  }

  .git-file-status {
    width: 16px;
    height: 16px;
    margin-right: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 600;
    border-radius: 2px;
  }

  .git-file-status.modified { color: #e2c08d; }
  .git-file-status.added { color: #73c991; }
  .git-file-status.deleted { color: #f48771; }
  .git-file-status.untracked { color: #8c8c8c; }
  .git-file-status.renamed { color: #73c991; }
  .git-file-status.conflicted { color: #f48771; background: #5a1d1d; }

  .git-file-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .git-file-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .git-file-item:hover .git-file-actions {
    opacity: 1;
  }

  .git-message-box {
    padding: 12px;
    border-bottom: 1px solid var(--panel-border, #3c3c3c);
  }

  .git-message-input {
    width: 100%;
    min-height: 60px;
    padding: 8px;
    background: var(--input-background, #3c3c3c);
    border: 1px solid var(--input-border, #3c3c3c);
    border-radius: 4px;
    color: var(--input-foreground, #cccccc);
    font-family: inherit;
    font-size: 13px;
    resize: vertical;
    box-sizing: border-box;
  }

  .git-message-input:focus {
    outline: none;
    border-color: var(--focus-border, #007fd4);
  }

  .git-message-input::placeholder {
    color: var(--input-placeholder-foreground, #6e6e6e);
  }

  .git-commit-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .git-btn {
    flex: 1;
    padding: 6px 12px;
    background: var(--button-background, #0e639c);
    border: none;
    border-radius: 4px;
    color: var(--button-foreground, #ffffff);
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .git-btn:hover {
    background: var(--button-hover-background, #1177bb);
  }

  .git-btn:disabled {
    background: var(--button-disabled-background, #3c3c3c);
    color: var(--button-disabled-foreground, #6e6e6e);
    cursor: not-allowed;
  }

  .git-btn.secondary {
    background: var(--button-secondary-background, #3c3c3c);
    color: var(--button-secondary-foreground, #cccccc);
  }

  .git-btn.secondary:hover {
    background: var(--button-secondary-hover-background, #4c4c4c);
  }

  .git-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
    color: var(--foreground-muted, #858585);
  }

  .git-empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }

  .git-empty-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--foreground, #cccccc);
  }

  .git-empty-description {
    font-size: 12px;
    line-height: 1.5;
  }

  .git-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    color: var(--foreground-muted, #858585);
  }

  .git-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--foreground-muted, #858585);
    border-top-color: transparent;
    border-radius: 50%;
    animation: git-spin 1s linear infinite;
    margin-right: 8px;
  }

  @keyframes git-spin {
    to { transform: rotate(360deg); }
  }

  .git-dropdown {
    position: absolute;
    background: var(--dropdown-background, #3c3c3c);
    border: 1px solid var(--dropdown-border, #3c3c3c);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    max-height: 300px;
    overflow-y: auto;
    z-index: 1000;
    min-width: 200px;
  }

  .git-dropdown-item {
    padding: 8px 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .git-dropdown-item:hover {
    background: var(--dropdown-hover-background, #4c4c4c);
  }

  .git-dropdown-item.current {
    background: var(--dropdown-active-background, #094771);
  }

  .git-dropdown-separator {
    height: 1px;
    background: var(--dropdown-border, #3c3c3c);
    margin: 4px 0;
  }
`;

/** Event callbacks */
export interface SourceControlPanelCallbacks {
  onFileSelect?: (file: GitFile) => void;
  onStage?: (files: string[]) => void;
  onUnstage?: (files: string[]) => void;
  onCommit?: (message: string) => void;
  onSync?: () => void;
  onBranchChange?: (branch: string) => void;
  onDiscard?: (file: string) => void;
  onRefresh?: () => void;
}

/**
 * Source Control Panel class
 */
export class SourceControlPanel {
  private container: HTMLElement;
  private workspaceRoot: string;
  private state: SourceControlState;
  private callbacks: SourceControlPanelCallbacks;
  private selectedFiles: Set<string> = new Set();
  private refreshInterval: NodeJS.Timeout | null = null;

  constructor(
    container: HTMLElement,
    workspaceRoot: string,
    callbacks: SourceControlPanelCallbacks = {}
  ) {
    this.container = container;
    this.workspaceRoot = workspaceRoot;
    this.callbacks = callbacks;

    this.state = {
      branch: '',
      branches: [],
      changes: [],
      staged: [],
      message: '',
      isCommitting: false,
      isSyncing: false,
      ahead: 0,
      behind: 0,
    };

    this.injectStyles();
    this.render();
    this.setupAutoRefresh();
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    if (!document.getElementById('git-panel-styles')) {
      const style = document.createElement('style');
      style.id = 'git-panel-styles';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }
  }

  /**
   * Setup auto-refresh
   */
  private setupAutoRefresh(): void {
    // Refresh every 5 seconds
    this.refreshInterval = setInterval(() => {
      this.refresh();
    }, 5000);
  }

  /**
   * Stop auto-refresh
   */
  stopAutoRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Update panel state
   */
  updateState(state: Partial<SourceControlState>): void {
    this.state = { ...this.state, ...state };
    this.render();
  }

  /**
   * Update git status
   */
  updateStatus(status: GitStatus): void {
    this.state.branch = status.branch;
    this.state.changes = status.files.filter((f) => !f.staged);
    this.state.staged = status.files.filter((f) => f.staged);
    this.state.ahead = status.ahead;
    this.state.behind = status.behind;
    this.render();
  }

  /**
   * Update branches list
   */
  updateBranches(branches: GitBranch[]): void {
    this.state.branches = branches;
    const currentBranch = branches.find((b) => b.current);
    if (currentBranch) {
      this.state.branch = currentBranch.name;
      this.state.ahead = currentBranch.ahead;
      this.state.behind = currentBranch.behind;
    }
    this.render();
  }

  /**
   * Refresh the panel
   */
  private refresh(): void {
    if (this.callbacks.onRefresh) {
      this.callbacks.onRefresh();
    }
  }

  /**
   * Render the panel
   */
  private render(): void {
    this.container.innerHTML = '';

    const panel = document.createElement('div');
    panel.className = 'git-panel';

    // Header
    panel.appendChild(this.renderHeader());

    // Sync indicator
    if (this.state.ahead > 0 || this.state.behind > 0) {
      panel.appendChild(this.renderSyncIndicator());
    }

    // Message box
    panel.appendChild(this.renderMessageBox());

    // Staged changes section
    if (this.state.staged.length > 0) {
      panel.appendChild(this.renderSection('staged', 'Staged Changes', this.state.staged));
    }

    // Changes section
    if (this.state.changes.length > 0) {
      panel.appendChild(this.renderSection('changes', 'Changes', this.state.changes));
    }

    // Empty state
    if (this.state.staged.length === 0 && this.state.changes.length === 0) {
      panel.appendChild(this.renderEmptyState());
    }

    this.container.appendChild(panel);
  }

  /**
   * Render header with branch selector
   */
  private renderHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'git-panel-header';

    const title = document.createElement('div');
    title.className = 'git-panel-title';
    title.textContent = 'Source Control';
    header.appendChild(title);

    // Branch selector
    const branchSelector = document.createElement('div');
    branchSelector.className = 'git-branch-selector';
    branchSelector.innerHTML = `
      <span class="git-branch-icon">🌿</span>
      <span class="git-branch-name">${this.state.branch || 'main'}</span>
      <span>▼</span>
    `;
    branchSelector.addEventListener('click', () => this.showBranchDropdown(branchSelector));
    header.appendChild(branchSelector);

    return header;
  }

  /**
   * Render sync indicator
   */
  private renderSyncIndicator(): HTMLElement {
    const indicator = document.createElement('div');
    indicator.className = 'git-sync-indicator';
    if (this.state.ahead > 0 || this.state.behind > 0) {
      indicator.classList.add('ahead-behind');
    }

    let text = '';
    if (this.state.ahead > 0 && this.state.behind > 0) {
      text = `↓${this.state.behind} ↑${this.state.ahead}`;
    } else if (this.state.ahead > 0) {
      text = `↑${this.state.ahead}`;
    } else if (this.state.behind > 0) {
      text = `↓${this.state.behind}`;
    }

    indicator.innerHTML = `
      <span>🔄</span>
      <span>${text}</span>
    `;

    return indicator;
  }

  /**
   * Render message box and commit actions
   */
  private renderMessageBox(): HTMLElement {
    const box = document.createElement('div');
    box.className = 'git-message-box';

    const textarea = document.createElement('textarea');
    textarea.className = 'git-message-input';
    textarea.placeholder = 'Message (Ctrl+Enter to commit)';
    textarea.value = this.state.message;
    textarea.addEventListener('input', (e) => {
      this.state.message = (e.target as HTMLTextAreaElement).value;
    });
    textarea.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        this.commit();
      }
    });
    box.appendChild(textarea);

    const actions = document.createElement('div');
    actions.className = 'git-commit-actions';

    const commitBtn = document.createElement('button');
    commitBtn.className = 'git-btn';
    commitBtn.disabled = this.state.staged.length === 0 || !this.state.message.trim() || this.state.isCommitting;
    commitBtn.innerHTML = this.state.isCommitting 
      ? '<span class="git-spinner"></span> Committing...'
      : '✓ Commit';
    commitBtn.addEventListener('click', () => this.commit());
    actions.appendChild(commitBtn);

    const syncBtn = document.createElement('button');
    syncBtn.className = 'git-btn secondary';
    syncBtn.disabled = this.state.isSyncing;
    syncBtn.innerHTML = this.state.isSyncing
      ? '<span class="git-spinner"></span> Syncing...'
      : '🔄 Sync';
    syncBtn.addEventListener('click', () => this.sync());
    actions.appendChild(syncBtn);

    box.appendChild(actions);

    return box;
  }

  /**
   * Render a file section (changes or staged)
   */
  private renderSection(id: string, title: string, files: GitFile[]): HTMLElement {
    const section = document.createElement('div');
    section.className = 'git-section';

    const header = document.createElement('div');
    header.className = 'git-section-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'git-section-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const count = document.createElement('div');
    count.className = 'git-section-count';
    count.textContent = files.length.toString();
    header.appendChild(count);

    // Section actions
    const actions = document.createElement('div');
    actions.className = 'git-section-actions';

    if (id === 'changes') {
      const stageAllBtn = document.createElement('button');
      stageAllBtn.className = 'git-action-btn';
      stageAllBtn.title = 'Stage All';
      stageAllBtn.innerHTML = '+';
      stageAllBtn.addEventListener('click', () => this.stageAll(files));
      actions.appendChild(stageAllBtn);
    } else {
      const unstageAllBtn = document.createElement('button');
      unstageAllBtn.className = 'git-action-btn';
      unstageAllBtn.title = 'Unstage All';
      unstageAllBtn.innerHTML = '-';
      unstageAllBtn.addEventListener('click', () => this.unstageAll(files));
      actions.appendChild(unstageAllBtn);
    }

    header.appendChild(actions);
    section.appendChild(header);

    // File list
    const list = document.createElement('ul');
    list.className = 'git-file-list';

    for (const file of files) {
      list.appendChild(this.renderFileItem(file));
    }

    section.appendChild(list);

    return section;
  }

  /**
   * Render a file item
   */
  private renderFileItem(file: GitFile): HTMLElement {
    const item = document.createElement('li');
    item.className = 'git-file-item';
    if (this.selectedFiles.has(file.path)) {
      item.classList.add('selected');
    }

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'git-file-checkbox';
    checkbox.checked = file.staged;
    checkbox.addEventListener('change', () => {
      if (file.staged) {
        this.callbacks.onUnstage?.([file.path]);
      } else {
        this.callbacks.onStage?.([file.path]);
      }
    });
    item.appendChild(checkbox);

    // Status indicator
    const status = document.createElement('div');
    status.className = `git-file-status ${this.getStatusClass(file.status)}`;
    status.textContent = file.status;
    item.appendChild(status);

    // File name
    const name = document.createElement('div');
    name.className = 'git-file-name';
    name.textContent = file.path;
    name.title = file.path;
    item.appendChild(name);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'git-file-actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'git-action-btn';
    openBtn.title = 'Open File';
    openBtn.innerHTML = '📄';
    openBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.callbacks.onFileSelect?.(file);
    });
    actions.appendChild(openBtn);

    if (!file.staged) {
      const discardBtn = document.createElement('button');
      discardBtn.className = 'git-action-btn';
      discardBtn.title = 'Discard Changes';
      discardBtn.innerHTML = '🗑️';
      discardBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Discard changes in ${file.path}?`)) {
          this.callbacks.onDiscard?.(file.path);
        }
      });
      actions.appendChild(discardBtn);
    }

    item.appendChild(actions);

    // Click to select
    item.addEventListener('click', () => {
      this.selectedFiles.clear();
      this.selectedFiles.add(file.path);
      this.render();
      this.callbacks.onFileSelect?.(file);
    });

    // Double click to open diff
    item.addEventListener('dblclick', () => {
      this.callbacks.onFileSelect?.(file);
    });

    return item;
  }

  /**
   * Render empty state
   */
  private renderEmptyState(): HTMLElement {
    const empty = document.createElement('div');
    empty.className = 'git-empty-state';
    empty.innerHTML = `
      <div class="git-empty-icon">✓</div>
      <div class="git-empty-title">No Changes</div>
      <div class="git-empty-description">
        There are no changes to commit.<br>
        Your working directory is clean.
      </div>
    `;
    return empty;
  }

  /**
   * Show branch dropdown
   */
  private showBranchDropdown(anchor: HTMLElement): void {
    // Remove existing dropdown
    const existing = document.getElementById('git-branch-dropdown');
    if (existing) {
      existing.remove();
      return;
    }

    const dropdown = document.createElement('div');
    dropdown.id = 'git-branch-dropdown';
    dropdown.className = 'git-dropdown';

    const rect = anchor.getBoundingClientRect();
    dropdown.style.top = `${rect.bottom + 4}px`;
    dropdown.style.left = `${rect.left}px`;

    // Current branch
    this.state.branches.forEach((branch) => {
      const item = document.createElement('div');
      item.className = `git-dropdown-item ${branch.current ? 'current' : ''}`;
      item.innerHTML = `
        <span>${branch.current ? '✓' : ''}</span>
        <span>${branch.name}</span>
      `;
      item.addEventListener('click', () => {
        if (!branch.current) {
          this.callbacks.onBranchChange?.(branch.name);
        }
        dropdown.remove();
      });
      dropdown.appendChild(item);
    });

    // Separator
    const separator = document.createElement('div');
    separator.className = 'git-dropdown-separator';
    dropdown.appendChild(separator);

    // Create new branch option
    const createItem = document.createElement('div');
    createItem.className = 'git-dropdown-item';
    createItem.innerHTML = '<span>+</span><span>Create new branch...</span>';
    createItem.addEventListener('click', () => {
      const name = prompt('Enter branch name:');
      if (name) {
        this.createBranch(name);
      }
      dropdown.remove();
    });
    dropdown.appendChild(createItem);

    document.body.appendChild(dropdown);

    // Close on outside click
    const closeDropdown = (e: MouseEvent) => {
      if (!dropdown.contains(e.target as Node)) {
        dropdown.remove();
        document.removeEventListener('click', closeDropdown);
      }
    };
    setTimeout(() => document.addEventListener('click', closeDropdown), 0);
  }

  /**
   * Stage all files
   */
  private stageAll(files: GitFile[]): void {
    this.callbacks.onStage?.(files.map((f) => f.path));
  }

  /**
   * Unstage all files
   */
  private unstageAll(files: GitFile[]): void {
    this.callbacks.onUnstage?.(files.map((f) => f.path));
  }

  /**
   * Commit changes
   */
  private commit(): void {
    const message = this.state.message.trim();
    if (message && this.state.staged.length > 0) {
      this.state.isCommitting = true;
      this.render();
      this.callbacks.onCommit?.(message);
    }
  }

  /**
   * Sync (push/pull)
   */
  private sync(): void {
    this.state.isSyncing = true;
    this.render();
    this.callbacks.onSync?.();
  }

  /**
   * Create new branch
   */
  private async createBranch(name: string): Promise<void> {
    try {
      await ipcRenderer.invoke('git:createBranch', this.workspaceRoot, name, true);
      this.refresh();
    } catch (error) {
      console.error('Failed to create branch:', error);
    }
  }

  /**
   * Get CSS class for file status
   */
  private getStatusClass(status: GitFileStatus): string {
    switch (status) {
      case 'M':
        return 'modified';
      case 'A':
        return 'added';
      case 'D':
        return 'deleted';
      case '??':
        return 'untracked';
      case 'R':
        return 'renamed';
      case 'U':
        return 'conflicted';
      default:
        return '';
    }
  }

  /**
   * Dispose the panel
   */
  dispose(): void {
    this.stopAutoRefresh();
    this.container.innerHTML = '';
  }
}

/**
 * Create and mount source control panel
 */
export function createSourceControlPanel(
  container: HTMLElement,
  workspaceRoot: string,
  callbacks?: SourceControlPanelCallbacks
): SourceControlPanel {
  return new SourceControlPanel(container, workspaceRoot, callbacks);
}
