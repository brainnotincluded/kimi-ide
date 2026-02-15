/**
 * Problem Item Component
 * IDE Kimi IDE - Single problem item in the problems panel
 */

import React, { useState, useCallback } from 'react';
import { ProblemItemData, CodeAction, severityToLabel } from '../types';
import { ProblemIcon } from './ProblemIcon';
import { DiagnosticSeverity } from '../../languages/core/types';

interface ProblemItemProps {
  problem: ProblemItemData;
  isSelected?: boolean;
  onClick?: (problem: ProblemItemData) => void;
  onQuickFix?: (problem: ProblemItemData, action: CodeAction) => void;
  onCopyMessage?: (message: string) => void;
  style?: React.CSSProperties;
}

export const ProblemItem: React.FC<ProblemItemProps> = ({
  problem,
  isSelected = false,
  onClick,
  onQuickFix,
  onCopyMessage,
  style,
}) => {
  const [showActions, setShowActions] = useState(false);
  const [codeActions, setCodeActions] = useState<CodeAction[]>([]);
  const [isLoadingActions, setIsLoadingActions] = useState(false);

  const handleClick = useCallback(() => {
    onClick?.(problem);
  }, [onClick, problem]);

  const handleMouseEnter = useCallback(async () => {
    setShowActions(true);
    if (codeActions.length === 0 && !isLoadingActions) {
      setIsLoadingActions(true);
      try {
        // Import dynamically to avoid circular dependency
        const { getCodeActions } = await import('../renderer-ipc');
        const actions = await getCodeActions(problem.file, problem.diagnostic.range);
        setCodeActions(actions.filter((a) => a.kind === 'quickfix'));
      } finally {
        setIsLoadingActions(false);
      }
    }
  }, [problem, codeActions.length, isLoadingActions]);

  const handleMouseLeave = useCallback(() => {
    setShowActions(false);
  }, []);

  const handleQuickFix = useCallback(
    (action: CodeAction) => {
      onQuickFix?.(problem, action);
    },
    [onQuickFix, problem]
  );

  const handleCopyMessage = useCallback(() => {
    onCopyMessage?.(problem.diagnostic.message);
  }, [onCopyMessage, problem.diagnostic.message]);

  const severityLabel = severityToLabel(problem.diagnostic.severity);
  const hasQuickFix = codeActions.length > 0;

  return (
    <div
      style={{
        ...styles.container,
        ...(isSelected ? styles.selected : {}),
        ...style,
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Severity Icon */}
      <div style={styles.iconContainer}>
        <ProblemIcon severity={problem.diagnostic.severity} size={16} />
      </div>

      {/* Problem Content */}
      <div style={styles.content}>
        {/* Message */}
        <div style={styles.message} title={problem.diagnostic.message}>
          {problem.diagnostic.message}
        </div>

        {/* Metadata */}
        <div style={styles.metadata}>
          <span style={styles.source}>{problem.source}</span>
          {problem.code && (
            <>
              <span style={styles.separator}>·</span>
              <span style={styles.code}>{problem.code}</span>
            </>
          )}
          <span style={styles.separator}>·</span>
          <span style={styles.location}>
            {problem.relativeFile}:{problem.line}:{problem.column + 1}
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      {showActions && (
        <div style={styles.actions}>
          {hasQuickFix && (
            <button
              style={styles.actionButton}
              onClick={(e) => {
                e.stopPropagation();
                handleQuickFix(codeActions[0]);
              }}
              title="Quick Fix"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm10.28-1.72-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.75.75 0 0 1 1.06-1.06l1.47 1.47 3.97-3.97a.75.75 0 0 1 1.06 1.06Z" />
              </svg>
            </button>
          )}
          <button
            style={styles.actionButton}
            onClick={(e) => {
              e.stopPropagation();
              handleCopyMessage();
            }}
            title="Copy Message"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '6px 12px',
    cursor: 'pointer',
    borderBottom: '1px solid #2d2d2d',
    transition: 'background-color 0.15s',
    fontSize: '13px',
    lineHeight: '1.4',
  },
  selected: {
    backgroundColor: '#37373d',
  },
  iconContainer: {
    flexShrink: 0,
    marginRight: '8px',
    marginTop: '1px',
  },
  content: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  message: {
    color: '#cccccc',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  metadata: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '2px',
    fontSize: '11px',
    color: '#858585',
  },
  source: {
    color: '#9cdcfe',
  },
  code: {
    color: '#ce9178',
    fontFamily: 'monospace',
  },
  location: {
    color: '#858585',
  },
  separator: {
    color: '#555555',
  },
  actions: {
    display: 'flex',
    gap: '4px',
    marginLeft: '8px',
    opacity: 0.8,
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    padding: 0,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '3px',
    color: '#858585',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
};

export default ProblemItem;
