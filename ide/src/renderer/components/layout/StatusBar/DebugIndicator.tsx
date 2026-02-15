/**
 * @fileoverview Debug indicator component
 * @module renderer/components/layout/StatusBar/DebugIndicator
 */

import React from 'react';

export interface DebugIndicatorProps {
  className?: string;
}

export const DebugIndicator: React.FC<DebugIndicatorProps> = ({ className = '' }) => {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    backgroundColor: '#cc6633',
    borderRadius: '3px',
    fontWeight: 500,
  };

  const iconStyles: React.CSSProperties = {
    color: '#ff6b6b',
    fontSize: '10px',
  };

  return (
    <div className={`statusbar-debug ${className}`} style={containerStyles}>
      <span style={iconStyles}>●</span>
      <span>Debugging</span>
    </div>
  );
};

export default DebugIndicator;
