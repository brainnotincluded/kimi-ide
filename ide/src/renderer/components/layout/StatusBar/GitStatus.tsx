/**
 * @fileoverview Git status component
 * @module renderer/components/layout/StatusBar/GitStatus
 */

import React from 'react';
import type { GitInfo } from '../../../../shared/types';

export interface GitStatusProps {
  info: GitInfo;
}

export const GitStatus: React.FC<GitStatusProps> = ({ info }) => {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '3px',
    transition: 'background-color 0.15s',
  };

  const iconStyles: React.CSSProperties = {
    width: '14px',
    height: '14px',
  };

  const changesBadgeStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    color: '#f1c40f',
  };

  const dotStyles: React.CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: '#f1c40f',
  };

  return (
    <div className="statusbar-git" style={containerStyles}>
      <svg style={iconStyles} viewBox="0 0 16 16" fill="currentColor">
        <path d="M4.72 3.22a.75.75 0 011.06 1.06L2.06 8l3.72 3.72a.75.75 0 11-1.06 1.06L.47 8.53a.75.75 0 010-1.06l4.25-4.25zm6.56 0a.75.75 0 10-1.06 1.06L13.94 8l-3.72 3.72a.75.75 0 101.06 1.06l4.25-4.25a.75.75 0 000-1.06l-4.25-4.25z"/>
      </svg>
      <span>{info.branch}</span>
      {info.changes > 0 && (
        <span style={changesBadgeStyles}>
          <span style={dotStyles} />
          {info.changes}
        </span>
      )}
    </div>
  );
};

export default GitStatus;
