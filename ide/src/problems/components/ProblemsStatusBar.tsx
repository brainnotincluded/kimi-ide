/**
 * Problems Status Bar Component
 * IDE Kimi IDE - Status bar indicator for problems count
 */

import React from 'react';
import { ProblemsCount } from '../types';

interface ProblemsStatusBarProps {
  counts: ProblemsCount;
  onClick?: () => void;
  isActive?: boolean;
}

export const ProblemsStatusBar: React.FC<ProblemsStatusBarProps> = ({
  counts,
  onClick,
  isActive = false,
}) => {
  const hasErrors = counts.errors > 0;
  const hasWarnings = counts.warnings > 0;
  const hasInfo = counts.information > 0;

  if (!hasErrors && !hasWarnings && !hasInfo) {
    return null;
  }

  return (
    <button
      style={{
        ...styles.container,
        ...(isActive ? styles.active : {}),
      }}
      onClick={onClick}
      title="Show Problems Panel"
    >
      {/* Error Icon & Count */}
      {hasErrors && (
        <span style={styles.item}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="#f44336">
            <circle cx="8" cy="8" r="7" stroke="#f44336" strokeWidth="1.5" fill="none" />
            <line x1="5" y1="5" x2="11" y2="11" stroke="#f44336" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="11" y1="5" x2="5" y2="11" stroke="#f44336" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span style={{ ...styles.count, color: '#f44336' }}>{counts.errors}</span>
        </span>
      )}

      {/* Warning Icon & Count */}
      {hasWarnings && (
        <span style={styles.item}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 2L14 13H2L8 2Z"
              stroke="#ff9800"
              strokeWidth="1.5"
              strokeLinejoin="round"
              fill="none"
            />
            <line x1="8" y1="6" x2="8" y2="9" stroke="#ff9800" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="11.5" r="0.75" fill="#ff9800" />
          </svg>
          <span style={{ ...styles.count, color: '#ff9800' }}>{counts.warnings}</span>
        </span>
      )}

      {/* Info Icon & Count */}
      {hasInfo && !hasErrors && !hasWarnings && (
        <span style={styles.item}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="7" stroke="#2196f3" strokeWidth="1.5" />
            <line x1="8" y1="7" x2="8" y2="11" stroke="#2196f3" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="8" cy="4.5" r="0.75" fill="#2196f3" />
          </svg>
          <span style={{ ...styles.count, color: '#2196f3' }}>{counts.information}</span>
        </span>
      )}
    </button>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '2px 8px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '3px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
    color: '#cccccc',
  },
  active: {
    backgroundColor: '#37373d',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  count: {
    fontSize: '12px',
    fontWeight: 500,
    minWidth: '16px',
    textAlign: 'center',
  },
};

export default ProblemsStatusBar;
