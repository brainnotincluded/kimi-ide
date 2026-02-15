/**
 * @fileoverview AI status component
 * @module renderer/components/layout/StatusBar/AIStatus
 */

import React from 'react';

export interface AIStatusProps {
  connected: boolean;
}

export const AIStatus: React.FC<AIStatusProps> = ({ connected }) => {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '3px',
    cursor: 'pointer',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  };

  const dotStyles: React.CSSProperties = {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: connected ? '#4ade80' : '#ef4444',
  };

  const iconStyles: React.CSSProperties = {
    width: '12px',
    height: '12px',
  };

  return (
    <div 
      className="statusbar-ai" 
      style={containerStyles}
      title={connected ? 'AI Connected' : 'AI Disconnected'}
    >
      <div style={dotStyles} />
      <svg style={iconStyles} viewBox="0 0 16 16" fill="currentColor">
        <path d="M9.793 2.143a.75.75 0 01-.351.92 7.3 7.3 0 00-.805.408.75.75 0 01-1.077-.64V2.047a.75.75 0 01.502-.708 8.13 8.13 0 011.457-.387.75.75 0 01.274 1.191zM7.534 4.232a.75.75 0 01-.526.919 9.9 9.9 0 00-1.135.41.75.75 0 11-.612-1.37c.407-.18.82-.338 1.24-.473a.75.75 0 011.033.514zM5.236 7.093a.75.75 0 11.612 1.37c-.42.135-.833.293-1.24.473a.75.75 0 11-.612-1.37c.385-.151.773-.28 1.168-.387a.75.75 0 01.072-.086zM3.674 10.374a.75.75 0 01-.275-1.025 8.137 8.137 0 011.085-1.365.75.75 0 011.1 1.02 6.636 6.636 0 00-.886 1.115.75.75 0 01-1.024.255zM2.182 13.544a.75.75 0 01.336-.93 6.35 6.35 0 001.353-1.02.75.75 0 111.036 1.083 7.85 7.85 0 01-1.67 1.261.75.75 0 01-1.055-.394z"/>
        <path d="M7.354 15.854a.5.5 0 00.707 0l3-3a.5.5 0 00-.707-.707L8 14.293V4.5a.5.5 0 00-1 0v9.793l-2.354-2.146a.5.5 0 00-.707.707l3 3z"/>
      </svg>
      <span style={{ fontSize: '11px', fontWeight: 500 }}>AI</span>
    </div>
  );
};

export default AIStatus;
