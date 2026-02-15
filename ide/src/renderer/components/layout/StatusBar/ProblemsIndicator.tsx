/**
 * @fileoverview Problems indicator component
 * @module renderer/components/layout/StatusBar/ProblemsIndicator
 */

import React from 'react';
import type { ProblemsCount } from '../../../../shared/types';

export interface ProblemsIndicatorProps {
  count: ProblemsCount;
}

export const ProblemsIndicator: React.FC<ProblemsIndicatorProps> = ({ count }) => {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const errorStyles: React.CSSProperties = {
    color: '#ff6b6b',
    fontWeight: 500,
  };

  const warningStyles: React.CSSProperties = {
    color: '#f1c40f',
    fontWeight: 500,
  };

  return (
    <div className="statusbar-problems" style={containerStyles}>
      {count.errors > 0 && (
        <span style={errorStyles}>{count.errors} Errors</span>
      )}
      {count.warnings > 0 && (
        <span style={warningStyles}>{count.warnings} Warnings</span>
      )}
    </div>
  );
};

export default ProblemsIndicator;
