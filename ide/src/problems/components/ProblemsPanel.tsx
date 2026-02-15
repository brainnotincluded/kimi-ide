/**
 * Problems Panel Component
 * IDE Kimi IDE - VS Code-like Problems Panel
 */

import React, { useState, useCallback } from 'react';
import { useProblems } from '../hooks/useProblems';
import { ProblemItemData, GroupedProblems, CodeAction } from '../types';
import { ProblemsFilterBar } from './ProblemsFilterBar';
import { ProblemItem } from './ProblemItem';
import { ProblemIcon } from './ProblemIcon';

interface ProblemsPanelProps {
  height?: number;
  onProblemClick?: (problem: ProblemItemData) => void;
}

export const ProblemsPanel: React.FC<ProblemsPanelProps> = ({
  height = 200,
  onProblemClick,
}) => {
  const {
    groupedProblems,
    counts,
    filter,
    groupBy,
    selectedProblemId,
    setFilter,
    setGroupBy,
    toggleGroup,
    expandAllGroups,
    collapseAllGroups,
    clearAll,
    clearForFile,
    openProblem,
    copyMessage,
  } = useProblems({ initialGroupBy: 'file' });

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    problem?: ProblemItemData;
  } | null>(null);

  const handleProblemClick = useCallback(
    async (problem: ProblemItemData) => {
      onProblemClick?.(problem);
      await openProblem(problem);
    },
    [onProblemClick, openProblem]
  );

  const handleQuickFix = useCallback(
    async (problem: ProblemItemData, action: CodeAction) => {
      const { applyCodeAction } = await import('../renderer-ipc');
      await applyCodeAction(problem.file, action);
    },
    []
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, problem: ProblemItemData) => {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY, problem });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleCopyFromContext = useCallback(() => {
    if (contextMenu?.problem) {
      copyMessage(contextMenu.problem.diagnostic.message);
    }
    closeContextMenu();
  }, [contextMenu, copyMessage, closeContextMenu]);

  const hasProblems = counts.total > 0;

  return (
    <div style={{ ...styles.container, height }} onClick={closeContextMenu}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.title}>Problems</span>
        <span style={styles.count}>
          {counts.errors > 0 && (
            <span style={{ color: '#f44336' }}>{counts.errors} errors</span>
          )}
          {counts.errors > 0 && counts.warnings > 0 && <span style={styles.countSeparator}>, </span>}
          {counts.warnings > 0 && (
            <span style={{ color: '#ff9800' }}>{counts.warnings} warnings</span>
          )}
          {!hasProblems && <span style={{ color: '#858585' }}>No problems</span>}
        </span>
      </div>

      {/* Filter Bar */}
      {hasProblems && (
        <ProblemsFilterBar
          filter={filter}
          groupBy={groupBy}
          counts={counts}
          onFilterChange={setFilter}
          onGroupByChange={setGroupBy}
          onExpandAll={expandAllGroups}
          onCollapseAll={collapseAllGroups}
          onClearAll={clearAll}
        />
      )}

      {/* Problem List */}
      <div style={styles.content}>
        {!hasProblems ? (
          <div style={styles.emptyState}>
            <svg
              width="48"
              height="48"
              viewBox="0 0 16 16"
              fill="none"
              stroke="#4caf50"
              strokeWidth="1.5"
            >
              <circle cx="8" cy="8" r="6" />
              <path d="M5 8l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={styles.emptyText}>No problems have been detected in the workspace.</span>
          </div>
        ) : (
          <div style={styles.list}>
            {groupedProblems.map((group) => (
              <ProblemGroup
                key={group.key}
                group={group}
                selectedProblemId={selectedProblemId}
                onToggle={() => toggleGroup(group.key)}
                onProblemClick={handleProblemClick}
                onQuickFix={handleQuickFix}
                onCopyMessage={copyMessage}
                onContextMenu={handleContextMenu}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && contextMenu.problem && (
        <div
          style={{
            ...styles.contextMenu,
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <div style={styles.contextMenuItem} onClick={handleCopyFromContext}>
            Copy Message
          </div>
          <div style={styles.contextMenuSeparator} />
          <div
            style={styles.contextMenuItem}
            onClick={() => {
              openProblem(contextMenu.problem!);
              closeContextMenu();
            }}
          >
            Go to Problem
          </div>
        </div>
      )}
    </div>
  );
};

interface ProblemGroupProps {
  group: GroupedProblems;
  selectedProblemId?: string;
  onToggle: () => void;
  onProblemClick: (problem: ProblemItemData) => void;
  onQuickFix: (problem: ProblemItemData, action: CodeAction) => void;
  onCopyMessage: (message: string) => void;
  onContextMenu: (e: React.MouseEvent, problem: ProblemItemData) => void;
}

const ProblemGroup: React.FC<ProblemGroupProps> = ({
  group,
  selectedProblemId,
  onToggle,
  onProblemClick,
  onQuickFix,
  onCopyMessage,
  onContextMenu,
}) => {
  return (
    <div style={styles.group}>
      {/* Group Header */}
      <div style={styles.groupHeader} onClick={onToggle}>
        <span style={styles.groupToggle}>
          {group.expanded ? (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 6l4 4 4-4" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 4l4 4-4 4" />
            </svg>
          )}
        </span>
        <span style={styles.groupName}>{group.name}</span>
        <span style={styles.groupCount}>{group.problems.length}</span>
      </div>

      {/* Group Content */}
      {group.expanded && (
        <div style={styles.groupContent}>
          {group.problems.map((problem) => (
            <div
              key={problem.id}
              onContextMenu={(e) => onContextMenu(e, problem)}
            >
              <ProblemItem
                problem={problem}
                isSelected={selectedProblemId === problem.id}
                onClick={onProblemClick}
                onQuickFix={onQuickFix}
                onCopyMessage={onCopyMessage}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#1e1e1e',
    borderTop: '1px solid #2d2d2d',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    color: '#cccccc',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    backgroundColor: '#252526',
    borderBottom: '1px solid #2d2d2d',
  },
  title: {
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: '#cccccc',
  },
  count: {
    fontSize: '11px',
    color: '#858585',
  },
  countSeparator: {
    margin: '0 4px',
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: '16px',
    color: '#858585',
  },
  emptyText: {
    fontSize: '13px',
    textAlign: 'center',
    maxWidth: '300px',
  },
  list: {
    paddingBottom: '8px',
  },
  group: {
    borderBottom: '1px solid #2d2d2d',
  },
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    backgroundColor: '#252526',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background-color 0.15s',
  },
  groupToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    color: '#858585',
  },
  groupName: {
    flex: 1,
    fontSize: '12px',
    fontWeight: 500,
    color: '#cccccc',
  },
  groupCount: {
    fontSize: '11px',
    color: '#858585',
    backgroundColor: '#3c3c3c',
    padding: '2px 6px',
    borderRadius: '10px',
  },
  groupContent: {
    backgroundColor: '#1e1e1e',
  },
  contextMenu: {
    position: 'fixed',
    backgroundColor: '#3c3c3c',
    border: '1px solid #505050',
    borderRadius: '4px',
    padding: '4px 0',
    minWidth: '150px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    zIndex: 1000,
  },
  contextMenuItem: {
    padding: '6px 12px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#cccccc',
    transition: 'background-color 0.15s',
  },
  contextMenuSeparator: {
    height: '1px',
    backgroundColor: '#505050',
    margin: '4px 0',
  },
};

export default ProblemsPanel;
