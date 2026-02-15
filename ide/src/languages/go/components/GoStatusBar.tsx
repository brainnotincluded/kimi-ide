/**
 * Go Status Bar Component
 * 
 * Displays Go version, status, and quick action buttons
 */

import React, { useState, useEffect, useCallback } from 'react';
import { GoLanguageProvider } from '../provider';
import { GoInstallation, GoToolsStatus } from '../types';

interface GoStatusBarProps {
  provider: GoLanguageProvider;
  onRun?: () => void;
  onBuild?: () => void;
  onTest?: () => void;
}

export const GoStatusBar: React.FC<GoStatusBarProps> = ({
  provider,
  onRun,
  onBuild,
  onTest
}) => {
  const [installation, setInstallation] = useState<GoInstallation | null>(null);
  const [toolsStatus, setToolsStatus] = useState<GoToolsStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkInstallation();
    
    // Listen for installation changes
    provider.on('installationChecked', setInstallation);
    
    return () => {
      provider.removeListener('installationChecked', setInstallation);
    };
  }, [provider]);

  const checkInstallation = async () => {
    const install = await provider.checkGoInstallation();
    setInstallation(install);
    
    const tools = await provider.getToolsStatus();
    setToolsStatus(tools);
  };

  const handleBuild = async () => {
    setIsLoading(true);
    try {
      await onBuild?.();
    } finally {
      setIsLoading(false);
    }
  };

  const handleRun = async () => {
    setIsLoading(true);
    try {
      await onRun?.();
    } finally {
      setIsLoading(false);
    }
  };

  const handleTest = async () => {
    setIsLoading(true);
    try {
      await onTest?.();
    } finally {
      setIsLoading(false);
    }
  };

  const handleModTidy = async () => {
    setIsLoading(true);
    try {
      await provider.goModTidy();
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormat = async () => {
    setIsLoading(true);
    try {
      // Format all Go files in project
      await provider.runGo('fmt', ['./...']);
    } finally {
      setIsLoading(false);
    }
  };

  const getVersionColor = () => {
    if (!installation) return '#888';
    if (installation.version === 'not installed') return '#f44336';
    const major = parseInt(installation.version.split('.')[0]);
    if (major >= 1 && parseInt(installation.version.split('.')[1] || '0') >= 21) return '#4caf50';
    return '#ff9800';
  };

  return (
    <div style={styles.container}>
      <div style={styles.leftSection}>
        {/* Go Version Badge */}
        <div 
          style={{
            ...styles.versionBadge,
            borderColor: getVersionColor()
          }}
          onClick={() => setShowDetails(!showDetails)}
          title="Click to toggle details"
        >
          <span style={{ ...styles.versionIcon, color: getVersionColor() }}>Go</span>
          <span style={styles.versionText}>
            {installation ? installation.version : 'Checking...'}
          </span>
          {toolsStatus?.gopls && (
            <span style={styles.goplsIndicator} title="gopls connected">●</span>
          )}
        </div>

        {/* Action Buttons */}
        <div style={styles.buttonGroup}>
          <button
            style={{
              ...styles.actionButton,
              ...(isLoading ? styles.buttonDisabled : {})
            }}
            onClick={handleRun}
            disabled={isLoading}
            title="Run (go run)"
          >
            <span style={styles.buttonIcon}>▶</span>
            Run
          </button>
          
          <button
            style={{
              ...styles.actionButton,
              ...(isLoading ? styles.buttonDisabled : {})
            }}
            onClick={handleBuild}
            disabled={isLoading}
            title="Build (go build)"
          >
            <span style={styles.buttonIcon}>🔨</span>
            Build
          </button>
          
          <button
            style={{
              ...styles.actionButton,
              ...(isLoading ? styles.buttonDisabled : {})
            }}
            onClick={handleTest}
            disabled={isLoading}
            title="Test (go test)"
          >
            <span style={styles.buttonIcon}>🧪</span>
            Test
          </button>
        </div>

        {/* Utility Buttons */}
        <div style={styles.buttonGroup}>
          <button
            style={styles.utilButton}
            onClick={handleFormat}
            disabled={isLoading}
            title="Format (gofmt)"
          >
            Format
          </button>
          
          <button
            style={styles.utilButton}
            onClick={handleModTidy}
            disabled={isLoading}
            title="Go Mod Tidy"
          >
            Tidy
          </button>
        </div>
      </div>

      <div style={styles.rightSection}>
        {isLoading && (
          <div style={styles.spinner}>
            <div style={styles.spinnerInner} />
          </div>
        )}
      </div>

      {/* Details Panel */}
      {showDetails && installation && (
        <div style={styles.detailsPanel}>
          <div style={styles.detailsContent}>
            <h4 style={styles.detailsTitle}>Go Environment</h4>
            
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>Version:</span>
              <span style={styles.detailValue}>{installation.version}</span>
            </div>
            
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>GOROOT:</span>
              <span style={styles.detailValue}>{installation.goroot || 'Not set'}</span>
            </div>
            
            <div style={styles.detailRow}>
              <span style={styles.detailLabel}>GOPATH:</span>
              <span style={styles.detailValue}>{installation.gopath || 'Not set'}</span>
            </div>

            {toolsStatus && (
              <>
                <h4 style={styles.detailsTitle}>Tools Status</h4>
                <div style={styles.toolsGrid}>
                  {Object.entries(toolsStatus).map(([tool, installed]) => (
                    <div key={tool} style={styles.toolItem}>
                      <span style={{
                        ...styles.toolStatus,
                        color: installed ? '#4caf50' : '#f44336'
                      }}>
                        {installed ? '✓' : '✗'}
                      </span>
                      <span style={styles.toolName}>{tool}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 12px',
    backgroundColor: '#1e1e1e',
    borderTop: '1px solid #333',
    fontSize: '12px',
    color: '#ccc',
    position: 'relative'
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  rightSection: {
    display: 'flex',
    alignItems: 'center'
  },
  versionBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '2px 8px',
    borderRadius: '3px',
    border: '1px solid #555',
    backgroundColor: '#2d2d2d',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  versionIcon: {
    fontWeight: 'bold',
    fontSize: '11px'
  },
  versionText: {
    fontFamily: 'monospace'
  },
  goplsIndicator: {
    color: '#4caf50',
    fontSize: '8px'
  },
  buttonGroup: {
    display: 'flex',
    gap: '4px'
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 10px',
    border: 'none',
    borderRadius: '3px',
    backgroundColor: '#0e639c',
    color: '#fff',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed'
  },
  buttonIcon: {
    fontSize: '10px'
  },
  utilButton: {
    padding: '3px 10px',
    border: '1px solid #555',
    borderRadius: '3px',
    backgroundColor: '#2d2d2d',
    color: '#ccc',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  },
  spinner: {
    width: '14px',
    height: '14px',
    position: 'relative'
  },
  spinnerInner: {
    width: '100%',
    height: '100%',
    border: '2px solid #333',
    borderTopColor: '#0e639c',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  detailsPanel: {
    position: 'absolute',
    bottom: '100%',
    left: '10px',
    backgroundColor: '#252526',
    border: '1px solid #454545',
    borderRadius: '4px',
    padding: '12px',
    minWidth: '300px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
    zIndex: 1000
  },
  detailsContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  detailsTitle: {
    margin: '0 0 8px 0',
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#fff',
    borderBottom: '1px solid #454545',
    paddingBottom: '4px'
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '11px'
  },
  detailLabel: {
    color: '#888'
  },
  detailValue: {
    color: '#ccc',
    fontFamily: 'monospace',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  toolsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '6px'
  },
  toolItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px'
  },
  toolStatus: {
    fontWeight: 'bold'
  },
  toolName: {
    color: '#ccc'
  }
};

// Add keyframes for spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);

export default GoStatusBar;
