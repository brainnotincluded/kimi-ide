/**
 * @fileoverview StatusBar layout component (main entry)
 * @module renderer/components/layout/StatusBar
 */

import React from 'react';
import { GitStatus } from './GitStatus';
import { CursorPosition } from './CursorPosition';
import { AIStatus } from './AIStatus';
import { ProblemsIndicator } from './ProblemsIndicator';
import { DebugIndicator } from './DebugIndicator';
import type { GitInfo, CursorPosition as CursorPos, ProblemsCount } from '../../../../shared/types';

export interface StatusBarProps {
  activeFile?: string | null;
  fileType?: string | null;
  cursorPosition?: CursorPos;
  gitInfo?: GitInfo | null;
  aiConnected?: boolean;
  problemsCount?: ProblemsCount;
  isDebugging?: boolean;
  encoding?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  activeFile,
  fileType,
  cursorPosition,
  gitInfo,
  aiConnected = true,
  problemsCount,
  isDebugging = false,
  encoding = 'UTF-8',
}) => {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '24px',
    padding: '0 12px',
    backgroundColor: '#007acc',
    fontSize: '12px',
    color: '#ffffff',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    userSelect: 'none',
  };

  const sectionStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  };

  const separatorStyles: React.CSSProperties = {
    color: 'rgba(255, 255, 255, 0.5)',
  };

  return (
    <div className="statusbar" style={containerStyles}>
      {/* Left Section */}
      <div style={sectionStyles}>
        {isDebugging && <DebugIndicator />}
        {problemsCount && (problemsCount.errors > 0 || problemsCount.warnings > 0) && (
          <ProblemsIndicator count={problemsCount} />
        )}
        {gitInfo && <GitStatus info={gitInfo} />}
      </div>

      {/* Center Section */}
      <div style={sectionStyles}>
        {activeFile && fileType && (
          <>
            <span>{fileType}</span>
            <span style={separatorStyles}>|</span>
            <span>{encoding}</span>
            <span style={separatorStyles}>|</span>
            {cursorPosition && (
              <CursorPosition line={cursorPosition.line} column={cursorPosition.column} />
            )}
          </>
        )}
      </div>

      {/* Right Section */}
      <div style={sectionStyles}>
        <AIStatus connected={aiConnected} />
      </div>
    </div>
  );
};

export default StatusBar;
