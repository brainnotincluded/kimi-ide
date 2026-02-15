/**
 * Inline Git Decorations
 * Shows modified/added/deleted line indicators in the editor (similar to VS Code)
 */

import { GitDiff, GitBlame, GitBlameLine, InlineDecoration, LineChangeType } from '../types';

/** CSS styles for inline decorations */
const STYLES = `
  .git-gutter {
    position: absolute;
    left: 0;
    width: 4px;
    height: 100%;
    pointer-events: none;
  }

  .git-gutter-marker {
    position: absolute;
    left: 0;
    width: 4px;
    height: 100%;
    cursor: pointer;
    pointer-events: auto;
  }

  .git-gutter-marker.added {
    background-color: #238636;
  }

  .git-gutter-marker.modified {
    background-color: #9e6a03;
  }

  .git-gutter-marker.deleted {
    background-color: #da3633;
    height: 0;
    border-top: 2px solid #da3633;
    margin-top: -1px;
  }

  .git-gutter-marker:hover {
    width: 6px;
  }

  .git-line-decoration {
    position: relative;
  }

  .git-line-decoration.added {
    background-color: rgba(35, 134, 54, 0.15);
  }

  .git-line-decoration.modified {
    background-color: rgba(158, 106, 3, 0.15);
  }

  .git-line-decoration.deleted {
    background-color: rgba(218, 54, 51, 0.15);
  }

  .git-blame-widget {
    position: absolute;
    right: 0;
    background: var(--editor-background, #1e1e1e);
    border-left: 1px solid var(--panel-border, #3c3c3c);
    padding: 4px 12px;
    font-size: 12px;
    color: var(--foreground-muted, #858585);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.2s ease;
    user-select: none;
    max-width: 300px;
  }

  .git-blame-widget:hover {
    opacity: 1;
    background: var(--list-hover-background, #2a2d2e);
  }

  .git-blame-author {
    color: var(--foreground, #cccccc);
    font-weight: 500;
  }

  .git-blame-date {
    color: var(--foreground-muted, #858585);
  }

  .git-blame-hash {
    color: var(--foreground-muted, #858585);
    font-family: monospace;
  }

  .git-diff-popup {
    position: absolute;
    background: var(--editor-background, #1e1e1e);
    border: 1px solid var(--panel-border, #3c3c3c);
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
    z-index: 1000;
    max-width: 600px;
    max-height: 300px;
    overflow: auto;
    font-family: var(--editor-font-family, 'Fira Code', 'Consolas', monospace);
    font-size: 12px;
  }

  .git-diff-popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--panel-header-background, #252526);
    border-bottom: 1px solid var(--panel-border, #3c3c3c);
    font-weight: 500;
  }

  .git-diff-popup-close {
    background: none;
    border: none;
    color: var(--foreground, #cccccc);
    cursor: pointer;
    font-size: 14px;
    padding: 2px 6px;
    border-radius: 3px;
  }

  .git-diff-popup-close:hover {
    background: var(--toolbar-hover-background, #4c4c4c);
  }

  .git-diff-popup-content {
    padding: 8px 0;
  }

  .git-diff-line {
    display: flex;
    padding: 2px 12px;
    white-space: pre;
    font-family: monospace;
  }

  .git-diff-line.added {
    background: rgba(35, 134, 54, 0.2);
  }

  .git-diff-line.added::before {
    content: '+';
    color: #3fb950;
    margin-right: 8px;
    min-width: 12px;
  }

  .git-diff-line.deleted {
    background: rgba(218, 54, 51, 0.2);
  }

  .git-diff-line.deleted::before {
    content: '-';
    color: #f85149;
    margin-right: 8px;
    min-width: 12px;
  }

  .git-diff-line.unchanged::before {
    content: ' ';
    margin-right: 8px;
    min-width: 12px;
  }

  .git-diff-line-numbers {
    color: var(--foreground-muted, #858585);
    margin-right: 12px;
    min-width: 50px;
    text-align: right;
    user-select: none;
  }

  .git-diff-line-content {
    flex: 1;
  }
`;

/** Editor integration interface */
export interface EditorIntegration {
  getLineHeight(): number;
  getScrollTop(): number;
  getContainer(): HTMLElement;
  getLineElement(line: number): HTMLElement | null;
  revealLine(line: number): void;
  onDidChangeCursorPosition(callback: (line: number) => void): void;
  onDidChangeModel(callback: () => void): void;
}

/** Inline decorations manager */
export class InlineDecorationsManager {
  private editor: EditorIntegration;
  private container: HTMLElement;
  private gutterContainer: HTMLElement;
  private blameContainer: HTMLElement;
  private decorations: Map<number, InlineDecoration> = new Map();
  private blameData: Map<number, GitBlameLine> = new Map();
  private diffPopup: HTMLElement | null = null;
  private isBlameVisible: boolean = false;
  private lineHeight: number = 20;

  constructor(editor: EditorIntegration, container: HTMLElement) {
    this.editor = editor;
    this.container = container;

    this.injectStyles();
    this.createContainers();
    this.setupEventListeners();
  }

  /**
   * Inject CSS styles
   */
  private injectStyles(): void {
    if (!document.getElementById('git-inline-styles')) {
      const style = document.createElement('style');
      style.id = 'git-inline-styles';
      style.textContent = STYLES;
      document.head.appendChild(style);
    }
  }

  /**
   * Create decoration containers
   */
  private createContainers(): void {
    // Gutter container
    this.gutterContainer = document.createElement('div');
    this.gutterContainer.className = 'git-gutter';
    this.container.appendChild(this.gutterContainer);

    // Blame container
    this.blameContainer = document.createElement('div');
    this.blameContainer.className = 'git-blame-container';
    this.blameContainer.style.display = 'none';
    this.container.appendChild(this.blameContainer);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Update on scroll
    this.container.addEventListener('scroll', () => this.render());

    // Update on model change
    this.editor.onDidChangeModel(() => {
      this.clear();
    });

    // Update on cursor position change
    this.editor.onDidChangeCursorPosition((line) => {
      if (this.isBlameVisible) {
        this.highlightBlameLine(line);
      }
    });
  }

  /**
   * Apply diff decorations
   */
  applyDiff(diff: GitDiff): void {
    this.clear();

    const decorations: InlineDecoration[] = [];

    for (const hunk of diff.hunks) {
      for (const line of hunk.lines) {
        let type: LineChangeType;
        if (line.type === 'added') {
          type = 'added';
        } else if (line.type === 'deleted') {
          type = 'deleted';
        } else {
          continue; // Skip unchanged lines
        }

        const lineNumber = line.newLineNumber || line.oldLineNumber || 0;
        if (lineNumber > 0) {
          decorations.push({
            line: lineNumber,
            type,
            diff,
          });
        }
      }
    }

    this.applyDecorations(decorations);
  }

  /**
   * Apply decorations from array
   */
  applyDecorations(decorations: InlineDecoration[]): void {
    for (const decoration of decorations) {
      this.decorations.set(decoration.line, decoration);
    }
    this.render();
  }

  /**
   * Show blame annotations
   */
  showBlame(blame: GitBlame): void {
    this.blameData.clear();

    for (const line of blame.lines) {
      this.blameData.set(line.line, line);
    }

    this.isBlameVisible = true;
    this.blameContainer.style.display = 'block';
    this.renderBlame();
  }

  /**
   * Hide blame annotations
   */
  hideBlame(): void {
    this.isBlameVisible = false;
    this.blameContainer.style.display = 'none';
    this.blameContainer.innerHTML = '';
    this.blameData.clear();
  }

  /**
   * Toggle blame visibility
   */
  toggleBlame(blame?: GitBlame): void {
    if (this.isBlameVisible) {
      this.hideBlame();
    } else if (blame) {
      this.showBlame(blame);
    }
  }

  /**
   * Clear all decorations
   */
  clear(): void {
    this.decorations.clear();
    this.gutterContainer.innerHTML = '';
    this.hideDiffPopup();
  }

  /**
   * Render decorations
   */
  private render(): void {
    this.lineHeight = this.editor.getLineHeight();
    const scrollTop = this.editor.getScrollTop();

    // Clear gutter
    this.gutterContainer.innerHTML = '';

    // Render gutter markers
    for (const [line, decoration] of this.decorations) {
      const marker = this.createGutterMarker(line, decoration.type);
      const top = (line - 1) * this.lineHeight - scrollTop;
      marker.style.top = `${top}px`;
      marker.style.height = decoration.type === 'deleted' ? '2px' : `${this.lineHeight}px`;
      this.gutterContainer.appendChild(marker);
    }

    // Update line decorations
    this.updateLineDecorations();

    // Render blame if visible
    if (this.isBlameVisible) {
      this.renderBlame();
    }
  }

  /**
   * Create gutter marker element
   */
  private createGutterMarker(line: number, type: LineChangeType): HTMLElement {
    const marker = document.createElement('div');
    marker.className = `git-gutter-marker ${type}`;
    marker.dataset.line = line.toString();
    marker.dataset.type = type;

    marker.addEventListener('click', () => {
      this.editor.revealLine(line);
      this.showDiffPopup(line);
    });

    marker.addEventListener('mouseenter', () => {
      this.highlightLine(line, type);
    });

    marker.addEventListener('mouseleave', () => {
      this.unhighlightLine(line);
    });

    return marker;
  }

  /**
   * Update line background decorations
   */
  private updateLineDecorations(): void {
    // Remove existing decorations
    for (const el of Array.from(this.container.querySelectorAll('.git-line-decoration'))) {
      el.classList.remove('git-line-decoration', 'added', 'modified', 'deleted');
    }

    // Apply new decorations
    for (const [line, decoration] of this.decorations) {
      const lineEl = this.editor.getLineElement(line);
      if (lineEl) {
        lineEl.classList.add('git-line-decoration', decoration.type);
      }
    }
  }

  /**
   * Render blame annotations
   */
  private renderBlame(): void {
    this.blameContainer.innerHTML = '';

    const scrollTop = this.editor.getScrollTop();
    const containerHeight = this.container.clientHeight;

    // Calculate visible line range
    const startLine = Math.floor(scrollTop / this.lineHeight) + 1;
    const endLine = Math.ceil((scrollTop + containerHeight) / this.lineHeight);

    // Render blame widgets for visible lines
    for (let line = startLine; line <= endLine; line++) {
      const blameLine = this.blameData.get(line);
      if (blameLine) {
        const widget = this.createBlameWidget(blameLine, line);
        const top = (line - 1) * this.lineHeight - scrollTop;
        widget.style.top = `${top}px`;
        this.blameContainer.appendChild(widget);
      }
    }
  }

  /**
   * Create blame widget
   */
  private createBlameWidget(blameLine: GitBlameLine, line: number): HTMLElement {
    const widget = document.createElement('div');
    widget.className = 'git-blame-widget';
    widget.dataset.line = line.toString();

    const timeAgo = this.formatTimeAgo(blameLine.date);
    const shortHash = blameLine.hash.substring(0, 7);

    widget.innerHTML = `
      <span class="git-blame-hash">${shortHash}</span>
      <span class="git-blame-author">${this.escapeHtml(blameLine.author)}</span>
      <span class="git-blame-date">${timeAgo}</span>
    `;

    widget.addEventListener('click', () => {
      // Show commit details
      this.showCommitDetails(blameLine.hash);
    });

    return widget;
  }

  /**
   * Highlight a blame line
   */
  private highlightBlameLine(line: number): void {
    for (const widget of Array.from(this.blameContainer.querySelectorAll('.git-blame-widget'))) {
      widget.classList.remove('active');
    }

    const widget = this.blameContainer.querySelector(`[data-line="${line}"]`) as HTMLElement;
    if (widget) {
      widget.classList.add('active');
    }
  }

  /**
   * Highlight line on hover
   */
  private highlightLine(line: number, type: LineChangeType): void {
    const lineEl = this.editor.getLineElement(line);
    if (lineEl) {
      lineEl.style.backgroundColor = this.getHighlightColor(type);
    }
  }

  /**
   * Unhighlight line
   */
  private unhighlightLine(line: number): void {
    const lineEl = this.editor.getLineElement(line);
    if (lineEl) {
      lineEl.style.backgroundColor = '';
    }
  }

  /**
   * Get highlight color for type
   */
  private getHighlightColor(type: LineChangeType): string {
    switch (type) {
      case 'added':
        return 'rgba(35, 134, 54, 0.25)';
      case 'modified':
        return 'rgba(158, 106, 3, 0.25)';
      case 'deleted':
        return 'rgba(218, 54, 51, 0.25)';
      default:
        return '';
    }
  }

  /**
   * Show diff popup for line
   */
  private showDiffPopup(line: number): void {
    this.hideDiffPopup();

    const decoration = this.decorations.get(line);
    if (!decoration || !decoration.diff) return;

    const popup = document.createElement('div');
    popup.className = 'git-diff-popup';

    // Header
    const header = document.createElement('div');
    header.className = 'git-diff-popup-header';
    header.innerHTML = `
      <span>Diff: ${decoration.diff.newPath}</span>
      <button class="git-diff-popup-close">×</button>
    `;
    popup.appendChild(header);

    // Close button
    const closeBtn = header.querySelector('.git-diff-popup-close') as HTMLButtonElement;
    closeBtn.addEventListener('click', () => this.hideDiffPopup());

    // Content
    const content = document.createElement('div');
    content.className = 'git-diff-popup-content';

    // Find relevant hunk
    for (const hunk of decoration.diff.hunks) {
      const startLine = hunk.newStart;
      const endLine = hunk.newStart + hunk.newLines - 1;

      if (line >= startLine && line <= endLine) {
        // Show context lines around the changed line
        for (const hunkLine of hunk.lines) {
          const lineEl = document.createElement('div');
          lineEl.className = `git-diff-line ${hunkLine.type}`;

          const lineNum = hunkLine.newLineNumber || hunkLine.oldLineNumber || '';
          lineEl.innerHTML = `
            <span class="git-diff-line-numbers">${lineNum}</span>
            <span class="git-diff-line-content">${this.escapeHtml(hunkLine.content)}</span>
          `;

          content.appendChild(lineEl);
        }
        break;
      }
    }

    popup.appendChild(content);

    // Position popup near the line
    const lineEl = this.editor.getLineElement(line);
    if (lineEl) {
      const rect = lineEl.getBoundingClientRect();
      popup.style.left = `${rect.left + 50}px`;
      popup.style.top = `${rect.bottom + 5}px`;
    }

    document.body.appendChild(popup);
    this.diffPopup = popup;

    // Close on outside click
    const closeOnOutside = (e: MouseEvent) => {
      if (!popup.contains(e.target as Node)) {
        this.hideDiffPopup();
        document.removeEventListener('click', closeOnOutside);
      }
    };
    setTimeout(() => document.addEventListener('click', closeOnOutside), 0);
  }

  /**
   * Hide diff popup
   */
  private hideDiffPopup(): void {
    if (this.diffPopup) {
      this.diffPopup.remove();
      this.diffPopup = null;
    }
  }

  /**
   * Show commit details
   */
  private showCommitDetails(hash: string): void {
    // This would typically show a more detailed view
    // For now, just log or emit an event
    console.log('Show commit details for:', hash);
    // Emit event for parent components to handle
    const event = new CustomEvent('git:showCommit', { detail: { hash } });
    this.container.dispatchEvent(event);
  }

  /**
   * Format date as relative time
   */
  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years}y ago`;
    if (months > 0) return `${months}mo ago`;
    if (weeks > 0) return `${weeks}w ago`;
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'just now';
  }

  /**
   * Escape HTML
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Dispose the manager
   */
  dispose(): void {
    this.clear();
    this.hideBlame();
    this.hideDiffPopup();
    this.gutterContainer.remove();
    this.blameContainer.remove();
  }
}

/**
 * Create inline decorations manager
 */
export function createInlineDecorations(
  editor: EditorIntegration,
  container: HTMLElement
): InlineDecorationsManager {
  return new InlineDecorationsManager(editor, container);
}

/**
 * Create Monaco editor integration
 */
export function createMonacoIntegration(
  editor: any // monaco.editor.IStandaloneCodeEditor
): EditorIntegration {
  return {
    getLineHeight: () => editor.getOption(55), // monaco.editor.EditorOption.lineHeight = 55
    getScrollTop: () => editor.getScrollTop(),
    getContainer: () => editor.getContainerDomNode(),
    getLineElement: (line: number) => {
      const elements = editor.getContainerDomNode().querySelectorAll('.view-line');
      // Monaco uses 0-based lines internally, display is 1-based
      return elements[line - 1] as HTMLElement || null;
    },
    revealLine: (line: number) => editor.revealLine(line),
    onDidChangeCursorPosition: (callback: (line: number) => void) => {
      editor.onDidChangeCursorPosition((e: any) => {
        callback(e.position.lineNumber);
      });
    },
    onDidChangeModel: (callback: () => void) => {
      editor.onDidChangeModel(callback);
    },
  };
}

/**
 * Create CodeMirror editor integration
 */
export function createCodeMirrorIntegration(
  editor: any // EditorView
): EditorIntegration {
  return {
    getLineHeight: () => {
      const line = editor.dom.querySelector('.cm-line');
      return line ? line.clientHeight : 20;
    },
    getScrollTop: () => editor.scrollDOM.scrollTop,
    getContainer: () => editor.dom,
    getLineElement: (line: number) => {
      const lines = editor.dom.querySelectorAll('.cm-line');
      return lines[line - 1] as HTMLElement || null;
    },
    revealLine: (line: number) => {
      const lineEl = editor.dom.querySelectorAll('.cm-line')[line - 1] as HTMLElement;
      if (lineEl) {
        lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },
    onDidChangeCursorPosition: (callback: (line: number) => void) => {
      // CodeMirror doesn't have a direct line change event, use selection change
      // This is a simplified version
    },
    onDidChangeModel: (callback: () => void) => {
      // CodeMirror document change
    },
  };
}
