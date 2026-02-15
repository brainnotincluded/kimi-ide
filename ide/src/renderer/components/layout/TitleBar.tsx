/**
 * @fileoverview TitleBar layout component
 * @module renderer/components/layout/TitleBar
 */

import React from 'react';

export interface TitleBarProps {
  workspaceName?: string | null;
  onOpenFolder?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  workspaceName,
  onOpenFolder,
}) => {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '38px',
    padding: '0 12px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #3c3c3c',
    WebkitAppRegion: 'drag', // Make draggable on macOS
    userSelect: 'none',
  };

  const leftStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    WebkitAppRegion: 'no-drag',
  };

  const logoStyles: React.CSSProperties = {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    backgroundColor: '#007acc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#ffffff',
  };

  const appNameStyles: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#cccccc',
  };

  const menuStyles: React.CSSProperties = {
    display: 'flex',
    gap: '4px',
    marginLeft: '16px',
  };

  const menuItemStyles: React.CSSProperties = {
    padding: '4px 8px',
    fontSize: '12px',
    color: '#cccccc',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  };

  const centerStyles: React.CSSProperties = {
    fontSize: '12px',
    color: '#969696',
    WebkitAppRegion: 'drag',
  };

  const rightStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    WebkitAppRegion: 'no-drag',
  };

  const buttonStyles: React.CSSProperties = {
    padding: '4px 12px',
    fontSize: '12px',
    color: '#ffffff',
    backgroundColor: '#0e639c',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  };

  return (
    <div className="titlebar" style={containerStyles}>
      <div style={leftStyles}>
        <div style={logoStyles}>T</div>
        <span style={appNameStyles}>Kimi IDE</span>
        <div style={menuStyles}>
          {['File', 'Edit', 'View', 'Go', 'Run', 'Terminal', 'Help'].map((item) => (
            <button key={item} style={menuItemStyles} className="menu-item">
              {item}
            </button>
          ))}
        </div>
      </div>
      <div style={centerStyles}>
        {workspaceName || 'Welcome'}
      </div>
      <div style={rightStyles}>
        {onOpenFolder && (
          <button style={buttonStyles} onClick={onOpenFolder}>
            Open Folder
          </button>
        )}
      </div>
    </div>
  );
};

export default TitleBar;
