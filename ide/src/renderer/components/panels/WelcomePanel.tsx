/**
 * @fileoverview Welcome panel component
 * @module renderer/components/panels/WelcomePanel
 */

import React from 'react';

export interface WelcomePanelProps {
  onOpenFolder?: () => void;
}

export const WelcomePanel: React.FC<WelcomePanelProps> = ({ onOpenFolder }) => {
  const containerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: '#1e1e1e',
    color: '#cccccc',
  };

  const contentStyles: React.CSSProperties = {
    textAlign: 'center',
  };

  const ringContainerStyles: React.CSSProperties = {
    position: 'relative',
    width: '200px',
    height: '200px',
    margin: '0 auto 32px',
  };

  const ringStyles = (size: number, delay: number): React.CSSProperties => ({
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: '50%',
    border: '1px solid rgba(0, 122, 204, 0.3)',
    animation: `pulse 2s ease-in-out ${delay}s infinite`,
  });

  const logoStyles: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '80px',
    height: '80px',
    borderRadius: '16px',
    backgroundColor: '#007acc',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '40px',
    fontWeight: 'bold',
    color: '#ffffff',
    boxShadow: '0 4px 20px rgba(0, 122, 204, 0.4)',
  };

  const titleStyles: React.CSSProperties = {
    fontSize: '32px',
    fontWeight: 300,
    marginBottom: '8px',
    color: '#ffffff',
  };

  const subtitleStyles: React.CSSProperties = {
    fontSize: '16px',
    color: '#858585',
    marginBottom: '32px',
  };

  const buttonStyles: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    fontSize: '14px',
    color: '#ffffff',
    backgroundColor: '#0e639c',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  };

  const shortcutsStyles: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    marginTop: '48px',
  };

  const shortcutStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: '#858585',
  };

  const kbdStyles: React.CSSProperties = {
    padding: '2px 6px',
    fontFamily: 'inherit',
    fontSize: '11px',
    backgroundColor: '#3c3c3c',
    border: '1px solid #555555',
    borderRadius: '3px',
  };

  return (
    <div className="welcome-panel" style={containerStyles}>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.6; transform: translate(-50%, -50%) scale(1.05); }
        }
      `}</style>
      <div style={contentStyles}>
        <div style={ringContainerStyles}>
          <div style={ringStyles(200, 0)} />
          <div style={ringStyles(160, 0.5)} />
          <div style={ringStyles(120, 1)} />
          <div style={logoStyles}>T</div>
        </div>
        
        <h1 style={titleStyles}>Kimi IDE</h1>
        <p style={subtitleStyles}>Code Editor</p>
        
        {onOpenFolder && (
          <button style={buttonStyles} onClick={onOpenFolder}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Open Folder
          </button>
        )}

        <div style={shortcutsStyles}>
          <div style={shortcutStyles}>
            <kbd style={kbdStyles}>Cmd</kbd>
            <kbd style={kbdStyles}>O</kbd>
            <span>Open</span>
          </div>
          <div style={shortcutStyles}>
            <kbd style={kbdStyles}>Cmd</kbd>
            <kbd style={kbdStyles}>J</kbd>
            <span>Terminal</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePanel;
